import * as React from "react";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ServiceWorkerUpdatePrompt } from "@/components/ServiceWorkerUpdatePrompt";
import {
  clearServiceWorkerUpdateReady,
  markServiceWorkerUpdateReady,
} from "@/lib/serviceWorkerUpdate";

afterEach(() => {
  cleanup();
  clearServiceWorkerUpdateReady();
});

describe("ServiceWorkerUpdatePrompt", () => {
  it("activates the waiting worker before reloading deliberately", async () => {
    let reloads = 0;
    let activations = 0;
    render(
      <ServiceWorkerUpdatePrompt
        onActivate={async () => { activations += 1; return true; }}
        onReload={() => { reloads += 1; }}
      />,
    );

    assert.equal(screen.queryByRole("status"), null);
    act(() => markServiceWorkerUpdateReady());

    assert.ok(screen.getByRole("status"));
    fireEvent.click(screen.getByRole("button", { name: "Refresh now" }));
    await act(async () => undefined);
    assert.equal(activations, 1);
    assert.equal(reloads, 1);
    assert.equal(screen.queryByRole("status"), null);
  });

  it("keeps the update prompt visible when activation cannot complete", async () => {
    let reloads = 0;
    markServiceWorkerUpdateReady();
    render(
      <ServiceWorkerUpdatePrompt
        onActivate={async () => false}
        onReload={() => { reloads += 1; }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Refresh now" }));
    await act(async () => undefined);

    assert.equal(reloads, 0);
    assert.ok(screen.getByRole("status"));
    assert.match(screen.getByRole("status").textContent ?? "", /couldn't activate/i);
  });

  it("allows a clinician to defer the refresh without reloading mid-edit", () => {
    let reloads = 0;
    markServiceWorkerUpdateReady();
    render(<ServiceWorkerUpdatePrompt onReload={() => { reloads += 1; }} />);

    fireEvent.click(screen.getByRole("button", { name: "Later" }));
    assert.equal(reloads, 0);
    assert.equal(screen.queryByRole("status"), null);
  });
});
