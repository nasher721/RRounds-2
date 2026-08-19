import * as React from "react";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { AuthProvider } from "@/hooks/useAuth";
import { usePatientActivity } from "@/hooks/usePatientActivity";
import { productionReadinessFixtures } from "@/test/dashboardRegressionFixtures";

declare global {
  var __SUPABASE_SELECT_MOCK__: unknown;
}

afterEach(() => {
  cleanup();
  delete globalThis.__SUPABASE_SELECT_MOCK__;
  delete (globalThis as unknown as { __SUPABASE_AUTH_MOCK__?: unknown }).__SUPABASE_AUTH_MOCK__;
  delete (globalThis as unknown as { __SUPABASE_INSERT_MOCK__?: unknown }).__SUPABASE_INSERT_MOCK__;
});

function wrapper({ children }: { children: React.ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

const activityRow = {
  id: "activity-1",
  patient_id: "patient-1",
  user_id: "user-1",
  action: "updated",
  field_name: "assessment",
  summary: "Assessment updated",
  created_at: "2026-05-27T12:00:00.000Z",
};

describe("usePatientActivity", { concurrency: false }, () => {
  it("exposes a readable error and retry callback when activity fetch fails", async () => {
    globalThis.__SUPABASE_SELECT_MOCK__ = productionReadinessFixtures.activityFetchFailure;

    const { result } = renderHook(() => usePatientActivity("patient-1"), { wrapper });

    await result.current.fetchActivities();

    await waitFor(() => {
      assert.equal(result.current.loading, false);
      assert.match(result.current.error ?? "", /patient activity could not be loaded/i);
      assert.equal(typeof result.current.retry, "function");
    });
  });

  it("preserves the last successful activity rows when a refresh fails", async () => {
    let shouldFail = false;
    globalThis.__SUPABASE_SELECT_MOCK__ = () => {
      if (shouldFail) {
        return productionReadinessFixtures.activityFetchFailure();
      }
      return productionReadinessFixtures.activityFetchSuccess([activityRow]);
    };

    const { result } = renderHook(() => usePatientActivity("patient-1"), { wrapper });

    await result.current.fetchActivities();
    await waitFor(() => {
      assert.equal(result.current.activities[0]?.summary, "Assessment updated");
    });

    shouldFail = true;
    await result.current.fetchActivities();

    await waitFor(() => {
      assert.equal(result.current.loading, false);
      assert.equal(result.current.activities[0]?.summary, "Assessment updated");
    });
  });

  it("exposes lastFetchedAt after a successful fetch for Step 3 contract coverage", async () => {
    globalThis.__SUPABASE_SELECT_MOCK__ = () =>
      productionReadinessFixtures.activityFetchSuccess([activityRow]);

    const { result } = renderHook(() => usePatientActivity("patient-1"), { wrapper });
    await result.current.fetchActivities();

    await waitFor(() => {
      assert.equal(result.current.loading, false);
      assert.equal(result.current.activities.length, 1);
    });

    assert.equal(typeof result.current.lastFetchedAt, "number");
    assert.ok((result.current.lastFetchedAt as number) > 0);
  });

  it("keeps lastFetchedAt when a later refresh fails", async () => {
    let shouldFail = false;
    globalThis.__SUPABASE_SELECT_MOCK__ = () => {
      if (shouldFail) {
        return productionReadinessFixtures.activityFetchFailure();
      }
      return productionReadinessFixtures.activityFetchSuccess([activityRow]);
    };

    const { result } = renderHook(() => usePatientActivity("patient-1"), { wrapper });
    await result.current.fetchActivities();
    await waitFor(() => {
      assert.equal(typeof result.current.lastFetchedAt, "number");
    });
    const previousFetchedAt = result.current.lastFetchedAt;

    shouldFail = true;
    await result.current.fetchActivities();
    await waitFor(() => {
      assert.equal(result.current.loading, false);
      assert.match(result.current.error ?? "", /patient activity could not be loaded/i);
    });

    assert.equal(result.current.lastFetchedAt, previousFetchedAt);
  });

  it("reports a returned Supabase error when adding an activity", async () => {
    (globalThis as unknown as { __SUPABASE_AUTH_MOCK__?: unknown }).__SUPABASE_AUTH_MOCK__ = {
      getSession: async () => ({
        data: { session: { user: { id: "user-1" } } },
        error: null,
      }),
    };
    (globalThis as unknown as { __SUPABASE_INSERT_MOCK__?: unknown }).__SUPABASE_INSERT_MOCK__ = () => ({
      data: null,
      error: new Error("activity insert rejected"),
    });

    const { result } = renderHook(() => usePatientActivity("patient-1"), { wrapper });
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });

    let inserted: boolean | undefined;
    await act(async () => {
      inserted = await result.current.addActivity("updated", { fieldName: "assessment" });
    });

    assert.equal(inserted, false);
  });
});