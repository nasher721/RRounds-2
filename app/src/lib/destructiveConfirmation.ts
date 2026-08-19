export function formatClearAllPatientsConfirmation(patientCount: number): string {
  const safeCount = Math.max(0, Math.trunc(patientCount));
  return `Remove all ${safeCount} patient record${safeCount === 1 ? "" : "s"} from today’s rounds? This cannot be undone. Export a recovery copy first if these notes are needed.`;
}
