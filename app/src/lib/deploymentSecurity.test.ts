import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("production deployment security", () => {
  it("does not publish production source maps", () => {
    const viteConfig = readFileSync("vite.config.ts", "utf8");
    assert.match(viteConfig, /sourcemap:\s*false/);
    assert.doesNotMatch(viteConfig, /sourcemap:\s*mode\s*===\s*['"]production['"]/);
  });

  it("ships a restrictive content security policy and transport headers", () => {
    const deployment = JSON.parse(readFileSync("vercel.json", "utf8")) as {
      headers?: Array<{
        source: string;
        headers: Array<{ key: string; value: string }>;
      }>;
    };
    const rootHeaders = new Map(
      deployment.headers
        ?.find(({ source }) => source === "/(.*)")
        ?.headers.map(({ key, value }) => [key.toLowerCase(), value]) ?? [],
    );
    const csp = rootHeaders.get("content-security-policy") ?? "";

    assert.match(csp, /default-src 'self'/);
    assert.match(csp, /script-src 'self'/);
    assert.match(csp, /connect-src[^;]+https:\/\/\*\.supabase\.co/);
    assert.match(csp, /object-src 'none'/);
    assert.match(csp, /frame-ancestors 'none'/);
    assert.match(csp, /base-uri 'self'/);
    assert.match(
      rootHeaders.get("strict-transport-security") ?? "",
      /max-age=\d+/,
    );
    assert.match(rootHeaders.get("permissions-policy") ?? "", /geolocation=\(\)/);
  });
});
