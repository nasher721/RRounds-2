import {
  authenticateRequest,
  checkRateLimit,
  createErrorResponse,
  handleOptions,
  jsonResponse,
  parseAndValidateBody,
  RATE_LIMITS,
  requireString,
  safeErrorMessage,
  safeLog,
} from "../_shared/mod.ts";
import {
  buildClinicalProviderAttempts,
  isRetryableProviderStatus,
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

interface PatientMedications {
  infusions: string[];
  scheduled: string[];
  prn: string[];
  rawText: string;
}

interface ParsedPatient {
  name: string;
  bed: string;
  clinicalSummary: string;
  intervalEvents: string;
  imaging: string;
  labs: string;
  systems: PatientSystems;
  medications: PatientMedications;
}

type ParsedPatientPayload = Partial<ParsedPatient> & Partial<PatientSystems> & {
  medicationsRaw?: string;
  medicationsInfusions?: string[];
  medicationsScheduled?: string[];
  medicationsPrn?: string[];
};

/**
 * Convert <BR> markers to actual newlines and normalize line endings
 */
function convertLineBreaks(text: string): string {
  if (!text) return "";

  return text
    // Convert <BR> markers to actual newlines
    .replace(/<BR>/g, "\n")
    // Also handle literal \n strings just in case
    .replace(/\\n/g, "\n")
    // Normalize CRLF and CR to LF
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  try {
    // Authenticate the request
    const authResult = await authenticateRequest(req);
    if ("error" in authResult) {
      return authResult.error;
    }
    safeLog("info", "Parse single patient request authenticated");
    // Rate limiting check
    const rateLimit = await checkRateLimit(
      req,
      RATE_LIMITS.parse,
      authResult.userId,
    );
    if (!rateLimit.allowed) {
      return rateLimit.response ??
        jsonResponse(req, { error: "Rate limit exceeded" }, 429);
    }

    const bodyResult = await parseAndValidateBody<
      { content?: string; model?: string }
    >(req);
    if (!bodyResult.valid) {
      return bodyResult.response;
    }
    const { content, model: requestedModel } = bodyResult.data;

    const modelResult = resolveRequestedModel(requestedModel);
    if (!modelResult.valid) {
      return jsonResponse(req, { error: modelResult.error }, 400);
    }

    const contentCheck = requireString(content, "content");
    if (typeof contentCheck === "object" && "error" in contentCheck) {
      return createErrorResponse(req, contentCheck.error, 400);
    }
    const validContent = contentCheck;

    const providerPolicy = resolveClinicalProvider(modelResult.model);
    if (!providerPolicy.valid) {
      safeLog("error", "Clinical AI unavailable for single-patient parse", {
        reason: providerPolicy.error,
      });
      return jsonResponse(req, { error: providerPolicy.error }, 503);
    }

    const providerAttempts = buildClinicalProviderAttempts(modelResult.model);
    if (providerAttempts.length === 0) {
      safeLog("error", "No valid LLM API key found");
      return jsonResponse(req, {
        error:
          "Clinical AI is not configured for this deployment. Add a provider key (GEMINI_API_KEY, OPENAI_API_KEY, or GROQ_API_KEY) to Supabase secrets.",
      }, 503);
    }

    const systemPrompt = `You organize clinical notes into sections.

LINE BREAK RULE - THIS IS CRITICAL:
Use <BR> to represent each line break from the original input.

Example input:
Line one
Line two
Line three

Example output for a field: "Line one<BR>Line two<BR>Line three"

If the input has text on separate lines, the output MUST have <BR> between them. NEVER merge lines into one continuous paragraph.

CONTENT RULES:
- Copy text EXACTLY as written
- Do NOT move imaging/labs from system sections to separate imaging/labs fields
- The "imaging" and "labs" fields should ONLY contain standalone imaging/labs sections

MEDICATION CATEGORIZATION RULES:
When extracting medications, categorize them into three buckets:

1. INFUSIONS: Any medication with these indicators:
   - "mcg/kg/min", "mg/hr", "units/hr", "mL/hr"
   - Keywords: "titrate", "gtt", "drip", "infusion", "continuous"
   - Examples: Norepinephrine, Propofol drip, Insulin gtt, Heparin infusion

2. PRN (As Needed): Any medication with:
   - Keywords: "PRN", "as needed", "p.r.n.", "when", "if needed"
   - Examples: Morphine PRN, Ondansetron as needed

3. SCHEDULED: All other regular medications
   - Includes: daily, BID, TID, QID, q6h, q8h, etc.

MEDICATION FORMATTING RULES:
- Capitalize the first letter of each drug name
- Remove brand names if generic is known (keep just one name)
- Remove suffixes like "sulfate", "HCl", "hydrochloride", "sodium" unless critical
- Remove indication text like "for pain", "for blood pressure", "for nausea"
- Use abbreviations: "mg" not "milligrams", "mcg" not "micrograms"
- Keep dosing frequency: daily, BID, TID, q6h, q8h, etc.
- For infusions, include the rate: "5 mcg/kg/min" or "10 units/hr"
- Format: "DrugName Dose Route Frequency" (e.g., "Metoprolol 25 mg PO BID")`;

    const userPrompt =
      `Organize these notes. Use <BR> for EVERY line break. Do NOT merge lines together.

INPUT:
${validContent}`;

    let response: Response | null = null;
    let activeProvider: string | null = null;
    let lastRetryableStatus = 0;

    for (const attempt of providerAttempts) {
      safeLog("info", "Parse single patient provider request started", {
        provider: attempt.config.provider,
        inputChars: validContent.length,
      });

      let candidate: Response;
      try {
        candidate = await fetch(`${attempt.config.baseURL}/chat/completions`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${attempt.config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: attempt.model,
            max_tokens: normalizeOutputTokenLimit(8_000),
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "organize_patient_data",
                  description:
                    "Organize clinical notes. Use <BR> for line breaks.",
                  parameters: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Patient name" },
                      bed: { type: "string", description: "Room/bed" },
                      clinicalSummary: {
                        type: "string",
                        description:
                          "History/diagnoses. Use <BR> for line breaks",
                      },
                      intervalEvents: {
                        type: "string",
                        description: "Recent events. Use <BR> for line breaks",
                      },
                      imaging: {
                        type: "string",
                        description: "ONLY standalone imaging sections",
                      },
                      labs: {
                        type: "string",
                        description: "ONLY standalone lab sections",
                      },
                      neuro: {
                        type: "string",
                        description:
                          "ALL neuro content with <BR> for line breaks",
                      },
                      cv: {
                        type: "string",
                        description: "ALL cv content with <BR> for line breaks",
                      },
                      resp: {
                        type: "string",
                        description:
                          "ALL resp content with <BR> for line breaks",
                      },
                      renalGU: {
                        type: "string",
                        description:
                          "ALL renal/GU content with <BR> for line breaks",
                      },
                      gi: {
                        type: "string",
                        description: "ALL GI content with <BR> for line breaks",
                      },
                      endo: {
                        type: "string",
                        description:
                          "ALL endo content with <BR> for line breaks",
                      },
                      heme: {
                        type: "string",
                        description:
                          "ALL heme content with <BR> for line breaks",
                      },
                      infectious: {
                        type: "string",
                        description: "ALL ID content with <BR> for line breaks",
                      },
                      skinLines: {
                        type: "string",
                        description:
                          "ALL skin/lines content with <BR> for line breaks",
                      },
                      dispo: {
                        type: "string",
                        description:
                          "ALL disposition content with <BR> for line breaks",
                      },
                      medicationsRaw: {
                        type: "string",
                        description: "Raw medication text from input",
                      },
                      medicationsInfusions: {
                        type: "array",
                        items: { type: "string" },
                        description:
                          "Continuous infusion medications with rates (e.g., Norepinephrine 5 mcg/min)",
                      },
                      medicationsScheduled: {
                        type: "array",
                        items: { type: "string" },
                        description:
                          "Regularly scheduled medications (e.g., Metoprolol 25 mg PO BID)",
                      },
                      medicationsPrn: {
                        type: "array",
                        items: { type: "string" },
                        description:
                          "As-needed medications (e.g., Morphine 2 mg IV PRN)",
                      },
                    },
                    required: [
                      "name",
                      "bed",
                      "clinicalSummary",
                      "intervalEvents",
                      "imaging",
                      "labs",
                      "neuro",
                      "cv",
                      "resp",
                      "renalGU",
                      "gi",
                      "endo",
                      "heme",
                      "infectious",
                      "skinLines",
                      "dispo",
                      "medicationsRaw",
                      "medicationsInfusions",
                      "medicationsScheduled",
                      "medicationsPrn",
                    ],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: {
              type: "function",
              function: { name: "organize_patient_data" },
            },
          }),
        });
      } catch {
        safeLog("error", "Parse single patient provider request failed", {
          provider: attempt.config.provider,
        });
        continue;
      }

      if (!candidate.ok && isRetryableProviderStatus(candidate.status)) {
        safeLog("error", "Parse single patient provider attempt failed", {
          provider: attempt.config.provider,
          statusCode: candidate.status,
        });
        lastRetryableStatus = candidate.status;
        continue;
      }

      response = candidate;
      activeProvider = attempt.config.provider;
      break;
    }

    if (!response) {
      safeLog("error", "Parse single patient providers exhausted");
      if (lastRetryableStatus === 429) {
        return jsonResponse(req, {
          error: "Rate limit exceeded. Please try again in a moment.",
        }, 429);
      }
      return jsonResponse(
        req,
        { error: "Failed to process clinical notes" },
        500,
      );
    }

    if (!response.ok) {
      safeLog("error", "Parse single patient provider request failed", {
        provider: activeProvider,
        statusCode: response.status,
      });

      if (response.status === 429) {
        return jsonResponse(req, {
          error: "Rate limit exceeded. Please try again in a moment.",
        }, 429);
      }
      if (response.status === 402) {
        return jsonResponse(req, {
          error: "AI credits exhausted. Please add credits to continue.",
        }, 402);
      }

      return jsonResponse(
        req,
        { error: "Failed to process clinical notes" },
        500,
      );
    }

    const aiResponse = await response.json();

    safeLog("info", "Parse single patient response received");

    let parsedData: ParsedPatientPayload | undefined;

    // Check for tool call response
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        parsedData = JSON.parse(
          toolCall.function.arguments,
        ) as ParsedPatientPayload;
        safeLog("info", "Parse single patient tool response parsed", {
          parsedWith: "tool-call",
        });
      } catch (error) {
        safeLog("warn", "Parse single patient tool response parse failed", {
          errorType: error instanceof Error ? error.name : "UnknownError",
        });
      }
    }

    // Fallback to content parsing if tool call didn't work
    if (!parsedData) {
      const aiContent = aiResponse.choices?.[0]?.message?.content;
      if (!aiContent) {
        safeLog("error", "No content in AI response");
        return jsonResponse(req, { error: "No response from AI service" }, 500);
      }

      // Extract JSON from response
      let jsonStr = aiContent;
      const jsonMatch = aiContent.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      } else {
        const startIdx = aiContent.indexOf("{");
        const endIdx = aiContent.lastIndexOf("}");
        if (startIdx !== -1 && endIdx !== -1) {
          jsonStr = aiContent.substring(startIdx, endIdx + 1);
        }
      }

      try {
        parsedData = JSON.parse(jsonStr) as ParsedPatientPayload;
      } catch (parseError) {
        safeLog("warn", "Parse single patient content response parse failed", {
          errorType: parseError instanceof Error
            ? parseError.name
            : "UnknownError",
        });
        // Try to repair common JSON issues
        const repaired = jsonStr
          .replace(/,\s*}/g, "}")
          .replace(/,\s*]/g, "]")
          .replace(/\n/g, "\\n")
          .replace(/\r/g, "")
          .replace(/\t/g, "  ");

        try {
          parsedData = JSON.parse(repaired) as ParsedPatientPayload;
        } catch {
          return jsonResponse(
            req,
            { error: "Failed to parse AI response" },
            500,
          );
        }
      }
    }

    // Build the patient object - handle both flat structure (from tool call) and nested structure
    const parsedPatient: ParsedPatient = {
      name: parsedData.name || "",
      bed: parsedData.bed || "",
      clinicalSummary: parsedData.clinicalSummary || "",
      intervalEvents: parsedData.intervalEvents || "",
      imaging: parsedData.imaging || "",
      labs: parsedData.labs || "",
      systems: parsedData.systems || {
        neuro: parsedData.neuro || "",
        cv: parsedData.cv || "",
        resp: parsedData.resp || "",
        renalGU: parsedData.renalGU || "",
        gi: parsedData.gi || "",
        endo: parsedData.endo || "",
        heme: parsedData.heme || "",
        infectious: parsedData.infectious || "",
        skinLines: parsedData.skinLines || "",
        dispo: parsedData.dispo || "",
      },
      medications: parsedData.medications || {
        infusions: parsedData.medicationsInfusions || [],
        scheduled: parsedData.medicationsScheduled || [],
        prn: parsedData.medicationsPrn || [],
        rawText: parsedData.medicationsRaw || "",
      },
    };

    // Convert literal \n to actual newlines
    const cleanedPatient: ParsedPatient = {
      name: convertLineBreaks(parsedPatient.name || "").trim(),
      bed: convertLineBreaks(parsedPatient.bed || "").trim(),
      clinicalSummary: convertLineBreaks(parsedPatient.clinicalSummary || ""),
      intervalEvents: convertLineBreaks(parsedPatient.intervalEvents || ""),
      imaging: convertLineBreaks(parsedPatient.imaging || ""),
      labs: convertLineBreaks(parsedPatient.labs || ""),
      systems: {
        neuro: convertLineBreaks(parsedPatient.systems?.neuro || ""),
        cv: convertLineBreaks(parsedPatient.systems?.cv || ""),
        resp: convertLineBreaks(parsedPatient.systems?.resp || ""),
        renalGU: convertLineBreaks(parsedPatient.systems?.renalGU || ""),
        gi: convertLineBreaks(parsedPatient.systems?.gi || ""),
        endo: convertLineBreaks(parsedPatient.systems?.endo || ""),
        heme: convertLineBreaks(parsedPatient.systems?.heme || ""),
        infectious: convertLineBreaks(parsedPatient.systems?.infectious || ""),
        skinLines: convertLineBreaks(parsedPatient.systems?.skinLines || ""),
        dispo: convertLineBreaks(parsedPatient.systems?.dispo || ""),
      },
      medications: {
        infusions: parsedPatient.medications?.infusions || [],
        scheduled: parsedPatient.medications?.scheduled || [],
        prn: parsedPatient.medications?.prn || [],
        rawText: convertLineBreaks(parsedPatient.medications?.rawText || ""),
      },
    };

    safeLog("info", "Successfully parsed patient data");

    return jsonResponse(req, { patient: cleanedPatient });
  } catch (error) {
    safeLog("error", "Parse single patient request failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return createErrorResponse(
      req,
      safeErrorMessage(error, "Failed to parse patient data"),
      500,
    );
  }
});
