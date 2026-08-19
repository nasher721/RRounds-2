import {
  checkRateLimit,
  hmacSha256Hex,
  type RateLimitConsumer,
  type RateLimitKeyHasher,
} from "./rate-limit.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const TEST_HASHER: RateLimitKeyHasher = (identifier) =>
  hmacSha256Hex(identifier, "test-rate-limit-secret-32-bytes");

async function withoutEnvironmentReads(
  run: () => Promise<void>,
): Promise<void> {
  const originalGet = Deno.env.get;
  Deno.env.get = () => undefined;
  try {
    await run();
  } finally {
    Deno.env.get = originalGet;
  }
}

Deno.test("rate limits use distributed consumption without storing identifiers", async () => {
  let capturedKey = "";
  let capturedWindow = 0;
  let capturedLimit = 0;
  const resetTime = Date.now() + 30_000;
  const consume: RateLimitConsumer = (key, windowMs, maxRequests) => {
    capturedKey = key;
    capturedWindow = windowMs;
    capturedLimit = maxRequests;
    return Promise.resolve({ allowed: true, remaining: 4, resetTime });
  };

  const result = await checkRateLimit(
    new Request("https://example.test/function"),
    { windowMs: 60_000, maxRequests: 5, keyPrefix: "test" },
    "patient-owner-id",
    consume,
    TEST_HASHER,
  );

  assert(result.allowed, "Expected the distributed decision to be honored");
  assert(result.remaining === 4, "Expected remaining quota from the backend");
  assert(result.resetTime === resetTime, "Expected backend reset time");
  assert(capturedWindow === 60_000, "Expected configured window");
  assert(capturedLimit === 5, "Expected configured request limit");
  assert(
    /^test:[a-f0-9]{64}$/.test(capturedKey),
    "Expected a namespaced HMAC-SHA-256 rate-limit key",
  );
  assert(
    !capturedKey.includes("patient-owner-id"),
    "Rate-limit storage must not contain raw user identifiers",
  );
});

Deno.test("rate-limit denial returns retry metadata", async () => {
  await withoutEnvironmentReads(async () => {
    const resetTime = Date.now() + 5_000;
    const consume: RateLimitConsumer = () =>
      Promise.resolve({ allowed: false, remaining: 0, resetTime });
    const result = await checkRateLimit(
      new Request("https://example.test/function", {
        headers: { "x-forwarded-for": "198.51.100.4" },
      }),
      { windowMs: 60_000, maxRequests: 1 },
      undefined,
      consume,
      TEST_HASHER,
    );

    assert(!result.allowed, "Expected the backend denial to block the request");
    assert(result.response?.status === 429, "Expected HTTP 429");
    assert(
      Number(result.response.headers.get("Retry-After")) >= 1,
      "Expected a positive Retry-After header",
    );
  });
});

Deno.test("rate-limit backend failures fail closed", async () => {
  await withoutEnvironmentReads(async () => {
    const consume: RateLimitConsumer = () =>
      Promise.reject(new Error("database diagnostic must stay private"));
    const result = await checkRateLimit(
      new Request("https://example.test/function"),
      { windowMs: 60_000, maxRequests: 1 },
      undefined,
      consume,
      TEST_HASHER,
    );

    assert(!result.allowed, "Backend failure must not bypass rate limiting");
    assert(result.response?.status === 503, "Expected HTTP 503");
    assert(
      !(await result.response!.text()).includes("database diagnostic"),
      "Backend diagnostics must not cross the response boundary",
    );
  });
});

Deno.test("rate-limit identifiers are keyed and cannot be matched with plain hashes", async () => {
  const first = await hmacSha256Hex(
    "same-user",
    "first-test-rate-limit-secret",
  );
  const second = await hmacSha256Hex(
    "same-user",
    "second-test-rate-limit-secret",
  );
  assert(first !== second, "Expected secret-dependent identifiers");
});
