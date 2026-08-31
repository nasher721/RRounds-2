/**
 * Open Evidence Panel Lazy Loader (overlay)
 * Mounted once per shell (Round runner ToolsSheet, MobileDashboard) — only
 * renders once `isOpen` is true, matching GuidelinesPanelLazy/IBCCPanel's
 * overlay variant so Ctrl/Cmd+E and the Tools entry points have a visible
 * target outside the classic desktop Resources tab (which uses the always-
 * mounted `OpenEvidencePanel` instead).
 */

import React, { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { useOpenEvidenceState } from "@/hooks/useOpenEvidenceState";
import { LazyPanelErrorBoundary } from "@/components/LazyPanelErrorBoundary";

const OpenEvidencePanelContent = lazy(() => import("./OpenEvidencePanelContent"));

function PanelSkeleton() {
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card border-l border-border shadow-xl flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        <span className="text-sm">Loading Open Evidence…</span>
      </div>
    </div>
  );
}

export function OpenEvidencePanelLazy() {
  const { isOpen } = useOpenEvidenceState();

  if (!isOpen) return null;

  return (
    <LazyPanelErrorBoundary
      title="Failed to load Open Evidence"
      fallbackClassName="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card border-l border-border shadow-xl flex items-center justify-center p-6"
    >
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card border-l border-border shadow-xl" role="dialog" aria-modal="true" aria-label="Open Evidence">
        <Suspense fallback={<PanelSkeleton />}>
          <OpenEvidencePanelContent />
        </Suspense>
      </div>
    </LazyPanelErrorBoundary>
  );
}
