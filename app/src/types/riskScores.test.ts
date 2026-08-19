import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateCURB65,
  calculateNEWS2,
  calculateQSOFA,
  calculateSOFA,
  calculateWellsDVT,
  calculateWellsPE,
} from './riskScores';

test('manual calculators return score context without treatment or mortality recommendations', () => {
  const results = [
    calculateSOFA({
      pao2fio2: 400,
      onVentilator: false,
      platelets: 150,
      bilirubin: 1,
      map: 80,
      gcs: 15,
      creatinine: 1,
      urineOutput: 1_500,
    }),
    calculateQSOFA({ respiratoryRate: 18, alteredMentation: false, systolicBP: 120 }),
    calculateCURB65({
      confusion: false,
      bun: 12,
      respiratoryRate: 18,
      systolicBP: 120,
      diastolicBP: 80,
      age: 50,
    }),
    calculateWellsDVT({}),
    calculateWellsPE({}),
    calculateNEWS2({
      respiratoryRate: 16,
      spo2: 97,
      onSupplementalO2: false,
      temperature: 37,
      systolicBP: 120,
      heartRate: 80,
      consciousness: 'alert',
    }),
  ];

  for (const result of results) {
    assert.equal('recommendation' in result, false);
    assert.doesNotMatch(
      result.interpretation,
      /mortality|treatment|admission|transfer|workup|monitor|CT-PA|ultrasound|D-dimer/i,
    );
  }
});

test('SOFA renal scoring uses urine output even when creatinine is unavailable', () => {
  const result = calculateSOFA({ urineOutput: 150 });
  assert.equal(result.score, 4);
});

test('Wells PE uses one explicit two-tier model', () => {
  const result = calculateWellsPE({
    clinicalDVTSigns: true,
    heartRate100: true,
    hemoptysis: true,
  });

  assert.equal(result.score, 5.5);
  assert.equal(result.riskLevel, 'high');
  assert.match(result.interpretation, /PE likely.*two-tier/i);
});

test('qSOFA describes criteria present without diagnosing sepsis', () => {
  const result = calculateQSOFA({
    respiratoryRate: 22,
    alteredMentation: true,
    systolicBP: 120,
  });

  assert.equal(result.score, 2);
  assert.match(result.interpretation, /2 of 3 qSOFA criteria present/i);
  assert.doesNotMatch(result.interpretation, /sepsis|ICU|treatment/i);
});

test('NEWS2 identifies a single parameter scoring three without treatment advice', () => {
  const result = calculateNEWS2({
    respiratoryRate: 8,
    spo2: 97,
    onSupplementalO2: false,
    temperature: 37,
    systolicBP: 120,
    heartRate: 80,
    consciousness: 'alert',
  });

  assert.equal(result.score, 3);
  assert.equal(result.riskLevel, 'moderate');
  assert.match(result.interpretation, /single parameter.*3/i);
});
