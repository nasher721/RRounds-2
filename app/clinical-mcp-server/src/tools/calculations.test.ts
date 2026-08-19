import assert from "node:assert/strict";
import test from "node:test";
import { calculateScore } from "./calculations.js";

test("calculates each supported formula with valid inputs", () => {
    const bmi = calculateScore("bmi", { weight_kg: 70, height_cm: 175 });
    assert.match(bmi.text, /^BMI: 22\.9 \(Normal weight\)/);
    assert.match(bmi.text, /Verify units, input accuracy/);
    assert.ok(Math.abs(Number(bmi.structuredContent.bmi) - 22.8571) < 0.001);

    const anionGap = calculateScore("anion_gap", {
        sodium: 140,
        chloride: 104,
        bicarbonate: 24
    });
    assert.equal(anionGap.structuredContent.anion_gap, 12);

    const correctedCalcium = calculateScore("corrected_calcium", {
        measured_calcium: 8,
        albumin: 2
    });
    assert.ok(Math.abs(Number(correctedCalcium.structuredContent.corrected_calcium) - 9.6) < 0.0001);
});

test("accepts an explicitly supplied zero bicarbonate instead of treating it as missing", () => {
    const result = calculateScore("anion_gap", {
        sodium: 140,
        chloride: 104,
        bicarbonate: 0
    });

    assert.equal(result.structuredContent.anion_gap, 36);
});

test("rejects missing, negative, zero-invalid, and non-finite inputs", () => {
    assert.throws(
        () => calculateScore("bmi", { weight_kg: 70 }),
        /Missing height_cm/
    );
    assert.throws(
        () => calculateScore("bmi", { weight_kg: -1, height_cm: 175 }),
        /weight_kg must be greater than 0/
    );
    assert.throws(
        () => calculateScore("bmi", { weight_kg: 70, height_cm: 0 }),
        /height_cm must be greater than 0/
    );
    assert.throws(
        () => calculateScore("anion_gap", { sodium: Number.POSITIVE_INFINITY, chloride: 104, bicarbonate: 24 }),
        /sodium must be a finite number/
    );
    assert.throws(
        () => calculateScore("corrected_calcium", { measured_calcium: 8, albumin: -0.1 }),
        /albumin must be greater than or equal to 0/
    );
});

test("rejects a non-finite calculated result", () => {
    assert.throws(
        () => calculateScore("bmi", { weight_kg: Number.MAX_VALUE, height_cm: Number.MIN_VALUE }),
        /BMI result is outside the supported numeric range/
    );
});
