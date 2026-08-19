import * as React from "react";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { SettingsProvider } from "@/contexts/SettingsContext";
import { assertDictationRecordingSize, useDictation } from "@/hooks/useDictation";
import { getUserFacingErrorMessage } from "@/lib/userFacingErrors";

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

function AuthenticatedSettings({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading || !user) return null;
  return <SettingsProvider>{children}</SettingsProvider>;
}

function wrapper({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthenticatedSettings>{children}</AuthenticatedSettings>
    </AuthProvider>
  );
}

describe("useDictation", { concurrency: false }, () => {
  it("preserves actionable guidance for recordings too short to upload", () => {
    assert.throws(
      () => assertDictationRecordingSize(999),
      (error) => {
        assert.equal(
          getUserFacingErrorMessage(error, "fallback"),
          "Recording too short. Please try again.",
        );
        return true;
      },
    );
    assert.doesNotThrow(() => assertDictationRecordingSize(1000));
  });

  it("returns to idle and exposes recovery guidance when microphone permission is denied", async () => {
    setupAuthMock();
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          throw new DOMException("Permission denied by test browser", "NotAllowedError");
        },
      },
    });

    const { result } = renderHook(() => useDictation(), { wrapper });

    await waitFor(() => assert.ok(result.current));

    await act(async () => {
      await result.current.startRecording();
    });

    await waitFor(() => {
      assert.equal(result.current.isRecording, false);
      assert.equal(result.current.isProcessing, false);
      assert.match(result.current.error ?? "", /microphone permission/i);
    });
  });

  it("surfaces a NotAllowedError from mocked getUserMedia without leaving recording stuck", async () => {
    setupAuthMock();
    let getUserMediaCalls = 0;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: async () => {
          getUserMediaCalls += 1;
          throw new DOMException("Permission denied by test browser", "NotAllowedError");
        },
      },
    });

    const { result } = renderHook(() => useDictation(), { wrapper });
    await waitFor(() => assert.ok(result.current));

    await act(async () => {
      await result.current.toggleRecording();
    });

    await waitFor(() => {
      assert.equal(getUserMediaCalls, 1);
      assert.equal(result.current.isRecording, false);
      assert.match(result.current.error ?? "", /Allow microphone access/i);
    });
  });
});
