import { describe, expect, test } from "node:test";
import {
  getSupabaseRuntimeConfig,
  type SupabaseRuntimeEnv,
} from "./supabaseRuntime.ts";

describe("Supabase runtime configuration", () => {
  test("returns unavailable when both required public values are missing", () => {
    expect(getSupabaseRuntimeConfig({})).toEqual({
      available: false,
      reason: "missing",
    });
  });

  test("trims values and rejects partial or malformed configuration", () => {
    const partial: SupabaseRuntimeEnv = {
      VITE_SUPABASE_URL: " https://example.supabase.co ",
    };
    expect(getSupabaseRuntimeConfig(partial)).toEqual({
      available: false,
      reason: "missing",
    });

    expect(getSupabaseRuntimeConfig({
      VITE_SUPABASE_URL: "not-a-url",
      VITE_SUPABASE_PUBLISHABLE_KEY: "public-key",
    })).toEqual({
      available: false,
      reason: "invalid",
    });
  });

  test("accepts a valid URL and either supported public key name", () => {
    expect(getSupabaseRuntimeConfig({
      VITE_SUPABASE_URL: " https://example.supabase.co/ ",
      VITE_SUPABASE_ANON_KEY: " anon-key ",
    })).toEqual({
      available: true,
      url: "https://example.supabase.co",
      key: "anon-key",
    });
  });
});

