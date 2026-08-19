import {
  authenticateRequest,
  checkRateLimit,
  createErrorResponse,
  handleOptions,
  jsonResponse,
  MAX_MEDIA_PAYLOAD_BYTES,
  parseAndValidateBody,
  RATE_LIMITS,
  safeErrorMessage,
  safeLog,
  validateImageArray,
} from "../_shared/mod.ts";
import {
  buildClinicalProviderAttempts,
  type ClinicalProviderAttempt,
  isRetryableProviderStatus,
  MissingAPIKeyError,
  normalizeOutputTokenLimit,
  resolveClinicalProvider,
  resolveRequestedModel,
} from "../_shared/llm-client.ts";

interface PatientSystems {
  neuro: string;
  cv: string;
  resp: string;
  renalGU: string;
  gi: string;
  endo: string;
  heme: string;
  infectious: string;
  skinLines: string;
  dispo: string;
}

interface MedicationCategories {
  infusions: string[];
  scheduled: string[];
  prn: string[];
  rawText?: string;
}

interface ParsedPatient {
  bed: string;
  name: string;
  mrn: string;
  age: string;
  sex: string;
  handoffSummary: string;
  intervalEvents: string;
  bedStatus: string;
  systems: PatientSystems;
  medications?: MedicationCategories;
}

type LLMUserContent =
  | string
  | Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  >;

const MAX_IMAGES_PER_REQUEST = 20;
const MAX_TEXT_CHARS = 1_000_000;
const MAX_PATIENTS_PARSED = 200;

/**
 * Remove duplicate sentences/phrases within a text field
 * Detects repeated phrases (>15 chars) and keeps only first occurrence
 * PRESERVES original line breaks and paragraph structure
 */
function deduplicateText(text: string): string {
  if (!text || text.length < 30) return text;

  // Split by line breaks first to preserve paragraph structure
  const lines = text.split(/\n/);
  const processedLines: string[] = [];
  const seenLines = new Set<string>();

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Preserve empty lines for paragraph spacing
    if (trimmedLine === "") {
      processedLines.push("");
      continue;
    }

    const normalizedLine = trimmedLine.toLowerCase().replace(/\s+/g, " ");

    // Skip if we've seen this exact line
    if (normalizedLine.length > 15 && seenLines.has(normalizedLine)) {
      safeLog("info", "Parse handoff duplicate line removed");
      continue;
    }

    // Check for substantial substring matches (80%+ overlap)
    let isDuplicate = false;
    for (const existing of seenLines) {
      if (normalizedLine.length > 20 && existing.length > 20) {
        // Check if one contains the other
        if (
          normalizedLine.includes(existing) || existing.includes(normalizedLine)
        ) {
          isDuplicate = true;
          safeLog("info", "Parse handoff overlapping line removed");
          break;
        }
      }
    }

    if (!isDuplicate) {
      seenLines.add(normalizedLine);
      processedLines.push(line); // Keep original line with its formatting
    }
  }

  // Rejoin with newlines to preserve original structure
  return processedLines.join("\n").trim();
}

/**
 * Remove repeated phrases within text (stuttering/echoing artifacts)
 * Detects when the same phrase appears multiple times in sequence
 * PRESERVES original line breaks
 */
/**
 * Remove repeated phrases within text (stuttering/echoing artifacts)
 * Detects when the same phrase appears multiple times in sequence
 * PRESERVES original line breaks
 * Added safety limits and optimized loop
 */
function removeRepeatedPhrases(text: string): string {
  if (!text || text.length < 20) return text;

  // Safety limit: if text is too long, skip aggressive processing to prevent timeout
  if (text.length > 50000) return text;

  // Process line by line to preserve structure
  const lines = text.split(/\n/);
  const processedLines: string[] = [];

  for (const line of lines) {
    if (line.trim() === "") {
      processedLines.push("");
      continue;
    }

    // Pattern: detect repeated consecutive phrases of 3+ words within this line
    const words = line.split(/\s+/);

    // Skip very long lines to prevent performance issues
    if (words.length > 1000) {
      processedLines.push(line);
      continue;
    }

    const result: string[] = [];
    let i = 0;

    while (i < words.length) {
      // Try to find repeating patterns of various lengths
      let foundRepeat = false;
      const maxPatternLen = Math.min(10, Math.floor((words.length - i) / 2));

      for (let patternLen = 3; patternLen <= maxPatternLen; patternLen++) {
        const pattern = words.slice(i, i + patternLen).join(" ");
        const nextPattern = words.slice(i + patternLen, i + patternLen * 2)
          .join(" ");

        if (pattern.length > 10 && pattern === nextPattern) {
          // Found a repeat - add pattern once and skip the duplicate
          result.push(...words.slice(i, i + patternLen));
          i += patternLen * 2;
          foundRepeat = true;
          safeLog("info", "Parse handoff repeated phrase removed");

          // Continue checking for more repeats of the same pattern
          while (i + patternLen <= words.length) {
            const checkPattern = words.slice(i, i + patternLen).join(" ");
            if (checkPattern === pattern) {
              i += patternLen;
              safeLog("info", "Parse handoff repeated phrase removed");
            } else {
              break;
            }
          }
          break;
        }
      }

      if (!foundRepeat) {
        result.push(words[i]);
        i++;
      }
    }

    processedLines.push(result.join(" "));
  }

  return processedLines.join("\n");
}

/**
 * Main text cleaning function - applies all deduplication strategies
 * Preserves HTML formatting tags and original line breaks
 */
function cleanPatientText(text: string): string {
  if (!text) return "";
  if (typeof text !== "string") return String(text);

  let cleaned = text;

  try {
    // Step 1: Normalize escaped newlines to actual newlines
    cleaned = cleaned.replace(/\\n/g, "\n");

    // Step 2: Remove repeated phrases (OCR stuttering)
    cleaned = removeRepeatedPhrases(cleaned);

    // Step 3: Remove duplicate lines
    cleaned = deduplicateText(cleaned);

    // Step 4: Clean up horizontal whitespace but PRESERVE newlines
    cleaned = cleaned.replace(/[ \t]+/g, " ");

    // Step 5: Normalize multiple consecutive blank lines to max 2
    cleaned = cleaned.replace(/\n{3,}/g, "\n\n");

    // Step 6: Convert newlines to <br> for HTML compatibility but respect block tags
    // First convert all newlines to <br>
    cleaned = cleaned.replace(/\n/g, "<br>");
    // Remove <br> immediately surrounding block elements to prevent double spacing
    cleaned = cleaned.replace(/<br>\s*(<(?:ul|ol|li|p|div|h[1-6]))/gi, "$1");
    cleaned = cleaned.replace(/(<\/(?:ul|ol|li|p|div|h[1-6])>)\s*<br>/gi, "$1");
  } catch (error) {
    safeLog("warn", "Parse handoff text cleanup failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    // Fallback: return marginally cleaned text
    return text.replace(/\\n/g, "\n");
  }

  return cleaned.trim();
}

/**
 * Merge medication arrays, removing duplicates
 */
function mergeMedications(
  a: MedicationCategories | undefined,
  b: MedicationCategories | undefined,
): MedicationCategories {
  const mergeArrays = (arr1: string[] = [], arr2: string[] = []): string[] => {
    const combined = [...arr1, ...arr2];
    return [...new Set(combined)];
  };

  return {
    infusions: mergeArrays(a?.infusions, b?.infusions),
    scheduled: mergeArrays(a?.scheduled, b?.scheduled),
    prn: mergeArrays(a?.prn, b?.prn),
  };
}

/**
 * Deduplicate patients by bed number - keeps the most complete record
 */
function deduplicatePatientsByBed(patients: ParsedPatient[]): ParsedPatient[] {
  const bedMap = new Map<string, ParsedPatient>();

  for (const patient of patients) {
    const normalizedBed = patient.bed.trim().toLowerCase();

    if (!normalizedBed) {
      safeLog("warn", "Parse handoff record without bed skipped");
      continue;
    }

    const existing = bedMap.get(normalizedBed);

    if (!existing) {
      bedMap.set(normalizedBed, patient);
    } else {
      // Merge: keep the version with more content, combine if needed
      safeLog("info", "Parse handoff duplicate record merged");

      const merged: ParsedPatient = {
        bed: patient.bed || existing.bed,
        name: patient.name || existing.name,
        mrn: patient.mrn || existing.mrn,
        age: patient.age || existing.age,
        sex: patient.sex || existing.sex,
        handoffSummary: (patient.handoffSummary?.length || 0) >
            (existing.handoffSummary?.length || 0)
          ? patient.handoffSummary
          : existing.handoffSummary,
        intervalEvents: (patient.intervalEvents?.length || 0) >
            (existing.intervalEvents?.length || 0)
          ? patient.intervalEvents
          : existing.intervalEvents,
        bedStatus: patient.bedStatus || existing.bedStatus,
        medications: mergeMedications(
          patient.medications,
          existing.medications,
        ),
        systems: {
          neuro: patient.systems?.neuro || existing.systems?.neuro || "",
          cv: patient.systems?.cv || existing.systems?.cv || "",
          resp: patient.systems?.resp || existing.systems?.resp || "",
          renalGU: patient.systems?.renalGU || existing.systems?.renalGU || "",
          gi: patient.systems?.gi || existing.systems?.gi || "",
          endo: patient.systems?.endo || existing.systems?.endo || "",
          heme: patient.systems?.heme || existing.systems?.heme || "",
          infectious: patient.systems?.infectious ||
            existing.systems?.infectious || "",
          skinLines: patient.systems?.skinLines ||
            existing.systems?.skinLines || "",
          dispo: patient.systems?.dispo || existing.systems?.dispo || "",
        },
      };

      bedMap.set(normalizedBed, merged);
    }
  }

  const result = Array.from(bedMap.values());
  safeLog("info", "Parse handoff records deduplicated", {
    patientCount: patients.length,
    uniquePatientCount: result.length,
  });

  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  try {
    // Authenticate the request
    const authResult = await authenticateRequest(req);
    if ("error" in authResult) {
      return authResult.error;
    }
    safeLog("info", "Parse handoff request authenticated");

    // Rate limiting check
    const rateLimit = await checkRateLimit(
      req,
      RATE_LIMITS.parse,
      authResult.userId,
    );
    if (!rateLimit.allowed) {
      safeLog("warn", "Parse handoff app rate limited", {
        statusCode: rateLimit.response?.status ?? 429,
        source: "app",
        remaining: rateLimit.remaining ?? 0,
      });
      return rateLimit.response ??
        jsonResponse(req, {
          error: "Rate limit exceeded",
          success: false,
          source: "app",
        }, 429);
    }

    const bodyResult = await parseAndValidateBody<
      { pdfContent?: unknown; images?: unknown; model?: unknown }
    >(req, { maxBytes: MAX_MEDIA_PAYLOAD_BYTES });
    if (!bodyResult.valid) {
      return bodyResult.response;
    }
    const {
      pdfContent: unvalidatedPdfContent,
      images: unvalidatedImages,
      model: requestedModel,
    } = bodyResult.data;

    const modelResult = resolveRequestedModel(requestedModel);
    if (!modelResult.valid) {
      return jsonResponse(req, {
        success: false,
        error: modelResult.error,
      }, 400);
    }

    if (
      unvalidatedPdfContent !== undefined &&
      typeof unvalidatedPdfContent !== "string"
    ) {
      return jsonResponse(req, {
        success: false,
        error: "PDF content must be text",
      }, 400);
    }
    const pdfContent = unvalidatedPdfContent as string | undefined;

    let images: string[] | undefined;
    if (unvalidatedImages !== undefined) {
      const imageResult = validateImageArray(
        unvalidatedImages,
        MAX_IMAGES_PER_REQUEST,
      );
      if (!Array.isArray(imageResult)) {
        return jsonResponse(req, {
          success: false,
          error: imageResult.error,
        }, imageResult.status);
      }
      images = imageResult;
    }

    if (
      (!pdfContent || !pdfContent.trim()) && (!images || images.length === 0)
    ) {
      return jsonResponse(req, {
        success: false,
        error: "PDF content or images are required",
      }, 400);
    }

    if (pdfContent && pdfContent.length > MAX_TEXT_CHARS) {
      return jsonResponse(req, {
        success: false,
        error:
          "Document too large to parse in one request. Please split into smaller sections.",
      }, 413);
    }

    const providerPolicy = resolveClinicalProvider(modelResult.model);
    if (!providerPolicy.valid) {
      safeLog("error", "Clinical AI unavailable for import request", {
        reason: providerPolicy.error,
      });
      return jsonResponse(req, {
        success: false,
        error: providerPolicy.error,
      }, 503);
    }

    const providerAttempts = buildClinicalProviderAttempts(modelResult.model);
    if (providerAttempts.length === 0) {
      safeLog("error", "No LLM API key configured");
      return jsonResponse(req, {
        success: false,
        error:
          "Clinical AI is not configured for this deployment. Add a provider key (GEMINI_API_KEY, OPENAI_API_KEY, or GROQ_API_KEY) to Supabase secrets.",
      }, 503);
    }

    safeLog("info", "Parse handoff processing started", {
      imageCount: images?.length ?? 0,
      hasText: Boolean(pdfContent),
      providerCount: providerAttempts.length,
      primaryProvider: providerAttempts[0].config.provider,
    });

    const systemPrompt =
      `You are an expert medical data extraction assistant. Your task is to parse patient lists / handoff documents from nearly any clinical export format and extract structured patient data with system-based organization.

Given content from Epic handoffs, census lists, Excel/CSV exports, Word notes, HTML printouts, JSON dumps, or scanned page images, extract ALL patients into a structured JSON format. This is critical - you must find EVERY patient/room in the document.

PATIENT IDENTIFICATION:
- Look for bed/room numbers like "15-ED", "G054-02", "H022-01", "ICU-12", "Room 4", "Bed 7", or similar patterns
- Each patient section typically starts with a bed/room number followed by patient name
- Names are often followed by MRN in parentheses and age/sex
- Spreadsheet/CSV rows labeled "Patient/Row N" are usually one patient each
- Look for repeating patterns that indicate separate patient entries
- Page breaks may separate patients but one patient may span multiple pages

For each patient, extract:
- bed: The bed/room number (e.g., "15-ED", "G054-02", "H022-01")
- name: Patient's full name
- mrn: Medical Record Number (usually a number in parentheses after the name)
- age: Patient's age (e.g., "65 yo", "72y")
- sex: Patient's sex (M or F)
- handoffSummary: The main handoff summary text (clinical overview, history, plan - but NOT system-specific content or "What we did on rounds")
- intervalEvents: Content from "What we did on rounds" section (or "Rounds update", "Events", "Daily update"). Do NOT include the section header.
- bedStatus: Any bed status information
- medications: STRUCTURED OBJECT with three arrays (infusions, scheduled, prn) - see MEDICATION PARSING below
- systems: Object containing system-based review content. Parse ALL content into appropriate systems:
  - neuro: Neurological (mental status, neuro exams, seizures, sedation, pain, ALSO include brain/spine imaging like CT head, MRI brain)
  - cv: Cardiovascular (heart, BP, rhythms, pressors, fluids, cardiac, ALSO include cardiac labs like troponin, BNP and cardiac imaging like echo, EKG)
  - resp: Respiratory (lungs, ventilator, O2, breathing, pulmonary, ALSO include chest imaging like CXR, CT chest and ABGs)
  - renalGU: Renal/GU (kidneys, creatinine, urine, dialysis, Foley, electrolytes, ALSO include renal labs like BMP, Cr, BUN, electrolytes and renal imaging)
  - gi: GI/Nutrition (abdomen, bowels, diet, TPN, liver, GI bleed, ALSO include liver labs like LFTs, lipase and abdominal imaging)
  - endo: Endocrine (glucose, insulin, thyroid, steroids, ALSO include endocrine labs like A1c, TSH, cortisol)
  - heme: Hematology (blood counts, anticoagulation, transfusions, bleeding, ALSO include heme labs like CBC, coags, INR)
  - infectious: Infectious Disease (cultures, antibiotics, fever, infection, ALSO include ID labs like WBC, procalcitonin, cultures and relevant imaging)
  - skinLines: Skin/Lines (IV access, wounds, pressure ulcers, drains, central lines, PICC, arterial lines)
  - dispo: Disposition (discharge planning, goals of care, family discussions, social work)

MEDICATION PARSING (CRITICAL):
Extract medications and categorize them into three arrays within a medications object:

1. INFUSIONS array: Continuous drips with these indicators:
   - Keywords: "mcg/kg/min", "mg/hr", "units/hr", "mL/hr", "titrate", "gtt", "drip", "infusion"
   - Examples: ["Norepinephrine 5 mcg/kg/min", "Propofol 20 mcg/kg/min", "Insulin gtt 2 units/hr"]

2. SCHEDULED array: Regular scheduled medications:
   - Includes: daily, BID, TID, QID, q6h, q8h, q12h, etc.
   - Examples: ["Metoprolol 25 mg PO BID", "Amlodipine 10 mg daily", "Vancomycin 1g IV q12h"]

3. PRN array: As-needed medications:
   - Keywords: "PRN", "as needed", "p.r.n.", "when"
   - Examples: ["Morphine 2 mg IV q4h PRN pain", "Ondansetron 4 mg IV PRN nausea"]

MEDICATION FORMATTING RULES:
- Capitalize first letter of drug name
- Remove brand names, keep generic only (e.g., "Norvasc" -> "Amlodipine")
- Remove suffixes like "sulfate", "HCl", "hydrochloride", "sodium"
- Remove indication text like "for pain", "for blood pressure"
- Use abbreviations: "mg" not "milligrams", "mcg" not "micrograms"
- Format: "DrugName Dose Route Frequency" (e.g., "Metoprolol 25 mg PO BID")
- For infusions include rate: "Norepinephrine 5 mcg/kg/min"

IMPORTANT: Do NOT create separate imaging or labs fields. Instead, include all imaging and lab information within the relevant system section where it clinically belongs. For example:
- CT head results go in "neuro"
- Chest X-ray and ABG go in "resp"
- CBC and INR go in "heme"
- BMP and creatinine go in "renalGU"
- Troponin and echo go in "cv"

FORMATTING PRESERVATION (CRITICAL):
- STRICT RULE: Do NOT collapse multiple lines into a single sentence or paragraph.
- STRICT RULE: Do NOT convert list items into prose (e.g., "Item 1, Item 2") - keep them vertical.
- Preserve ALL original line breaks exactly as they appear in the source.
- USE HTML TAGS to preserve structure:
  - Use <b>TEXT</b> for section headers (e.g., <b>Assessment:</b>) and bold text.
  - Use <u>TEXT</u> for underlined text.
  - WHENEVER you see a list (bulleted, numbered, or implicit), YOU MUST use <ul> and <li> tags:
    <ul>
      <li>First issue</li>
      <li>Second issue</li>
    </ul>
  - If a section contains multiple distinct points on separate lines, treat it as a list.
  - Use <br> only for line breaks within a single list item if absolutely needed.

ANTI-PROSE EXAMPLES:
BAD (Do NOT do this):
"Neuro is alert and oriented. CV is RRR. Resp is clear on room air."

GOOD (Do this):
<ul>
  <li>Neuro is alert and oriented</li>
  <li>CV is RRR</li>
  <li>Resp is clear on room air</li>
</ul>

- Do NOT use markdown (**bold**), use HTML (<b>bold</b>).
Return ONLY valid JSON in this exact format:
{
  "patients": [
    {
      "bed": "string",
      "name": "string",
      "mrn": "string",
      "age": "string",
      "sex": "string",
      "handoffSummary": "string",
      "intervalEvents": "string",
      "bedStatus": "string",
      "medications": {
        "infusions": ["string array of formatted infusion meds"],
        "scheduled": ["string array of formatted scheduled meds"],
        "prn": ["string array of formatted PRN meds"]
      },
      "systems": {
        "neuro": "string",
        "cv": "string",
        "resp": "string",
        "renalGU": "string",
        "gi": "string",
        "endo": "string",
        "heme": "string",
        "infectious": "string",
        "skinLines": "string",
        "dispo": "string"
      }
    }
  ]
}

CRITICAL DEDUPLICATION RULES:
- If the same patient/bed appears on multiple pages, MERGE them into ONE entry
- NEVER output the same bed number twice
- Avoid redundant repetition (stuttering/echoing), BUT:
- PRESERVE distinctive list items even if they look similar.
- Do NOT automatically dedup sentences if they are part of a structured list.
- Clean up any OCR artifacts or formatting issues
- If a field is missing, use an empty string (for strings) or empty array (for medications)

SYSTEM MAPPING GUIDANCE:
- Look for section headers like "Neuro:", "CV:", "Pulm:", "Renal:", "GI:", "ID:", "Heme:", "Endo:", "Access:", "Dispo:", "Meds:"
- Also map content based on clinical context even without explicit headers
- "Pulm" or "Pulmonary" maps to "resp"
- "ID" or "Infectious Disease" maps to "infectious"
- "Access" or "Lines" maps to "skinLines"
- Include relevant imaging and labs WITHIN each system section, not separately`;

    // Build message content based on whether we have images or text
    let userContent: LLMUserContent;
    if (images && images.length > 0) {
      // Vision-based OCR: send images to the model
      userContent = [
        {
          type: "text",
          text:
            "Parse these patient-list / handoff pages and extract all patient data with system-based organization. CRITICAL: Each patient/bed/room should appear only ONCE in the output. Merge content from multiple pages for the same patient. Preserve formatting with HTML tags. Parse content into the appropriate system categories (neuro, cv, resp, renalGU, gi, endo, heme, infectious, skinLines, dispo):",
        },
        ...images.map((img: string) => ({
          type: "image_url" as const,
          image_url: { url: img },
        })),
      ];
    } else {
      userContent =
        `Parse the following patient list / handoff document and extract all patient data with system-based organization. CRITICAL: Each patient/bed/room should appear only ONCE. Remove any repeated content. Preserve formatting with HTML tags. Place clinical details into the correct chart sections/systems:\n\n${pdfContent}`;
    }

    // Try the resolved provider first, then fail over to every other
    // configured provider on rate limits (429) and server errors (5xx).
    let response: Response | null = null;
    let activeAttempt: ClinicalProviderAttempt | null = null;
    let providersTried = 0;
    let lastProviderStatus = 0;
    let lastProviderName: string | null = null;

    for (const attempt of providerAttempts) {
      providersTried += 1;
      const providerPayload = JSON.stringify({
        model: attempt.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        max_tokens: normalizeOutputTokenLimit(8_000),
      });

      let candidate: Response;
      try {
        candidate = await fetch(
          `${attempt.config.baseURL}/chat/completions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${attempt.config.apiKey}`,
              "Content-Type": "application/json",
            },
            body: providerPayload,
          },
        );
      } catch {
        safeLog("error", "Parse handoff provider request failed", {
          provider: attempt.config.provider,
        });
        lastProviderStatus = 0;
        lastProviderName = attempt.config.provider;
        continue;
      }

      if (candidate.status === 402) {
        return jsonResponse(req, {
          success: false,
          error: "AI credits exhausted. Please add funds.",
        }, 402);
      }

      if (!candidate.ok && isRetryableProviderStatus(candidate.status)) {
        safeLog("error", "Parse handoff provider attempt failed", {
          statusCode: candidate.status,
          provider: attempt.config.provider,
          providersTried,
        });
        lastProviderStatus = candidate.status;
        lastProviderName = attempt.config.provider;
        continue;
      }

      response = candidate;
      activeAttempt = attempt;
      break;
    }

    if (!response || !activeAttempt) {
      if (lastProviderStatus === 429) {
        safeLog("error", "Parse handoff providers rate limited", {
          statusCode: 429,
          provider: lastProviderName,
          source: "provider",
          providersTried,
          retryAfter: 5,
        });
        return jsonResponse(req, {
          success: false,
          error: "Rate limit exceeded. Please try again later.",
          source: "provider",
          retryAfter: 5,
        }, 429);
      }
      return jsonResponse(req, {
        success: false,
        error: "AI processing failed",
      }, 500);
    }

    if (!response.ok) {
      safeLog("error", "Parse handoff provider request failed", {
        statusCode: response.status,
        provider: activeAttempt.config.provider,
      });
      return jsonResponse(req, {
        success: false,
        error: "AI processing failed",
      }, 500);
    }

    safeLog("info", "Parse handoff provider selected", {
      provider: activeAttempt.config.provider,
      model: activeAttempt.model,
      providersTried,
    });

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content || "";

    safeLog("info", "Parse handoff response received", {
      outputChars: content.length,
    });

    // Extract and repair JSON from the response
    let parsedData: { patients: ParsedPatient[] };
    try {
      let jsonStr = content;

      // Remove markdown code blocks if present
      jsonStr = jsonStr.replace(/```json\s*/g, "").replace(/```\s*/g, "");

      // Find the JSON object
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      jsonStr = jsonMatch[0];

      // Try to parse as-is first
      try {
        parsedData = JSON.parse(jsonStr);
      } catch {
        safeLog("warn", "Parse handoff response repair started", {
          stage: "initial-parse",
        });

        // Repair Strategy 1: Fix unescaped quotes in strings
        let repaired = jsonStr;

        // Replace unescaped newlines and tabs inside strings
        repaired = repaired.replace(/(?<!\\)\\n/g, "\\n");
        repaired = repaired.replace(/(?<!\\)\\t/g, "\\t");

        // Attempt to repair truncated JSON
        // Remove any trailing incomplete content more aggressively
        // Remove incomplete string at end
        repaired = repaired.replace(/,\s*"[^"]*$/, "");
        // Remove incomplete property value
        repaired = repaired.replace(/,\s*"[^"]*"\s*:\s*"[^"]*$/, "");
        // Remove incomplete object
        repaired = repaired.replace(/,\s*\{[^}]*$/, "");
        // Remove incomplete array item
        repaired = repaired.replace(/,\s*\[[^\]]*$/, "");
        // Remove trailing comma before closing
        repaired = repaired.replace(/,(\s*[\]}])/g, "$1");

        // Calculate missing closers after cleanup
        const finalOpenBraces = (repaired.match(/\{/g) || []).length;
        const finalCloseBraces = (repaired.match(/\}/g) || []).length;
        const finalOpenBrackets = (repaired.match(/\[/g) || []).length;
        const finalCloseBrackets = (repaired.match(/\]/g) || []).length;

        const missingBrackets = finalOpenBrackets - finalCloseBrackets;
        const missingBraces = finalOpenBraces - finalCloseBraces;

        // Close unclosed structures in correct order (brackets then braces)
        repaired += "]".repeat(Math.max(0, missingBrackets));
        repaired += "}".repeat(Math.max(0, missingBraces));

        safeLog("info", "Parse handoff response repair attempted", {
          stage: "bracket-repair",
        });

        try {
          parsedData = JSON.parse(repaired);
        } catch (repairError1) {
          safeLog("warn", "Parse handoff response repair retried", {
            stage: "object-extraction",
          });

          // Repair Strategy 2: Try to extract just the patients array
          const patientsMatch = jsonStr.match(/"patients"\s*:\s*\[([\s\S]*)/);
          if (patientsMatch) {
            const patientsContent = patientsMatch[1];

            // Find complete patient objects by matching balanced braces
            const patients: ParsedPatient[] = [];
            let depth = 0;
            let start = -1;

            for (let i = 0; i < patientsContent.length; i++) {
              const char = patientsContent[i];
              if (char === "{") {
                if (depth === 0) start = i;
                depth++;
              } else if (char === "}") {
                depth--;
                if (depth === 0 && start !== -1) {
                  try {
                    const patientStr = patientsContent.substring(start, i + 1);
                    const patient = JSON.parse(patientStr);
                    patients.push(patient);
                  } catch {
                    safeLog("warn", "Parse handoff malformed record skipped");
                  }
                  start = -1;
                }
              }
            }

            if (patients.length > 0) {
              safeLog("info", "Parse handoff complete records extracted", {
                patientCount: patients.length,
              });
              parsedData = { patients };
            } else {
              throw new Error("Could not extract any valid patient objects");
            }
          } else {
            throw repairError1;
          }
        }
      }
    } catch (parseError) {
      safeLog("error", "Parse handoff response parse failed", {
        errorType: parseError instanceof Error
          ? parseError.name
          : "UnknownError",
        outputChars: content.length,
      });
      return jsonResponse(req, {
        success: false,
        error:
          "Failed to parse AI response. The document may be too complex. Try splitting into smaller sections.",
      }, 500);
    }

    safeLog("info", "Parse handoff response parsed", {
      patientCount: parsedData.patients?.length || 0,
    });

    if (!Array.isArray(parsedData.patients)) {
      return jsonResponse(req, {
        success: false,
        error: "Malformed AI response. Please retry with a smaller section.",
      }, 500);
    }

    if (parsedData.patients.length > MAX_PATIENTS_PARSED) {
      return jsonResponse(req, {
        success: false,
        error:
          "Parsed too many patient records. Please split the document and retry.",
      }, 413);
    }

    // POST-PROCESSING: Apply deduplication and ensure systems/medications structure
    if (parsedData.patients && parsedData.patients.length > 0) {
      // Step 1: Clean text within each patient's fields and ensure systems/medications structure
      parsedData.patients = parsedData.patients.map((patient) => {
        const systems = patient.systems || {};
        const medications = patient.medications ||
          { infusions: [], scheduled: [], prn: [] };
        return {
          ...patient,
          handoffSummary: cleanPatientText(patient.handoffSummary),
          intervalEvents: cleanPatientText(patient.intervalEvents),
          bedStatus: cleanPatientText(patient.bedStatus),
          medications: {
            infusions: medications.infusions || [],
            scheduled: medications.scheduled || [],
            prn: medications.prn || [],
          },
          systems: {
            neuro: cleanPatientText(systems.neuro || ""),
            cv: cleanPatientText(systems.cv || ""),
            resp: cleanPatientText(systems.resp || ""),
            renalGU: cleanPatientText(systems.renalGU || ""),
            gi: cleanPatientText(systems.gi || ""),
            endo: cleanPatientText(systems.endo || ""),
            heme: cleanPatientText(systems.heme || ""),
            infectious: cleanPatientText(systems.infectious || ""),
            skinLines: cleanPatientText(systems.skinLines || ""),
            dispo: cleanPatientText(systems.dispo || ""),
          },
        };
      });

      // Step 2: Deduplicate patients by bed number
      parsedData.patients = deduplicatePatientsByBed(parsedData.patients);
    }

    safeLog("info", "Parse handoff processing completed", {
      patientCount: parsedData.patients?.length || 0,
    });

    return jsonResponse(req, { success: true, data: parsedData });
  } catch (error) {
    safeLog("error", "Parse handoff request failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    if (error instanceof MissingAPIKeyError) {
      return jsonResponse(req, { success: false, error: error.message }, 503);
    }
    return createErrorResponse(
      req,
      safeErrorMessage(error, "Failed to parse handoff document"),
      500,
    );
  }
});
