import type { Patient } from "@/types/patient";

/**
 * Surfaces optional-field coaching when named patients still lack MRN or bed/location.
 */
export const getPatientProfileCoaching = (patients: Patient[]): {
  showBanner: boolean;
  message: string;
  incompleteCount: number;
} => {
  const incomplete = patients.filter(
    (p) => p.name.trim().length > 0 && (!p.mrn?.trim() || !p.bed?.trim()),
  );
  if (incomplete.length === 0) {
    return { showBanner: false, message: "", incompleteCount: 0 };
  }
  const needsMrn = incomplete.filter((p) => !p.mrn?.trim()).length;
  const needsBed = incomplete.filter((p) => !p.bed?.trim()).length;
  const parts: string[] = [];
  if (needsMrn > 0) parts.push("MRN");
  if (needsBed > 0) parts.push("bed or location");
  const label = parts.length > 0 ? parts.join(" and ") : "profile details";
  return {
    showBanner: true,
    incompleteCount: incomplete.length,
    message: `Add ${label} when available for safer handoffs (${incomplete.length} patient${incomplete.length === 1 ? "" : "s"}).`,
  };
};
