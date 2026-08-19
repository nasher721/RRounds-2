import * as React from "react";
import { useLocation } from "react-router-dom";

const DEFAULT_PUBLIC_ORIGIN = "https://remix-of-remix-of-round-robin-notes.vercel.app";
const PUBLIC_ORIGIN = (import.meta.env?.VITE_PUBLIC_APP_URL || DEFAULT_PUBLIC_ORIGIN).replace(/\/$/, "");
const LANDING_DESCRIPTION = "A focused clinical rounding workspace for patient lists, notes, tasks, and team handoffs.";

interface MetadataDefinition {
  title: string;
  description: string;
  robots: "index, follow" | "noindex, follow" | "noindex, nofollow";
  canonicalPath: string;
  structuredProduct?: boolean;
}

const PUBLIC_ROUTES: Record<string, MetadataDefinition> = {
  "/": {
    title: "Rolling Rounds | Clinical Rounding Workspace",
    description: LANDING_DESCRIPTION,
    robots: "index, follow",
    canonicalPath: "/",
    structuredProduct: true,
  },
  "/security": {
    title: "Security | Rolling Rounds",
    description: "Review the deployment, access-control, device, and data-handling safeguards for Rolling Rounds.",
    robots: "index, follow",
    canonicalPath: "/security",
  },
  "/privacy": {
    title: "Privacy Notice | Rolling Rounds",
    description: "Review privacy and data-handling information for this Rolling Rounds deployment.",
    robots: "noindex, follow",
    canonicalPath: "/privacy",
  },
  "/auth": {
    title: "Sign in | Rolling Rounds",
    description: "Sign in to an authorized Rolling Rounds workspace.",
    robots: "noindex, nofollow",
    canonicalPath: "/auth",
  },
  "/fhir/callback": {
    title: "EHR Import | Rolling Rounds",
    description: "Complete an authorized EHR import into Rolling Rounds.",
    robots: "noindex, nofollow",
    canonicalPath: "/fhir/callback",
  },
};

const PRIVATE_WORKSPACE_METADATA: MetadataDefinition = {
  title: "Workspace | Rolling Rounds",
  description: "Authorized Rolling Rounds clinical workspace.",
  robots: "noindex, nofollow",
  canonicalPath: "/",
};

const NOT_FOUND_METADATA: MetadataDefinition = {
  title: "Page not found | Rolling Rounds",
  description: "The requested Rolling Rounds page could not be found.",
  robots: "noindex, nofollow",
  canonicalPath: "/",
};

function upsertMeta(attribute: "name" | "property", key: string, content: string): void {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(attribute, key);
    document.head.append(element);
  }
  element.content = content;
}

function upsertCanonical(href: string): void {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!element) {
    element = document.createElement("link");
    element.rel = "canonical";
    document.head.append(element);
  }
  element.href = href;
}

function updateStructuredProduct(enabled: boolean): void {
  const existing = document.head.querySelector<HTMLScriptElement>('script[type="application/ld+json"][data-rolling-rounds]');
  if (!enabled) {
    existing?.remove();
    return;
  }

  const script = existing ?? document.createElement("script");
  script.type = "application/ld+json";
  script.dataset.rollingRounds = "product";
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Rolling Rounds",
    applicationCategory: "HealthApplication",
    operatingSystem: "Web",
    description: LANDING_DESCRIPTION,
    url: `${PUBLIC_ORIGIN}/`,
    image: `${PUBLIC_ORIGIN}/icons/icon-512.png`,
  });
  if (!existing) document.head.append(script);
}

export function RouteMetadata({ authenticated }: { authenticated: boolean }): null {
  const { pathname } = useLocation();

  React.useEffect(() => {
    const metadata = authenticated && pathname === "/"
      ? PRIVATE_WORKSPACE_METADATA
      : PUBLIC_ROUTES[pathname] ?? NOT_FOUND_METADATA;
    const canonical = `${PUBLIC_ORIGIN}${metadata.canonicalPath}`;

    document.title = metadata.title;
    upsertMeta("name", "description", metadata.description);
    upsertMeta("name", "robots", metadata.robots);
    upsertMeta("property", "og:title", metadata.title);
    upsertMeta("property", "og:description", metadata.description);
    upsertMeta("property", "og:url", canonical);
    upsertMeta("name", "twitter:title", metadata.title);
    upsertMeta("name", "twitter:description", metadata.description);
    upsertCanonical(canonical);
    updateStructuredProduct(Boolean(metadata.structuredProduct && !authenticated));
  }, [authenticated, pathname]);

  return null;
}
