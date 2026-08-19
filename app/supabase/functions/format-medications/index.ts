import {
  authenticateRequest,
  checkRateLimit,
  createErrorResponse,
  handleOptions,
  jsonResponse,
  MissingAPIKeyError,
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
  sanitizeOutboundLLMPrompts,
} from "../_shared/llm-client.ts";

interface MedicationCategories {
  infusions: string[];
  scheduled: string[];
  prn: string[];
  rawText: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  const requestId = crypto.randomUUID?.() ?? `req_${Date.now()}`;
  const startMs = performance.now();

  try {
    // Authenticate the request
    const authResult = await authenticateRequest(req);
    if ("error" in authResult) {
      return authResult.error;
    }
    const userId = authResult.userId;
    safeLog("info", "Format medications request authenticated", {
      requestId,
      function: "format-medications",
    });
    // Rate limiting check
    const rateLimit = await checkRateLimit(req, RATE_LIMITS.ai, userId);
    if (!rateLimit.allowed) {
      return rateLimit.response ??
        jsonResponse(req, { error: "Rate limit exceeded" }, 429);
    }

    const bodyResult = await parseAndValidateBody<
      { medications?: string; model?: string }
    >(req);
    if (!bodyResult.valid) {
      return bodyResult.response;
    }
    const { medications, model: requestedModel } = bodyResult.data;

    const modelResult = resolveRequestedModel(requestedModel);
    if (!modelResult.valid) {
      return jsonResponse(req, { error: modelResult.error }, 400);
    }

    const medsCheck = requireString(medications, "medications");
    if (typeof medsCheck !== "string") {
      return jsonResponse(req, { error: medsCheck.error }, 400);
    }
    const validMedications = medsCheck;

    const providerPolicy = resolveClinicalProvider(modelResult.model);
    if (!providerPolicy.valid) {
      return jsonResponse(req, { error: providerPolicy.error }, 503);
    }
    const providerAttempts = buildClinicalProviderAttempts(modelResult.model);
    if (providerAttempts.length === 0) {
      safeLog("error", "No LLM API key configured");
      return jsonResponse(req, {
        error:
          "Clinical AI is not configured for this deployment. Add a provider key (GEMINI_API_KEY, OPENAI_API_KEY, or GROQ_API_KEY) to Supabase secrets.",
      }, 503);
    }

    const systemPrompt =
      `You are a medication formatting expert. Parse medication lists into structured categories.

CATEGORIZATION RULES:
1. INFUSIONS: Any medication with these indicators:
   - "mcg/kg/min", "mg/hr", "units/hr", "mL/hr"
   - Keywords: "titrate", "gtt", "drip", "infusion", "continuous"
   - Examples: Norepinephrine, Propofol drip, Insulin gtt, Heparin infusion

2. PRN (As Needed): Any medication with:
   - Keywords: "PRN", "as needed", "p.r.n.", "when", "if needed"
   - Examples: Morphine PRN, Ondansetron as needed

3. SCHEDULED: All other regular medications
   - Includes: daily, BID, TID, QID, q6h, q8h, etc.

FORMATTING RULES (CRITICAL):
- Capitalize the first letter of each drug name
- Remove brand names if generic is known (keep just one name)
- Remove suffixes like "sulfate", "HCl", "hydrochloride", "sodium" unless critical
- Remove indication text like "for pain", "for blood pressure", "for nausea"
- Use abbreviations: "mg" not "milligrams", "mcg" not "micrograms"
- Keep dosing frequency: daily, BID, TID, q6h, q8h, etc.
- For infusions, include the rate: "5 mcg/kg/min" or "10 units/hr"
- Format: "DrugName Dose Route Frequency" (e.g., "Metoprolol 25 mg PO BID")
- If route is obvious (oral meds = PO), you can omit it

OUTPUT FORMAT:
Return a JSON object with three arrays: infusions, scheduled, prn
Each array contains formatted medication strings.`;

    const userPrompt =
      `Parse and format these medications:\n\n${validMedications}`;
    const sanitizedPrompts = sanitizeOutboundLLMPrompts(
      systemPrompt,
      userPrompt,
    );

    let response: Response | null = null;
    let lastRetryableStatus = 0;

    for (const attempt of providerAttempts) {
      let candidate: Response;
      try {
        candidate = await fetch(`${attempt.config.baseURL}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${attempt.config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: attempt.model,
            max_tokens: normalizeOutputTokenLimit(4_000),
            messages: [
              { role: "system", content: sanitizedPrompts.systemPrompt },
              {
                role: "user",
                content: sanitizedPrompts.userPrompt,
              },
            ],
            tools: [
              {
                type: "function",
                function: {
                  name: "categorize_medications",
                  description:
                    "Categorize and format medications into infusions, scheduled, and PRN",
                  parameters: {
                    type: "object",
                    properties: {
                      infusions: {
                        type: "array",
                        items: { type: "string" },
                        description:
                          "Continuous infusion medications with rates",
                      },
                      scheduled: {
                        type: "array",
                        items: { type: "string" },
                        description: "Regularly scheduled medications",
                      },
                      prn: {
                        type: "array",
                        items: { type: "string" },
                        description: "As-needed medications",
                      },
                    },
                    required: ["infusions", "scheduled", "prn"],
                    additionalProperties: false,
                  },
                },
              },
            ],
            tool_choice: {
              type: "function",
              function: { name: "categorize_medications" },
            },
          }),
        });
      } catch {
        safeLog("error", "Format medications provider request failed", {
          requestId,
          function: "format-medications",
        });
        continue;
      }

      if (!candidate.ok && isRetryableProviderStatus(candidate.status)) {
        safeLog("error", "Format medications provider attempt failed", {
          requestId,
          function: "format-medications",
          statusCode: candidate.status,
        });
        lastRetryableStatus = candidate.status;
        continue;
      }

      response = candidate;
      break;
    }

    if (!response) {
      safeLog("error", "Format medications providers exhausted", { requestId });
      if (lastRetryableStatus === 429) {
        return jsonResponse(req, {
          error: "Rate limit exceeded. Please try again.",
        }, 429);
      }
      return jsonResponse(req, { error: "Failed to process medications" }, 500);
    }

    if (!response.ok) {
      safeLog("error", "Format medications provider request failed", {
        requestId,
        function: "format-medications",
        statusCode: response.status,
      });

      if (response.status === 429) {
        return jsonResponse(req, {
          error: "Rate limit exceeded. Please try again.",
        }, 429);
      }
      if (response.status === 402) {
        return jsonResponse(req, {
          error: "AI credits exhausted. Please add credits.",
        }, 402);
      }

      return jsonResponse(req, { error: "Failed to process medications" }, 500);
    }

    const aiResponse = await response.json();
    safeLog("info", "AI response received for medications");

    let parsedMeds: MedicationCategories = {
      infusions: [],
      scheduled: [],
      prn: [],
      rawText: validMedications,
    };

    // Parse tool call response
    const toolCall = aiResponse.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      try {
        const args = JSON.parse(toolCall.function.arguments);
        parsedMeds = {
          infusions: args.infusions || [],
          scheduled: args.scheduled || [],
          prn: args.prn || [],
          rawText: validMedications,
        };
      } catch (error) {
        safeLog("warn", "Format medications tool response parse failed", {
          errorType: error instanceof Error ? error.name : "UnknownError",
          function: "format-medications",
          requestId,
        });
      }
    }

    // Fallback: parse from content if tool call didn't work
    if (
      parsedMeds.infusions.length === 0 &&
      parsedMeds.scheduled.length === 0 &&
      parsedMeds.prn.length === 0
    ) {
      const content = aiResponse.choices?.[0]?.message?.content;
      if (content) {
        try {
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            parsedMeds = {
              infusions: parsed.infusions || [],
              scheduled: parsed.scheduled || [],
              prn: parsed.prn || [],
              rawText: validMedications,
            };
          }
        } catch (error) {
          safeLog("warn", "Format medications content response parse failed", {
            errorType: error instanceof Error ? error.name : "UnknownError",
            function: "format-medications",
            requestId,
          });
        }
      }
    }

    const durationMs = Math.round(performance.now() - startMs);
    safeLog("info", "format-medications completed", {
      requestId,
      function: "format-medications",
      durationMs,
      status: "success",
    });

    return jsonResponse(req, { medications: parsedMeds });
  } catch (error) {
    const durationMs = Math.round(performance.now() - startMs);
    safeLog("error", "Format medications request failed", {
      requestId,
      function: "format-medications",
      durationMs,
      status: "error",
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    if (error instanceof MissingAPIKeyError) {
      return jsonResponse(req, {
        error: error.message,
        code: "MISSING_API_KEY",
      }, 503);
    }
    return createErrorResponse(
      req,
      safeErrorMessage(error, "Failed to format medications"),
      500,
    );
  }
});
