import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import * as React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AIErrorBoundary } from "@/components/AIErrorBoundary";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GlobalErrorBoundary } from "@/components/GlobalErrorBoundary";
import {
  LazyPanelErrorBoundary,
  LazyPanelErrorFallback,
} from "@/components/LazyPanelErrorBoundary";

const SECRET = "patient Jane Doe provider-key sk-secret-123";

function Crash(): React.ReactNode {
  throw new Error(SECRET);
}

function stringifyConsoleCalls(calls: unknown[][]): string {
  return calls
    .flat()
    .map((value) => {
      if (value instanceof Error) return `${value.name}: ${value.message}\n${value.stack ?? ""}`;
      if (typeof value === "string") return value;
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    })
    .join("\n");
}

afterEach(() => {
  cleanup();
});

describe("error-boundary privacy", { concurrency: false }, () => {
  it("never writes raw runtime errors or component stacks to console", () => {
    const error = new Error(SECRET);
    const errorInfo = { componentStack: `\n    at PatientPanel (${SECRET})` };
    const calls: unknown[][] = [];
    const originalConsoleError = console.error;
    console.error = (...args: unknown[]) => calls.push(args);

    try {
      new ErrorBoundary({ children: null }).componentDidCatch(error, errorInfo);
      new GlobalErrorBoundary({ children: null }).componentDidCatch(error, errorInfo);
      new AIErrorBoundary({ children: null }).componentDidCatch(error, errorInfo);
      new LazyPanelErrorBoundary({ children: null, title: "Panel unavailable" })
        .componentDidCatch(error, errorInfo);
    } finally {
      console.error = originalConsoleError;
    }

    assert.doesNotMatch(stringifyConsoleCalls(calls), /Jane Doe|sk-secret-123|PatientPanel/);
  });

  it("shows safe fallback copy and never copies raw crash details", () => {
    const clipboardWrites: string[] = [];
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          clipboardWrites.push(text);
        },
      },
    });

    const originalConsoleError = console.error;
    console.error = () => {};

    try {
      const { unmount } = render(
        <ErrorBoundary>
          <Crash />
        </ErrorBoundary>,
      );
      assert.match(document.body.textContent ?? "", /Something went wrong/);
      assert.doesNotMatch(document.body.textContent ?? "", /Jane Doe|sk-secret-123/);
      unmount();

      const onErrorCalls: Error[] = [];
      render(
        <AIErrorBoundary onError={(error) => onErrorCalls.push(error)}>
          <Crash />
        </AIErrorBoundary>,
      );
      const aiDetailsButton = screen.queryByRole("button", { name: /show details/i });
      if (aiDetailsButton) fireEvent.click(aiDetailsButton);
      const aiCopyButton = screen.queryByRole("button", { name: /copy error/i });
      if (aiCopyButton) fireEvent.click(aiCopyButton);
      assert.equal(onErrorCalls[0]?.message, SECRET);
      assert.doesNotMatch(document.body.textContent ?? "", /Jane Doe|sk-secret-123/);
      cleanup();

      render(
        <GlobalErrorBoundary>
          <Crash />
        </GlobalErrorBoundary>,
      );
      const globalDetailsButton = screen.queryByRole("button", { name: /show error details/i });
      if (globalDetailsButton) fireEvent.click(globalDetailsButton);
      const globalCopyButton = screen.queryByRole("button", { name: /^copy error$/i });
      if (globalCopyButton) fireEvent.click(globalCopyButton);
      assert.doesNotMatch(document.body.textContent ?? "", /Jane Doe|sk-secret-123/);
      assert.doesNotMatch(document.body.textContent ?? "", /Your data has been saved/i);
      cleanup();

      render(
        <LazyPanelErrorFallback
          title="Panel unavailable"
          error={new Error(SECRET)}
          onRetry={() => {}}
        />,
      );
      assert.match(document.body.textContent ?? "", /Panel unavailable/);
      assert.doesNotMatch(document.body.textContent ?? "", /Jane Doe|sk-secret-123/);

      assert.doesNotMatch(clipboardWrites.join("\n"), /Jane Doe|sk-secret-123/);
    } finally {
      console.error = originalConsoleError;
    }
  });
});
