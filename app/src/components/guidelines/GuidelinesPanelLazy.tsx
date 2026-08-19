/**
 * Guidelines Panel Lazy Loader
 * Lazy loads the panel content for better initial performance
 */

import React, { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { useClinicalGuidelinesState } from "@/contexts/ClinicalGuidelinesContext";
import { LazyPanelErrorBoundary } from "@/components/LazyPanelErrorBoundary";

const GuidelinesPanelContent = lazy(() => import("./GuidelinesPanelContent"));

function PanelSkeleton() {
  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card border-l border-border shadow-xl flex items-center justify-center">
      <div className="flex flex-col items-center gap-2 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        <span className="text-sm">Loading guidelines…</span>
      </div>
    </div>
  );
}

export function GuidelinesPanelLazy() {
  const { isOpen, isDataLoaded, ensureDataLoaded } = useClinicalGuidelinesState();

  React.useEffect(() => {
    if (isOpen) void ensureDataLoaded();
  }, [ensureDataLoaded, isOpen]);

  if (!isOpen) return null;

  return (
    <LazyPanelErrorBoundary
      title="Failed to load guidelines"
      fallbackClassName="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card border-l border-border shadow-xl flex items-center justify-center p-6"
    >
      <Suspense fallback={<PanelSkeleton />}>
        {isDataLoaded ? <GuidelinesPanelContent /> : <PanelSkeleton />}
      </Suspense>
    </LazyPanelErrorBoundary>
  );
}
