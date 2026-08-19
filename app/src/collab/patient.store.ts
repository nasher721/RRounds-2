import { syncedStore, getYjsValue } from "@syncedstore/core";
import * as Y from "yjs";

export type PatientNoteStore = {
  notes: Partial<Record<string, string>>;
  cursors: Partial<Record<string, CursorInfo>>;
};

export type CursorInfo = {
  name: string;
  color: string;
  system: string;
  timestamp: number;
};

export function createPatientNoteStore(doc?: Y.Doc): PatientNoteStore {
  return syncedStore(
    {
      notes: {} as Record<string, string>,
      cursors: {} as Record<string, CursorInfo>,
    },
    doc
  );
}

export function getYjsDocFromStore(store: PatientNoteStore): Y.Doc {
  return getYjsValue(store) as Y.Doc;
}

export function getNoteKey(patientId: string, system: string): string {
  return `${patientId}:${system}`;
}

export function updateNote(
  store: PatientNoteStore,
  patientId: string,
  system: string,
  content: string
): void {
  const key = getNoteKey(patientId, system);
  store.notes[key] = content;
}

export function getNote(
  store: PatientNoteStore,
  patientId: string,
  system: string
): string {
  const key = getNoteKey(patientId, system);
  return store.notes[key] || "";
}

export function updateCursor(
  store: PatientNoteStore,
  userId: string,
  info: CursorInfo
): void {
  store.cursors[userId] = { ...info, timestamp: Date.now() };
}

export function removeCursor(store: PatientNoteStore, userId: string): void {
  delete store.cursors[userId];
}

export function getCursorsForPatient(
  store: PatientNoteStore,
  patientId: string
): Array<{ userId: string } & CursorInfo> {
  const result: Array<{ userId: string } & CursorInfo> = [];
  for (const [userId, info] of Object.entries(store.cursors)) {
    if (info?.system.startsWith(patientId)) {
      result.push({ userId, ...info });
    }
  }
  return result.sort((a, b) => b.timestamp - a.timestamp);
}
