import DOMPurify from 'dompurify';

const SAFE_STYLE_PROPERTIES = new Set([
  'background-color',
  'border',
  'border-color',
  'border-radius',
  'border-style',
  'border-width',
  'color',
  'font-family',
  'font-size',
  'font-style',
  'font-weight',
  'height',
  'line-height',
  'margin',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'margin-top',
  'max-height',
  'max-width',
  'padding',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'text-align',
  'text-decoration',
  'vertical-align',
  'white-space',
  'width',
]);

const UNSAFE_STYLE_VALUE = /(?:url\s*\(|expression\s*\(|@import|javascript:|data:|behavior\s*:|-moz-binding)/i;
const SAFE_PATIENT_IMAGE_DATA_URL =
  /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/=\s]+$/i;
const SAFE_DATA_ATTRIBUTES = new Set([
  'data-date',
  'data-marked',
  'data-patient-image-key',
  'data-styles',
]);

interface SanitizeOptions {
  preservePatientImageSources: boolean;
}

const hasSafeNetworkImageProtocol = (candidate: string): boolean => {
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

/**
 * Sanitize HTML content to prevent XSS attacks.
 * Allows a safe subset of HTML tags and attributes suitable for clinical documentation.
 */
const sanitizeHtmlWithOptions = (
  html: string,
  options: SanitizeOptions,
): string => {
  if (!html) return '';
  
  const sanitized = DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'b', 'i', 'u', 'strong', 'em', 'br', 'p', 'div', 'span',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'table', 'thead', 'tbody', 'tr', 'td', 'th',
      'img', 'a', 'sub', 'sup', 'mark', 'del', 'ins', 'hr'
    ],
    ALLOWED_ATTR: [
      'style', 'href', 'src', 'alt', 'title', 'target', 'rel',
      'colspan', 'rowspan', 'width', 'height',
      'data-marked', 'data-date', 'data-styles', 'data-patient-image-key'
    ],
    ALLOW_DATA_ATTR: true,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    // Strip dangerous URLs
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    KEEP_CONTENT: true,
  });

  const template = document.createElement('template');
  template.innerHTML = sanitized;

  template.content.querySelectorAll<HTMLElement>('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const attributeName = attribute.name.toLowerCase();
      if (attributeName.startsWith('data-') && !SAFE_DATA_ATTRIBUTES.has(attributeName)) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  template.content.querySelectorAll<HTMLElement>('[style]').forEach((element) => {
    const safeDeclarations = Array.from(element.style)
      .filter((property) => SAFE_STYLE_PROPERTIES.has(property))
      .map((property) => [property, element.style.getPropertyValue(property)] as const)
      .filter(([, styleValue]) => !UNSAFE_STYLE_VALUE.test(styleValue));

    element.removeAttribute('style');
    safeDeclarations.forEach(([property, styleValue]) => {
      element.style.setProperty(property, styleValue);
    });
    if (!element.getAttribute('style')) {
      element.removeAttribute('style');
    }
  });

  template.content.querySelectorAll<HTMLAnchorElement>('a[target]').forEach((anchor) => {
    if (anchor.target.toLowerCase() !== '_blank') return;
    const relValues = new Set((anchor.getAttribute('rel') || '').split(/\s+/).filter(Boolean));
    relValues.add('noopener');
    relValues.add('noreferrer');
    anchor.setAttribute('rel', Array.from(relValues).join(' '));
  });

  template.content.querySelectorAll<HTMLImageElement>('img').forEach((image) => {
    const objectKey = image.getAttribute('data-patient-image-key');
    const source = image.getAttribute('src') || '';

    if (!options.preservePatientImageSources) {
      if (!objectKey) {
        image.remove();
        return;
      }
      image.removeAttribute('src');
      return;
    }

    if (
      source &&
      !SAFE_PATIENT_IMAGE_DATA_URL.test(source) &&
      !hasSafeNetworkImageProtocol(source)
    ) {
      image.removeAttribute('src');
    }
  });

  return template.innerHTML;
};

/**
 * Sanitize general clinical HTML. Images without a canonical patient-image
 * key are removed, and canonical image placeholders never retain a URL.
 */
export const sanitizeHtml = (html: string): string =>
  sanitizeHtmlWithOptions(html, { preservePatientImageSources: false });

/**
 * Patient-image migration/rendering uses this narrower escape hatch so legacy
 * raster data and validated signed URLs can be inspected in detached DOM.
 * Callers must canonicalize or owner-validate those sources before rendering.
 */
export const sanitizePatientImageHtml = (html: string): string =>
  sanitizeHtmlWithOptions(html, { preservePatientImageSources: true });

/**
 * Convert clipboard content into HTML that is safe to insert into a
 * contenteditable surface. Rich clipboard markup keeps the editor's supported
 * formatting; plain text is escaped before line breaks are restored.
 */
export const sanitizePastedHtml = (html: string, plainText: string): string => {
  if (html) return sanitizeHtml(html);
  if (!plainText) return '';

  const container = document.createElement('div');
  container.textContent = plainText;
  return container.innerHTML.replace(/\r?\n/g, '<br>');
};

const SAFE_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:', 'tel:']);

/**
 * Build link markup without interpolating untrusted prompt input into HTML.
 * Only explicit, user-facing link schemes are accepted.
 */
export const createSafeLinkHtml = (rawUrl: string, label: string): string | null => {
  const candidate = rawUrl.trim();
  if (!candidate) return null;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }

  if (!SAFE_LINK_PROTOCOLS.has(parsed.protocol)) return null;

  const anchor = document.createElement('a');
  anchor.setAttribute('href', parsed.href);
  anchor.setAttribute('target', '_blank');
  anchor.setAttribute('rel', 'noopener noreferrer');
  anchor.textContent = label;
  return sanitizeHtml(anchor.outerHTML);
};

/**
 * Strip all HTML tags and return plain text.
 * Useful for exports and text-only contexts.
 */
export const stripHtml = (html: string): string => {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent || '';
};

/**
 * Sanitize HTML and also clean inline font styles while preserving structure.
 * This combines XSS sanitization with style cleanup for print/display contexts.
 */
export const sanitizeAndCleanStyles = (html: string): string => {
  if (!html) return '';
  
  // First sanitize against XSS
  const sanitized = sanitizeHtml(html);
  
  // Then clean inline font styles
  const doc = new DOMParser().parseFromString(sanitized, 'text/html');
  
  const allElements = doc.body.querySelectorAll('*');
  allElements.forEach(el => {
    const element = el as HTMLElement;
    if (element.style) {
      element.style.fontSize = '';
      element.style.fontFamily = '';
      element.style.lineHeight = '';
      if (element.getAttribute('style')?.trim() === '') {
        element.removeAttribute('style');
      }
    }
    // Remove FONT tags by unwrapping their content
    if (element.tagName === 'FONT') {
      const parent = element.parentNode;
      while (element.firstChild) {
        parent?.insertBefore(element.firstChild, element);
      }
      parent?.removeChild(element);
    }
  });
  
  return doc.body.innerHTML;
};
