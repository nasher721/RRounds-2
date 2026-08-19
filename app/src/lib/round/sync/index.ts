export type {
  CachedRoundSession,
  FieldConflict,
  FieldConflictChoice,
  RoundContinuityMeta,
  RoundOutboxEntry,
  RoundOutboxKind,
  VersionedField,
} from "./types";

export {
  applyFieldConflictChoice,
  detectDraftFieldConflict,
  draftEntityKey,
  mergeRoundContinuity,
  pickLastWriteField,
} from "./conflictRules";

export {
  createContinuityMeta,
  getOrCreateRoundDeviceId,
  loadCachedRoundSession,
  normalizeContinuityMeta,
  saveCachedRoundSession,
} from "./roundSessionCache";

export {
  coalesceRoundOutboxEntry,
  computeOutboxNextRetryAt,
  countConflictOutbox,
  countPendingOutbox,
  isOutboxEntryReady,
  mergeOutboxQueue,
  resolveDraftFieldPushOutcome,
  resolveRoundStateUpsertOutcome,
  selectPendingOutbox,
  shouldDrainOutboxAfterHydrate,
  withOutboxDefaults,
} from "./outboxMerge";

export { roundOutbox } from "./roundOutbox";
export { roundSyncEngine } from "./roundSyncEngine";
