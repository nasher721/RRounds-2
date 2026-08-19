export type LoginFieldErrors = {
  email?: string;
  password?: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateLoginField(
  field: keyof LoginFieldErrors,
  value: string,
): string | undefined {
  if (field === "email") {
    return EMAIL_PATTERN.test(value.trim())
      ? undefined
      : "Please enter a valid email address";
  }

  return value.length >= 6
    ? undefined
    : "Password must be at least 6 characters";
}

export function validateLoginForm(email: string, password: string): LoginFieldErrors {
  const errors: LoginFieldErrors = {};
  const emailError = validateLoginField("email", email);
  const passwordError = validateLoginField("password", password);

  if (emailError) errors.email = emailError;
  if (passwordError) errors.password = passwordError;

  return errors;
}
