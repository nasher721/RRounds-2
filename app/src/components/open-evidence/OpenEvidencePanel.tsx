/**
 * Open Evidence Panel
 * Lazy loads the panel content for performance. Renders content directly
 * when embedded (e.g. in the Resources tab), without a floating toggle button.
 */

import React, { Suspense, memo } from "react";
import { Loader2 } from "lucide-react";

const OpenEvidencePanelContent = React.lazy(() => import("./OpenEvidencePanelContent"));

function OpenEvidencePanelComponent() {
  return (
    <Suspense
      fallback={
        <div className="h-full w-full bg-card flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" aria-hidden />
            <p className="text-sm text-muted-foreground">Loading Open Evidence…</p>
          </div>
        </div>
      }
    >
      <OpenEvidencePanelContent />
    </Suspense>
  );
}

export const OpenEvidencePanel = memo(OpenEvidencePanelComponent);
