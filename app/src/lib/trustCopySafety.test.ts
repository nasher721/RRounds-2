import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const publicClaimFiles = [
  'src/components/ai/AITransparencyPanel.tsx',
  'src/components/DictationButton.tsx',
  'src/components/landing/FeatureHighlights.tsx',
  'src/components/settings/AIModelSettingsPanel.tsx',
  'src/components/trust/TrustIndicators.tsx',
  'src/pages/Privacy.tsx',
  'src/pages/Security.tsx',
];

const publicCopy = publicClaimFiles
  .map((file) => readFileSync(file, 'utf8'))
  .join('\n');

test('public trust copy does not make unsupported absolute security or privacy claims', () => {
  const forbiddenClaims = [
    /HIPAA Aligned/i,
    /HIPAA Aware/i,
    /we follow HIPAA/i,
    />\s*End-to-End Encryption\s*</i,
    /TLS 1\.3/i,
    /PHI is never stored/i,
    /All data is encrypted both in transit and at rest/i,
    /enterprise-grade encryption/i,
    /Data is stored in the United States/i,
    /within your organization/i,
    /All data access and changes are logged/i,
    /comprehensive audit trails?/i,
    /No patient data sales/i,
    /We do not sell patient data/i,
    /New teams can create an account/i,
    />\s*Create account\s*</i,
    /View Full Privacy Policy/i,
  ];

  for (const claim of forbiddenClaims) {
    assert.doesNotMatch(publicCopy, claim);
  }
});

test('public trust copy describes deployment-dependent controls and provider handling', () => {
  assert.match(publicCopy, /when (?:the app is )?served over HTTPS|when deployed (?:behind|with) HTTPS/i);
  assert.match(publicCopy, /browser (?:cache|storage)|cached (?:in|by) (?:the )?browser/i);
  assert.match(publicCopy, /device (?:controls|protections)|managed device/i);
  assert.match(publicCopy, /provider[^.\n]*(?:retention|data handling)/i);
  assert.match(publicCopy, /(?:agreement|BAA)/i);
  assert.match(publicCopy, /not a comprehensive (?:access )?audit/i);
});

test('dictation disclosures describe both transcription and optional enhancement recipients', () => {
  const dictationCopy = [
    'src/components/DictationButton.tsx',
    'src/components/settings/AIModelSettingsPanel.tsx',
    'src/pages/Privacy.tsx',
  ]
    .map((file) => readFileSync(file, 'utf8'))
    .join('\n');

  assert.match(dictationCopy, /raw audio[^.\n]*OpenAI[^.\n]*transcription/i);
  assert.match(dictationCopy, /(?:resulting )?transcript[^.\n]*selected AI provider/i);
});

test('privacy page keeps an honest development fallback behind the approved notice gate', () => {
  const privacy = readFileSync('src/pages/Privacy.tsx', 'utf8');

  assert.match(privacy, /PRIVACY_NOTICE_IS_CONFIGURED/);
  assert.match(privacy, /Open approved privacy notice/i);
  assert.match(privacy, /not an approved privacy notice/i);
  assert.match(privacy, /deployment operator/i);
  assert.match(privacy, /before (?:a )?production/i);
  assert.match(privacy, /retention/i);
  assert.match(privacy, /deletion/i);
});

test('auth page never renders raw upstream authentication errors', () => {
  const auth = readFileSync('src/pages/Auth.tsx', 'utf8');

  assert.match(auth, /getSafeAuthErrorMessage/);
  assert.doesNotMatch(auth, /description:\s*error\.message/);
});
