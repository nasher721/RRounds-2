import {
  authenticateRequest,
  checkRateLimit,
  handleOptions,
  jsonResponse,
  parseAndValidateBody,
  RATE_LIMITS,
  safeLog,
  validateStringArray,
} from "../_shared/mod.ts";

interface DrugInteractionRequest {
  medications: string[];
}

export type DrugLookupStatus = "available" | "not_found" | "provider_error";
export type DrugPairStatus =
  | "interaction_found"
  | "no_documented_interaction"
  | "inconclusive";

export interface DrugCoverage {
  drug: string;
  status: DrugLookupStatus;
  labelsChecked: number;
  message: string;
}

export interface DocumentedInteraction {
  drug1: string;
  drug2: string;
  description: string;
  source: "FDA product labeling";
  evidenceDrug: string;
}

export interface DrugPairAssessment {
  drug1: string;
  drug2: string;
  status: DrugPairStatus;
  message: string;
}

export interface DrugInteractionCheckResult {
  success: true;
  interactions: DocumentedInteraction[];
  assessments: DrugPairAssessment[];
  coverage: DrugCoverage[];
  overallStatus: "complete" | "inconclusive";
  checkedCount: number;
  disclaimer: string;
}

interface OpenFDAResult {
  id?: string;
  openfda?: {
    brand_name?: string[];
    generic_name?: string[];
    rxcui?: string[];
  };
  drug_interactions?: string[];
}

interface DrugLookupResult {
  coverage: DrugCoverage;
  labels: OpenFDAResult[];
}

const OPENFDA_BASE_URL = "https://api.fda.gov/drug/label.json";
const MAX_MEDICATIONS = 20;
const MAX_MEDICATION_NAME_BYTES = 200;
const MAX_LABEL_RESULTS = 5;
const LOOKUP_TIMEOUT_MS = 8_000;

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

function getOpenFDAApiKey(): string | undefined {
  try {
    return Deno.env.get("OPENFDA_API_KEY");
  } catch {
    return undefined;
  }
}

export function normalizeDrugName(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getOpenFDAUrl(drugName: string): string {
  const escapedDrug = drugName.replace(/[\\"]/g, "\\$&");
  const url = new URL(OPENFDA_BASE_URL);
  url.searchParams.set(
    "search",
    `openfda.brand_name:"${escapedDrug}" OR openfda.generic_name:"${escapedDrug}"`,
  );
  url.searchParams.set("limit", String(MAX_LABEL_RESULTS));
  const apiKey = getOpenFDAApiKey();
  if (apiKey) url.searchParams.set("api_key", apiKey);
  return url.toString();
}

export async function fetchDrugLabels(
  drugName: string,
  fetchImpl: FetchLike = fetch,
): Promise<DrugLookupResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);

  try {
    const response = await fetchImpl(getOpenFDAUrl(drugName), {
      signal: controller.signal,
    });

    if (response.status === 404) {
      return {
        coverage: {
          drug: drugName,
          status: "not_found",
          labelsChecked: 0,
          message: "No matching FDA product label was found.",
        },
        labels: [],
      };
    }

    if (!response.ok) {
      safeLog("warn", "OpenFDA drug lookup failed", {
        statusCode: response.status,
      });
      return {
        coverage: {
          drug: drugName,
          status: "provider_error",
          labelsChecked: 0,
          message: response.status === 429
            ? "FDA label service rate limit reached."
            : "FDA label service was unavailable.",
        },
        labels: [],
      };
    }

    const payload = await response.json() as { results?: unknown };
    const labels = Array.isArray(payload.results)
      ? payload.results.filter((item): item is OpenFDAResult =>
        typeof item === "object" && item !== null
      )
      : [];

    if (labels.length === 0) {
      return {
        coverage: {
          drug: drugName,
          status: "not_found",
          labelsChecked: 0,
          message: "No matching FDA product label was found.",
        },
        labels: [],
      };
    }

    return {
      coverage: {
        drug: drugName,
        status: "available",
        labelsChecked: labels.length,
        message: `${labels.length} matching FDA product label${
          labels.length === 1 ? "" : "s"
        } reviewed.`,
      },
      labels,
    };
  } catch (error) {
    safeLog("warn", "OpenFDA drug lookup failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      coverage: {
        drug: drugName,
        status: "provider_error",
        labelsChecked: 0,
        message: error instanceof DOMException && error.name === "AbortError"
          ? "FDA label service timed out."
          : "FDA label service was unavailable.",
      },
      labels: [],
    };
  } finally {
    clearTimeout(timeout);
  }
}

function normalizedText(value: string): string {
  return ` ${
    value
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  } `;
}

function extractInteractionEvidence(
  label: OpenFDAResult,
  otherDrug: string,
): string | null {
  const needle = normalizedText(otherDrug);
  if (needle.trim().length < 2) return null;

  for (const section of label.drug_interactions ?? []) {
    if (!normalizedText(section).includes(needle)) continue;

    const matchingSentence = section
      .split(/(?<=[.!?])\s+/)
      .find((sentence) => normalizedText(sentence).includes(needle));
    const evidence = (matchingSentence ?? section).trim();
    return evidence.length > 500 ? `${evidence.slice(0, 497)}...` : evidence;
  }
  return null;
}

function evidenceFromLookup(
  lookup: DrugLookupResult,
  labelDrug: string,
  otherDrug: string,
): DocumentedInteraction[] {
  const evidence: DocumentedInteraction[] = [];
  const seenDescriptions = new Set<string>();

  for (const label of lookup.labels) {
    const description = extractInteractionEvidence(label, otherDrug);
    if (!description || seenDescriptions.has(description)) continue;
    seenDescriptions.add(description);
    evidence.push({
      drug1: labelDrug,
      drug2: otherDrug,
      description,
      source: "FDA product labeling",
      evidenceDrug: labelDrug,
    });
  }

  return evidence;
}

export function assessDrugLookups(
  medications: string[],
  lookups: Map<string, DrugLookupResult>,
): DrugInteractionCheckResult {
  const interactions: DocumentedInteraction[] = [];
  const assessments: DrugPairAssessment[] = [];

  for (let i = 0; i < medications.length; i++) {
    for (let j = i + 1; j < medications.length; j++) {
      const drug1 = medications[i];
      const drug2 = medications[j];
      const lookup1 = lookups.get(drug1)!;
      const lookup2 = lookups.get(drug2)!;
      const pairEvidence = [
        ...evidenceFromLookup(lookup1, drug1, drug2),
        ...evidenceFromLookup(lookup2, drug2, drug1),
      ];

      if (pairEvidence.length > 0) {
        interactions.push(...pairEvidence);
        assessments.push({
          drug1,
          drug2,
          status: "interaction_found",
          message:
            "An interaction mention was found in retrieved FDA labeling.",
        });
      } else if (
        lookup1.coverage.status === "available" &&
        lookup2.coverage.status === "available"
      ) {
        assessments.push({
          drug1,
          drug2,
          status: "no_documented_interaction",
          message:
            "No interaction was documented in the FDA labels retrieved for either drug.",
        });
      } else {
        const unavailable = [lookup1.coverage, lookup2.coverage]
          .filter((coverage) => coverage.status !== "available")
          .map((coverage) => coverage.drug)
          .join(" and ");
        assessments.push({
          drug1,
          drug2,
          status: "inconclusive",
          message: `Coverage was incomplete for ${unavailable}.`,
        });
      }
    }
  }

  const coverage = medications.map((drug) => lookups.get(drug)!.coverage);
  return {
    success: true,
    interactions,
    assessments,
    coverage,
    overallStatus: coverage.every((item) => item.status === "available")
      ? "complete"
      : "inconclusive",
    checkedCount: medications.length,
    disclaimer:
      "FDA product labels are not a complete interaction database. An absent label mention does not establish safety; verify with a validated interaction reference or pharmacist.",
  };
}

export async function checkMedicationSet(
  medications: string[],
  fetchImpl: FetchLike = fetch,
): Promise<DrugInteractionCheckResult> {
  const lookupEntries = await Promise.all(
    medications.map(async (drug) =>
      [drug, await fetchDrugLabels(drug, fetchImpl)] as const
    ),
  );
  return assessDrugLookups(medications, new Map(lookupEntries));
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return handleOptions(req);
  if (req.method !== "POST") {
    return jsonResponse(
      req,
      { success: false, error: "Method not allowed" },
      405,
    );
  }

  const authResult = await authenticateRequest(req);
  if ("error" in authResult) return authResult.error;

  const rateLimitResult = await checkRateLimit(
    req,
    RATE_LIMITS.standard,
    authResult.userId,
  );
  if (!rateLimitResult.allowed) return rateLimitResult.response!;

  const bodyResult = await parseAndValidateBody<DrugInteractionRequest>(req);
  if (!bodyResult.valid) return bodyResult.response;

  const validated = validateStringArray(
    bodyResult.data.medications,
    "medications",
    MAX_MEDICATIONS,
    MAX_MEDICATION_NAME_BYTES,
  );
  if (!Array.isArray(validated)) {
    return jsonResponse(req, { success: false, error: validated.error }, 400);
  }

  const medications = [
    ...new Set(validated.map(normalizeDrugName).filter(Boolean)),
  ];
  if (medications.length < 2) {
    return jsonResponse(req, {
      success: false,
      error: "At least 2 distinct valid medication names are required",
    }, 400);
  }

  safeLog("info", "Drug interaction check request accepted", {
    medicationCount: medications.length,
  });

  const result = await checkMedicationSet(medications);
  safeLog("info", "Drug interaction check completed", {
    interactionCount: result.interactions.length,
    medicationCount: result.checkedCount,
    status: result.overallStatus,
  });
  return jsonResponse(req, result);
}

if (import.meta.main) Deno.serve(handler);
