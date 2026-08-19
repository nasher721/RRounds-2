import {
  authenticateRequest,
  checkRateLimit,
  createErrorResponse,
  handleOptions,
  jsonResponse,
  MissingAPIKeyError,
  parseAndValidateBody,
  RATE_LIMITS,
  safeErrorMessage,
  safeLog,
} from "../_shared/mod.ts";
import { callLLM } from "../_shared/llm-client.ts";

interface Todo {
  content: string;
  completed: boolean;
  section?: string;
  created_at?: string;
}

interface PatientSystems {
  neuro?: string;
  cv?: string;
  resp?: string;
  renalGU?: string;
  gi?: string;
  endo?: string;
  heme?: string;
  infectious?: string;
  skinLines?: string;
  dispo?: string;
}

interface PatientMedications {
  infusions?: string[];
  scheduled?: string[];
  prn?: string[];
  rawText?: string;
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
    const userId = authResult.userId;
    safeLog("info", "Generate daily summary request authenticated");

    // Rate limiting check
    const rateLimit = await checkRateLimit(req, RATE_LIMITS.ai, userId);
    if (!rateLimit.allowed) {
      return rateLimit.response ??
        jsonResponse(req, { error: "Rate limit exceeded" }, 429);
    }

    const bodyResult = await parseAndValidateBody<{
      patientName?: string;
      clinicalSummary?: string;
      intervalEvents?: string;
      imaging?: string;
      labs?: string;
      systems?: PatientSystems;
      medications?: PatientMedications;
      todos?: Todo[];
      existingIntervalEvents?: string;
      model?: string;
    }>(req);
    if (!bodyResult.valid) {
      return bodyResult.response;
    }
    const {
      patientName,
      clinicalSummary,
      imaging,
      labs,
      systems,
      medications,
      todos,
      existingIntervalEvents,
      model: requestedModel,
    } = bodyResult.data;

    const todayFormatted = new Date().toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });

    // Build comprehensive patient context
    const patientContext: string[] = [];

    // Clinical Summary
    if (clinicalSummary && stripHtml(clinicalSummary).trim()) {
      patientContext.push(`CLINICAL SUMMARY:\n${stripHtml(clinicalSummary)}`);
    }

    // Systems review
    const systemsData = systems as PatientSystems;
    if (systemsData) {
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
      const systemNotes: string[] = [];
      for (const [key, label] of Object.entries(systemLabels)) {
        const content = systemsData[key as keyof PatientSystems];
        if (content && stripHtml(content).trim()) {
          systemNotes.push(`${label}: ${stripHtml(content)}`);
        }
      }
      if (systemNotes.length > 0) {
        patientContext.push(`SYSTEMS REVIEW:\n${systemNotes.join("\n")}`);
      }
    }

    // Labs
    if (labs && stripHtml(labs).trim()) {
      patientContext.push(`LABS:\n${stripHtml(labs)}`);
    }

    // Imaging
    if (imaging && stripHtml(imaging).trim()) {
      patientContext.push(`IMAGING:\n${stripHtml(imaging)}`);
    }

    // Medications
    const medsData = medications as PatientMedications;
    if (medsData) {
      const medNotes: string[] = [];
      if (medsData.infusions?.length) {
        medNotes.push(`Infusions: ${medsData.infusions.join(", ")}`);
      }
      if (medsData.scheduled?.length) {
        medNotes.push(`Scheduled: ${medsData.scheduled.join(", ")}`);
      }
      if (medsData.prn?.length) {
        medNotes.push(`PRN: ${medsData.prn.join(", ")}`);
      }
      if (medsData.rawText && stripHtml(medsData.rawText).trim()) {
        medNotes.push(stripHtml(medsData.rawText));
      }
      if (medNotes.length > 0) {
        patientContext.push(`MEDICATIONS:\n${medNotes.join("\n")}`);
      }
    }

    // Check if we have any content
    if (patientContext.length === 0) {
      return jsonResponse(req, {
        error:
          "No patient data to summarize. Add content to clinical fields first.",
      }, 400);
    }

    // Process todos
    const allTodos = (todos as Todo[]) || [];
    const pendingTodos = allTodos.filter((t) => !t.completed);
    const completedTodos = allTodos.filter((t) => t.completed);

    // Categorize todos by urgency
    const todayKeywords = ["today", "now", "asap", "stat", "urgent"];
    const tomorrowKeywords = ["tomorrow", "am", "morning", "f/u"];

    const todayTodos = pendingTodos.filter((t) =>
      todayKeywords.some((kw) => t.content.toLowerCase().includes(kw))
    );
    const tomorrowTodos = pendingTodos.filter((t) =>
      tomorrowKeywords.some((kw) => t.content.toLowerCase().includes(kw)) &&
      !todayKeywords.some((kw) => t.content.toLowerCase().includes(kw))
    );
    const otherTodos = pendingTodos.filter((t) =>
      !todayKeywords.some((kw) => t.content.toLowerCase().includes(kw)) &&
      !tomorrowKeywords.some((kw) => t.content.toLowerCase().includes(kw))
    );

    const systemPrompt =
      `You are an ICU/hospital physician generating a concise daily summary in standard medical shorthand. This summary captures the patient's current status and outstanding tasks.

OUTPUT FORMAT:
---
📋 ${todayFormatted} Daily Summary

▸ STATUS: [1-2 line overall status in shorthand]

▸ KEY POINTS:
• [3-5 bullets covering most important active issues across all systems]
• [Focus on: hemodynamics, resp status, neuro, ID, major labs/imaging findings]
• [Include current drips/key meds if relevant]

${
        pendingTodos.length > 0
          ? `▸ ACTION ITEMS:
${
            todayTodos.length > 0
              ? "🔴 TODAY:\n" +
                todayTodos.map((t) => `• ${t.content}`).join("\n")
              : ""
          }
${
            tomorrowTodos.length > 0
              ? "🟡 TOMORROW:\n" +
                tomorrowTodos.map((t) => `• ${t.content}`).join("\n")
              : ""
          }
${
            otherTodos.length > 0
              ? "⚪ PENDING:\n" +
                otherTodos.map((t) => `• ${t.content}`).join("\n")
              : ""
          }`
          : ""
      }

${
        completedTodos.length > 0
          ? `✓ COMPLETED: ${completedTodos.length} task(s)`
          : ""
      }
---

ABBREVIATION GUIDELINES:
- pt = patient, y/o = year old, h/o = history of
- w/ = with, w/o = without, s/p = status post
- ↑ = increased/improving, ↓ = decreased/worsening, → = stable/progressing
- dx = diagnosis, tx = treatment, rx = prescription
- c/o = complains of, r/o = rule out
- f/u = follow up, d/c = discharge/discontinue
- nl = normal, abn = abnormal, wnl = within normal limits
- prn = as needed, q = every, qd = daily, bid = twice daily
- MAP = mean arterial pressure, CVP = central venous pressure
- ABG = arterial blood gas, CBC = complete blood count
- Cr = creatinine, BUN = blood urea nitrogen, Hgb = hemoglobin
- WBC = white blood cells, plt = platelets
- SOB = shortness of breath, RR = respiratory rate
- ETT = endotracheal tube, vent = ventilator
- PEEP = positive end-expiratory pressure, FiO2 = fraction inspired oxygen
- I/O = intake/output, UOP = urine output

RULES:
1. Be extremely concise - use abbreviations liberally
2. Prioritize clinical significance
3. Group related items (e.g., all resp findings together)
4. Include specific values for critical parameters (MAP, vent settings, key labs)
5. Highlight any changes from previous status
6. Output ONLY the formatted summary block`;

    const userPrompt = `Generate a comprehensive daily summary for ${
      patientName || "this patient"
    }:\n\n${patientContext.join("\n\n")}`;

    safeLog("info", "Generate daily summary processing started", {
      sectionCount: patientContext.length,
      todoCount: pendingTodos.length,
    });

    let summary: string | null | undefined = null;
    try {
      summary = await callLLM(systemPrompt, userPrompt, {
        model: requestedModel,
        temperature: 0.4,
      });
      safeLog("info", "Generate daily summary response received", {
        outputChars: summary?.length || 0,
      });
    } catch (err) {
      safeLog("error", "Generate daily summary provider request failed", {
        errorType: err instanceof Error ? err.name : "UnknownError",
      });
      if (
        err instanceof Error &&
        (err.message.includes("429") || err.message.includes("Rate limit"))
      ) {
        return jsonResponse(req, {
          error: "Rate limit exceeded. Please try again in a moment.",
        }, 429);
      }
      throw err;
    }

    if (!summary) {
      throw new Error("No response from AI");
    }

    // Append to existing interval events
    let finalContent = summary;
    if (existingIntervalEvents && existingIntervalEvents.trim()) {
      // Check if today's summary already exists and replace it
      const datePattern = todayFormatted.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const summaryMarkerRegex = new RegExp(
        `---\\s*\\n📋\\s*${datePattern}[\\s\\S]*?---`,
        "g",
      );
      if (summaryMarkerRegex.test(existingIntervalEvents)) {
        finalContent = existingIntervalEvents.replace(
          summaryMarkerRegex,
          summary,
        );
      } else {
        finalContent = existingIntervalEvents.trim() + "\n\n" + summary;
      }
    }

    safeLog("info", "Generate daily summary processing completed", {
      outputChars: summary.length,
    });

    return jsonResponse(req, { summary: finalContent, summaryOnly: summary });
  } catch (error) {
    safeLog("error", "Generate daily summary request failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    // Handle missing API key configuration
    if (error instanceof MissingAPIKeyError) {
      return jsonResponse(req, {
        error: error.message,
        code: "MISSING_API_KEY",
      }, 503);
    }
    return createErrorResponse(
      req,
      safeErrorMessage(error, "Failed to generate daily summary"),
      500,
    );
  }
});

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, "").trim();
}
