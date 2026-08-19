import type { PatientSaveState } from "@/hooks/patients/usePatientMutations";
import type { QueuedMutationDB } from "@/lib/offline/database";

const BLOCKING_PATIENT_SAVE_STATES = new Set<PatientSaveState>([
  "saving",
  "queued",
  "conflict",
  "error",
]);

export interface RoundCompletionSafety {
  canComplete: boolean;
  roundUnresolvedCount: number;
  roundConflictCount: number;
  mutationUnresolvedCount: number;
  mutationPendingCount: number;
  mutationFailedCount: number;
  mutationConflictCount: number;
  patientSaveBlockerCount: number;
  dataVerificationBlockerCount: number;
}

/** One completion decision across both persistence systems used by Round. */
export function deriveRoundCompletionSafety(input: {
  roundUnresolvedCount: number;
  roundConflictCount: number;
  mutations: readonly QueuedMutationDB[];
  patientSaveStates: Readonly<Record<string, PatientSaveState>>;
  dataVerificationBlockerCount?: number;
}): RoundCompletionSafety {
  const unresolvedMutations = input.mutations.filter(
    (mutation) => mutation.status !== "completed",
  );
  const mutationPendingCount = unresolvedMutations.filter(
    (mutation) => !mutation.status || mutation.status === "pending" || mutation.status === "syncing",
  ).length;
  const mutationFailedCount = unresolvedMutations.filter(
    (mutation) => mutation.status === "failed",
  ).length;
  const mutationConflictCount = unresolvedMutations.filter(
    (mutation) => mutation.status === "conflict",
  ).length;
  const patientSaveBlockerCount = Object.values(input.patientSaveStates).filter(
    (state) => BLOCKING_PATIENT_SAVE_STATES.has(state),
  ).length;
  const roundUnresolvedCount = Math.max(0, input.roundUnresolvedCount);
  const roundConflictCount = Math.max(0, input.roundConflictCount);
  const mutationUnresolvedCount = unresolvedMutations.length;
  const dataVerificationBlockerCount = Math.max(0, input.dataVerificationBlockerCount ?? 0);

  return {
    canComplete:
      roundUnresolvedCount === 0
      && roundConflictCount === 0
      && mutationUnresolvedCount === 0
      && patientSaveBlockerCount === 0
      && dataVerificationBlockerCount === 0,
    roundUnresolvedCount,
    roundConflictCount,
    mutationUnresolvedCount,
    mutationPendingCount,
    mutationFailedCount,
    mutationConflictCount,
    patientSaveBlockerCount,
    dataVerificationBlockerCount,
  };
}
