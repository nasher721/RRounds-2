import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const fromRoot = (...segments: string[]) => path.join(process.cwd(), ...segments);

test('unsupported automatic acuity and protocol engines are absent', () => {
  const removedFiles = [
    'src/components/PatientAcuityBadge.tsx',
    'src/components/SmartProtocolSuggestions.tsx',
    'src/hooks/useProtocolSuggestions.ts',
    'src/hooks/useRiskScores.ts',
    'src/lib/riskScores/calculators.ts',
    'src/components/mobile/MobileLabTrends.tsx',
  ];

  for (const file of removedFiles) {
    assert.equal(existsSync(fromRoot(file)), false, `${file} must remain removed`);
  }
});

test('patient and census UI do not infer clinical state from note keywords', () => {
  const guardedFiles = [
    'src/types/riskScores.ts',
    'src/components/PatientCard.tsx',
    'src/components/UnitCensusDashboard.tsx',
  ];
  const source = guardedFiles
    .map((file) => readFileSync(fromRoot(file), 'utf8'))
    .join('\n');

  assert.doesNotMatch(source, /calculatePatientAcuity/);
  assert.doesNotMatch(source, /SmartProtocolSuggestions|ProtocolBadge|useProtocolSuggestions/);
  assert.doesNotMatch(source, /\.includes\(\s*['"]mi['"]\s*\)/);
  assert.doesNotMatch(source, /allText\.includes|labText\.match/);
});

test('empty clinical views do not fabricate patient, lab, analytics, or timeline data', () => {
  const guardedFiles = [
    'src/components/mobile/MobileAnalytics.tsx',
    'src/components/mobile/index.ts',
    'src/components/AnalyticsDashboard.tsx',
    'src/components/labs/LabTrendingChart.tsx',
    'src/components/features/index.ts',
    'src/components/tools/timeline/TimelineGenerator.tsx',
  ];
  const source = guardedFiles
    .map((file) => readFileSync(fromRoot(file), 'utf8'))
    .join('\n');

  assert.doesNotMatch(source, /generateSample(?:Labs|DashboardData|LabData)/);
  assert.doesNotMatch(source, /Math\.random\(\)/);
  assert.doesNotMatch(source, /Initial sample data|EMS Arrival|Patient found down/);
  assert.match(source, /No analytics data available/);
  assert.match(source, /useState<TimelineEvent\[\]>\(\[\]\)/);
});

test('unstructured lab text is not automatically labeled normal, abnormal, or critical', () => {
  assert.equal(
    existsSync(fromRoot('src/components/LabTrendingPanel.tsx')),
    false,
    'the free-text lab inference panel must remain removed',
  );

  const callerSource = [
    'src/components/PatientCard.tsx',
    'src/components/dashboard/DesktopDashboard.tsx',
  ]
    .map((file) => readFileSync(fromRoot(file), 'utf8'))
    .join('\n');

  assert.doesNotMatch(callerSource, /LabTrendBadge|LabTrendingPanel/);
});
