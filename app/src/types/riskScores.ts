/**
 * Manual clinical risk-score inputs and deterministic scoring functions.
 *
 * These functions calculate only the published point totals/categories. They do
 * not infer inputs from patient notes and do not provide treatment, disposition,
 * or patient-specific mortality recommendations.
 */

export interface RiskScoreResult {
  score: number;
  maxScore: number;
  interpretation: string;
  riskLevel: 'neutral' | 'low' | 'moderate' | 'high';
  color: string;
}

export interface SOFAInputs {
  pao2fio2?: number;
  onVentilator?: boolean;
  platelets?: number;
  bilirubin?: number;
  map?: number;
  dopamine?: number;
  dobutamine?: boolean;
  epinephrine?: number;
  norepinephrine?: number;
  gcs?: number;
  creatinine?: number;
  urineOutput?: number;
}

export interface QSOFAInputs {
  respiratoryRate?: number;
  alteredMentation?: boolean;
  systolicBP?: number;
}

export interface CURB65Inputs {
  confusion?: boolean;
  bun?: number;
  respiratoryRate?: number;
  systolicBP?: number;
  diastolicBP?: number;
  age?: number;
}

export interface WellsDVTInputs {
  activeCancer?: boolean;
  paralysisParesis?: boolean;
  recentImmobilization?: boolean;
  localizedTenderness?: boolean;
  entireLegSwollen?: boolean;
  calfSwelling3cm?: boolean;
  pittingEdema?: boolean;
  collateralVeins?: boolean;
  previousDVT?: boolean;
  alternativeDiagnosisLikely?: boolean;
}

export interface WellsPEInputs {
  clinicalDVTSigns?: boolean;
  alternativeDiagnosisLessLikely?: boolean;
  heartRate100?: boolean;
  immobilizationOrSurgery?: boolean;
  previousPEOrDVT?: boolean;
  hemoptysis?: boolean;
  malignancy?: boolean;
}

export interface NEWS2Inputs {
  respiratoryRate?: number;
  spo2?: number;
  onSupplementalO2?: boolean;
  temperature?: number;
  systolicBP?: number;
  heartRate?: number;
  consciousness?: 'alert' | 'confusion' | 'voice' | 'pain' | 'unresponsive';
}

const colorFor = (riskLevel: RiskScoreResult['riskLevel']) => {
  switch (riskLevel) {
    case 'low':
      return 'text-green-600';
    case 'moderate':
      return 'text-amber-600';
    case 'high':
      return 'text-red-600';
    default:
      return 'text-blue-600';
  }
};

export const calculateSOFA = (inputs: SOFAInputs): RiskScoreResult => {
  let score = 0;

  if (inputs.pao2fio2 !== undefined) {
    if (inputs.pao2fio2 < 100 && inputs.onVentilator) score += 4;
    else if (inputs.pao2fio2 < 200 && inputs.onVentilator) score += 3;
    else if (inputs.pao2fio2 < 300) score += 2;
    else if (inputs.pao2fio2 < 400) score += 1;
  }

  if (inputs.platelets !== undefined) {
    if (inputs.platelets < 20) score += 4;
    else if (inputs.platelets < 50) score += 3;
    else if (inputs.platelets < 100) score += 2;
    else if (inputs.platelets < 150) score += 1;
  }

  if (inputs.bilirubin !== undefined) {
    if (inputs.bilirubin >= 12) score += 4;
    else if (inputs.bilirubin >= 6) score += 3;
    else if (inputs.bilirubin >= 2) score += 2;
    else if (inputs.bilirubin >= 1.2) score += 1;
  }

  const dopamine = inputs.dopamine ?? 0;
  const epinephrine = inputs.epinephrine ?? 0;
  const norepinephrine = inputs.norepinephrine ?? 0;
  if (dopamine > 15 || epinephrine > 0.1 || norepinephrine > 0.1) score += 4;
  else if (dopamine > 5 || epinephrine > 0 || norepinephrine > 0) score += 3;
  else if (dopamine > 0 || inputs.dobutamine) score += 2;
  else if (inputs.map !== undefined && inputs.map < 70) score += 1;

  if (inputs.gcs !== undefined) {
    if (inputs.gcs < 6) score += 4;
    else if (inputs.gcs < 10) score += 3;
    else if (inputs.gcs < 13) score += 2;
    else if (inputs.gcs < 15) score += 1;
  }

  let renalScore = 0;
  if (inputs.creatinine !== undefined) {
    if (inputs.creatinine >= 5) renalScore = 4;
    else if (inputs.creatinine >= 3.5) renalScore = 3;
    else if (inputs.creatinine >= 2) renalScore = 2;
    else if (inputs.creatinine >= 1.2) renalScore = 1;
  }
  if (inputs.urineOutput !== undefined) {
    if (inputs.urineOutput < 200) renalScore = Math.max(renalScore, 4);
    else if (inputs.urineOutput < 500) renalScore = Math.max(renalScore, 3);
  }
  score += renalScore;

  return {
    score,
    maxScore: 24,
    interpretation: 'Raw SOFA score for serial organ-dysfunction assessment.',
    riskLevel: 'neutral',
    color: colorFor('neutral'),
  };
};

export const calculateQSOFA = (inputs: QSOFAInputs): RiskScoreResult => {
  let score = 0;
  if (inputs.respiratoryRate !== undefined && inputs.respiratoryRate >= 22) score += 1;
  if (inputs.alteredMentation) score += 1;
  if (inputs.systolicBP !== undefined && inputs.systolicBP <= 100) score += 1;

  return {
    score,
    maxScore: 3,
    interpretation: `${score} of 3 qSOFA criteria present; this criteria count is not a diagnosis.`,
    riskLevel: 'neutral',
    color: colorFor('neutral'),
  };
};

export const calculateCURB65 = (inputs: CURB65Inputs): RiskScoreResult => {
  let score = 0;
  if (inputs.confusion) score += 1;
  if (inputs.bun !== undefined && inputs.bun > 19) score += 1;
  if (inputs.respiratoryRate !== undefined && inputs.respiratoryRate >= 30) score += 1;
  if (
    (inputs.systolicBP !== undefined && inputs.systolicBP < 90) ||
    (inputs.diastolicBP !== undefined && inputs.diastolicBP <= 60)
  ) score += 1;
  if (inputs.age !== undefined && inputs.age >= 65) score += 1;

  const riskLevel = score <= 1 ? 'low' : score === 2 ? 'moderate' : 'high';
  const category = score <= 1 ? 'lower' : score === 2 ? 'intermediate' : 'higher';
  return {
    score,
    maxScore: 5,
    interpretation: `CURB-65 ${category} score category (${score} of 5).`,
    riskLevel,
    color: colorFor(riskLevel),
  };
};

export const calculateWellsDVT = (inputs: WellsDVTInputs): RiskScoreResult => {
  let score = 0;
  if (inputs.activeCancer) score += 1;
  if (inputs.paralysisParesis) score += 1;
  if (inputs.recentImmobilization) score += 1;
  if (inputs.localizedTenderness) score += 1;
  if (inputs.entireLegSwollen) score += 1;
  if (inputs.calfSwelling3cm) score += 1;
  if (inputs.pittingEdema) score += 1;
  if (inputs.collateralVeins) score += 1;
  if (inputs.previousDVT) score += 1;
  if (inputs.alternativeDiagnosisLikely) score -= 2;

  const riskLevel = score <= 0 ? 'low' : score <= 2 ? 'moderate' : 'high';
  const category = riskLevel === 'low' ? 'Low' : riskLevel === 'moderate' ? 'Moderate' : 'High';
  return {
    score,
    maxScore: 9,
    interpretation: `${category} pretest-probability category (three-tier Wells DVT model).`,
    riskLevel,
    color: colorFor(riskLevel),
  };
};

export const calculateWellsPE = (inputs: WellsPEInputs): RiskScoreResult => {
  let score = 0;
  if (inputs.clinicalDVTSigns) score += 3;
  if (inputs.alternativeDiagnosisLessLikely) score += 3;
  if (inputs.heartRate100) score += 1.5;
  if (inputs.immobilizationOrSurgery) score += 1.5;
  if (inputs.previousPEOrDVT) score += 1.5;
  if (inputs.hemoptysis) score += 1;
  if (inputs.malignancy) score += 1;

  const likely = score > 4;
  const riskLevel = likely ? 'high' : 'low';
  return {
    score,
    maxScore: 12.5,
    interpretation: `PE ${likely ? 'likely' : 'unlikely'} — two-tier Wells PE model.`,
    riskLevel,
    color: colorFor(riskLevel),
  };
};

export const calculateNEWS2 = (inputs: NEWS2Inputs): RiskScoreResult => {
  const parameterScores: number[] = [];

  const respiratoryScore = inputs.respiratoryRate === undefined ? 0
    : inputs.respiratoryRate <= 8 || inputs.respiratoryRate >= 25 ? 3
    : inputs.respiratoryRate <= 11 ? 1
    : inputs.respiratoryRate >= 21 ? 2
    : 0;
  parameterScores.push(respiratoryScore);

  const oxygenSaturationScore = inputs.spo2 === undefined ? 0
    : inputs.spo2 <= 91 ? 3
    : inputs.spo2 <= 93 ? 2
    : inputs.spo2 <= 95 ? 1
    : 0;
  parameterScores.push(oxygenSaturationScore);
  parameterScores.push(inputs.onSupplementalO2 ? 2 : 0);

  const temperatureScore = inputs.temperature === undefined ? 0
    : inputs.temperature <= 35 ? 3
    : inputs.temperature <= 36 ? 1
    : inputs.temperature >= 39.1 ? 2
    : inputs.temperature >= 38.1 ? 1
    : 0;
  parameterScores.push(temperatureScore);

  const systolicBPScore = inputs.systolicBP === undefined ? 0
    : inputs.systolicBP <= 90 || inputs.systolicBP >= 220 ? 3
    : inputs.systolicBP <= 100 ? 2
    : inputs.systolicBP <= 110 ? 1
    : 0;
  parameterScores.push(systolicBPScore);

  const heartRateScore = inputs.heartRate === undefined ? 0
    : inputs.heartRate <= 40 || inputs.heartRate >= 131 ? 3
    : inputs.heartRate <= 50 ? 1
    : inputs.heartRate >= 111 ? 2
    : inputs.heartRate >= 91 ? 1
    : 0;
  parameterScores.push(heartRateScore);
  parameterScores.push(inputs.consciousness && inputs.consciousness !== 'alert' ? 3 : 0);

  const score = parameterScores.reduce((total, value) => total + value, 0);
  const hasSingleParameterScoreOfThree = parameterScores.includes(3);
  const riskLevel = score >= 7 ? 'high' : score >= 5 || hasSingleParameterScoreOfThree ? 'moderate' : 'low';
  const interpretation = score >= 7
    ? 'High NEWS2 aggregate-score category (SpO2 Scale 1).'
    : score >= 5
      ? 'Medium NEWS2 aggregate-score category (SpO2 Scale 1).'
      : hasSingleParameterScoreOfThree
        ? 'Low-medium NEWS2 category: a single parameter scored 3 (SpO2 Scale 1).'
        : 'Low NEWS2 aggregate-score category (SpO2 Scale 1).';

  return {
    score,
    maxScore: 20,
    interpretation,
    riskLevel,
    color: colorFor(riskLevel),
  };
};
