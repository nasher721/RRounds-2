import { useSyncedStore } from "@syncedstore/react";
import { useCallback } from "react";
import {
  PatientNoteStore,
  getNote,
  updateNote,
  getNoteKey,
  getCursorsForPatient,
} from "./patient.store";
import { useCollaboration } from "./CollaborationProvider";

export function usePatientNote(patientId: string, system: string) {
  const { store, setLocalCursor, clearLocalCursor } = useCollaboration();
  useSyncedStore(store);

  const note = store ? getNote(store, patientId, system) : "";
  const key = getNoteKey(patientId, system);

  const setNote = useCallback(
    (content: string) => {
      if (store) {
        updateNote(store, patientId, system, content);
      }
    },
    [store, patientId, system]
  );

  const onFocus = useCallback(() => {
    setLocalCursor(patientId, system);
  }, [setLocalCursor, patientId, system]);

  const onBlur = useCallback(() => {
    clearLocalCursor();
  }, [clearLocalCursor]);

  return {
    note,
    setNote,
    onFocus,
    onBlur,
    isConnected: !!store,
  };
}

export function usePresence(patientId: string) {
  const { collaborators } = useCollaboration();
  return getCursorsForPatient(
    { cursors: {} } as PatientNoteStore,
    patientId
  ).filter((c) => collaborators.some((col) => col.userId === c.userId));
}

export function useCollaborationStatus() {
  const { isConnected, collaborators } = useCollaboration();
  return {
    isConnected,
    collaboratorCount: collaborators.length,
    collaborators,
  };
}
