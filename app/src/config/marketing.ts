/**
 * Public marketing / landing page configuration (Vite env).
 */

/** Shown on landing footer, contact section, and Privacy page */
export const CONTACT_EMAIL =
  import.meta.env?.VITE_CONTACT_EMAIL?.trim() ?? "";

export const CONTACT_EMAIL_IS_CONFIGURED = CONTACT_EMAIL.length > 0;

/** Developer setup guidance must never appear in a production marketing page. */
export const SHOW_CONTACT_CONFIGURATION_HINT =
  Boolean(import.meta.env?.DEV) && !CONTACT_EMAIL_IS_CONFIGURED;
