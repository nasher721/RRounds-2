import test from 'node:test';
import assert from 'node:assert/strict';
import { mapFHIRToPatient } from './mapper';

test('FHIR import keeps identity, allergies, and medications in structured chart fields', () => {
  const result = mapFHIRToPatient(
    {
      name: [{ given: ['Jane'], family: 'Doe' }],
      birthDate: '1980-01-02',
      gender: 'female',
      identifier: [{
        value: 'MRN-123',
        type: { coding: [{ code: 'MR' }] },
      }],
    },
    [
      {
        medicationCodeableConcept: { text: 'Aspirin' },
        dosageInstruction: [{ text: '81 mg daily' }],
      },
      {
        medicationCodeableConcept: { text: 'Acetaminophen' },
        dosageInstruction: [{ text: '650 mg', asNeededBoolean: true }],
      },
    ],
    [{
      substance: { text: 'Penicillin' },
      reaction: [{ description: 'rash' }],
      clinicalStatus: { coding: [{ code: 'active' }] },
    }],
  );

  assert.equal(result.patient.name, 'Jane Doe');
  assert.equal(result.patient.mrn, 'MRN-123');
  assert.equal(result.patient.bed, '');
  assert.equal(result.patient.clinicalSummary, '');
  assert.equal(result.patient.dateOfBirth, '1980-01-02');
  assert.equal(result.patient.gender, 'female');
  assert.deepEqual(result.patient.alerts, ['Penicillin (rash)']);
  assert.deepEqual(result.patient.medications?.scheduled, ['Aspirin 81 mg daily']);
  assert.deepEqual(result.patient.medications?.prn, ['Acetaminophen 650 mg']);
});

test('FHIR import omits unsupported gender values instead of writing them into notes', () => {
  const result = mapFHIRToPatient(
    { name: [{ text: 'Alex Patient' }], gender: 'not-a-fhir-gender' },
    [],
    [],
  );

  assert.equal(result.patient.gender, undefined);
  assert.equal(result.patient.clinicalSummary, '');
});
