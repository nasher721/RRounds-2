import { logInfo } from "@/lib/observability/logger";

export const MARKETING_EVENTS = {
  landingView: "landing_view",
  headerSignIn: "sign_in.header",
  heroSignIn: "sign_in.hero",
  featureExplore: "features.explore",
  securityGuidance: "security_guidance.open",
  pricingContact: "pricing.contact",
  contactEmail: "contact.email",
  footerWorkspace: "workspace.footer",
} as const;

export type MarketingEvent = keyof typeof MARKETING_EVENTS;

export function createMarketingEventName(event: MarketingEvent): string {
  return `marketing.${MARKETING_EVENTS[event]}`;
}

/**
 * Record only a fixed, PHI-free public-funnel event. The shared logger adds a
 * pseudonymous tab-session identifier and forwards it only when a telemetry
 * collector is explicitly configured.
 */
export function recordMarketingEvent(event: MarketingEvent): void {
  logInfo(createMarketingEventName(event), {
    feature: "public_funnel",
    type: "product_analytics",
  });
}
