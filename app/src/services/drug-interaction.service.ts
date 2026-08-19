import { supabase } from '@/integrations/supabase/client';
import { getUserFacingErrorMessage } from '@/lib/userFacingErrors';

export type DrugLookupStatus = 'available' | 'not_found' | 'provider_error';
export type DrugPairStatus = 'interaction_found' | 'no_documented_interaction' | 'inconclusive';

export interface DocumentedInteraction {
  drug1: string;
  drug2: string;
  description: string;
  source: 'FDA product labeling';
  evidenceDrug: string;
}

export interface DrugCoverage {
  drug: string;
  status: DrugLookupStatus;
  labelsChecked: number;
  message: string;
}

export interface DrugPairAssessment {
  drug1: string;
  drug2: string;
  status: DrugPairStatus;
  message: string;
}

export interface SuccessfulDrugInteractionResponse {
  success: true;
  interactions: DocumentedInteraction[];
  assessments: DrugPairAssessment[];
  coverage: DrugCoverage[];
  overallStatus: 'complete' | 'inconclusive';
  checkedCount: number;
  disclaimer: string;
}

export interface FailedDrugInteractionResponse {
  success: false;
  interactions: [];
  error: string;
}

export type DrugInteractionResponse =
  | SuccessfulDrugInteractionResponse
  | FailedDrugInteractionResponse;

const failedResponse = (error: string): FailedDrugInteractionResponse => ({
  success: false,
  interactions: [],
  error,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedPairKey(drug1: string, drug2: string): string {
  return [drug1.trim().toLowerCase(), drug2.trim().toLowerCase()].sort().join('\u0000');
}

function isSuccessfulResponse(value: unknown): value is SuccessfulDrugInteractionResponse {
  if (!isRecord(value) || value.success !== true) return false;
  if (value.overallStatus !== 'complete' && value.overallStatus !== 'inconclusive') return false;
  if (
    !Array.isArray(value.interactions) ||
    !Array.isArray(value.assessments) ||
    !Array.isArray(value.coverage) ||
    typeof value.checkedCount !== 'number' ||
    !Number.isInteger(value.checkedCount) ||
    value.checkedCount < 2 ||
    typeof value.disclaimer !== 'string' ||
    value.disclaimer.trim().length === 0
  ) return false;

  const coverageValid = value.coverage.every((item) =>
    isRecord(item) &&
    typeof item.drug === 'string' && item.drug.trim().length > 0 &&
    ['available', 'not_found', 'provider_error'].includes(String(item.status)) &&
    typeof item.labelsChecked === 'number' &&
    Number.isInteger(item.labelsChecked) && item.labelsChecked >= 0 &&
    (item.status === 'available' ? Number(item.labelsChecked) > 0 : Number(item.labelsChecked) === 0) &&
    typeof item.message === 'string' && item.message.trim().length > 0
  );
  const assessmentsValid = value.assessments.every((item) =>
    isRecord(item) &&
    typeof item.drug1 === 'string' && item.drug1.trim().length > 0 &&
    typeof item.drug2 === 'string' && item.drug2.trim().length > 0 &&
    ['interaction_found', 'no_documented_interaction', 'inconclusive'].includes(String(item.status)) &&
    typeof item.message === 'string' && item.message.trim().length > 0
  );
  const interactionsValid = value.interactions.every((item) =>
    isRecord(item) &&
    typeof item.drug1 === 'string' && item.drug1.trim().length > 0 &&
    typeof item.drug2 === 'string' && item.drug2.trim().length > 0 &&
    typeof item.description === 'string' && item.description.trim().length > 0 &&
    item.source === 'FDA product labeling' &&
    typeof item.evidenceDrug === 'string' && item.evidenceDrug.trim().length > 0 &&
    !('severity' in item)
  );

  if (!coverageValid || !assessmentsValid || !interactionsValid) return false;
  if (value.coverage.length !== value.checkedCount) return false;

  const coverageByDrug = new Map(
    value.coverage.map((item) => [item.drug.trim().toLowerCase(), item] as const),
  );
  if (coverageByDrug.size !== value.coverage.length) return false;

  const allCoverageAvailable = value.coverage.every((item) => item.status === 'available');
  if ((value.overallStatus === 'complete') !== allCoverageAvailable) return false;

  const expectedPairCount = (value.checkedCount * (value.checkedCount - 1)) / 2;
  if (value.assessments.length !== expectedPairCount) return false;

  const assessmentByPair = new Map<string, DrugPairAssessment>();
  for (const assessment of value.assessments) {
    const drug1Coverage = coverageByDrug.get(assessment.drug1.trim().toLowerCase());
    const drug2Coverage = coverageByDrug.get(assessment.drug2.trim().toLowerCase());
    const pairKey = normalizedPairKey(assessment.drug1, assessment.drug2);
    if (!drug1Coverage || !drug2Coverage || drug1Coverage === drug2Coverage) return false;
    if (assessmentByPair.has(pairKey)) return false;
    if (
      assessment.status === 'no_documented_interaction' &&
      (drug1Coverage.status !== 'available' || drug2Coverage.status !== 'available')
    ) return false;
    if (
      assessment.status === 'inconclusive' &&
      drug1Coverage.status === 'available' &&
      drug2Coverage.status === 'available'
    ) return false;
    assessmentByPair.set(pairKey, assessment as DrugPairAssessment);
  }

  const interactionPairs = new Set(
    value.interactions.map((item) => normalizedPairKey(item.drug1, item.drug2)),
  );
  for (const pairKey of interactionPairs) {
    if (assessmentByPair.get(pairKey)?.status !== 'interaction_found') return false;
  }
  for (const [pairKey, assessment] of assessmentByPair) {
    if ((assessment.status === 'interaction_found') !== interactionPairs.has(pairKey)) return false;
  }

  return true;
}

export async function checkDrugInteractions(medications: string[]): Promise<DrugInteractionResponse> {
  if (!medications || medications.length < 2) {
    return failedResponse('At least 2 medications required to check for interactions.');
  }

  const cleanMeds = medications
    .map(m => m.trim())
    .filter(m => m.length > 0);

  if (cleanMeds.length < 2) {
    return failedResponse('At least 2 valid medication names required.');
  }

  try {
    const { data, error } = await supabase.functions.invoke('check-drug-interactions', {
      body: { medications: cleanMeds },
    });

    if (error) {
      console.error('Drug interaction check failed');
      return failedResponse(getUserFacingErrorMessage(error, 'Failed to check drug interactions'));
    }

    if (!isSuccessfulResponse(data)) {
      return failedResponse(
        'Interaction coverage could not be verified. No safety conclusion was produced.',
      );
    }

    return data;
  } catch (error) {
    console.error('Drug interaction check failed');
    return failedResponse(getUserFacingErrorMessage(error, 'An unexpected error occurred'));
  }
}
