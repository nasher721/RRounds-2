import {
  ALLOWED_TRANSFORM_TYPES,
  authenticateRequest,
  checkRateLimit,
  corsHeaders,
  createErrorResponse,
  handleOptions,
  MissingAPIKeyError,
  parseAndValidateBody,
  RATE_LIMITS,
  requireEnum,
  requireString,
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
    safeLog("info", "Transform text request authenticated");
    // Rate limiting check
    const rateLimit = await checkRateLimit(
      req,
      RATE_LIMITS.standard,
      authResult.userId,
    );
    if (!rateLimit.allowed) {
      return rateLimit.response ??
        new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        });
    }

    // Parse and validate input
    const bodyResult = await parseAndValidateBody<
      {
        text?: string;
        transformType?: string;
        customPrompt?: string;
        model?: string;
      }
    >(req);
    if (!bodyResult.valid) {
      return bodyResult.response;
    }
    const { text, transformType, customPrompt, model: requestedModel } =
      bodyResult.data;

    const textCheck = requireString(text, "text");
    if (typeof textCheck === "object" && "error" in textCheck) {
      return createErrorResponse(req, textCheck.error, 400);
    }
    const typeCheck = requireEnum(
      transformType,
      "transformType",
      ALLOWED_TRANSFORM_TYPES,
    );
    if (typeof typeCheck === "object" && "error" in typeCheck) {
      return createErrorResponse(req, typeCheck.error, 400);
    }
    const validText = textCheck;
    const validTransformType = typeCheck;

    let systemPrompt = "";
    let userPrompt = "";

    switch (validTransformType) {
      case "comma-list":
        systemPrompt =
          `You are a text formatting assistant. Convert the given text into a comma-delimited list.
- Extract distinct items, concepts, or elements from the text
- Format them as a clean comma-separated list
- Remove redundant words and keep each item concise
- Do not add any explanation, just output the comma-separated list`;
        userPrompt =
          `Convert this text to a comma-delimited list:\n\n${validText}`;
        break;

      case "medical-shorthand":
        systemPrompt =
          `You are a medical documentation expert. Rewrite the given text using standard medical abbreviations and shorthand.
Common abbreviations to use:
- patient → pt, patients → pts
- with → w/, without → w/o
- history → hx, history of → h/o
- diagnosis → dx, treatment → tx, symptoms → sx
- before → pre, after → post
- bilateral → b/l, left → L, right → R
- increase → ↑, decrease → ↓
- normal → nl, abnormal → abn
- negative → neg, positive → pos
- times/frequency → x (e.g., "three times" → "3x")
- every → q (e.g., "every day" → "qd")
- as needed → prn
- immediately → stat
- by mouth → PO, intravenous → IV, intramuscular → IM
- blood pressure → BP, heart rate → HR, respiratory rate → RR
- chief complaint → CC, review of systems → ROS
- physical exam → PE, vital signs → VS
- follow up → f/u, discharge → d/c
- year old → y/o (e.g., "65 year old" → "65 y/o")

Output ONLY the rewritten text in medical shorthand. No explanations.`;
        userPrompt = `Rewrite in medical shorthand:\n\n${validText}`;
        break;

      case "custom":
        if (!customPrompt) {
          return new Response(
            JSON.stringify({
              error: "Custom prompt required for custom transformation",
            }),
            {
              status: 400,
              headers: {
                ...corsHeaders(req),
                "Content-Type": "application/json",
              },
            },
          );
        }
        systemPrompt =
          `You are a helpful text transformation assistant. Apply the user's requested transformation to the given text. Output ONLY the transformed text without any explanations or commentary.`;
        userPrompt = `${customPrompt}\n\nText to transform:\n${validText}`;
        break;

      default:
        return new Response(
          JSON.stringify({ error: "Invalid transformType" }),
          {
            status: 400,
            headers: {
              ...corsHeaders(req),
              "Content-Type": "application/json",
            },
          },
        );
    }

    safeLog("info", "Transform text processing started", {
      feature: validTransformType,
      inputChars: validText.length,
    });

    const transformedText = await callLLM(
      systemPrompt,
      userPrompt,
      { model: requestedModel },
    );

    if (!transformedText) {
      throw new Error("No response from AI");
    }

    safeLog("info", "Transform text processing completed", {
      feature: validTransformType,
      outputChars: transformedText.length,
    });

    return new Response(
      JSON.stringify({ transformedText }),
      { headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  } catch (error) {
    safeLog("error", "Transform text request failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    // Handle missing API key configuration
    if (error instanceof MissingAPIKeyError) {
      return new Response(
        JSON.stringify({ error: error.message, code: "MISSING_API_KEY" }),
        {
          status: 503,
          headers: { ...corsHeaders(req), "Content-Type": "application/json" },
        },
      );
    }
    const errorMessage = safeErrorMessage(error, "Failed to transform text");
    return createErrorResponse(req, errorMessage, 500);
  }
});
