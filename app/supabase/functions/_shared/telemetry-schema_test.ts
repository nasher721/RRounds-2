import {
  MAX_TELEMETRY_BATCH_SIZE,
  parseTelemetryBatch,
} from "./telemetry-schema.ts";

const NOW = Date.parse("2026-08-13T14:00:00.000Z");

function event(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    app: "round-robin-notes",
    context: {
      metricName: "offline.sync.queue_length",
      metricUnit: "count",
      metricValue: 2,
      outcome: "enqueued",
      type: "metric",
    },
    env: "production",
    level: "info",
    message: "metric",
    sessionId: "session_123",
    timestamp: "2026-08-13T13:59:00.000Z",
    ...overrides,
  };
}

Deno.test("telemetry ingestion projects a valid metric into fixed columns", () => {
  const result = parseTelemetryBatch([event()], NOW);
  if (!result.valid) throw new Error(result.error);

  if (result.rows.length !== 1) throw new Error("Expected one telemetry row");
  const [row] = result.rows;
  if (row.metric_name !== "offline.sync.queue_length") {
    throw new Error("Metric name was not preserved");
  }
  if (row.metric_value !== 2 || row.metric_unit !== "count") {
    throw new Error("Metric measurement was not preserved");
  }
  if ("session_id" in row || "context" in row || "user_agent" in row) {
    throw new Error(
      "Identifying or arbitrary payload data crossed the storage boundary",
    );
  }
});

Deno.test("telemetry ingestion accepts fixed public-funnel events", () => {
  const result = parseTelemetryBatch([
    event({
      context: { feature: "public_funnel", type: "product_analytics" },
      message: "marketing.landing_view",
    }),
  ], NOW);
  if (!result.valid) throw new Error(result.error);
  if (result.rows[0].feature !== "public_funnel") {
    throw new Error("Public funnel feature was not preserved");
  }
});

Deno.test("telemetry ingestion accepts the content-free production monitor probe", () => {
  const result = parseTelemetryBatch([
    event({ context: {}, message: "monitor.ingest_probe" }),
  ], NOW);
  if (!result.valid) throw new Error(result.error);
  if (result.rows[0].event_name !== "monitor.ingest_probe") {
    throw new Error("Monitor probe was not preserved");
  }
});

Deno.test("telemetry ingestion rejects arbitrary messages and PHI-shaped fields", () => {
  const arbitraryMessage = parseTelemetryBatch([
    event({ message: "patient.Jane_Doe.MRN_12345" }),
  ], NOW);
  if (arbitraryMessage.valid) {
    throw new Error("Arbitrary event names must be rejected");
  }

  const rawContext = parseTelemetryBatch([
    event({ context: { patientName: "Jane_Doe" } }),
  ], NOW);
  if (rawContext.valid) {
    throw new Error("Unknown context fields must be rejected");
  }

  const extraPayload = parseTelemetryBatch([
    event({ clinicalNote: "raw-note" }),
  ], NOW);
  if (extraPayload.valid) {
    throw new Error("Unknown top-level fields must be rejected");
  }
});

Deno.test("telemetry ingestion rejects malformed and unbounded measurements", () => {
  for (
    const invalidContext of [
      {
        metricName: "unknown.metric",
        metricUnit: "count",
        metricValue: 1,
        type: "metric",
      },
      {
        metricName: "offline.sync.queue_length",
        metricUnit: "bytes",
        metricValue: 1,
        type: "metric",
      },
      {
        metricName: "offline.sync.queue_length",
        metricUnit: "count",
        metricValue: Infinity,
        type: "metric",
      },
      {
        metricName: "offline.sync.queue_length",
        metricUnit: "count",
        metricValue: 1,
        type: "free_text",
      },
    ]
  ) {
    const result = parseTelemetryBatch(
      [event({ context: invalidContext })],
      NOW,
    );
    if (result.valid) throw new Error("Invalid measurement must be rejected");
  }
});

Deno.test("telemetry ingestion enforces batch and timestamp bounds", () => {
  const oversized = parseTelemetryBatch(
    Array.from({ length: MAX_TELEMETRY_BATCH_SIZE + 1 }, () => event()),
    NOW,
  );
  if (oversized.valid) throw new Error("Oversized batches must be rejected");

  const old = parseTelemetryBatch([
    event({ timestamp: "2026-06-01T00:00:00.000Z" }),
  ], NOW);
  if (old.valid) throw new Error("Expired telemetry must be rejected");

  const future = parseTelemetryBatch([
    event({ timestamp: "2026-08-15T00:00:00.000Z" }),
  ], NOW);
  if (future.valid) throw new Error("Far-future telemetry must be rejected");
});
