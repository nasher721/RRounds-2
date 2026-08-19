export interface CockcroftGaultInput {
  ageYears: number;
  weightKg: number;
  serumCreatinineMgDl: number;
  sex: "male" | "female";
}

/**
 * Estimates adult creatinine clearance with the Cockcroft-Gault equation.
 * This intentionally returns renal function only; medication doses and
 * intervals require a validated, drug-specific source and clinical review.
 */
export function calculateCockcroftGault({
  ageYears,
  weightKg,
  serumCreatinineMgDl,
  sex,
}: CockcroftGaultInput): number {
  if (!Number.isFinite(ageYears) || ageYears < 18 || ageYears > 120) {
    throw new RangeError("Age must be between 18 and 120 years.");
  }
  if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 500) {
    throw new RangeError("Weight must be greater than 0 and no more than 500 kg.");
  }
  if (!Number.isFinite(serumCreatinineMgDl) || serumCreatinineMgDl <= 0) {
    throw new RangeError("Serum creatinine must be greater than 0 mg/dL.");
  }

  const estimate = ((140 - ageYears) * weightKg) / (72 * serumCreatinineMgDl);
  return sex === "female" ? estimate * 0.85 : estimate;
}
