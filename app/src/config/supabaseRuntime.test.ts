import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  getSupabaseRuntimeConfig,
  type SupabaseRuntimeEnv,
} from "./supabaseRuntime.ts";

describe("Supabase runtime configuration", () => {
  test("returns unavailable when both required public values are missing", () => {
    assert.deepEqual(getSupabaseRuntimeConfig({}), {
      available: false,
      reason: "missing",
    });
  });

  test("trims values and rejects partial or malformed configuration", () => {
    const partial: SupabaseRuntimeEnv = {
      VITE_SUPABASE_URL: " https://example.supabase.co ",
    };
    assert.deepEqual(getSupabaseRuntimeConfig(partial), {
      available: false,
      reason: "missing",
    });

    assert.deepEqual(getSupabaseRuntimeConfig({
      VITE_SUPABASE_URL: "not-a-url",
      VITE_SUPABASE_PUBLISHABLE_KEY: "public-key",
    }), {
      available: false,
      reason: "invalid",
    });
  });

  test("accepts a valid URL and either supported public key name", () => {
    assert.deepEqual(getSupabaseRuntimeConfig({
      VITE_SUPABASE_URL: " https://example.supabase.co/ ",
      VITE_SUPABASE_ANON_KEY: " anon-key ",
    }), {
      available: true,
      url: "https://example.supabase.co",
      key: "anon-key",
    });
  });
});
