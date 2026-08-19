import assert from "node:assert/strict";
import test, { afterEach } from "node:test";
import * as React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PatientRosterStatusBanner } from "./PatientRosterStatusBanner";

afterEach(cleanup);

test("patient roster status banner warns on stale local truth and retries verification", async () => {
  let retries = 0;
  render(
    <PatientRosterStatusBanner
      verification="stale"
      onRetry={async () => {
        retries += 1;
      }}
    />,
  );

  assert.match(
    screen.getByRole("status").textContent ?? "",
    /patient-list recovery could not be verified/i,
  );
  fireEvent.click(screen.getByRole("button", { name: /retry patient list/i }));
  await waitFor(() => assert.equal(retries, 1));
});

test("patient roster status banner stays quiet for verified and expected offline truth", () => {
  const { rerender } = render(
    <PatientRosterStatusBanner verification="verified" onRetry={async () => undefined} />,
  );
  assert.equal(screen.queryByRole("status"), null);

  rerender(<PatientRosterStatusBanner verification="local" onRetry={async () => undefined} />);
  assert.equal(screen.queryByRole("status"), null);
});
