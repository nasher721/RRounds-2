export type AuthProviderLabel = 'Google' | 'Apple';

export type AuthFailureCategory =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'rate_limited'
  | 'unavailable'
  | 'provider_error';

interface SafeAuthErrorOptions {
  providerLabel?: AuthProviderLabel;
}

interface AuthErrorShape {
  code?: unknown;
  message?: unknown;
}

const PASSWORD_ERROR_BY_CODE: Readonly<Record<string, string>> = {
  invalid_credentials: 'Invalid email or password. Please try again.',
  email_not_confirmed: 'Your email address is not confirmed. Contact your administrator.',
  over_email_send_rate_limit: 'Too many sign-in attempts. Wait a few minutes, then try again.',
  over_request_rate_limit: 'Too many sign-in attempts. Wait a few minutes, then try again.',
};

const PASSWORD_ERROR_BY_MESSAGE: Readonly<Record<string, string>> = {
  'authentication is not configured.': 'Sign-in is not available for this deployment. Contact your administrator.',
  'email not confirmed': 'Your email address is not confirmed. Contact your administrator.',
  'invalid login credentials': 'Invalid email or password. Please try again.',
  'too many requests': 'Too many sign-in attempts. Wait a few minutes, then try again.',
};

const AUTH_CATEGORY_BY_CODE: Readonly<Record<string, AuthFailureCategory>> = {
  invalid_credentials: 'invalid_credentials',
  email_not_confirmed: 'email_not_confirmed',
  over_email_send_rate_limit: 'rate_limited',
  over_request_rate_limit: 'rate_limited',
};

const AUTH_CATEGORY_BY_MESSAGE: Readonly<Record<string, AuthFailureCategory>> = {
  'authentication is not configured.': 'unavailable',
  'email not confirmed': 'email_not_confirmed',
  'invalid login credentials': 'invalid_credentials',
  'too many requests': 'rate_limited',
};

function readAuthError(error: unknown): { code: string; message: string } {
  if (!error || (typeof error !== 'object' && typeof error !== 'function')) {
    return { code: '', message: '' };
  }

  const candidate = error as AuthErrorShape;
  return {
    code: typeof candidate.code === 'string' ? candidate.code.trim().toLowerCase() : '',
    message: typeof candidate.message === 'string' ? candidate.message.trim().toLowerCase() : '',
  };
}

/**
 * Reduce provider failures to a fixed category before they cross an
 * observability or user-interface boundary. Unknown messages may contain
 * tenant or account details and are deliberately collapsed.
 */
export function classifyAuthError(error: unknown): AuthFailureCategory {
  const { code, message } = readAuthError(error);
  return AUTH_CATEGORY_BY_CODE[code]
    ?? AUTH_CATEGORY_BY_MESSAGE[message]
    ?? 'provider_error';
}

/**
 * Convert provider errors to an explicit allowlist of safe copy. Unknown
 * upstream messages can contain account identifiers, tenant details, or
 * diagnostics and must never be rendered to the user.
 */
export function getSafeAuthErrorMessage(
  error: unknown,
  options: SafeAuthErrorOptions = {},
): string {
  const { code, message } = readAuthError(error);

  if (!options.providerLabel) {
    const approvedMessage = PASSWORD_ERROR_BY_CODE[code] ?? PASSWORD_ERROR_BY_MESSAGE[message];
    if (approvedMessage) return approvedMessage;
  }

  if (options.providerLabel) {
    return `Could not sign in with ${options.providerLabel}. Please try again or contact your administrator.`;
  }

  return 'Could not sign in. Please try again or contact your administrator.';
}
