import * as React from "react";
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AuthProvider } from "@/hooks/useAuth";
import { ActivityFeed } from "@/components/patient/ActivityFeed";
import { productionReadinessFixtures } from "@/test/dashboardRegressionFixtures";

declare global {
  var __SUPABASE_SELECT_MOCK__: unknown;
}

afterEach(() => {
  cleanup();
  delete globalThis.__SUPABASE_SELECT_MOCK__;
});

function renderFeed() {
  return render(
    <AuthProvider>
      <ActivityFeed patientId="patient-1" patientName="Alex Morgan" />
    </AuthProvider>,
  );
}

describe("ActivityFeed", { concurrency: false }, () => {
  it("shows an error and retry control when patient activity fails to load", async () => {
    globalThis.__SUPABASE_SELECT_MOCK__ = productionReadinessFixtures.activityFetchFailure;

    renderFeed();

    fireEvent.click(screen.getByRole("button", { name: /Activity/i }));

    assert.ok(await screen.findByText(/patient activity could not be loaded/i));
    assert.ok(screen.getByRole("button", { name: /retry/i }));
    assert.ok(screen.getByRole("alert"));
  });

  it("renders the empty activity state when the activity query succeeds with no rows", async () => {
    globalThis.__SUPABASE_SELECT_MOCK__ = () => productionReadinessFixtures.activityFetchSuccess([]);

    renderFeed();

    fireEvent.click(screen.getByRole("button", { name: /Activity/i }));

    assert.ok(await screen.findByText("No activity yet"));
  });

  it("keeps previously loaded activity rows visible after a failed refresh and recovers on retry", async () => {
    let shouldFail = false;
    const activityRow = {
      id: "activity-1",
      patient_id: "patient-1",
      user_id: "user-1",
      action: "updated",
      field_name: "assessment",
      summary: "Assessment updated",
      created_at: "2026-05-27T12:00:00.000Z",
    };

    globalThis.__SUPABASE_SELECT_MOCK__ = () => {
      if (shouldFail) return productionReadinessFixtures.activityFetchFailure();
      return productionReadinessFixtures.activityFetchSuccess([activityRow]);
    };

    renderFeed();
    const activityToggle = screen.getByRole("button", { name: /Activity/i });
    fireEvent.click(activityToggle);
    assert.ok(await screen.findByText("Assessment updated"));

    // Collapse + reopen to trigger a refresh that fails while preserving rows.
    shouldFail = true;
    fireEvent.click(activityToggle);
    fireEvent.click(activityToggle);
    assert.ok(await screen.findByText(/patient activity could not be loaded/i));
    assert.ok(screen.getByText("Assessment updated"));
    assert.ok(screen.getByRole("button", { name: /retry/i }));

    shouldFail = false;
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    assert.ok(await screen.findByText("Assessment updated"));
    assert.equal(screen.queryByText(/patient activity could not be loaded/i), null);
  });

  it("offers show more when more than maxItems activities are returned", async () => {
    const rows = Array.from({ length: 7 }, (_, index) => ({
      id: `activity-${index + 1}`,
      patient_id: "patient-1",
      user_id: "user-1",
      action: "updated",
      field_name: "assessment",
      summary: `Assessment update ${index + 1}`,
      created_at: `2026-05-27T12:0${index}:00.000Z`,
    }));
    globalThis.__SUPABASE_SELECT_MOCK__ = () =>
      productionReadinessFixtures.activityFetchSuccess(rows);

    render(
      <AuthProvider>
        <ActivityFeed patientId="patient-1" patientName="Alex Morgan" maxItems={5} />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Activity/i }));
    assert.ok(await screen.findByText("Assessment update 1"));
    assert.ok(screen.getByRole("button", { name: /show more/i }));
  });
});
