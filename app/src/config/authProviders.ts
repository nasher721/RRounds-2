import { parseApprovedOAuthProviders } from '@/config/authProviderPolicy';

/**
 * OAuth buttons are a deployment-controlled capability, not auto-discovery.
 * Password sign-in remains available for provisioned accounts.
 */
export const APPROVED_OAUTH_PROVIDERS = parseApprovedOAuthProviders(
  import.meta.env?.VITE_APPROVED_OAUTH_PROVIDERS,
);
