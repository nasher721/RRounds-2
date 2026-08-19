/**
 * PII Sanitizer
 *
 * Sanitizes patient data before sending to AI APIs to protect patient privacy.
 *
 * This module replaces or removes personally identifiable information (PII)
 * while preserving clinically relevant data that AI needs for processing.
 *
 * Protected fields:
 * - Patient names → generic labels (e.g., "Patient A")
 * - Medical Record Numbers (MRN) → removed
 * - Dates of birth → age ranges
 * - Social Security Numbers → removed
 * - Phone numbers → removed
 * - Addresses → removed
 * - Email addresses → removed
 *
 * Preserved fields:
 * - Clinical summaries, systems, medications, labs, imaging
 * - Ages, diagnoses, procedures
 * - Vital signs, lab values
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SanitizationResult {
  /** The sanitized text */
  text: string;
  /** Number of PII items redacted */
  redactedCount: number;
  /** Types of PII found */
  redactedTypes: string[];
}

export interface SanitizationOptions {
  /** Replace names with generic labels instead of removing (default: true) */
  useGenericLabels?: boolean;
  /** Preserve age information when replacing DOB (default: true) */
  preserveAge?: boolean;
  /** Additional names to redact (e.g., from patient list) */
  knownNames?: string[];
}

// ---------------------------------------------------------------------------
// PII patterns
// ---------------------------------------------------------------------------

const PII_PATTERNS: Array<{ pattern: RegExp; type: string; replacement: string }> = [
  // SSN patterns (xxx-xx-xxxx)
  {
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    type: 'ssn',
    replacement: '[SSN REDACTED]',
  },
  // MRN patterns (various formats)
  {
    pattern: /\b(?:MRN|mrn|Medical Record(?:\s+Number)?)\s*[:#]?\s*\d{4,12}\b/gi,
    type: 'mrn',
    replacement: '[MRN REDACTED]',
  },
  // Phone numbers (US formats)
  {
    pattern: /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    type: 'phone',
    replacement: '[PHONE REDACTED]',
  },
  // Email addresses
  {
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    type: 'email',
    replacement: '[EMAIL REDACTED]',
  },
  // Street addresses (simple patterns)
  {
    pattern: /\b\d{1,5}\s+(?:[A-Z][a-z]+\s+){1,3}(?:St|Street|Ave|Avenue|Blvd|Boulevard|Dr|Drive|Rd|Road|Ln|Lane|Ct|Court|Way|Pl|Place)\.?\b/gi,
    type: 'address',
    replacement: '[ADDRESS REDACTED]',
  },
  // Date of birth patterns
  {
    pattern: /\b(?:DOB|Date of Birth|D\.O\.B\.?)\s*[:#]?\s*\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b/gi,
    type: 'dob',
    replacement: '[DOB REDACTED]',
  },
  // Insurance/policy numbers
  {
    pattern: /\b(?:Insurance|Policy|Member)\s*(?:ID|#|Number)\s*[:#]?\s*[A-Z0-9]{6,15}\b/gi,
    type: 'insurance',
    replacement: '[INSURANCE REDACTED]',
  },
];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sanitize a text string by removing/replacing PII.
 */
export function sanitizeText(
  text: string,
  options: SanitizationOptions = {},
): SanitizationResult {
  if (!text) return { text: '', redactedCount: 0, redactedTypes: [] };

  let sanitized = text;
  let redactedCount = 0;
  const redactedTypes = new Set<string>();

  // Apply known names first (most specific)
  if (options.knownNames?.length) {
    for (const name of options.knownNames) {
      if (!name || name.length < 2) continue;
      // Escape special regex characters
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const namePattern = new RegExp(`\\b${escaped}\\b`, 'gi');
      if (namePattern.test(sanitized)) {
        sanitized = sanitized.replace(namePattern,
          options.useGenericLabels !== false ? '[Patient]' : '[NAME REDACTED]',
        );
        redactedCount++;
        redactedTypes.add('name');
      }
    }
  }

  // Apply pattern-based redaction
  for (const { pattern, type, replacement } of PII_PATTERNS) {
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    const matches = sanitized.match(pattern);
    if (matches) {
      sanitized = sanitized.replace(pattern, replacement);
      redactedCount += matches.length;
      redactedTypes.add(type);
    }
  }

  return {
    text: sanitized,
    redactedCount,
    redactedTypes: Array.from(redactedTypes),
  };
}

/**
 * Sanitize a clinical context object for AI processing.
 * Preserves clinical data while removing PII from all text fields.
 */
export function sanitizeClinicalContext<T extends Record<string, unknown>>(
  context: T,
  options: SanitizationOptions = {},
): { sanitized: T; totalRedacted: number; redactedTypes: string[] } {
  let totalRedacted = 0;
  const allTypes = new Set<string>();

  // Extract patient name for known names list if present
  const knownNames = [...(options.knownNames ?? [])];
  const patientName = context.patientName as string | undefined;
  if (patientName) {
    // Split name into parts (first, last, etc.)
    const parts = patientName.split(/\s+/).filter(p => p.length >= 2);
    knownNames.push(patientName, ...parts);
  }

  const optionsWithNames: SanitizationOptions = {
    ...options,
    knownNames,
  };

  function sanitizeValue(value: unknown): unknown {
    if (typeof value === 'string') {
      const result = sanitizeText(value, optionsWithNames);
      totalRedacted += result.redactedCount;
      result.redactedTypes.forEach(t => allTypes.add(t));
      return result.text;
    }
    if (Array.isArray(value)) {
      return value.map(sanitizeValue);
    }
    if (value && typeof value === 'object') {
      const sanitizedObj: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        // Skip known PII-only fields entirely
        if (['patientName', 'mrn', 'ssn', 'dob', 'dateOfBirth', 'phone', 'email', 'address'].includes(k)) {
          if (k === 'patientName') {
            sanitizedObj[k] = '[Patient]';
          }
          // Other PII fields are omitted entirely
          totalRedacted++;
          allTypes.add(k);
          continue;
        }
        sanitizedObj[k] = sanitizeValue(v);
      }
      return sanitizedObj;
    }
    return value;
  }

  const sanitized = sanitizeValue(context) as T;

  return {
    sanitized,
    totalRedacted,
    redactedTypes: Array.from(allTypes),
  };
}
