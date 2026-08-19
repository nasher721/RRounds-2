import assert from 'node:assert/strict';
import test from 'node:test';
import * as React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { InteractionCheckSummary } from './OpenFDAChecker';
import type { SuccessfulDrugInteractionResponse } from '@/services/drug-interaction.service';

test.afterEach(cleanup);

const baseResult: SuccessfulDrugInteractionResponse = {
  success: true,
  interactions: [],
  assessments: [],
  coverage: [
    {
      drug: 'warfarin',
      status: 'available',
      labelsChecked: 1,
      message: '1 matching FDA product label reviewed.',
    },
    {
      drug: 'aspirin',
      status: 'available',
      labelsChecked: 1,
      message: '1 matching FDA product label reviewed.',
    },
  ],
  overallStatus: 'complete',
  checkedCount: 2,
  disclaimer: 'FDA labels are not a complete interaction database.',
};

test('visibly distinguishes an inconclusive check from a documented-label negative', () => {
  render(
    React.createElement(InteractionCheckSummary, {
      result: {
        ...baseResult,
        overallStatus: 'inconclusive',
        coverage: [
          { ...baseResult.coverage[0], status: 'provider_error', labelsChecked: 0 },
          baseResult.coverage[1],
        ],
      },
    }),
  );

  assert.ok(screen.getByTestId('interaction-inconclusive'));
  assert.match(screen.getByText('Check inconclusive').textContent ?? '', /inconclusive/i);
  assert.equal(screen.queryByTestId('interaction-no-documented'), null);
});

test('labels a complete empty result as no documented label mention, not no interaction', () => {
  render(React.createElement(InteractionCheckSummary, { result: baseResult }));

  assert.ok(screen.getByTestId('interaction-no-documented'));
  assert.ok(screen.getByText('No interaction documented in retrieved FDA labels'));
  assert.match(screen.getByText(/not proof that the combination is safe/i).textContent ?? '', /not proof/i);
});

test('renders label evidence without assigning a severity', () => {
  render(
    React.createElement(InteractionCheckSummary, {
      result: {
        ...baseResult,
        interactions: [{
          drug1: 'aspirin',
          drug2: 'warfarin',
          description: 'Concomitant warfarin may increase bleeding risk.',
          source: 'FDA product labeling',
          evidenceDrug: 'aspirin',
        }],
      },
    }),
  );

  assert.ok(screen.getByTestId('interaction-evidence'));
  assert.ok(screen.getByText(/No severity was inferred/i));
  assert.equal(screen.queryByText(/CRITICAL|HIGH|MODERATE|LOW/), null);
});
