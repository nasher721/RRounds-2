import {
  ALLOWED_TODO_SECTIONS,
  authenticateRequest,
  checkRateLimit,
  corsHeaders,
  createErrorResponse,
  handleOptions,
  MissingAPIKeyError,
  parseAndValidateBody,
  RATE_LIMITS,
  requireEnum,
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
    safeLog("info", "Generate todos request authenticated");

    // Rate limiting check
    const rateLimit = await checkRateLimit(
      req,
      RATE_LIMITS.ai,
      authResult.userId,
    );
    if (!rateLimit.allowed) {
      return rateLimit.response ??
        new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        });
    }

    const bodyResult = await parseAndValidateBody<
      {
        patientData?: Record<string, unknown>;
        section?: string;
        model?: string;
      }
    >(req);
    if (!bodyResult.valid) {
      return bodyResult.response;
    }
    const { patientData, section, model: requestedModel } = bodyResult.data;

    if (!patientData || typeof patientData !== "object") {
      return createErrorResponse(
        req,
        "Missing required field: patientData",
        400,
      );
    }

    const sectionCheck = requireEnum(
      section ?? "all",
      "section",
      ALLOWED_TODO_SECTIONS,
    );
    if (typeof sectionCheck === "object" && "error" in sectionCheck) {
      return createErrorResponse(req, sectionCheck.error, 400);
    }
    const selectedSection = sectionCheck;
    const getPatientText = (key: string): string => {
      const value = patientData[key];
      return typeof value === "string" ? value : "";
    };
    const patientSystems =
      patientData.systems && typeof patientData.systems === "object"
        ? patientData.systems as Record<string, unknown>
        : {};

    let prompt = "";
    let contextData = "";

    if (selectedSection === "all") {
      // Generate todos for entire patient
      contextData = `
Patient Name: ${getPatientText("name") || "Unknown"}
Bed: ${getPatientText("bed") || "N/A"}
Clinical Summary: ${getPatientText("clinicalSummary") || "None"}
Interval Events: ${getPatientText("intervalEvents") || "None"}
Imaging: ${getPatientText("imaging") || "None"}
Labs: ${getPatientText("labs") || "None"}
Systems Review: ${JSON.stringify(patientSystems, null, 2)}
`;
      prompt =
        `Based on this patient's complete information, generate a prioritized list of actionable to-do items for the care team. Focus on clinical tasks, follow-ups, pending orders, and important monitoring.`;
    } else {
      // Generate todos for specific section
      const sectionNames: Record<string, string> = {
        clinical_summary: "Clinical Summary",
        interval_events: "Interval Events",
        imaging: "Imaging",
        labs: "Labs",
        cv: "Cardiovascular",
        resp: "Respiratory",
        neuro: "Neurological",
        gi: "Gastrointestinal",
        renalGU: "Renal/GU",
        heme: "Hematology",
        infectious: "Infectious Disease",
        endo: "Endocrine",
        skinLines: "Skin/Lines",
        dispo: "Disposition",
      };

      const sectionName = sectionNames[selectedSection] || selectedSection;

      if (selectedSection === "clinical_summary") {
        contextData = getPatientText("clinicalSummary");
      } else if (selectedSection === "interval_events") {
        contextData = getPatientText("intervalEvents");
      } else if (selectedSection === "imaging") {
        contextData = getPatientText("imaging");
      } else if (selectedSection === "labs") {
        contextData = getPatientText("labs");
      } else {
        const systemContent = patientSystems[selectedSection];
        contextData = typeof systemContent === "string" ? systemContent : "";
      }

      prompt =
        `Based on this ${sectionName} information, generate actionable to-do items specific to this area. Focus on follow-ups, pending tasks, and important items to address.`;
    }

    if (!contextData.trim()) {
      return new Response(
        JSON.stringify({
          todos: [],
          message: "No content available to generate todos from.",
        }),
        {
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        },
      );
    }

    const systemPrompt =
      `You are a medical assistant helping generate actionable to-do items for patient care.
Generate concise, specific, and actionable tasks. Each task should be clear and completable.
Return ONLY a JSON array of strings, each string being one to-do item.
Keep each item under 100 characters. Generate 3-7 relevant items based on the content provided.
Do not include explanations or markdown, just the JSON array.`;

    const content = await callLLM(
      systemPrompt,
      `${prompt}\n\nContent:\n${contextData}`,
      {
        model: requestedModel,
        temperature: 0.3,
      },
    );
    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse the JSON array from the response
    let todos: string[] = [];
    try {
      // Try to extract JSON array from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        todos = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      safeLog("warn", "Generate todos response parse failed", {
        errorType: parseError instanceof Error
          ? parseError.name
          : "UnknownError",
      });
      // If parsing fails, split by newlines and clean up
      todos = content
        .split("\n")
        .map((line: string) => line.replace(/^[-*•]\s*/, "").trim())
        .filter((line: string) => line.length > 0 && line.length < 150);
    }

    return new Response(
      JSON.stringify({ todos }),
      { headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (error) {
    safeLog("error", "Generate todos request failed", {
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
      safeErrorMessage(error, "Failed to generate todos"),
      500,
    );
  }
});
