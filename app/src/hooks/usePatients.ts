/**
 * usePatients – now decomposed into focused sub-hooks under ./patients/.
 * This file re-exports the composite hook for backward compatibility.
 */
export { usePatients } from "./patients";
export type { Patient, PatientSystems, PatientMedications } from "./patients";
