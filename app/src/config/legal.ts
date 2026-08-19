import { parsePrivacyNoticeUrl } from '@/config/legalPolicy';

/** Operator-approved privacy notice used by every production-facing link. */
export const PRIVACY_NOTICE_URL = parsePrivacyNoticeUrl(
  import.meta.env?.VITE_PRIVACY_NOTICE_URL,
);

export const PRIVACY_NOTICE_IS_CONFIGURED = PRIVACY_NOTICE_URL.length > 0;
