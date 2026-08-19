import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { hasSupabaseConfig, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/use-notifications";
import type { Patient, PatientSystems, PatientMedications } from "@/types/patient";
import type { PatientTodosMap } from "@/hooks/useAllPatientTodos";
import type { Database } from "@/integrations/supabase/types";
import { QUERY_KEYS } from "@/lib/cache/cacheConfig";
import { prepareUpdateData } from "@/lib/mappers/patientMapper";
import {
    buildPatientInsertPayload,
    mapPatientRecord,
    shouldTrackTimestamp,
} from "@/services/patientService";
import {
    deletePatientImageObjects,
    diffPatientImageObjectKeys,
    extractPatientImageObjectKeys,
} from "@/lib/patientImages";
import { logError, logWarn } from "@/lib/observability/logger";
import {
    recordPatientMutationMetrics,
    type PatientMutationOutcome,
} from "@/lib/observability/operationalMetrics";
import { indexedDBQueue, type QueuedMutation } from "@/lib/offline/indexedDBQueue";
import { CircuitOpenError } from "@/lib/circuitBreaker";
import { isBrowserKnownOffline } from "@/lib/networkConnectivity";

export interface PatientMutationsDeps {
    patientsRef: React.MutableRefObject<Patient[]>;
    setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
    patientCounter: number;
    setPatientCounter: React.Dispatch<React.SetStateAction<number>>;
    fetchPatients: (options?: { force?: boolean }) => Promise<void>;
}

type PatientUpdateRow = Database["public"]["Tables"]["patients"]["Update"];

export type PatientSaveState = "idle" | "saving" | "saved" | "queued" | "conflict" | "error";

export function reconcilePatientSaveStates(
    current: Readonly<Record<string, PatientSaveState>>,
    queue: readonly QueuedMutation[],
): { states: Record<string, PatientSaveState>; drained: string[]; failed: string[] } {
    const activeByPatient = new Map<string, QueuedMutation>();
    for (const mutation of queue) {
        if (
            mutation.type !== "patient"
            || mutation.table !== "patients"
            || mutation.operation !== "update"
            || !mutation.entityId
            || mutation.status === "completed"
        ) continue;
        activeByPatient.set(mutation.entityId, mutation);
    }

    const states = { ...current };
    const drained: string[] = [];
    const failed: string[] = [];
    for (const [patientId, state] of Object.entries(current)) {
        if (state !== "queued") continue;
        if (!activeByPatient.has(patientId)) {
            states[patientId] = "saved";
            drained.push(patientId);
        }
    }
    for (const [patientId, mutation] of activeByPatient) {
        if (mutation.status === "failed") {
            states[patientId] = "error";
            failed.push(patientId);
        } else if (mutation.status === "conflict") {
            states[patientId] = "conflict";
        } else {
            states[patientId] = "queued";
        }
    }

    return { states, drained, failed };
}

class PatientWriteConflictError extends Error {
    constructor() {
        super("Patient changed in another tab or device");
        this.name = "PatientWriteConflictError";
    }
}

function isBrowserOffline(): boolean {
    return isBrowserKnownOffline();
}

function isRetryablePatientWriteError(error: unknown): boolean {
    if (error instanceof PatientWriteConflictError) return false;
    const candidate = error as { status?: number; code?: string; message?: string; cause?: unknown } | null;
    const status = candidate?.status;
    if (status === 408 || status === 429 || (typeof status === "number" && status >= 500)) return true;
    const message = candidate?.message?.toLowerCase() ?? "";
    if (error instanceof TypeError || /network|fetch|timeout|connection|temporar/.test(message)) return true;
    // The API circuit breaker opens on transient connectivity/backend failures
    // — exactly the writes the durable offline queue exists to protect.
    // apiFetch wraps CircuitOpenError in an ApiError, so check both the error
    // and its cause.
    if (error instanceof CircuitOpenError || candidate?.cause instanceof CircuitOpenError) return true;
    // While the browser reports offline, any failure without an HTTP status is
    // connectivity-driven and queueable. (Strict === false: outside browsers
    // navigator.onLine is undefined, not offline.)
    return isBrowserOffline() && typeof status !== "number";
}

function collectReferencedPatientImageKeys(
    patients: ReadonlyArray<Pick<Patient, "imaging">>,
    ownerId: string,
): Set<string> {
    return new Set(
        patients.flatMap((patient) => extractPatientImageObjectKeys(patient.imaging, ownerId)),
    );
}

function restoreUpdatedField(
    currentPatient: Patient,
    previousPatient: Patient,
    field: string,
    tracked: boolean,
    optimisticTimestamp: string,
): Patient {
    const restoredPatient: Patient = { ...currentPatient };

    if (field.includes(".")) {
        const [parent, child] = field.split(".");
        if (parent === "systems") {
            restoredPatient.systems = {
                ...currentPatient.systems,
                [child]: previousPatient.systems[child as keyof PatientSystems],
            };
        } else if (parent === "medications") {
            restoredPatient.medications = {
                ...currentPatient.medications,
                [child]: previousPatient.medications[child as keyof PatientMedications],
            } as PatientMedications;
        }
    } else if (field === "medications") {
        restoredPatient.medications = previousPatient.medications;
    } else {
        (restoredPatient as unknown as Record<string, unknown>)[field] =
            (previousPatient as unknown as Record<string, unknown>)[field];
    }

    if (tracked) {
        const timestamps = {
            ...currentPatient.fieldTimestamps,
        } as Record<string, string | undefined>;
        const previousTimestamp = (
            previousPatient.fieldTimestamps as Record<string, string | undefined>
        )[field];
        if (previousTimestamp === undefined) delete timestamps[field];
        else timestamps[field] = previousTimestamp;
        restoredPatient.fieldTimestamps = timestamps;
    }

    if (currentPatient.lastModified === optimisticTimestamp) {
        restoredPatient.lastModified = previousPatient.lastModified;
    }

    return restoredPatient;
}

function setPatientListCache(queryClient: QueryClient, ownerId: string, patients: Patient[]) {
    queryClient.setQueryData<Patient[]>(QUERY_KEYS.patientList(ownerId), patients);
}

function removePatientScopedCaches(queryClient: QueryClient, ownerId: string, patientId: string) {
    queryClient.removeQueries({
        queryKey: QUERY_KEYS.patientTodosForOwner(ownerId, patientId),
        exact: true,
    });
    queryClient.setQueriesData<PatientTodosMap>(
        { queryKey: [...QUERY_KEYS.allTodos, ownerId] },
        (currentMap) => {
            if (!currentMap || !Object.prototype.hasOwnProperty.call(currentMap, patientId)) {
                return currentMap;
            }

            const { [patientId]: _removed, ...remainingTodos } = currentMap;
            return remainingTodos;
        }
    );
}

/**
 * Handles add / update / remove / duplicate / collapse / clear operations on patients.
 */
export function usePatientMutations({
    patientsRef,
    setPatients,
    patientCounter,
    setPatientCounter,
    fetchPatients,
}: PatientMutationsDeps) {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const notifications = useNotifications();
    const activeOwnerIdRef = React.useRef<string | null>(user?.id ?? null);
    activeOwnerIdRef.current = user?.id ?? null;
    const fieldUpdateVersionRef = React.useRef(new Map<string, number>());
    const patientUpdateVersionRef = React.useRef(new Map<string, number>());
    const patientWriteChainsRef = React.useRef(new Map<string, Promise<void>>());
    const patientServerRevisionRef = React.useRef(new Map<string, number>());
    const queuedNoticeKeysRef = React.useRef(new Set<string>());
    const patientConflictBlockedThroughVersionRef = React.useRef(new Map<string, number>());
    const patientConflictRefreshesRef = React.useRef(new Map<string, Promise<void>>());
    const [patientSaveStates, setPatientSaveStates] = React.useState<Record<string, PatientSaveState>>({});

    const setPatientSaveState = React.useCallback((patientId: string, state: PatientSaveState) => {
        setPatientSaveStates((current) => current[patientId] === state
            ? current
            : { ...current, [patientId]: state });
    }, []);

    const isCurrentOwner = React.useCallback(
        (requestOwnerId: string) => activeOwnerIdRef.current === requestOwnerId,
        []
    );

    // Reconcile per-patient save states with the durable offline queue: a
    // queued write that disappears from the queue has drained successfully;
    // one that exhausted its retries surfaces as an error. Without this the
    // header would claim "Offline queued" forever after a successful sync.
    const patientSaveStatesRef = React.useRef(patientSaveStates);
    React.useEffect(() => {
        patientSaveStatesRef.current = patientSaveStates;
    }, [patientSaveStates]);

    React.useEffect(() => {
        patientSaveStatesRef.current = {};
        setPatientSaveStates({});
        queuedNoticeKeysRef.current.clear();
        patientConflictBlockedThroughVersionRef.current.clear();
        patientConflictRefreshesRef.current.clear();
    }, [user?.id]);

    React.useEffect(() => {
        const unsubscribe = indexedDBQueue.subscribe((queue) => {
            const current = patientSaveStatesRef.current;
            const { states, drained, failed } = reconcilePatientSaveStates(current, queue);
            if (Object.keys(states).some((patientId) => states[patientId] !== current[patientId])) {
                patientSaveStatesRef.current = states;
                setPatientSaveStates(states);
            }
            // The replay bumped the server revision outside this hook's write
            // path; drop the cached expected revision and refetch so the next
            // edit does not hit a spurious conflict.
            const ownerId = activeOwnerIdRef.current;
            for (const patientId of [...drained, ...failed]) {
                if (ownerId) {
                    queuedNoticeKeysRef.current.delete(`${ownerId}:${patientId}`);
                }
            }
            for (const patientId of drained) {
                if (ownerId) {
                    patientServerRevisionRef.current.delete(`${ownerId}:${patientId}`);
                }
            }
            if (drained.length > 0) {
                void fetchPatients({ force: true });
            }
        });
        return unsubscribe;
    }, [fetchPatients]);

    const deleteImagesIfUnreferenced = React.useCallback(async (
        candidateKeys: string[],
        requestOwnerId: string,
        localPatients: Patient[],
        notifyOnFailure: boolean,
    ): Promise<void> => {
        if (candidateKeys.length === 0 || !isCurrentOwner(requestOwnerId)) return;

        try {
            const { data, error } = await supabase
                .from("patients")
                .select("imaging")
                .eq("user_id", requestOwnerId);

            if (!isCurrentOwner(requestOwnerId)) return;
            if (error) throw error;

            const serverPatients = (data ?? []).map((row) => ({ imaging: row.imaging ?? "" }));
            const referencedKeys = collectReferencedPatientImageKeys(
                [...localPatients, ...serverPatients],
                requestOwnerId,
            );
            const unreferencedKeys = candidateKeys.filter((key) => !referencedKeys.has(key));
            if (unreferencedKeys.length === 0) return;

            await deletePatientImageObjects(unreferencedKeys, requestOwnerId);
        } catch {
            if (notifyOnFailure && isCurrentOwner(requestOwnerId)) {
                notifications.warning({
                    title: "Image cleanup deferred",
                    description: "The patient record was saved, but one or more unused images still require cleanup.",
                });
            }
        }
    }, [isCurrentOwner, notifications]);

    const commitPatients = React.useCallback((requestOwnerId: string, nextPatients: Patient[]) => {
        if (!isCurrentOwner(requestOwnerId)) return false;
        patientsRef.current = nextPatients;
        setPatients(nextPatients);
        setPatientListCache(queryClient, requestOwnerId, nextPatients);
        return true;
    }, [isCurrentOwner, patientsRef, queryClient, setPatients]);

    const addPatient = React.useCallback(async () => {
        if (!user) {
            notifications.error({
                title: "Not signed in",
                description: "Please sign in to add patients.",
            });
            return;
        }
        const requestOwnerId = user.id;
        if (!hasSupabaseConfig) {
            notifications.error({
                title: "Configuration Error",
                description: "Supabase is not configured. Please check environment variables.",
            });
            return;
        }
        const mutationStartedAt = performance.now();
        let mutationOutcome: PatientMutationOutcome = "error";
        try {
            const nextNumber =
                1 +
                Math.max(0, ...patientsRef.current.map((p) => p.patientNumber ?? 0));
            const { data, error } = await supabase
                .from("patients")
                .insert([buildPatientInsertPayload({
                    userId: requestOwnerId,
                    patientNumber: nextNumber,
                })])
                .select()
                .single();

            if (!isCurrentOwner(requestOwnerId)) return;
            if (error) throw error;
            if (data == null) throw new Error("No data returned from insert");

            const newPatient = mapPatientRecord(data);

            commitPatients(requestOwnerId, [...patientsRef.current, newPatient]);
            setPatientCounter((prev) => Math.max(prev, nextNumber));

            notifications.success({
                title: "Patient Added",
                description: "New patient card created.",
            });
            mutationOutcome = "saved";
        } catch {
            if (!isCurrentOwner(requestOwnerId)) return;
            logError("patient.add.failed");
            notifications.error({
                title: "Error",
                description: "Failed to add patient.",
            });
        } finally {
            if (isCurrentOwner(requestOwnerId)) {
                recordPatientMutationMetrics({
                    operation: "add",
                    outcome: mutationOutcome,
                    durationMs: performance.now() - mutationStartedAt,
                });
            }
        }
    }, [user, notifications, isCurrentOwner, commitPatients, setPatientCounter, patientsRef]);

    const updatePatient = React.useCallback(async (id: string, field: string, value: unknown) => {
        if (!user) return;
        const requestOwnerId = user.id;
        if (!hasSupabaseConfig) {
            notifications.error({
                title: "Configuration Error",
                description: "Supabase is not configured. Please check environment variables.",
            });
            return;
        }

        const patientUpdateKey = `${requestOwnerId}:${id}`;
        const activeConflictRefresh = patientConflictRefreshesRef.current.get(patientUpdateKey);
        if (activeConflictRefresh) {
            await activeConflictRefresh;
            if (!isCurrentOwner(requestOwnerId)) return;
        }

        const isSystemField = field.startsWith('systems.');
        const isMedicationsField = field === 'medications';
        const shouldTrack = shouldTrackTimestamp(field);

        // Get current state from ref to ensure sequential updates see each other
        const currentPatients = [...patientsRef.current];
        const patientIndex = currentPatients.findIndex((p) => p.id === id);

        if (patientIndex === -1) return;

        const mutationStartedAt = performance.now();
        let mutationOutcome: PatientMutationOutcome = "error";
        let shouldRecordMutationMetrics = true;
        const now = new Date().toISOString();
        const shouldQueueWithoutNetwork =
            isBrowserOffline() || patientSaveStatesRef.current[id] === "queued";
        // Every new editor value must leave the previous queued state until the
        // latest value is durably coalesced. Otherwise an earlier keystroke can
        // make the UI claim "Offline queued" while later input is still pending.
        setPatientSaveState(id, "saving");

        const oldPatient = currentPatients[patientIndex];
        const updatedPatient = { ...oldPatient };
        const fieldUpdateKey = `${requestOwnerId}:${id}:${field}`;
        const fieldUpdateVersion = (fieldUpdateVersionRef.current.get(fieldUpdateKey) ?? 0) + 1;
        fieldUpdateVersionRef.current.set(fieldUpdateKey, fieldUpdateVersion);
        const patientUpdateVersion = (patientUpdateVersionRef.current.get(patientUpdateKey) ?? 0) + 1;
        patientUpdateVersionRef.current.set(patientUpdateKey, patientUpdateVersion);
        const imageDelta = field === "imaging" && typeof value === "string"
            ? diffPatientImageObjectKeys(oldPatient.imaging, value, requestOwnerId)
            : null;

        let oldValue: string | null = null;
        if (shouldTrack && !isMedicationsField) {
            if (isSystemField) {
                const systemKey = field.split('.')[1] as keyof PatientSystems;
                oldValue = updatedPatient.systems[systemKey] || null;
            } else {
                oldValue = (updatedPatient[field as keyof typeof updatedPatient] as string) || null;
            }
        }

        updatedPatient.lastModified = now;

        if (shouldTrack) {
            updatedPatient.fieldTimestamps = {
                ...updatedPatient.fieldTimestamps,
                [field]: now,
            };
        }

        if (field.includes(".")) {
            const [parent, child] = field.split(".");
            if (parent === "systems") {
                updatedPatient.systems = { ...updatedPatient.systems, [child]: value };
            } else if (parent === "medications") {
                updatedPatient.medications = { ...updatedPatient.medications, [child]: value };
            }
        } else if (field === "medications") {
            updatedPatient.medications = value as PatientMedications;
        } else {
            (updatedPatient as Record<string, unknown>)[field] = value;
        }

        // Synchronously update the ref so next call sees this change immediately
        currentPatients[patientIndex] = updatedPatient;
        commitPatients(requestOwnerId, currentPatients);

        const updateData = prepareUpdateData(field, value, updatedPatient.systems, updatedPatient.medications) as PatientUpdateRow;
        updateData.last_modified = now;

        if (shouldTrack) {
            updateData.field_timestamps = updatedPatient.fieldTimestamps as PatientUpdateRow["field_timestamps"];
        }

        // Serialize this tab's writes per patient. Each request then compares the
        // revision produced by its predecessor, while other tabs are rejected.
        const previousWrite = patientWriteChainsRef.current.get(patientUpdateKey) ?? Promise.resolve();
        let releaseWrite!: () => void;
        const writeGate = new Promise<void>((resolve) => {
            releaseWrite = resolve;
        });
        const writeChain = previousWrite.catch(() => undefined).then(() => writeGate);
        patientWriteChainsRef.current.set(patientUpdateKey, writeChain);
        await previousWrite.catch(() => undefined);

        const serializeForHistory = (v: unknown): string =>
            typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);
        let persistenceData = updateData;
        let queueAttempted = false;

        const queueLatestPatientUpdate = async (): Promise<boolean> => {
            const isLatestFieldUpdate =
                fieldUpdateVersionRef.current.get(fieldUpdateKey) === fieldUpdateVersion;
            if (!isLatestFieldUpdate) return false;

            queueAttempted = true;
            const wasAlreadyQueued = patientSaveStatesRef.current[id] === "queued";
            await indexedDBQueue.enqueue({
                type: "patient",
                operation: "update",
                table: "patients",
                entityId: id,
                payload: persistenceData as Record<string, unknown>,
                conflictData: {
                    last_modified: oldPatient.lastModified,
                    revision: patientServerRevisionRef.current.get(patientUpdateKey)
                        ?? oldPatient.revision
                        ?? 0,
                },
            });
            setPatientSaveState(id, "queued");
            mutationOutcome = "queued";
            if (
                !wasAlreadyQueued
                && !queuedNoticeKeysRef.current.has(patientUpdateKey)
            ) {
                queuedNoticeKeysRef.current.add(patientUpdateKey);
                notifications.warning({
                    title: "Offline — change queued",
                    description: "Change is stored on this device and will retry when connection recovers.",
                });
            }
            return true;
        };

        try {
            const blockedThroughVersion =
                patientConflictBlockedThroughVersionRef.current.get(patientUpdateKey) ?? 0;
            if (patientUpdateVersion <= blockedThroughVersion) {
                if (imageDelta?.added.length) {
                    const conflictRefresh = patientConflictRefreshesRef.current.get(patientUpdateKey);
                    void (async () => {
                        await conflictRefresh;
                        if (!isCurrentOwner(requestOwnerId)) return;
                        await deleteImagesIfUnreferenced(
                            imageDelta.added,
                            requestOwnerId,
                            patientsRef.current,
                            false,
                        );
                    })();
                }
                shouldRecordMutationMetrics = false;
                mutationOutcome = "conflict";
                return;
            }

            const latestPatient = patientsRef.current.find((patient) => patient.id === id) ?? updatedPatient;
            persistenceData = prepareUpdateData(
                field,
                value,
                latestPatient.systems,
                latestPatient.medications,
            ) as PatientUpdateRow;
            persistenceData.last_modified = now;
            if (shouldTrack) {
                persistenceData.field_timestamps = latestPatient.fieldTimestamps as PatientUpdateRow["field_timestamps"];
            }
            if (
                shouldQueueWithoutNetwork
                || isBrowserOffline()
                || patientSaveStatesRef.current[id] === "queued"
            ) {
                if (await queueLatestPatientUpdate()) return;
                // A newer value for this same field already superseded this
                // request and will be the one coalesced into durable storage.
                mutationOutcome = "queued";
                return;
            }
            const expectedRevision = patientServerRevisionRef.current.get(patientUpdateKey)
                ?? oldPatient.revision
                ?? 0;
            const { error, count } = await supabase
                .from("patients")
                .update(persistenceData, { count: "exact" })
                .eq("id", id)
                .eq("revision", expectedRevision);

            if (!isCurrentOwner(requestOwnerId)) return;
            if (error) throw error;
            if (count === 0) throw new PatientWriteConflictError();
            const nextRevision = expectedRevision + 1;
            patientServerRevisionRef.current.set(patientUpdateKey, nextRevision);
            const revisionPatients = patientsRef.current.map((patient) => (
                patient.id === id ? { ...patient, revision: nextRevision } : patient
            ));
            commitPatients(requestOwnerId, revisionPatients);

            if (imageDelta?.removed.length) {
                await deleteImagesIfUnreferenced(
                    imageDelta.removed,
                    requestOwnerId,
                    patientsRef.current,
                    true,
                );
                if (!isCurrentOwner(requestOwnerId)) return;
            }

            // Record history entry for trackable fields (non-blocking)
            if (shouldTrack) {
                const newValueStr = isMedicationsField ? serializeForHistory(value) : (value as string);
                const oldValueStr = isMedicationsField ? serializeForHistory(oldPatient.medications) : oldValue;
                if (oldValueStr !== newValueStr) {
                    void (async () => {
                        try {
                            const { error } = await supabase.from("patient_field_history").insert({
                                patient_id: id,
                                user_id: requestOwnerId,
                                field_name: field,
                                old_value: oldValueStr,
                                new_value: newValueStr,
                            });
                            if (!isCurrentOwner(requestOwnerId)) return;
                            if (error) throw error;
                            await queryClient.invalidateQueries({
                                queryKey: QUERY_KEYS.fieldHistoryForOwner(requestOwnerId, id),
                                exact: true,
                            });
                        } catch {
                            logWarn("patient.field_history.failed");
                        }
                    })();
                }
            }
            if (patientUpdateVersionRef.current.get(patientUpdateKey) === patientUpdateVersion) {
                setPatientSaveState(id, "saved");
            }
            queuedNoticeKeysRef.current.delete(patientUpdateKey);
            patientConflictBlockedThroughVersionRef.current.delete(patientUpdateKey);
            mutationOutcome = "saved";
        } catch (error) {
            if (!isCurrentOwner(requestOwnerId)) return;
            logError("patient.update.failed");
            const isLatestFieldUpdate =
                fieldUpdateVersionRef.current.get(fieldUpdateKey) === fieldUpdateVersion;

            if (!queueAttempted && isLatestFieldUpdate && isRetryablePatientWriteError(error)) {
                try {
                    if (await queueLatestPatientUpdate()) return;
                } catch {
                    // Durable queue unavailable: fall through to rollback and persistent error.
                }
            }

            if (isLatestFieldUpdate) {
                const rolledBackPatients = patientsRef.current.map((patient) => (
                    patient.id === id
                        ? restoreUpdatedField(patient, oldPatient, field, shouldTrack, now)
                        : patient
                ));
                commitPatients(requestOwnerId, rolledBackPatients);
            }

            if (imageDelta?.added.length) {
                await deleteImagesIfUnreferenced(
                    imageDelta.added,
                    requestOwnerId,
                    patientsRef.current,
                    false,
                );
                if (!isCurrentOwner(requestOwnerId)) return;
            }

            if (error instanceof PatientWriteConflictError) {
                const blockedThroughVersion = patientUpdateVersionRef.current.get(patientUpdateKey)
                    ?? patientUpdateVersion;
                const previousBlockedThroughVersion =
                    patientConflictBlockedThroughVersionRef.current.get(patientUpdateKey) ?? 0;
                patientConflictBlockedThroughVersionRef.current.set(
                    patientUpdateKey,
                    Math.max(previousBlockedThroughVersion, blockedThroughVersion),
                );
                patientServerRevisionRef.current.delete(patientUpdateKey);
                mutationOutcome = "conflict";

                if (!patientConflictRefreshesRef.current.has(patientUpdateKey)) {
                    const refreshPromise = Promise.resolve()
                        .then(() => fetchPatients({ force: true }))
                        .catch(() => {
                            logWarn("patient.conflict_refresh.failed");
                        })
                        .then(() => undefined)
                        .finally(() => {
                            if (patientConflictRefreshesRef.current.get(patientUpdateKey) === refreshPromise) {
                                patientConflictRefreshesRef.current.delete(patientUpdateKey);
                            }
                        });
                    patientConflictRefreshesRef.current.set(patientUpdateKey, refreshPromise);
                }

                setPatientSaveState(id, "conflict");
                queuedNoticeKeysRef.current.delete(patientUpdateKey);
                if (patientUpdateVersion > previousBlockedThroughVersion) {
                    notifications.error({
                        title: "Save conflict",
                        description: "This patient changed in another tab or device. Your edit was not allowed to overwrite it; the latest chart is loading.",
                    });
                }
                return;
            }

            if (patientUpdateVersionRef.current.get(patientUpdateKey) === patientUpdateVersion) {
                void fetchPatients({ force: true });
            }
            if (isLatestFieldUpdate) {
                setPatientSaveState(id, "error");
                queuedNoticeKeysRef.current.delete(patientUpdateKey);
                notifications.error({
                    title: "Save failed",
                    description: "Patient changes could not be saved or queued. Copy your text before retrying.",
                });
            }
        } finally {
            if (shouldRecordMutationMetrics && isCurrentOwner(requestOwnerId)) {
                recordPatientMutationMetrics({
                    operation: "update",
                    outcome: mutationOutcome,
                    durationMs: performance.now() - mutationStartedAt,
                });
            }
            releaseWrite();
            if (patientWriteChainsRef.current.get(patientUpdateKey) === writeChain) {
                void writeChain.finally(() => {
                    if (patientWriteChainsRef.current.get(patientUpdateKey) === writeChain) {
                        patientWriteChainsRef.current.delete(patientUpdateKey);
                    }
                });
            }
        }
    }, [
        user,
        fetchPatients,
        notifications,
        patientsRef,
        isCurrentOwner,
        commitPatients,
        queryClient,
        deleteImagesIfUnreferenced,
        setPatientSaveState,
    ]);

    const removePatient = React.useCallback(async (id: string) => {
        if (!user) return;
        const requestOwnerId = user.id;
        if (!hasSupabaseConfig) {
            notifications.error({
                title: "Configuration Error",
                description: "Supabase is not configured. Please check environment variables.",
            });
            return;
        }
        const patientToRemove = patientsRef.current.find((patient) => patient.id === id);
        if (!patientToRemove) return;

        const mutationStartedAt = performance.now();
        let mutationOutcome: PatientMutationOutcome = "error";
        try {
            const { error } = await supabase
                .from("patients")
                .delete()
                .eq("id", id);

            if (!isCurrentOwner(requestOwnerId)) return;
            if (error) throw error;
            patientServerRevisionRef.current.delete(`${requestOwnerId}:${id}`);

            const remainingPatients = patientsRef.current.filter((patient) => patient.id !== id);
            commitPatients(requestOwnerId, remainingPatients);
            removePatientScopedCaches(queryClient, requestOwnerId, id);

            await deleteImagesIfUnreferenced(
                extractPatientImageObjectKeys(patientToRemove.imaging, requestOwnerId),
                requestOwnerId,
                remainingPatients,
                true,
            );
            if (!isCurrentOwner(requestOwnerId)) return;

            notifications.success({
                title: "Patient Removed",
                description: "Patient has been removed.",
            });
            mutationOutcome = "saved";
        } catch {
            if (!isCurrentOwner(requestOwnerId)) return;
            logError("patient.remove.failed");
            notifications.error({
                title: "Error",
                description: "Failed to remove patient.",
            });
        } finally {
            if (isCurrentOwner(requestOwnerId)) {
                recordPatientMutationMetrics({
                    operation: "remove",
                    outcome: mutationOutcome,
                    durationMs: performance.now() - mutationStartedAt,
                });
            }
        }
    }, [
        user,
        notifications,
        patientsRef,
        isCurrentOwner,
        commitPatients,
        queryClient,
        deleteImagesIfUnreferenced,
    ]);

    const duplicatePatient = React.useCallback(async (id: string) => {
        if (!user) return;
        const requestOwnerId = user.id;
        if (!hasSupabaseConfig) {
            notifications.error({
                title: "Configuration Error",
                description: "Supabase is not configured. Please check environment variables.",
            });
            return;
        }

        const patient = patientsRef.current.find((p) => p.id === id);
        if (!patient) return;

        const nextNumber =
            1 +
            Math.max(0, ...patientsRef.current.map((p) => p.patientNumber ?? 0));
        const mutationStartedAt = performance.now();
        let mutationOutcome: PatientMutationOutcome = "error";
        try {
            const { data, error } = await supabase
                .from("patients")
                .insert([buildPatientInsertPayload({
                    userId: requestOwnerId,
                    patientNumber: nextNumber,
                    name: `${patient.name} (Copy)`,
                    mrn: patient.mrn,
                    bed: patient.bed,
                    clinicalSummary: patient.clinicalSummary,
                    intervalEvents: patient.intervalEvents,
                    imaging: patient.imaging,
                    labs: patient.labs,
                    systems: patient.systems,
                    medications: patient.medications,
                })])
                .select()
                .single();

            if (!isCurrentOwner(requestOwnerId)) return;
            if (error) throw error;
            if (data == null) throw new Error("No data returned from insert");

            const newPatient = mapPatientRecord(data);

            commitPatients(requestOwnerId, [...patientsRef.current, newPatient]);
            setPatientCounter((prev) => Math.max(prev, nextNumber));

            notifications.success({
                title: "Patient Duplicated",
                description: "Patient card has been duplicated.",
            });
            mutationOutcome = "saved";
        } catch {
            if (!isCurrentOwner(requestOwnerId)) return;
            logError("patient.duplicate.failed");
            notifications.error({
                title: "Error",
                description: "Failed to duplicate patient.",
            });
        } finally {
            if (isCurrentOwner(requestOwnerId)) {
                recordPatientMutationMetrics({
                    operation: "duplicate",
                    outcome: mutationOutcome,
                    durationMs: performance.now() - mutationStartedAt,
                });
            }
        }
    }, [user, notifications, patientsRef, isCurrentOwner, commitPatients, setPatientCounter]);

    const toggleCollapse = React.useCallback(async (id: string) => {
        const patient = patientsRef.current.find((p) => p.id === id);
        if (!patient) return;

        await updatePatient(id, "collapsed", !patient.collapsed);
    }, [updatePatient, patientsRef]);

    const collapseAll = React.useCallback(async () => {
        const currentPatients = patientsRef.current;
        if (!user || currentPatients.length === 0) return;
        const requestOwnerId = user.id;
        if (!hasSupabaseConfig) {
            notifications.error({
                title: "Configuration Error",
                description: "Supabase is not configured. Please check environment variables.",
            });
            return;
        }

        const allCollapsed = currentPatients.every(p => p.collapsed);
        const newCollapseState = !allCollapsed;
        const previousCollapseState = new Map(
            currentPatients.map((patient) => [patient.id, patient.collapsed]),
        );
        const collapseUpdateVersions = new Map<string, number>();
        currentPatients.forEach((patient) => {
            const fieldUpdateKey = `${requestOwnerId}:${patient.id}:collapsed`;
            const fieldUpdateVersion = (fieldUpdateVersionRef.current.get(fieldUpdateKey) ?? 0) + 1;
            fieldUpdateVersionRef.current.set(fieldUpdateKey, fieldUpdateVersion);
            collapseUpdateVersions.set(patient.id, fieldUpdateVersion);
        });

        const nextPatients = currentPatients.map(p => ({ ...p, collapsed: newCollapseState }));
        commitPatients(requestOwnerId, nextPatients);

        const mutationStartedAt = performance.now();
        let mutationOutcome: PatientMutationOutcome = "error";
        try {
            const { error } = await supabase
                .from("patients")
                .update({ collapsed: newCollapseState })
                .eq("user_id", requestOwnerId);

            if (!isCurrentOwner(requestOwnerId)) return;
            if (error) throw error;
            currentPatients.forEach((patient) => {
                patientServerRevisionRef.current.delete(`${requestOwnerId}:${patient.id}`);
            });
            await fetchPatients({ force: true });
            mutationOutcome = "saved";
        } catch {
            if (!isCurrentOwner(requestOwnerId)) return;
            logError("patient.collapse_all.failed");
            const rolledBackPatients = patientsRef.current.map((patient) => {
                const fieldUpdateKey = `${requestOwnerId}:${patient.id}:collapsed`;
                const expectedVersion = collapseUpdateVersions.get(patient.id);
                const previousCollapsed = previousCollapseState.get(patient.id);
                if (
                    expectedVersion === undefined
                    || previousCollapsed === undefined
                    || fieldUpdateVersionRef.current.get(fieldUpdateKey) !== expectedVersion
                ) {
                    return patient;
                }
                return { ...patient, collapsed: previousCollapsed };
            });
            commitPatients(requestOwnerId, rolledBackPatients);
        } finally {
            if (isCurrentOwner(requestOwnerId)) {
                recordPatientMutationMetrics({
                    operation: "collapse_all",
                    outcome: mutationOutcome,
                    durationMs: performance.now() - mutationStartedAt,
                });
            }
        }
    }, [user, notifications, patientsRef, isCurrentOwner, commitPatients, fetchPatients]);

    const clearAll = React.useCallback(async () => {
        if (!user) return;
        const requestOwnerId = user.id;
        if (!hasSupabaseConfig) {
            notifications.error({
                title: "Configuration Error",
                description: "Supabase is not configured. Please check environment variables.",
            });
            return;
        }
        const previousPatients = [...patientsRef.current];

        const mutationStartedAt = performance.now();
        let mutationOutcome: PatientMutationOutcome = "error";
        try {
            const { error } = await supabase
                .from("patients")
                .delete()
                .eq("user_id", requestOwnerId);

            if (!isCurrentOwner(requestOwnerId)) return;
            if (error) throw error;

            commitPatients(requestOwnerId, []);
            previousPatients.forEach((patient) => {
                patientServerRevisionRef.current.delete(`${requestOwnerId}:${patient.id}`);
            });
            setPatientCounter(1);
            previousPatients.forEach((patient) => removePatientScopedCaches(queryClient, requestOwnerId, patient.id));
            queryClient.setQueriesData<PatientTodosMap>(
                { queryKey: [...QUERY_KEYS.allTodos, requestOwnerId] },
                () => ({})
            );

            await deleteImagesIfUnreferenced(
                Array.from(collectReferencedPatientImageKeys(previousPatients, requestOwnerId)),
                requestOwnerId,
                [],
                true,
            );
            if (!isCurrentOwner(requestOwnerId)) return;

            notifications.success({
                title: "All Data Cleared",
                description: "All patient data has been removed.",
            });
            mutationOutcome = "saved";
        } catch {
            if (!isCurrentOwner(requestOwnerId)) return;
            logError("patient.clear_all.failed");
            notifications.error({
                title: "Error",
                description: "Failed to clear patients.",
            });
        } finally {
            if (isCurrentOwner(requestOwnerId)) {
                recordPatientMutationMetrics({
                    operation: "clear_all",
                    outcome: mutationOutcome,
                    durationMs: performance.now() - mutationStartedAt,
                });
            }
        }
    }, [
        user,
        notifications,
        patientsRef,
        isCurrentOwner,
        commitPatients,
        setPatientCounter,
        queryClient,
        deleteImagesIfUnreferenced,
    ]);

    return {
        addPatient,
        updatePatient,
        removePatient,
        duplicatePatient,
        toggleCollapse,
        collapseAll,
        clearAll,
        patientSaveStates,
    };
}
