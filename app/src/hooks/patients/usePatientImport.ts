import * as React from "react";
import { hasSupabaseConfig, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/use-notifications";
import type { Patient, PatientSystems, PatientMedications } from "@/types/patient";
import {
    buildPatientInsertPayload,
    defaultSystemsValue,
    getNextPatientCounter,
    mapPatientRecord,
} from "@/services/patientService";
import type { NewPatientSubmitPayload } from "@/components/dashboard/NewPatientSheet";
import { parseMedicationsJson, parseSystemsJson } from "@/lib/mappers/patientMapper";
import type { Json, TablesInsert } from "@/integrations/supabase/types";
import {
    acquirePatientImportAttempt,
    clearPatientImportAttempt,
    PatientImportStorageUnavailableError,
    runPatientImportWrite,
} from "@/lib/import/patientImportIdempotency";

export interface PatientImportDeps {
    patientsRef: React.MutableRefObject<Patient[]>;
    setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
}

/**
 * Handles importing patients from external sources (Epic handoff, smart import).
 */
export function usePatientImport({
    patientsRef,
    setPatients,
}: PatientImportDeps) {
    const { user } = useAuth();
    const notifications = useNotifications();
    const activeOwnerIdRef = React.useRef<string | null>(user?.id ?? null);
    activeOwnerIdRef.current = user?.id ?? null;

    const isCurrentOwner = React.useCallback(
        (requestOwnerId: string) => activeOwnerIdRef.current === requestOwnerId,
        []
    );

    const appendPatients = React.useCallback((requestOwnerId: string, patientsToAppend: Patient[]) => {
        if (!isCurrentOwner(requestOwnerId)) return;
        if (patientsToAppend.length === 0) return;

        const mergePatients = (existingPatients: Patient[]) => {
            const existingIds = new Set(existingPatients.map((patient) => patient.id));
            const uniqueNewPatients = patientsToAppend.filter((patient) => !existingIds.has(patient.id));
            return uniqueNewPatients.length === 0
                ? existingPatients
                : [...existingPatients, ...uniqueNewPatients];
        };

        patientsRef.current = mergePatients(patientsRef.current);
        setPatients((prev) => {
            const mergedPatients = mergePatients(prev);
            patientsRef.current = mergedPatients;
            return mergedPatients;
        });
    }, [isCurrentOwner, patientsRef, setPatients]);

    const isPatientNumberConflict = React.useCallback((error: unknown): boolean => {
        if (typeof error !== "object" || error === null) return false;
        const maybeCode = "code" in error ? (error as { code?: unknown }).code : undefined;
        if (maybeCode !== "23505") return false;
        const maybeDetails = "details" in error ? (error as { details?: unknown }).details : undefined;
        const maybeMessage = "message" in error ? (error as { message?: unknown }).message : undefined;
        const combinedText = `${String(maybeDetails ?? "")} ${String(maybeMessage ?? "")}`.toLowerCase();
        return combinedText.includes("patient_number");
    }, []);

    const isPatientIdConflict = React.useCallback((error: unknown): boolean => {
        if (typeof error !== "object" || error === null) return false;
        const maybeCode = "code" in error ? (error as { code?: unknown }).code : undefined;
        if (maybeCode !== "23505") return false;
        const maybeDetails = "details" in error ? (error as { details?: unknown }).details : undefined;
        const maybeMessage = "message" in error ? (error as { message?: unknown }).message : undefined;
        const combinedText = `${String(maybeDetails ?? "")} ${String(maybeMessage ?? "")}`.toLowerCase();
        return combinedText.includes("(id)") || combinedText.includes("patients_pkey");
    }, []);

    const getLatestPatientNumber = React.useCallback(async (ownerId: string): Promise<number> => {
        const { data, error } = await supabase
            .from("patients")
            .select("patient_number")
            .eq("user_id", ownerId)
            .order("patient_number", { ascending: false })
            .limit(1);
        if (error) throw error;
        return data?.[0]?.patient_number ?? 0;
    }, []);

    const getPatientsByIds = React.useCallback(async (ownerId: string, ids: string[]) => {
        if (ids.length === 0) return [];
        const { data, error } = await supabase
            .from("patients")
            .select("*")
            .eq("user_id", ownerId)
            .in("id", ids);
        if (error) throw error;
        return data ?? [];
    }, []);

    const importPatients = React.useCallback(async (patientsToImport: Array<{
        name: string;
        bed: string;
        clinicalSummary: string;
        intervalEvents: string;
        mrn?: string;
        imaging?: string;
        labs?: string;
        systems?: PatientSystems;
        medications?: PatientMedications;
        age?: number;
        dateOfBirth?: string;
        gender?: Patient["gender"];
        admissionDate?: string;
        serviceLine?: string;
        attendingPhysician?: string;
        codeStatus?: Patient["codeStatus"];
        alerts?: string[];
    }>) => {
        if (!user) return;
        const requestOwnerId = user.id;
        if (!hasSupabaseConfig) {
            notifications.error({
                title: "Configuration Error",
                description: "Supabase is not configured. Please check environment variables.",
            });
            return;
        }

        try {
            type PreparedImportRow = {
                name: string;
                payload: TablesInsert<"patients">;
            };

            const mapInsertedRows = (rows: Array<Parameters<typeof mapPatientRecord>[0]>): Patient[] =>
                [...rows]
                    .sort((left, right) => left.patient_number - right.patient_number)
                    .map(mapPatientRecord);

            const insertPreparedRowsIndividually = async (
                preparedRows: PreparedImportRow[],
                startingNumber: number,
                newPatients: Patient[],
                failedPatients: { name: string; error: unknown }[],
            ): Promise<boolean> => {
                let nextPatientNumber = startingNumber;

                for (const preparedRow of preparedRows) {
                    let rowPayload = {
                        ...preparedRow.payload,
                        patient_number: nextPatientNumber,
                    };
                    let attemptsRemaining = 2;

                    while (attemptsRemaining > 0) {
                        const { data, error } = await supabase
                            .from("patients")
                            .insert([rowPayload])
                            .select()
                            .single();

                        if (!isCurrentOwner(requestOwnerId)) return false;

                        if (error && isPatientIdConflict(error)) {
                            const existingRows = await getPatientsByIds(
                                requestOwnerId,
                                [String(rowPayload.id)],
                            );
                            if (!isCurrentOwner(requestOwnerId)) return false;
                            if (existingRows[0]) {
                                newPatients.push(mapPatientRecord(existingRows[0]));
                            } else {
                                failedPatients.push({ name: preparedRow.name, error });
                            }
                            break;
                        }

                        if (error && isPatientNumberConflict(error) && attemptsRemaining > 1) {
                            const latestNumber = await getLatestPatientNumber(requestOwnerId);
                            if (!isCurrentOwner(requestOwnerId)) return false;
                            rowPayload = {
                                ...rowPayload,
                                patient_number: latestNumber + 1,
                            };
                            attemptsRemaining -= 1;
                            continue;
                        }

                        if (error) {
                            failedPatients.push({ name: preparedRow.name, error });
                        } else if (data == null) {
                            failedPatients.push({ name: preparedRow.name, error: new Error("No data returned from insert") });
                        } else {
                            newPatients.push(mapPatientRecord(data));
                        }

                        nextPatientNumber = Number(rowPayload.patient_number ?? nextPatientNumber) + 1;
                        break;
                    }
                }

                return true;
            };

            const importAttempt = await acquirePatientImportAttempt(requestOwnerId, patientsToImport);
            if (!isCurrentOwner(requestOwnerId)) return;
            const nextPatientNumber = getNextPatientCounter(patientsRef.current);
            const preparedRows = patientsToImport.map((patientToImport, index): PreparedImportRow => {
                const systems = parseSystemsJson({
                    ...defaultSystemsValue,
                    ...(patientToImport.systems ?? {}),
                } as unknown as Json);
                const medications = parseMedicationsJson(
                    (patientToImport.medications ?? null) as unknown as Json,
                );

                return {
                    name: patientToImport.name,
                    payload: {
                        ...buildPatientInsertPayload({
                            userId: requestOwnerId,
                            patientNumber: nextPatientNumber + index,
                            name: patientToImport.name,
                            mrn: patientToImport.mrn ?? "",
                            bed: patientToImport.bed,
                            clinicalSummary: patientToImport.clinicalSummary,
                            intervalEvents: patientToImport.intervalEvents || "",
                            imaging: patientToImport.imaging || "",
                            labs: patientToImport.labs || "",
                            systems,
                            medications,
                            age: patientToImport.age,
                            dateOfBirth: patientToImport.dateOfBirth,
                            gender: patientToImport.gender,
                            admissionDate: patientToImport.admissionDate,
                            serviceLine: patientToImport.serviceLine,
                            attendingPhysician: patientToImport.attendingPhysician,
                            codeStatus: patientToImport.codeStatus,
                            alerts: patientToImport.alerts,
                        }),
                        id: importAttempt.patientIds[index],
                    },
                };
            });
            const payloads = preparedRows.map((preparedRow) => preparedRow.payload);
            const newPatients: Patient[] = [];
            const failedPatients: { name: string; error: unknown }[] = [];

            if (payloads.length > 0) {
                await runPatientImportWrite(async () => {
                    const { data, error } = await supabase
                        .from("patients")
                        .insert(payloads)
                        .select();
                    if (!isCurrentOwner(requestOwnerId)) return;

                    if (error && isPatientIdConflict(error)) {
                        const existingRows = await getPatientsByIds(requestOwnerId, importAttempt.patientIds);
                        if (!isCurrentOwner(requestOwnerId)) return;
                        const existingById = new Map(existingRows.map((row) => [row.id, row]));
                        newPatients.push(...mapInsertedRows(existingRows));
                        const missingRows = preparedRows.filter(
                            (preparedRow) => !existingById.has(String(preparedRow.payload.id)),
                        );
                        if (missingRows.length === 0) return;
                        const latestNumber = await getLatestPatientNumber(requestOwnerId);
                        if (!isCurrentOwner(requestOwnerId)) return;
                        const recovered = await insertPreparedRowsIndividually(
                            missingRows,
                            latestNumber + 1,
                            newPatients,
                            failedPatients,
                        );
                        if (!recovered) return;
                    } else if (error && isPatientNumberConflict(error)) {
                        const latestNumber = await getLatestPatientNumber(requestOwnerId);
                        if (!isCurrentOwner(requestOwnerId)) return;
                        // A bulk patient-number collision is recovered with bounded single-row retries.
                        await insertPreparedRowsIndividually(
                            preparedRows,
                            latestNumber + 1,
                            newPatients,
                            failedPatients,
                        );
                    } else if (error) {
                        failedPatients.push(...preparedRows.map((preparedRow) => ({
                            name: preparedRow.name,
                            error,
                        })));
                    } else if (data == null) {
                        const noDataError = new Error("No data returned from insert");
                        failedPatients.push(...preparedRows.map((preparedRow) => ({
                            name: preparedRow.name,
                            error: noDataError,
                        })));
                    } else {
                        newPatients.push(...mapInsertedRows(data));
                    }
                });
                if (!isCurrentOwner(requestOwnerId)) return;
            }

            appendPatients(requestOwnerId, newPatients);

            if (failedPatients.length === 0 && newPatients.length === preparedRows.length) {
                try {
                    await clearPatientImportAttempt(requestOwnerId, importAttempt.fingerprint);
                } catch {
                    // The server result and local roster are already committed.
                    // Retaining the durable retry record is safer than reporting
                    // the import as failed or risking a duplicate on retry.
                    console.error("Patient import retry record cleanup failed");
                }
            }

            if (failedPatients.length > 0) {
                if (newPatients.length === 0) {
                    notifications.error({
                        title: "Import Failed",
                        description: `Failed to import all ${patientsToImport.length} patients.`,
                    });
                    throw new Error(`Failed to import all patients`);
                }
                notifications.success({
                    title: "Partial Import Complete",
                    description: `${newPatients.length} patient(s) imported, ${failedPatients.length} failed.`,
                });
            } else {
                notifications.success({
                    title: "Import Complete",
                    description: `${newPatients.length} patient(s) imported into the chart.`,
                });
            }
        } catch (error) {
            if (!isCurrentOwner(requestOwnerId)) return;
            console.error("Patient import failed");
            if (error instanceof PatientImportStorageUnavailableError) {
                notifications.error({
                    title: "Import unavailable",
                    description: "Enable browser site storage before importing so retries cannot duplicate patients.",
                });
                throw error;
            }
            notifications.error({
                title: "Import Error",
                description: "Failed to import some patients.",
            });
            throw error;
        }
    }, [user, notifications, patientsRef, getLatestPatientNumber, getPatientsByIds, isPatientIdConflict, isPatientNumberConflict, isCurrentOwner, appendPatients]);

    const addPatientWithData = React.useCallback(async (patientData: NewPatientSubmitPayload) => {
        if (!user) {
            notifications.error({
                title: "Not signed in",
                description: "Please sign in to add patients.",
            });
            throw new Error("Not signed in");
        }
        const requestOwnerId = user.id;
        if (!hasSupabaseConfig) {
            notifications.error({
                title: "Configuration Error",
                description: "Supabase is not configured. Please check environment variables.",
            });
            throw new Error("Supabase not configured");
        }

        try {
            let insertNumber = getNextPatientCounter(patientsRef.current);
            const systems = parseSystemsJson({
                ...defaultSystemsValue,
                ...(patientData.systems ?? {}),
            } as unknown as Json);
            const medications = parseMedicationsJson(
                (patientData.medications ?? null) as unknown as Json,
            );
            let { data, error } = await supabase
                .from("patients")
                .insert([buildPatientInsertPayload({
                    userId: requestOwnerId,
                    patientNumber: insertNumber,
                    name: patientData.name || "",
                    mrn: patientData.mrn ?? "",
                    bed: patientData.bed || "",
                    clinicalSummary: patientData.clinicalSummary || "",
                    intervalEvents: patientData.intervalEvents || "",
                    imaging: patientData.imaging || "",
                    labs: patientData.labs || "",
                    systems,
                    medications,
                    age: patientData.age,
                    dateOfBirth: patientData.dateOfBirth,
                    gender: patientData.gender,
                    admissionDate: patientData.admissionDate,
                    serviceLine: patientData.serviceLine,
                    attendingPhysician: patientData.attendingPhysician,
                    consultingTeam: patientData.consultingTeam,
                    acuity: patientData.acuity,
                    codeStatus: patientData.codeStatus,
                    alerts: patientData.alerts,
                })])
                .select()
                .single();

            if (!isCurrentOwner(requestOwnerId)) return;
            if (error && isPatientNumberConflict(error)) {
                const latestNumber = await getLatestPatientNumber(requestOwnerId);
                if (!isCurrentOwner(requestOwnerId)) return;
                insertNumber = latestNumber + 1;
                const retryResult = await supabase
                    .from("patients")
                    .insert([buildPatientInsertPayload({
                        userId: requestOwnerId,
                        patientNumber: insertNumber,
                        name: patientData.name || "",
                        mrn: patientData.mrn ?? "",
                        bed: patientData.bed || "",
                        clinicalSummary: patientData.clinicalSummary || "",
                        intervalEvents: patientData.intervalEvents || "",
                        imaging: patientData.imaging || "",
                        labs: patientData.labs || "",
                        systems,
                        medications,
                        age: patientData.age,
                        dateOfBirth: patientData.dateOfBirth,
                        gender: patientData.gender,
                        admissionDate: patientData.admissionDate,
                        serviceLine: patientData.serviceLine,
                        attendingPhysician: patientData.attendingPhysician,
                        consultingTeam: patientData.consultingTeam,
                        acuity: patientData.acuity,
                        codeStatus: patientData.codeStatus,
                        alerts: patientData.alerts,
                    })])
                    .select()
                    .single();
                if (!isCurrentOwner(requestOwnerId)) return;
                data = retryResult.data;
                error = retryResult.error;
            }

            if (error) throw error;
            if (data == null) throw new Error("No data returned from insert");

            const newPatient = mapPatientRecord(data);

            appendPatients(requestOwnerId, [newPatient]);

            notifications.success({
                title: "Patient Imported",
                description: `${patientData.name || 'New patient'} added successfully.`,
            });
        } catch (error) {
            if (!isCurrentOwner(requestOwnerId)) return;
            console.error("Patient import failed");
            notifications.error({
                title: "Error",
                description: "Failed to import patient.",
            });
            throw error;
        }
    }, [user, notifications, patientsRef, getLatestPatientNumber, isPatientNumberConflict, isCurrentOwner, appendPatients]);

    return {
        importPatients,
        addPatientWithData,
    };
}
