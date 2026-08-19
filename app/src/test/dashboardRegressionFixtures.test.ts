import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dashboardPatients8,
  dashboardPatients20,
  dashboardImportPatients,
  dashboardPatientUpdatePatch,
  dashboardPatients3,
  makeDashboardPatientRows,
  makeDashboardPatients,
  makeDashboardTodoRows,
  makeDashboardTodosMap,
  productionReadinessFixtures,
  createThrowingStorage,
} from "@/test/dashboardRegressionFixtures";
import { createDashboardRequestCounter } from "@/test/dashboardRequestInstrumentation";

describe("dashboard regression fixtures", () => {
  it("provides a deterministic 8-patient roster fixture", () => {
    assert.equal(dashboardPatients8.length, 8);
    assert.deepEqual(
      dashboardPatients8.map((patient) => patient.bed),
      ["A01", "A02", "A03", "A04", "B05", "B06", "B07", "B08"],
    );
    assert.equal(dashboardPatients8[0].id, "patient-01");
    assert.equal(dashboardPatients8[7].mrn, "MRN-900008");
  });

  it("provides a deterministic 20-patient census fixture with stable todos", () => {
    const patients = makeDashboardPatients(20);
    const todosMap = makeDashboardTodosMap(patients);

    assert.equal(patients.length, 20);
    assert.equal(dashboardPatients20[19].bed, "E20");
    assert.equal(Object.keys(todosMap).length, 20);
    assert.equal(todosMap["patient-20"][0].content, "Review active plan for E20");
  });

  it("provides an explicit three-patient roster fixture for compact dashboard states", () => {
    assert.equal(dashboardPatients3.length, 3);
    assert.deepEqual(
      dashboardPatients3.map((patient) => patient.bed),
      ["A01", "A02", "A03"],
    );
    assert.deepEqual(
      dashboardPatients3.map((patient) => patient.id),
      ["patient-01", "patient-02", "patient-03"],
    );
  });

  it("provides database-row mocks and small workflow fixtures for dashboard harnesses", () => {
    const patientRows = makeDashboardPatientRows(dashboardPatients8);
    const todoRows = makeDashboardTodoRows(dashboardPatients8);

    assert.equal(patientRows[0].patient_number, 1);
    assert.equal(patientRows[0].clinical_summary, dashboardPatients8[0].clinicalSummary);
    assert.equal(todoRows[0].patient_id, "patient-01");
    assert.equal(dashboardImportPatients.length, 3);
    assert.equal(dashboardPatientUpdatePatch.field, "clinicalSummary");
  });

  it("exposes shared production-readiness scenarios used by Step 1 harnesses", () => {
    assert.equal(productionReadinessFixtures.zeroPatients.length, 0);
    assert.equal(productionReadinessFixtures.threePatientRoster.length, 3);
    assert.equal(productionReadinessFixtures.selectedNonFirstPatient.id, "patient-03");
    assert.equal(productionReadinessFixtures.filteredEmpty.filteredPatients.length, 0);
    assert.equal(productionReadinessFixtures.filteredEmpty.patients.length, 3);

    const throwingStorage = createThrowingStorage();
    assert.throws(() => throwingStorage.getItem("x"), /Access to storage is not allowed/);
    assert.throws(() => throwingStorage.setItem("x", "1"), /Quota exceeded/);

    assert.equal(productionReadinessFixtures.activityFetchFailure().error?.message, "activity service unavailable");
    assert.equal(productionReadinessFixtures.dictationPermissionDenied().name, "NotAllowedError");
  });
});

describe("dashboard request-count instrumentation", () => {
  it("passes when patient selection uses already-loaded patients and todo map", () => {
    const counter = createDashboardRequestCounter();

    counter.assertNoDuplicateFullReloadsAfterSelection();
    assert.deepEqual(counter.snapshot(), []);
  });

  it("detects duplicate full patient-list fetches after selection", () => {
    const counter = createDashboardRequestCounter();
    counter.recordPatientListFetch("selected patient-02");

    assert.throws(
      () => counter.assertNoDuplicateFullReloadsAfterSelection(),
      /patient selection should not refetch the full patient list/,
    );
  });

  it("detects unnecessary full todo-map reloads after selection", () => {
    const counter = createDashboardRequestCounter();
    counter.recordTodoMapFetch(
      dashboardPatients8.map((patient) => patient.id),
      "selected patient-03",
    );

    assert.throws(
      () => counter.assertNoDuplicateFullReloadsAfterSelection(),
      /patient selection should not reload the full todo map/,
    );
  });
});
