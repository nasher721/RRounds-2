/**
 * Lazy IBCC Panel Wrapper
 * Embedded: always renders (desktop resources tab).
 * Overlay: only when open — fixed shell so it never stacks into document flow.
 */

import React, { Suspense, memo } from "react";
import { Loader2 } from "lucide-react";
import { useIBCCState } from "@/contexts/IBCCContext";
import { LazyPanelErrorBoundary } from "@/components/LazyPanelErrorBoundary";
import { cn } from "@/lib/utils";

const IBCCPanelContent = React.lazy(() => import("./IBCCPanelContent"));

export type IBCCPanelVariant = "embedded" | "overlay";

type IBCCPanelProps = {
  variant?: IBCCPanelVariant;
};

function IBCCPanelComponent({ variant = "embedded" }: IBCCPanelProps) {
  const { isOpen, isDataLoaded, ensureDataLoaded } = useIBCCState();
  const shouldLoad = variant === "embedded" || isOpen;

  React.useEffect(() => {
    if (shouldLoad) void ensureDataLoaded();
  }, [ensureDataLoaded, shouldLoad]);

  if (variant === "overlay" && !isOpen) return null;

  const isOverlay = variant === "overlay";

  return (
    <LazyPanelErrorBoundary
      title="Failed to load IBCC Reference"
      fallbackClassName={cn(
        "bg-card flex items-center justify-center p-6",
        isOverlay
          ? "fixed inset-0 z-50"
          : "h-full w-full",
      )}
    >
      <div
        className={cn(
          "bg-card flex flex-col",
          isOverlay
            ? "fixed inset-0 z-50"
            : "h-full w-full",
        )}
        role={isOverlay ? "dialog" : undefined}
        aria-modal={isOverlay ? true : undefined}
        aria-label={isOverlay ? "Clinical Reference" : undefined}
      >
        <Suspense
          fallback={
            <div className="h-full w-full flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" aria-hidden />
                <p className="text-sm text-muted-foreground">Loading Clinical Reference…</p>
              </div>
            </div>
          }
        >
          {isDataLoaded ? <IBCCPanelContent /> : (
            <div className="h-full w-full flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" aria-hidden />
                <p className="text-sm text-muted-foreground">Loading Clinical Reference…</p>
              </div>
            </div>
          )}
        </Suspense>
      </div>
    </LazyPanelErrorBoundary>
  );
}

export const IBCCPanel = memo(IBCCPanelComponent);
