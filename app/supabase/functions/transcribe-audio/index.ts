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
} from "../_shared/mod.ts";
import {
  callLLM,
  getLLMConfig,
  isClinicalAIDisabled,
} from "../_shared/llm-client.ts";

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(
  base64String: string,
  chunkSize = 32768,
): Uint8Array {
  const chunks: Uint8Array[] = [];
  let position = 0;

  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);

    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }

    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

// Comprehensive medical vocabulary hints for Whisper
const WHISPER_MEDICAL_PROMPT =
  `Medical clinical documentation transcription. ICU critical care rounding notes.
Common terms: patient, history, diagnosis, treatment, assessment, plan, medications, vitals.
Abbreviations: BP, HR, RR, SpO2, MAP, CVP, PEEP, FiO2, GCS, BMP, CBC, ABG, EKG, CT, MRI.
Labs: creatinine, BUN, sodium, potassium, hemoglobin, hematocrit, platelets, WBC, lactate, troponin, BNP.
Medications: norepinephrine, vasopressin, propofol, fentanyl, midazolam, heparin, insulin, vancomycin, piperacillin-tazobactam, meropenem.
Diagnoses: sepsis, ARDS, acute kidney injury, heart failure, pneumonia, stroke, myocardial infarction, respiratory failure.
Procedures: intubation, central line, arterial line, chest tube, bronchoscopy, dialysis, CRRT.`;

// Medical terminology enhancement prompt - Enhanced with GPT-4 capabilities
const MEDICAL_ENHANCEMENT_PROMPT =
  `You are an expert medical transcription assistant specializing in ICU and critical care documentation. Your task is to enhance and correct medical dictation for clinical accuracy.

TRANSFORMATION RULES:
1. Medical Terminology Correction:
   - Fix phonetic medical terms (e.g., "die a bee tees" → "diabetes", "new moan ya" → "pneumonia")
   - Correct drug name pronunciations (e.g., "van co my sin" → "vancomycin", "lee vo flox a sin" → "levofloxacin")

2. Abbreviation Handling:
   - Expand spoken abbreviations appropriately (e.g., "bee pee" → "BP", "see oh pee dee" → "COPD")
   - Use standard medical abbreviations: BP, HR, RR, SpO2, MAP, GCS, BMP, CBC, etc.

3. Numerical Formatting:
   - Vital signs: "blood pressure one twenty over eighty" → "BP 120/80"
   - Lab values: "hemoglobin twelve point five" → "Hgb 12.5", "creatinine one point two" → "Cr 1.2"
   - Vent settings: "peep of eight, fi oh two forty percent" → "PEEP 8, FiO2 40%"
   - Doses: "norepinephrine at point one mics per kilo per minute" → "norepinephrine 0.1 mcg/kg/min"

4. Clinical Context:
   - Understand clinical context to disambiguate terms
   - "patient is a fib" → "patient is in afib" (atrial fibrillation)
   - "patient is stable" remains "patient is stable"

5. Formatting Standards:
   - Use proper capitalization for medical terms
   - Format lists with commas or bullet points
   - Keep sentences clinically clear and concise

6. Preservation Rules:
   - NEVER change clinical meaning or add information
   - If uncertain about a term, keep the original transcription
   - Maintain all clinical details exactly as dictated

Return ONLY the corrected text, no explanations or commentary.`;

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
    safeLog("info", "Authenticated transcription request");

    // Rate limiting - transcription is expensive
    const rateLimit = await checkRateLimit(
      req,
      RATE_LIMITS.transcription,
      authResult.userId,
    );
    if (!rateLimit.allowed) {
      return rateLimit.response ??
        createErrorResponse(req, "Rate limit exceeded", 429);
    }

    // Parse and validate input
    const bodyResult = await parseAndValidateBody<
      {
        audio?: string;
        mimeType?: string;
        enhanceMedical?: boolean;
        model?: string;
      }
    >(req, { maxBytes: MAX_MEDIA_PAYLOAD_BYTES });
    if (!bodyResult.valid) {
      safeLog("warn", "Invalid request body or payload too large");
      return bodyResult.response;
    }
    const {
      audio,
      mimeType = "audio/webm",
      enhanceMedical = true,
      model: requestedModel,
    } = bodyResult.data;

    if (!audio || typeof audio !== "string" || audio.trim().length === 0) {
      return createErrorResponse(
        req,
        "Missing required field: audio (base64-encoded audio data)",
        400,
      );
    }

    // Safety: strip data URI prefix if present (e.g., "data:audio/webm;base64,")
    const audioPrefixMatch = audio.match(/^data:audio\/[a-z0-9]+;base64,/i);
    const audioData = audioPrefixMatch ? audio.split(",")[1] : audio;

    safeLog("info", "Transcription payload accepted", {
      inputChars: audioData.length,
      mimeCategory: mimeType.split("/")[0] || "unknown",
      enhancementRequested: enhanceMedical,
    });

    // Process audio in chunks
    let binaryAudio: Uint8Array;
    try {
      binaryAudio = processBase64Chunks(audioData);
      safeLog("info", "Transcription audio decoded", {
        audioBytes: binaryAudio.length,
      });
    } catch (error) {
      safeLog("warn", "Transcription audio decode failed", {
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
      return createErrorResponse(
        req,
        "Malformed audio data: Invalid base64 encoding",
        400,
      );
    }

    // Prepare form data for Whisper API with enhanced medical prompting
    const formData = new FormData();
    const blob = new Blob([binaryAudio.buffer as ArrayBuffer], {
      type: mimeType,
    });
    formData.append("file", blob, `audio.${mimeType.split("/")[1] || "webm"}`);
    formData.append("model", "whisper-1");
    formData.append("language", "en");
    formData.append("prompt", WHISPER_MEDICAL_PROMPT);

    // Whisper is an OpenAI service, so audio transcription requires the
    // OpenAI credential; the clinical AI kill switch applies as well.
    if (isClinicalAIDisabled()) {
      return createErrorResponse(
        req,
        "Clinical AI is disabled for this deployment.",
        503,
      );
    }
    const llmConfig = getLLMConfig("openai");
    const OPENAI_API_KEY = llmConfig.apiKey;

    if (!OPENAI_API_KEY) {
      return createErrorResponse(
        req,
        "Audio transcription requires OPENAI_API_KEY secret to be configured for Whisper API access.",
        503,
      );
    }

    // First, transcribe using Whisper through OpenAI API
    const transcribeResponse = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: formData,
      },
    );

    let rawTranscript = "";

    if (transcribeResponse.ok) {
      const whisperResult = await transcribeResponse.json();
      rawTranscript = whisperResult.text;
      safeLog("info", "Whisper transcription completed");
    } else {
      safeLog("error", "Transcription provider request failed", {
        statusCode: transcribeResponse.status,
      });
      return createErrorResponse(
        req,
        "Whisper transcription failed",
        500,
      );
    }

    // If medical enhancement is requested, use our shared LLM client
    let finalText = rawTranscript;
    let enhancementModel = "none";

    if (enhanceMedical && rawTranscript) {
      safeLog("info", "Medical transcription enhancement started");

      try {
        // use the requested model or default. This relies on getLLMConfig doing the right mapping.
        const modelToUse = requestedModel || undefined;
        finalText = await callLLM(
          MEDICAL_ENHANCEMENT_PROMPT,
          rawTranscript,
          {
            model: modelToUse,
            temperature: 0.1,
            maxTokens: 2000,
          },
        ) || rawTranscript;

        enhancementModel = modelToUse || "default";
        safeLog("info", "Medical enhancement completed via shared LLM client");
      } catch (error) {
        safeLog("warn", "Medical transcription enhancement failed", {
          errorType: error instanceof Error ? error.name : "UnknownError",
        });
        // Fall back to raw transcript if enhancement fails
        finalText = rawTranscript;
      }
    }

    return jsonResponse(req, {
      text: finalText,
      rawText: rawTranscript,
      enhanced: enhanceMedical && finalText !== rawTranscript,
      enhancementModel: enhancementModel !== "none"
        ? enhancementModel
        : undefined,
    });
  } catch (error: unknown) {
    safeLog("error", "Transcription error");
    return createErrorResponse(
      req,
      safeErrorMessage(error, "Transcription failed"),
      500,
    );
  }
});
