import test from "node:test";
import assert from "node:assert/strict";
import { hl7Parser } from "@/lib/hl7";

test("parses canonical CR-delimited ADT messages and MSH fields", () => {
  const raw = [
    "MSH|^~\\&|SendingApp|SendingFacility|ReceivingApp|ReceivingFacility|20240701123045||ADT^A01^ADT_A01|MSG00001|P|2.5",
    "PID|1||12345^^^MRN||Doe^Jane||19800102|F",
    "PV1|1|I|ICU^12^A",
  ].join("\r");

  const message = hl7Parser.parse(raw);
  assert.ok(message);
  assert.deepEqual(message.messageType, {
    event: "ADT",
    trigger: "A01",
    structure: "ADT_A01",
  });
  assert.equal(message.messageControlId, "MSG00001");
  assert.equal(message.triggerEvent, "A01");

  const adt = hl7Parser.parseADT(message);
  assert.ok(adt);
  assert.equal(adt.patient.mrn, "12345");
  assert.equal(adt.patient.firstName, "Jane");
  assert.equal(adt.patient.lastName, "Doe");
  assert.equal(adt.visit.patientClass, "I");
  assert.match(hl7Parser.createACK(message, "AA"), /MSA\|AA\|MSG00001/);
});

test("reads ORU observation units from OBX-6", () => {
  const raw = [
    "MSH|^~\\&|Monitor|ICU|RRNOTES|Hospital|20240701123045||ORU^R01^ORU_R01|MSG00002|P|2.5",
    "PID|1||67890^^^MRN||Patient^Test",
    "OBX|1|NM|HR^Heart rate||87|beats/min|||||F|||20240701122900",
  ].join("\r");

  const message = hl7Parser.parse(raw);
  assert.ok(message);
  const oru = hl7Parser.parseORU(message);
  assert.ok(oru);
  assert.equal(oru.observations.length, 1);
  assert.equal(oru.observations[0].value, "87");
  assert.equal(oru.observations[0].unit, "beats/min");
});
