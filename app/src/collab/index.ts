export { CollaborationProvider, useCollaboration } from "./CollaborationProvider";
export { usePatientNote, usePresence, useCollaborationStatus } from "./hooks";
export {
  createPatientNoteStore,
  getNote,
  updateNote,
  getNoteKey,
  updateCursor,
  removeCursor,
  getCursorsForPatient,
} from "./patient.store";
export type { PatientNoteStore, CursorInfo } from "./patient.store";
