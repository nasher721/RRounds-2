import assert from "node:assert/strict";
import test from "node:test";
import { getPatientIdentity, normalizePatientAlerts, normalizePatientIdentityValue } from "./patientIdentity";

test("normalizes blank and unresolved template values", () => {
  assert.equal(normalizePatientIdentityValue(""), "Not documented");
  assert.equal(normalizePatientIdentityValue("   "), "Not documented");
  assert.equal(normalizePatientIdentityValue("[MRN]"), "Not documented");
  assert.equal(normalizePatientIdentityValue(" [Code Status] "), "Not documented");
  assert.equal(normalizePatientIdentityValue("MRN-123"), "MRN-123");
});

test("builds a complete identity without duplicate allergies", () => {
  assert.deepEqual(normalizePatientAlerts([" Penicillin ", "penicillin", "[No Allergies]"]), ["Penicillin"]);
  const identity = getPatientIdentity({
    id: "patient-1",
    patientNumber: 1,
    name: "  Ada Lovelace ",
    mrn: "[MRN]",
    bed: "7A",
    clinicalSummary: "",
    intervalEvents: "",
    imaging: "",
    labs: "",
    systems: {} as never,
    medications: { infusions: [], scheduled: [], prn: [] },
    fieldTimestamps: {},
    collapsed: false,
    createdAt: "",
    lastModified: "",
    attendingPhysician: "[Attending]",
    dateOfBirth: "1980-01-02",
    gender: "female",
    admissionDate: "2026-08-01T12:00:00Z",
    codeStatus: undefined,
    alerts: ["Penicillin", "penicillin", "[No Allergies]", "Isolation: Contact"],
  });

  assert.deepEqual(identity, {
    name: "Ada Lovelace",
    mrn: "Not documented",
    room: "7A",
    dob: "1980-01-02",
    gender: "Female",
    allergies: "Penicillin",
    isolation: "Contact",
    codeStatus: "Not documented",
    attending: "Not documented",
    admissionDate: "2026-08-01T12:00:00Z",
    diagnosis: "Not documented",
  });
});
