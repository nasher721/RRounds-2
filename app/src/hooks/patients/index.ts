import type { Patient, PatientSystems, PatientMedications } from "@/types/patient";
import { usePatientFetch } from "./usePatientFetch";
import { usePatientMutations } from "./usePatientMutations";
import { usePatientImport } from "./usePatientImport";

export type { Patient, PatientSystems, PatientMedications };

/**
 * Composite hook that exposes the same API as the original monolithic usePatients.
 * Internally delegates to focused sub-hooks for fetch, mutations, and import.
 */
export const usePatients = () => {
    const {
        patients,
        loading,
        verification: patientVerification,
        patientCounter,
        patientsRef,
        setPatients,
        setPatientCounter,
        fetchPatients,
    } = usePatientFetch();

    const {
        addPatient,
        updatePatient,
        removePatient,
        duplicatePatient,
        toggleCollapse,
        collapseAll,
        clearAll,
        patientSaveStates,
    } = usePatientMutations({
        patientsRef,
        setPatients,
        patientCounter,
        setPatientCounter,
        fetchPatients,
    });

    const {
        importPatients,
        addPatientWithData,
    } = usePatientImport({
        patientsRef,
        setPatients,
    });

    return {
        patients,
        loading,
        patientVerification,
        addPatient,
        addPatientWithData,
        updatePatient,
        removePatient,
        duplicatePatient,
        toggleCollapse,
        collapseAll,
        clearAll,
        patientSaveStates,
        importPatients,
        refetch: fetchPatients,
    };
};

// Re-export sub-hooks for granular usage
export { usePatientFetch } from "./usePatientFetch";
export { usePatientMutations } from "./usePatientMutations";
export { usePatientImport } from "./usePatientImport";
