import * as React from "react";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { DictationButton } from "@/components/DictationButton";

declare global {
  var __SUPABASE_AUTH_MOCK__: unknown;
}

afterEach(() => {
  cleanup();
  delete globalThis.__SUPABASE_AUTH_MOCK__;
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: undefined,
  });
});

function setupAuthMock() {
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: { user: { id: "test-user-id" } } }, error: null }),
    onAuthStateChange: () => ({ unsubscribe: () => {} }),
  };
}

function renderButton() {
  setupAuthMock();
  return render(
    <AuthProvider>
      <AuthenticatedDictationHarness />
    </AuthProvider>,
  );
}

function AuthenticatedDictationHarness() {
  const { loading } = useAuth();
  if (loading) return null;
  return (
    <SettingsProvider>
      <DictationButton onTranscript={() => {}} />
    </SettingsProvider>
  );
}

describe("DictationButton", { concurrency: false }, () => {
  it("shows visible recovery guidance when microphone permission is denied", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException("Permission denied by test browser", "NotAllowedError");
        },
      },
    });

    renderButton();
    fireEvent.click(await screen.findByRole("button", { name: "Start voice dictation" }));

    assert.ok(await screen.findByText(/allow microphone access/i));
    assert.ok(screen.getByRole("button", { name: "Start voice dictation" }));
    assert.equal(screen.getByRole("button", { name: "Start voice dictation" }).getAttribute("aria-busy"), null);
  });
});
