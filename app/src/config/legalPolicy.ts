const RESERVED_PRIVACY_HOSTS = [
  'example.com',
  'example.org',
  'example.net',
  'yourhospital.org',
  'localhost',
] as const;

const isReservedHost = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase();
  return RESERVED_PRIVACY_HOSTS.some(
    (reserved) => normalized === reserved || normalized.endsWith(`.${reserved}`),
  ) || normalized.endsWith('.invalid')
    || normalized.endsWith('.local')
    || normalized.endsWith('.test')
    || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(normalized)
    || normalized.startsWith('[');
};

/**
 * Normalize an operator-approved privacy notice URL. It is optional for local
 * development; production builds separately require a non-empty result.
 */
export function parsePrivacyNoticeUrl(rawValue: string | undefined): string {
  const value = rawValue?.trim();
  if (!value) return '';

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Privacy notice URL must be an absolute HTTPS URL.');
  }

  if (
    url.protocol !== 'https:'
    || isReservedHost(url.hostname)
    || url.username.length > 0
    || url.password.length > 0
    || url.hash.length > 0
  ) {
    throw new Error(
      'Privacy notice URL must use public HTTPS without credentials, fragments, or placeholder hosts.',
    );
  }

  return url.href;
}
