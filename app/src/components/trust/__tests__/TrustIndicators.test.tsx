import test from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TrustIndicators } from "../TrustIndicators";

// DOM setup from scripts/test-setup.mjs when run via npm test

if (typeof globalThis !== "undefined") {
  Object.assign(globalThis, { React });
}

// Mock requestAnimationFrame for Radix tooltip animations
if (typeof global.window !== "undefined" && typeof global.window.requestAnimationFrame === "undefined") {
  global.window.requestAnimationFrame = (cb) => setTimeout(cb, 0);
}

function renderWithProviders(component: React.ReactElement) {
  const div = document.createElement("div");
  document.body.appendChild(div);
  const root = createRoot(div);
  root.render(
    <MemoryRouter>
      <TooltipProvider>{component}</TooltipProvider>
    </MemoryRouter>
  );
  return { div, root };
}

test("TrustIndicators renders three trust indicators", async () => {
  const { div, root } = renderWithProviders(<TrustIndicators />);
  
  // Wait for React to render
  await new Promise((r) => setTimeout(r, 100));
  
  // Check for three badge-like elements (data-testid)
  const reviewBadge = div.querySelector('[data-testid="deployment-review-badge"]');
  const httpsBadge = div.querySelector('[data-testid="https-badge"]');
  const historyBadge = div.querySelector('[data-testid="history-badge"]');
  
  assert.ok(reviewBadge, "Should render deployment-review badge");
  assert.ok(httpsBadge, "Should render HTTPS-transport badge");
  assert.ok(historyBadge, "Should render change-history badge");
  
  root.unmount();
  document.body.removeChild(div);
});

test("TrustIndicators contains correct icon elements", async () => {
  const { div, root } = renderWithProviders(<TrustIndicators />);
  
  await new Promise((r) => setTimeout(r, 100));
  
  // Check for shield/lock icons using SVG or appropriate elements
  const svgElements = div.querySelectorAll("svg");
  assert.ok(svgElements.length >= 3, "Should have at least 3 SVG icons");
  
  root.unmount();
  document.body.removeChild(div);
});

test("TrustIndicators contains security documentation link", async () => {
  const { div, root } = renderWithProviders(<TrustIndicators />);
  
  await new Promise((r) => setTimeout(r, 100));
  
  // Check for link to /security
  const securityLink = div.querySelector('a[href="/security"]');
  assert.ok(securityLink, "Should have link to /security documentation");
  
  root.unmount();
  document.body.removeChild(div);
});

test("TrustIndicators renders with proper container structure", async () => {
  const { div, root } = renderWithProviders(<TrustIndicators />);
  
  await new Promise((r) => setTimeout(r, 100));
  
  // Check for flex container or proper grouping
  const container = div.querySelector('[class*="flex"]') || div.firstElementChild;
  assert.ok(container, "Should have a container element");
  
  root.unmount();
  document.body.removeChild(div);
});

test("TrustIndicators badge elements have tooltip-related attributes", async () => {
  const { div, root } = renderWithProviders(<TrustIndicators />);
  
  await new Promise((r) => setTimeout(r, 100));
  
  // Check for tooltip trigger elements (Radix uses data-state="closed|open")
  const tooltipTriggers = div.querySelectorAll('[data-state]');
  assert.ok(tooltipTriggers.length >= 3, "Should have tooltip triggers for each badge");
  
  root.unmount();
  document.body.removeChild(div);
});

test("TrustIndicators renders text labels for each indicator", async () => {
  const { div, root } = renderWithProviders(<TrustIndicators />);
  
  await new Promise((r) => setTimeout(r, 100));
  
  const text = div.textContent || "";
  
  // Check for deployment-review text without claiming compliance.
  assert.ok(
    /deployment|review/i.test(text),
    "Should contain deployment-review text"
  );
  
  // Check for encryption-related text
  assert.ok(
    /https|encrypt|secure|ssl|tls|ssl\/tls/i.test(text),
    "Should contain encryption related text"
  );
  
  // Check for audit-related text
  assert.ok(
    /audit|log|track|record|history/i.test(text),
    "Should contain audit related text"
  );
  
  root.unmount();
  document.body.removeChild(div);
});

test("TrustIndicators do not claim compliance or certification", async () => {
  const { div, root } = renderWithProviders(<TrustIndicators />);
  
  await new Promise((r) => setTimeout(r, 100));
  
  const text = div.textContent || "";
  
  // Should NOT claim certified status
  assert.ok(
    !/hipaa aligned|hipaa certified|compliant|certified/i.test(text),
    "Should not claim compliance or certification"
  );
  
  root.unmount();
  document.body.removeChild(div);
});

test("TrustIndicators is accessible with proper aria attributes", async () => {
  const { div, root } = renderWithProviders(<TrustIndicators />);
  
  await new Promise((r) => setTimeout(r, 100));
  
  // Check for tooltip content with aria attributes
  const tooltipContent = div.querySelectorAll('[role="tooltip"], [aria-describedby]');
  assert.ok(tooltipContent.length >= 3, "Should have accessible tooltip content");
  
  root.unmount();
  document.body.removeChild(div);
});
