import assert from 'node:assert/strict';
import test from 'node:test';
import { checkDrugInteractions } from '@/services/drug-interaction.service';

declare global {
  var __SUPABASE_FUNCTIONS_INVOKE_MOCK__: undefined | (() => Promise<unknown>);
}

test.afterEach(() => {
  delete globalThis.__SUPABASE_FUNCTIONS_INVOKE_MOCK__;
});

test('rejects a legacy empty response that has no coverage evidence', async () => {
  globalThis.__SUPABASE_FUNCTIONS_INVOKE_MOCK__ = async () => ({
    data: { success: true, interactions: [] },
    error: null,
  });

  const result = await checkDrugInteractions(['warfarin', 'aspirin']);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.match(result.error, /coverage could not be verified/i);
  }
});

test('rejects a nominally complete response whose coverage is empty', async () => {
  globalThis.__SUPABASE_FUNCTIONS_INVOKE_MOCK__ = async () => ({
    data: {
      success: true,
      interactions: [],
      assessments: [],
      coverage: [],
      overallStatus: 'complete',
      checkedCount: 2,
      disclaimer: 'FDA labels are incomplete.',
    },
    error: null,
  });

  const result = await checkDrugInteractions(['warfarin', 'aspirin']);
  assert.equal(result.success, false);
});

test('rejects a no-documentation assessment built from incomplete coverage', async () => {
  globalThis.__SUPABASE_FUNCTIONS_INVOKE_MOCK__ = async () => ({
    data: {
      success: true,
      interactions: [],
      assessments: [{
        drug1: 'warfarin',
        drug2: 'aspirin',
        status: 'no_documented_interaction',
        message: 'No interaction was documented.',
      }],
      coverage: [
        {
          drug: 'warfarin',
          status: 'provider_error',
          labelsChecked: 0,
          message: 'FDA label service was unavailable.',
        },
        {
          drug: 'aspirin',
          status: 'available',
          labelsChecked: 1,
          message: '1 matching FDA product label reviewed.',
        },
      ],
      overallStatus: 'inconclusive',
      checkedCount: 2,
      disclaimer: 'FDA labels are incomplete.',
    },
    error: null,
  });

  const result = await checkDrugInteractions(['warfarin', 'aspirin']);
  assert.equal(result.success, false);
});

test('preserves an explicit inconclusive coverage response', async () => {
  globalThis.__SUPABASE_FUNCTIONS_INVOKE_MOCK__ = async () => ({
    data: {
      success: true,
      interactions: [],
      assessments: [{
        drug1: 'warfarin',
        drug2: 'aspirin',
        status: 'inconclusive',
        message: 'Coverage was incomplete for warfarin.',
      }],
      coverage: [
        {
          drug: 'warfarin',
          status: 'provider_error',
          labelsChecked: 0,
          message: 'FDA label service was unavailable.',
        },
        {
          drug: 'aspirin',
          status: 'available',
          labelsChecked: 1,
          message: '1 matching FDA product label reviewed.',
        },
      ],
      overallStatus: 'inconclusive',
      checkedCount: 2,
      disclaimer: 'FDA labels are incomplete.',
    },
    error: null,
  });

  const result = await checkDrugInteractions(['warfarin', 'aspirin']);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.overallStatus, 'inconclusive');
    assert.equal(result.coverage[0]?.status, 'provider_error');
  }
});
