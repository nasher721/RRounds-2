import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { handleError } from "@/hooks/useErrorHandler";
import { useToast } from "@/hooks/use-toast";

const SECRET = "provider rejected patient Jane Doe with sk-secret-123";

afterEach(() => {
  cleanup();
});

describe("useErrorHandler privacy", { concurrency: false }, () => {
  it("uses safe toast copy and does not log raw arbitrary errors", async () => {
    const calls: unknown[][] = [];
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => calls.push(args);

    try {
      const { result } = renderHook(() => useToast());

      act(() => {
        handleError(new Error(SECRET));
      });

      await waitFor(() => assert.equal(result.current.toasts.length > 0, true));
      const latestToast = result.current.toasts[0];
      assert.equal(latestToast.title, "Something went wrong");
      assert.equal(latestToast.description, "Something went wrong. Please try again.");

      const consoleText = calls.flat().map(String).join("\n");
      assert.doesNotMatch(consoleText, /Jane Doe|sk-secret-123/);
    } finally {
      console.error = originalConsoleError;
    }
  });
});
