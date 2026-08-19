import assert from "node:assert/strict";
import test from "node:test";
import { validateLoginField, validateLoginForm } from "./loginValidation";

test("login validation accepts a provisioned email and password", () => {
  assert.deepEqual(validateLoginForm(" clinician@hospital.org ", "secret1"), {});
});

test("login validation reports both invalid fields without echoing their values", () => {
  assert.deepEqual(validateLoginForm("not-an-email", "short"), {
    email: "Please enter a valid email address",
    password: "Password must be at least 6 characters",
  });
});

test("field validation clears only when the edited field is valid", () => {
  assert.equal(validateLoginField("email", "doctor@hospital.org"), undefined);
  assert.equal(validateLoginField("email", "doctor@hospital"), "Please enter a valid email address");
  assert.equal(validateLoginField("password", "123456"), undefined);
});
