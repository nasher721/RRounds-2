import * as React from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const FHIRCallbackFlow = React.lazy(() => import("./FHIRCallbackFlow"));

class FHIRCallbackChunkBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(): void {
    console.error("FHIR callback workflow failed to load");
  }

  render(): React.ReactNode {
    if (this.state.failed) {
      return (
        <FHIRCallbackStatus
          icon={<AlertCircle className="h-5 w-5 shrink-0 text-destructive" aria-hidden />}
          title="Import unavailable"
          message="The EHR import workflow could not be loaded. Refresh this page to retry safely."
        />
      );
    }
    return this.props.children;
  }
}

function FHIRCallbackStatus({
  icon,
  title,
  message,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
}): React.ReactElement {
  return (
    <main id="main-content" className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md" role="region" aria-labelledby="fhir-import-shell-title">
        <CardHeader>
          <CardTitle id="fhir-import-shell-title" className="flex items-center gap-2 text-balance">
            {icon}
            <span>{title}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{message}</p>
        </CardContent>
      </Card>
    </main>
  );
}

/**
 * Eager recovery shell: the route itself never depends on a lazy chunk, while
 * the authenticated EHR/patient graph loads only when this callback is used.
 */
export default function FHIRCallback(): React.ReactElement {
  return (
    <FHIRCallbackChunkBoundary>
      <React.Suspense
        fallback={(
          <FHIRCallbackStatus
            icon={<Loader2 className="h-5 w-5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />}
            title="Connecting to EHR…"
            message="Please wait while we prepare the secure EHR import workflow…"
          />
        )}
      >
        <FHIRCallbackFlow />
      </React.Suspense>
    </FHIRCallbackChunkBoundary>
  );
}
