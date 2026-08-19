import test from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { fireEvent } from "@testing-library/react";
import { AuthProvider } from "@/hooks/useAuth";
import Auth from "@/pages/Auth";

// DOM and requestAnimationFrame from scripts/test-setup.mjs when run via npm test
if (typeof globalThis !== "undefined") {
  Object.assign(globalThis, { React })
}

test("Auth page renders with form and sign-in button", async () => {
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ unsubscribe: () => {} }),
  };
  const div = document.createElement("div");
  document.body.appendChild(div);
  const root = createRoot(div);
  root.render(
    <MemoryRouter>
      <AuthProvider>
        <Auth />
      </AuthProvider>
    </MemoryRouter>
  );
  await new Promise((r) => setTimeout(r, 80));
  const form = div.querySelector("form");
  const submitBtn = div.querySelector('button[type="submit"]');
  const emailInput = div.querySelector('input[type="email"], input[id="email"]');
  const passwordInput = div.querySelector('input[type="password"], input[id="password"]');
  assert.ok(form, "Auth page should render a form");
  assert.ok(submitBtn, "Auth page should render a submit button");
  const submitText = submitBtn?.textContent?.toLowerCase() ?? "";
  assert.ok(
    submitText.includes("sign in"),
    "Submit button should show Sign in",
  );
  assert.ok(emailInput, "Auth page should render an email input");
  assert.ok(passwordInput, "Auth page should render a password input");
  root.unmount();
  document.body.removeChild(div);
});

test("Auth page does not expose self-service sign up", async () => {
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ unsubscribe: () => {} }),
  };
  const div = document.createElement("div");
  document.body.appendChild(div);
  const root = createRoot(div);
  root.render(
    <MemoryRouter>
      <AuthProvider>
        <Auth />
      </AuthProvider>
    </MemoryRouter>
  );
  await new Promise((r) => setTimeout(r, 80));
  const signUpControl = Array.from(div.querySelectorAll("button")).find((button) =>
    button.textContent?.toLowerCase().includes("sign up")
  );
  assert.equal(signUpControl, undefined, "Auth page must not expose self-service sign up");
  assert.match(div.textContent ?? "", /provisioned by your administrator/i);
  root.unmount();
  document.body.removeChild(div);
});

test("Auth page does not advertise unapproved OAuth providers", async () => {
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ unsubscribe: () => {} }),
  };
  const div = document.createElement("div");
  document.body.appendChild(div);
  const root = createRoot(div);
  root.render(
    <MemoryRouter>
      <AuthProvider>
        <Auth />
      </AuthProvider>
    </MemoryRouter>
  );
  await new Promise((resolve) => setTimeout(resolve, 80));

  assert.doesNotMatch(div.textContent ?? "", /Continue with Google|Continue with Apple/);
  assert.doesNotMatch(div.textContent ?? "", /^or$/im);

  root.unmount();
  document.body.removeChild(div);
});

test("password sign-in records a classified failure without credentials", async () => {
  const submitted: Array<{ email: string; password: string }> = [];
  globalThis.__SUPABASE_AUTH_MOCK__ = {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ unsubscribe: () => {} }),
    signInWithPassword: async (credentials: { email: string; password: string }) => {
      submitted.push(credentials);
      return {
        error: Object.assign(new Error("Invalid login credentials"), {
          code: "invalid_credentials",
        }),
      };
    },
  };
  const writes: string[] = [];
  const originalLog = console.log;
  const div = document.createElement("div");
  document.body.appendChild(div);
  const root = createRoot(div);

  try {
    root.render(
      <MemoryRouter>
        <AuthProvider>
          <Auth />
        </AuthProvider>
      </MemoryRouter>
    );
    await new Promise((resolve) => setTimeout(resolve, 80));

    const email = div.querySelector<HTMLInputElement>('#email');
    const password = div.querySelector<HTMLInputElement>('#password');
    const form = div.querySelector<HTMLFormElement>('form');
    assert.ok(email && password && form);

    console.log = (...args: unknown[]) => writes.push(args.join(" "));
    fireEvent.change(email, { target: { value: "clinician@hospital.example" } });
    fireEvent.change(password, { target: { value: "do-not-log-this-secret" } });
    fireEvent.submit(form);
    await new Promise((resolve) => setTimeout(resolve, 50));
  } finally {
    console.log = originalLog;
    root.unmount();
    document.body.removeChild(div);
  }

  assert.deepEqual(submitted, [{
    email: "clinician@hospital.example",
    password: "do-not-log-this-secret",
  }]);
  const authWrites = writes.filter((write) => write.includes('auth.sign_in.'));
  assert.equal(authWrites.length, 2);
  assert.match(authWrites.join("\n"), /invalid_credentials/);
  assert.doesNotMatch(
    authWrites.join("\n"),
    /clinician@hospital\.example|do-not-log-this-secret/i,
  );
});
