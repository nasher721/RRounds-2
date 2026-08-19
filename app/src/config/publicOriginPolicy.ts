const PLACEHOLDER_HOSTS = new Set([
  'example.com',
  'example.net',
  'example.org',
  'yourhospital.org',
]);

function isPrivateOrPlaceholderHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  const usesPlaceholderDomain = Array.from(PLACEHOLDER_HOSTS).some(
    (domain) => host === domain || host.endsWith(`.${domain}`),
  );
  return host === 'localhost'
    || !host.includes('.')
    || host.includes(':')
    || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)
    || usesPlaceholderDomain
    || host.endsWith('.example')
    || host.endsWith('.invalid')
    || host.endsWith('.local')
    || host.endsWith('.test');
}

/**
 * Return the single canonical production origin used by HTML metadata, crawl
 * assets, runtime route metadata, deployment verification, and monitoring.
 */
export function parseProductionPublicOrigin(value: string | undefined): string {
  const configured = value?.trim();
  if (!configured) {
    throw new Error('Public app URL is required.');
  }

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error('Public app URL must be an absolute HTTPS origin.');
  }

  const hasOnlyOrigin = url.pathname === '/'
    && url.search === ''
    && url.hash === '';
  if (
    url.protocol !== 'https:'
    || url.username !== ''
    || url.password !== ''
    || url.port !== ''
    || !hasOnlyOrigin
    || isPrivateOrPlaceholderHost(url.hostname)
  ) {
    throw new Error(
      'Public app URL must be a public HTTPS origin without credentials, ports, paths, query strings, fragments, or placeholder hosts.',
    );
  }

  return url.origin;
}
