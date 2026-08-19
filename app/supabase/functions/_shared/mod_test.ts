import {
  optionalString,
  parseAndValidateBody,
  requireString,
  safeLog,
  utf8ByteLength,
  validateImageArray,
  validateStringArray,
} from "./mod.ts";
import * as shared from "./mod.ts";

Deno.test("shared auth API does not expose an unimplemented role verifier", () => {
  if ("verifyUserRole" in shared) {
    throw new Error(
      "Role authorization must fail closed until a trusted role source exists",
    );
  }
});

Deno.test("safeLog redacts metadata that is not explicitly allowlisted", () => {
  const originalConsoleLog = console.log;
  let captured = "";

  console.log = (...values: unknown[]) => {
    captured = String(values[0] ?? "");
  };

  try {
    safeLog("info", "Static operational event", {
      outputChars: 42,
      patientName: "Example Patient",
      responseBody: "clinical content",
    });
  } finally {
    console.log = originalConsoleLog;
  }

  const parsed = JSON.parse(captured) as {
    event: string;
    data: Record<string, unknown>;
  };

  if (parsed.event !== "Static operational event") {
    throw new Error("Expected the static event label to be preserved");
  }
  if (parsed.data.outputChars !== 42) {
    throw new Error(
      "Expected allowlisted operational metadata to be preserved",
    );
  }
  if (parsed.data.patientName !== "[REDACTED]") {
    throw new Error("Expected patient identifiers to be redacted");
  }
  if (parsed.data.responseBody !== "[REDACTED]") {
    throw new Error("Expected provider response bodies to be redacted");
  }
});

Deno.test("string limits are enforced in UTF-8 bytes", () => {
  if (utf8ByteLength("A😀é") !== 7) {
    throw new Error("Expected UTF-8 byte length, not JavaScript code units");
  }

  const required = requireString("éé", "text", 3);
  if (typeof required === "string" || !required.error.includes("UTF-8 bytes")) {
    throw new Error(
      "Expected a multibyte required string to exceed three bytes",
    );
  }

  if (optionalString("A😀B", 5) !== "A😀") {
    throw new Error(
      "Expected optional strings to truncate at a code-point boundary",
    );
  }

  const array = validateStringArray(["😀"], "items", 1, 3);
  if (Array.isArray(array) || !array.error.includes("UTF-8 bytes")) {
    throw new Error("Expected array items to use UTF-8 byte limits");
  }
});

Deno.test("image validation accepts only bounded raster data URIs", () => {
  const valid = validateImageArray(
    [
      "data:image/png;base64,AQID",
      "data:image/jpeg;base64,BAUG",
    ],
    2,
    3,
    6,
  );
  if (!Array.isArray(valid) || valid.length !== 2) {
    throw new Error("Expected bounded PNG and JPEG data URIs to be accepted");
  }

  const remote = validateImageArray(["https://example.test/tracking.png"]);
  if (Array.isArray(remote) || remote.status !== 400) {
    throw new Error("Expected remote image URLs to be rejected");
  }

  const activeContent = validateImageArray([
    "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
  ]);
  if (Array.isArray(activeContent) || activeContent.status !== 400) {
    throw new Error("Expected active image formats to be rejected");
  }

  const malformed = validateImageArray(["data:image/png;base64,not!base64"]);
  if (Array.isArray(malformed) || malformed.status !== 400) {
    throw new Error("Expected malformed base64 to be rejected");
  }

  const oversized = validateImageArray(
    ["data:image/png;base64,AQIDBA=="],
    1,
    3,
    3,
  );
  if (Array.isArray(oversized) || oversized.status !== 413) {
    throw new Error(
      "Expected decoded image bytes to enforce the per-image cap",
    );
  }

  const excessiveTotal = validateImageArray(
    [
      "data:image/png;base64,AQID",
      "data:image/webp;base64,BAUG",
    ],
    2,
    3,
    5,
  );
  if (Array.isArray(excessiveTotal) || excessiveTotal.status !== 413) {
    throw new Error(
      "Expected decoded image bytes to enforce the aggregate cap",
    );
  }
});

Deno.test({
  name: "request size validation measures the encoded body",
  async fn() {
    const originalEnvGet = Deno.env.get;
    Deno.env.get = () => undefined;
    const body = JSON.stringify({ value: "😀" });
    const request = new Request("http://localhost/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });

    try {
      const result = await parseAndValidateBody(request, {
        maxBytes: body.length,
      });
      if (result.valid || result.response.status !== 413) {
        throw new Error(
          "Expected multibyte JSON exceeding the byte limit to be rejected",
        );
      }
    } finally {
      Deno.env.get = originalEnvGet;
    }
  },
});
