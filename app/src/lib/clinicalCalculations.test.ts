import assert from "node:assert/strict";
import test from "node:test";

import { calculateCockcroftGault } from "./clinicalCalculations";

test("Cockcroft-Gault calculation applies the documented sex coefficient", () => {
  const input = {
    ageYears: 65,
    weightKg: 70,
    serumCreatinineMgDl: 1.2,
  };

  const maleEstimate = calculateCockcroftGault({ ...input, sex: "male" });
  const femaleEstimate = calculateCockcroftGault({ ...input, sex: "female" });

  assert.ok(Math.abs(maleEstimate - 60.7639) < 0.001);
  assert.ok(Math.abs(femaleEstimate - maleEstimate * 0.85) < 0.001);
});

test("Cockcroft-Gault calculation rejects unsafe or nonsensical inputs", () => {
  assert.throws(
    () => calculateCockcroftGault({ ageYears: 17, weightKg: 70, serumCreatinineMgDl: 1, sex: "male" }),
    /Age must be between 18 and 120 years/,
  );
  assert.throws(
    () => calculateCockcroftGault({ ageYears: 65, weightKg: 0, serumCreatinineMgDl: 1, sex: "male" }),
    /Weight must be greater than 0/,
  );
  assert.throws(
    () => calculateCockcroftGault({ ageYears: 65, weightKg: 70, serumCreatinineMgDl: 0, sex: "male" }),
    /Serum creatinine must be greater than 0/,
  );
});
