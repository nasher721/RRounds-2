import assert from "node:assert/strict";

type RequestKind = "patient-list" | "todo-map";

export interface DashboardRequestEvent {
  kind: RequestKind;
  reason: string;
  patientIds?: string[];
}
export function createDashboardRequestCounter() {
  const events: DashboardRequestEvent[] = [];

  return {
    recordPatientListFetch(reason: string) {
      events.push({ kind: "patient-list", reason });
    },
    recordTodoMapFetch(patientIds: string[], reason: string) {
      events.push({ kind: "todo-map", patientIds: [...patientIds].sort(), reason });
    },
    snapshot() {
      return [...events];
    },
    clear() {
      events.length = 0;
    },
    assertNoDuplicateFullReloadsAfterSelection() {
      const patientListFetches = events.filter((event) => event.kind === "patient-list");
      const todoMapReloads = events.filter((event) => event.kind === "todo-map");

      assert.equal(
        patientListFetches.length,
        0,
        `patient selection should not refetch the full patient list; saw ${patientListFetches.length}`,
      );
      assert.equal(
        todoMapReloads.length,
        0,
        `patient selection should not reload the full todo map; saw ${todoMapReloads.length}`,
      );
    },
  };
}
