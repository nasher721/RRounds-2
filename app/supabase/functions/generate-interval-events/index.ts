import {
  authenticateRequest,
  checkRateLimit,
  corsHeaders,
  createErrorResponse,
  handleOptions,
  MissingAPIKeyError,
  parseAndValidateBody,
  RATE_LIMITS,
  safeErrorMessage,
  safeLog,
} from "../_shared/mod.ts";
import { callLLM } from "../_shared/llm-client.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return handleOptions(req);
  }

  try {
    // Authenticate the request
    const authResult = await authenticateRequest(req);
    if ("error" in authResult) {
      return authResult.error;
    }
    const userId = authResult.userId;
    safeLog("info", "Generate interval events request authenticated");

    // Rate limiting check
    const rateLimit = await checkRateLimit(req, RATE_LIMITS.ai, userId);
    if (!rateLimit.allowed) {
      return rateLimit.response ??
        new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        });
    }

    const bodyResult = await parseAndValidateBody<
      {
        systems?: Record<string, string>;
        existingIntervalEvents?: string;
        patientName?: string;
        model?: string;
      }
    >(req);
    if (!bodyResult.valid) {
      return bodyResult.response;
    }
    const { systems, existingIntervalEvents, model: requestedModel } =
      bodyResult.data;

    if (!systems || typeof systems !== "object") {
      return createErrorResponse(req, "Missing required field: systems", 400);
    }

    // Build a summary of all system data
    const systemSummaries: string[] = [];
    const systemLabels: Record<string, string> = {
      neuro: "Neuro",
      cv: "CV",
      resp: "Resp",
      renalGU: "Renal/GU",
      gi: "GI",
      endo: "Endo",
      heme: "Heme",
      infectious: "ID",
      skinLines: "Skin/Lines",
      dispo: "Dispo",
    };

    for (const [key, label] of Object.entries(systemLabels)) {
      const content = systems[key];
      if (content && typeof content === "string" && content.trim()) {
        // Strip HTML tags for cleaner processing
        const cleanContent = content.replace(/<[^>]*>/g, "").trim();
        if (cleanContent) {
          systemSummaries.push(`${label}: ${cleanContent}`);
        }
      }
    }

    if (systemSummaries.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "No system data to summarize. Add content to system reviews first.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        },
      );
    }

    const today = new Date().toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    const systemPrompt =
      `You are a medical documentation expert specializing in creating concise interval event summaries for ICU/hospital patients. Generate a brief daily summary using standard medical abbreviations and shorthand.

REQUIRED FORMAT:
- Start with today's date: "${today}:"
- Use bullet points (•) for each key event/finding
- Use standard medical abbreviations:
  - pt = patient, w/ = with, w/o = without
  - h/o = history of, hx = history
  - dx = diagnosis, tx = treatment, sx = symptoms
  - ↑ = increased, ↓ = decreased
  - nl = normal, abn = abnormal
  - neg = negative, pos = positive
  - q = every, prn = as needed
  - BP = blood pressure, HR = heart rate, RR = respiratory rate
  - f/u = follow up, d/c = discharge
  - y/o = year old

GUIDELINES:
- Be extremely concise - aim for 3-6 bullet points
- Focus on NEW findings, changes, and actions taken today
- Exclude routine stable findings unless clinically relevant
- Group related items together
- Prioritize: 1) Clinical changes 2) New interventions 3) Pending items

${
        existingIntervalEvents
          ? `EXISTING INTERVAL EVENTS (add new summary below, do not repeat):\n${existingIntervalEvents}\n`
          : ""
      }

Output ONLY the formatted interval events summary. No explanations or headers.`;

    const userPrompt =
      `Generate today's interval events summary from these system-based rounds notes:\n\n${
        systemSummaries.join("\n\n")
      }`;

    safeLog("info", "Generate interval events processing started", {
      sectionCount: systemSummaries.length,
    });

    const generatedEvents = await callLLM(systemPrompt, userPrompt, {
      model: requestedModel,
      temperature: 0.3,
    });

    if (!generatedEvents) {
      throw new Error("No response from AI");
    }

    safeLog("info", "Generate interval events processing completed", {
      outputChars: generatedEvents.length,
    });

    return new Response(
      JSON.stringify({ intervalEvents: generatedEvents }),
      { headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (error) {
    safeLog("error", "Generate interval events request failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    if (error instanceof MissingAPIKeyError) {
      return new Response(
        JSON.stringify({ error: error.message, code: "MISSING_API_KEY" }),
        {
          status: 503,
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        },
      );
    }
    return createErrorResponse(
      req,
      safeErrorMessage(error, "Failed to generate interval events"),
      500,
    );
  }
});
