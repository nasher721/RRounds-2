import * as React from "react";
import { AlertTriangle, RefreshCw, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { recordTelemetryEvent, exportDiagnosticsReport } from "@/lib/observability/telemetry";
import { captureExceptionToSentry } from "@/lib/observability/sentryClient";
import { toast } from "sonner";

interface ErrorBoundaryState {
  hasError: boolean;
}

export class GlobalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): Partial<ErrorBoundaryState> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    recordTelemetryEvent('render_error', error, {
      componentStack: errorInfo.componentStack?.slice(0, 1000),
    });
    try {
      captureExceptionToSentry(error, {
        contexts: { react: { componentStack: errorInfo.componentStack } },
      });
    } catch {
      // Error reporting must never break the fallback itself.
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleCopyDiagnostics = async () => {
    try {
      const text = await exportDiagnosticsReport();
      await navigator.clipboard.writeText(text);
      toast.success("Diagnostics copied.");
    } catch {
      toast.error("Could not copy diagnostics.");
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <main className="min-h-screen bg-background flex items-center justify-center p-6" id="main-content">
          <div className="max-w-md w-full text-center space-y-6" role="alert" aria-live="assertive">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" aria-hidden />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-foreground">Something went wrong</h1>
              <p className="text-sm text-muted-foreground">
                An unexpected error occurred. Please reload the page to continue.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button type="button" onClick={this.handleReload} className="w-full min-h-[44px] gap-2">
                <RefreshCw className="h-4 w-4 shrink-0" aria-hidden />
                Reload Page
              </Button>

              <Button
                type="button"
                variant="secondary"
                onClick={this.handleCopyDiagnostics}
                className="w-full min-h-[44px] gap-2"
              >
                <Copy className="h-4 w-4 shrink-0" aria-hidden />
                Copy diagnostics
              </Button>
            </div>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
