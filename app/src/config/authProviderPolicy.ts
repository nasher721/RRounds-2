export const SUPPORTED_OAUTH_PROVIDERS = ['google', 'apple'] as const;

export type ApprovedOAuthProvider = (typeof SUPPORTED_OAUTH_PROVIDERS)[number];

const SUPPORTED_PROVIDER_SET = new Set<string>(SUPPORTED_OAUTH_PROVIDERS);

/**
 * Parse the deployment's explicit OAuth allowlist. An absent value means no
 * OAuth controls; unknown, empty, or non-canonical tokens fail closed.
 */
export function parseApprovedOAuthProviders(
  rawValue: string | undefined,
): ApprovedOAuthProvider[] {
  if (!rawValue?.trim()) return [];

  const providers = rawValue.split(',').map((provider) => provider.trim());
  const invalidProvider = providers.find(
    (provider) => !SUPPORTED_PROVIDER_SET.has(provider),
  );
  if (invalidProvider !== undefined) {
    throw new Error(
      `Unsupported OAuth provider "${invalidProvider || '(empty)'}". Use google and/or apple.`,
    );
  }

  return [...new Set(providers)] as ApprovedOAuthProvider[];
}
