import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { hasSupabaseConfig, supabase } from "@/integrations/supabase/client";
import { useAuth } from "../useAuth";
import { useNotifications } from "../use-notifications";
import type { Patient } from "@/types/patient";
import { logMetric, generateRequestId } from "@/lib/observability/logger";
import {
    getNextPatientCounter,
    getPatientRosterSelectColumns,
    markPatientRosterProjectionLegacy,
    mapPatientRecord,
    PATIENT_SELECT_COLUMNS_LEGACY,
    type PatientRecord,
    isMissingPatientContractColumnError,
} from "@/services/patientService";
import { QUERY_KEYS } from "@/lib/cache/cacheConfig";
import { CACHE_CONFIG } from "@/lib/cache/cacheConfig";
import { isBrowserKnownOffline } from "@/lib/networkConnectivity";
import {
    overlayPendingPatientUpdates,
    readPatientRosterWithPendingUpdates,
    writePatientRosterSnapshot,
} from "@/lib/offline/patientRosterCache";

export interface PatientFetchState {
    patients: Patient[];
    loading: boolean;
    /** Whether the visible roster is remote truth, expected offline truth, or an unverified fallback. */
    verification: PatientRosterVerification;
    patientCounter: number;
    /** Ref that always holds the latest patients array (avoids stale closures). */
    patientsRef: React.MutableRefObject<Patient[]>;
    setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
    setPatientCounter: React.Dispatch<React.SetStateAction<number>>;
    fetchPatients: (options?: { force?: boolean }) => Promise<void>;
}

export type PatientRosterVerification = "loading" | "verified" | "local" | "stale";

export interface PatientRosterReadResult {
    patients: Patient[];
    verification: Exclude<PatientRosterVerification, "loading">;
    hasLocalSnapshot: boolean;
}

interface PatientRosterReadDependencies {
    isKnownOffline: () => boolean;
    fetchRemote: (ownerId: string) => Promise<Patient[]>;
    readLocal: (ownerId: string) => Promise<Patient[] | null>;
    writeSnapshot: (ownerId: string, patients: readonly Patient[]) => Promise<boolean>;
    overlayPending: (ownerId: string, patients: readonly Patient[]) => Promise<Patient[]>;
}

async function fetchPatientsFromSupabase(ownerId: string): Promise<Patient[]> {
    const requestId = generateRequestId();
    const start = performance.now();

    try {
        const selectedColumns = getPatientRosterSelectColumns();
        let { data, error } = await supabase
            .from("patients")
            .select(selectedColumns)
            .eq("user_id", ownerId)
            .order("patient_number", { ascending: true });

        if (
            selectedColumns !== PATIENT_SELECT_COLUMNS_LEGACY
            && error
            && isMissingPatientContractColumnError(error)
        ) {
            markPatientRosterProjectionLegacy();
            ({ data, error } = await supabase
                .from("patients")
                .select(PATIENT_SELECT_COLUMNS_LEGACY)
                .eq("user_id", ownerId)
                .order("patient_number", { ascending: true }));
        }

        if (error) throw error;
        const patients = (data || []).map((record) => mapPatientRecord(record as unknown as PatientRecord));
        const durationMs = Math.round(performance.now() - start);
        logMetric("patients.fetch.duration_ms", durationMs, "ms", {
            requestId,
            count: patients.length,
            status: "success",
        });
        logMetric("patients.fetch.success", 1, "count", { requestId });
        return patients;
    } catch (err) {
        const durationMs = Math.round(performance.now() - start);
        logMetric("patients.fetch.duration_ms", durationMs, "ms", {
            requestId,
            status: "error",
        });
        throw err;
    }
}

const defaultPatientRosterReadDependencies: PatientRosterReadDependencies = {
    isKnownOffline: isBrowserKnownOffline,
    fetchRemote: fetchPatientsFromSupabase,
    readLocal: readPatientRosterWithPendingUpdates,
    writeSnapshot: writePatientRosterSnapshot,
    overlayPending: overlayPendingPatientUpdates,
};

/**
 * Resolve the safest available patient roster without equating
 * `navigator.onLine` with a successful backend read. A browser can remain
 * "online" during a Supabase outage, captive portal, DNS failure, or 5xx.
 */
export async function resolvePatientRosterRead(
    ownerId: string,
    dependencies: PatientRosterReadDependencies = defaultPatientRosterReadDependencies,
): Promise<PatientRosterReadResult> {
    if (dependencies.isKnownOffline()) {
        const local = await dependencies.readLocal(ownerId);
        return {
            patients: local ?? [],
            verification: "local",
            hasLocalSnapshot: local !== null,
        };
    }

    try {
        const remote = await dependencies.fetchRemote(ownerId);
        const snapshotPersisted = await dependencies.writeSnapshot(ownerId, remote);
        return {
            patients: await dependencies.overlayPending(ownerId, remote),
            // Remote truth remains visible, but irreversible completion must
            // not claim offline recovery is ready when durable storage failed.
            verification: snapshotPersisted ? "verified" : "stale",
            hasLocalSnapshot: snapshotPersisted,
        };
    } catch {
        let local: Patient[] | null = null;
        try {
            local = await dependencies.readLocal(ownerId);
        } catch {
            // The verification state remains stale even if local storage is
            // unavailable; rendering uncertainty is safer than an empty list
            // that looks server-authoritative.
        }
        return {
            patients: local ?? [],
            verification: dependencies.isKnownOffline() ? "local" : "stale",
            hasLocalSnapshot: local !== null,
        };
    }
}

/**
 * Handles fetching patients from Supabase via React Query and exposes core list state.
 * Single source of truth: the authenticated owner's patient-list cache (Patient[]).
 */
export function usePatientFetch(): PatientFetchState {
    const queryClient = useQueryClient();
    const { user } = useAuth();
    const notifications = useNotifications();
    const ownerId = user?.id ?? null;
    const activeOwnerIdRef = React.useRef<string | null>(ownerId);
    const mountedRef = React.useRef(true);
    activeOwnerIdRef.current = ownerId;
    const patientListQueryKey = React.useMemo(
        () => QUERY_KEYS.patientList(ownerId),
        [ownerId]
    );
    const [verificationState, setVerificationState] = React.useState<{
        ownerId: string;
        verification: Exclude<PatientRosterVerification, "loading">;
    } | null>(null);

    React.useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const query = useQuery({
        queryKey: patientListQueryKey,
        queryFn: async () => {
            if (!ownerId) return [];
            const result = await resolvePatientRosterRead(ownerId);
            if (!mountedRef.current || activeOwnerIdRef.current !== ownerId) return [];
            setVerificationState({ ownerId, verification: result.verification });
            if (result.verification !== "verified") {
                logMetric("patients.fetch.cache_fallback", 1, "count", {
                    requestId: generateRequestId(),
                    hasLocalSnapshot: result.hasLocalSnapshot,
                    verification: result.verification,
                });
            }
            return result.patients;
        },
        enabled: hasSupabaseConfig && !!user,
        // The query function has its own owner-scoped IndexedDB path. Let it
        // run while offline instead of allowing React Query to pause before
        // the roster snapshot can hydrate the workspace.
        networkMode: "always",
        staleTime: CACHE_CONFIG.staleTime.patients,
        gcTime: CACHE_CONFIG.queries.patients,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        // An offline snapshot is intentionally usable but never considered a
        // substitute for remote truth after connectivity returns.
        refetchOnReconnect: "always",
        retry: false,
    });

    const patients: Patient[] = React.useMemo(() => query.data ?? [], [query.data]);
    const loading = !!user && query.isPending;
    const verification: PatientRosterVerification = !ownerId
        ? "verified"
        : verificationState?.ownerId === ownerId
            ? verificationState.verification
            : "loading";
    const refetchPatientsQuery = query.refetch;
    const patientCounter = React.useMemo(
        () => getNextPatientCounter(patients),
        [patients]
    );

    const patientsRef = React.useRef<Patient[]>([]);
    const patientsOwnerIdRef = React.useRef<string | null>(ownerId);
    if (patientsOwnerIdRef.current !== ownerId) {
        patientsOwnerIdRef.current = ownerId;
        patientsRef.current = [];
    }
    React.useEffect(() => {
        patientsRef.current = patients;
    }, [patients]);

    const fetchPatients = React.useCallback(async (options?: { force?: boolean }) => {
        if (!ownerId) return;
        const requestOwnerId = ownerId;
        if (!hasSupabaseConfig) {
            notifications.error({
                title: "Configuration Error",
                description: "Supabase is not configured. Please check environment variables.",
            });
            return;
        }
        const cachedPatients = queryClient.getQueryData<Patient[]>(patientListQueryKey);
        const patientsQueryState = queryClient.getQueryState(patientListQueryKey);
        const hasFreshPatientCache =
            cachedPatients !== undefined &&
            patientsQueryState?.dataUpdatedAt !== undefined &&
            Date.now() - patientsQueryState.dataUpdatedAt < CACHE_CONFIG.staleTime.patients;

        if (!options?.force && hasFreshPatientCache) return;

        try {
            const result = await refetchPatientsQuery();
            if (activeOwnerIdRef.current !== requestOwnerId) return;
            if (result.error) throw result.error;
        } catch {
            if (activeOwnerIdRef.current !== requestOwnerId) return;
            console.error("Patient fetch failed");
            logMetric("patients.fetch.error", 1, "count", {
                userId: requestOwnerId,
                requestId: generateRequestId(),
            });
            notifications.error({
                title: "Error",
                description: "Failed to load patients.",
            });
        }
    }, [ownerId, notifications, refetchPatientsQuery, queryClient, patientListQueryKey]);

    React.useEffect(() => {
        if (verification !== "stale" || !ownerId) return;
        const retryOnFocus = () => {
            void refetchPatientsQuery();
        };
        const retryTimer = window.setTimeout(() => {
            void refetchPatientsQuery();
        }, 30_000);
        window.addEventListener("focus", retryOnFocus);
        return () => {
            window.clearTimeout(retryTimer);
            window.removeEventListener("focus", retryOnFocus);
        };
    }, [ownerId, refetchPatientsQuery, verification]);

    React.useEffect(() => {
        if (!ownerId) {
            queryClient.setQueryData<Patient[]>(patientListQueryKey, [], {
                updatedAt: 0,
            });
        }
    }, [ownerId, patientListQueryKey, queryClient]);

    React.useEffect(() => {
        if (query.isError && user) {
            logMetric("patients.fetch.error", 1, "count", {
                userId: user.id,
                requestId: generateRequestId(),
            });
            notifications.error({
                title: "Error",
                description: "Failed to load patients.",
            });
        }
    }, [query.isError, query.error, user, notifications]);

    const setPatients = React.useCallback(
        (action: React.SetStateAction<Patient[]>) => {
            if (!ownerId || activeOwnerIdRef.current !== ownerId) return;
            let nextSnapshot: Patient[] | null = null;
            queryClient.setQueryData<Patient[]>(patientListQueryKey, (old) => {
                const prev = old ?? [];
                const next = typeof action === "function" ? action(prev) : action;
                nextSnapshot = next;
                return next;
            });
            if (nextSnapshot && activeOwnerIdRef.current === ownerId) {
                void writePatientRosterSnapshot(ownerId, nextSnapshot).then((snapshotPersisted) => {
                    if (
                        !snapshotPersisted
                        && mountedRef.current
                        && activeOwnerIdRef.current === ownerId
                    ) {
                        setVerificationState({ ownerId, verification: "stale" });
                    }
                });
            }
        },
        [ownerId, patientListQueryKey, queryClient]
    );

    const setPatientCounter = React.useCallback(() => {
        /* no-op: patientCounter is derived from patients */
    }, []);

    return {
        patients,
        loading,
        verification,
        patientCounter,
        patientsRef,
        setPatients,
        setPatientCounter,
        fetchPatients,
    };
}
