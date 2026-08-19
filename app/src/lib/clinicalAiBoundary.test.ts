import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

test("clinical AI stays behind the authenticated Edge boundary", () => {
  const clinicalAssistant = read("src/hooks/useLLMClinicalAssistant.ts");
  const modelSettings = read("src/components/settings/AIModelSettingsPanel.tsx");

  assert.doesNotMatch(clinicalAssistant, /getLLMRouter|doRouterRequest/);
  assert.doesNotMatch(modelSettings, /setAiCredential|Provider Credentials|type="password"/);
  assert.match(modelSettings, /organization-managed/i);
});

test("the browser source tree contains no provider router or model-selection capability", () => {
  const browserRouter = new URL("../services/llm/config.ts", import.meta.url);
  const providerAdapters = new URL("../services/llm/providers/index.ts", import.meta.url);
  const modelSelectionHook = new URL("../hooks/useLLMModelSelection.ts", import.meta.url);
  const obsoleteMigrationGuide = new URL("../../AI_MIGRATION_GUIDE.md", import.meta.url);
  const obsoleteUsageReport = new URL("../../AI_USAGE_REPORT.md", import.meta.url);
  const settings = read("src/contexts/SettingsContext.tsx");

  assert.equal(existsSync(browserRouter), false, "browser provider adapters must not ship in source");
  assert.equal(existsSync(providerAdapters), false, "direct provider implementations must not return");
  assert.equal(existsSync(modelSelectionHook), false, "browser model selection must not return");
  assert.equal(existsSync(obsoleteMigrationGuide), false, "unsafe browser-router guidance must not return");
  assert.equal(existsSync(obsoleteUsageReport), false, "obsolete provider recommendations must not return");
  assert.doesNotMatch(
    settings,
    /setAiModel|resetAiModel|setAiFeatureModel|getModelForFeature|LLMProviderName/,
  );
});

test("shared clinical completions resolve a configured clinical provider with failover", () => {
  const client = read("supabase/functions/_shared/llm-client.ts");

  assert.match(client, /resolveClinicalProvider\(requestedModel\.model\)/);
  assert.match(client, /buildClinicalProviderAttempts/);
  assert.match(client, /isRetryableProviderStatus/);
  assert.doesNotMatch(client, /CLINICAL_PHI_LLM_PROVIDER/);
});

test("direct medication and audio provider calls use the clinical provider policy", () => {
  const medications = read("supabase/functions/format-medications/index.ts");
  const transcription = read("supabase/functions/transcribe-audio/index.ts");

  assert.match(medications, /resolveClinicalProvider\(modelResult\.model\)/);
  assert.match(medications, /sanitizeOutboundLLMPrompts/);
  assert.match(transcription, /isClinicalAIDisabled\(\)/);
  assert.match(transcription, /getLLMConfig\("openai"\)/);
});

test("browser Edge requests do not select deployment providers or models", () => {
  const requestHooks = [
    "src/hooks/useAIClinicalAssistant.ts",
    "src/hooks/useBatchCourseGenerator.ts",
    "src/hooks/useDailySummaryGenerator.ts",
    "src/hooks/useDictation.ts",
    "src/hooks/useIntervalEventsGenerator.ts",
    "src/hooks/useLLMClinicalAssistant.ts",
    "src/hooks/useMedicationFormat.ts",
    "src/hooks/usePatientCourseGenerator.ts",
    "src/hooks/useStreamingAI.ts",
    "src/hooks/useTextTransform.ts",
    "src/hooks/usePatientTodos.ts",
  ];

  for (const path of requestHooks) {
    const source = read(path);
    assert.doesNotMatch(source, /model:\s*getModelForFeature\(/, path);
  }
});

test("production deployment verifies clinical AI provider keys and the kill switch", () => {
  const workflow = read(".github/workflows/deploy-supabase.yml");

  assert.match(workflow, /CLINICAL_AI_DISABLED:.*vars\.CLINICAL_AI_DISABLED/);
  assert.match(workflow, /supabase secrets list/);
  assert.match(workflow, /OPENAI_API_KEY/);
  assert.match(workflow, /GEMINI_API_KEY/);
  assert.match(workflow, /GROQ_API_KEY/);
  assert.match(workflow, /CLINICAL_AI_DISABLED=\$\{disabled_flag\}/);
});

test("the production bundle gate rejects direct clinical provider origins", () => {
  const bundleGate = read("scripts/assert-client-secret-not-bundled.mjs");

  assert.match(bundleGate, /api\.openai\.com/);
  assert.match(bundleGate, /api\.anthropic\.com/);
  assert.match(bundleGate, /generativelanguage\.googleapis\.com/);
  assert.match(bundleGate, /api\.groq\.com/);
  assert.match(bundleGate, /direct clinical-provider origin/);
});
