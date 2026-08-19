import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { recordTelemetryEvent } from "@/lib/observability/telemetry";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: unknown[];
}

interface State {
  hasError: boolean;
}

/**
 * ErrorBoundary - Catches JavaScript errors in child components and displays a fallback UI.
 * 
 * This prevents a single component error from crashing the entire application.
 * Use this to wrap sections that could fail independently (e.g., patient list, AI chat panel).
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    recordTelemetryEvent("render_error", error, {
      boundary: "ErrorBoundary",
      componentStack: errorInfo.componentStack?.slice(0, 1000),
    });
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: Props): void {
    if (this.state.hasError && this.props.resetKeys) {
      const hasResetKeyChanged = this.props.resetKeys.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      if (hasResetKeyChanged) {
        this.reset();
      }
    }
  }

  reset = (): void => {
    this.setState({ hasError: false });
  };

  handleRetry = (): void => {
    this.reset();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex flex-col items-center justify-center p-6 min-h-[200px] bg-muted/20 rounded-lg border border-destructive/20">
          <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
          <h3 className="text-lg font-semibold text-destructive mb-1">
            Something went wrong
          </h3>
          <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
            This section could not be displayed. Please try again.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleRetry}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Creates a named ErrorBoundary for specific sections
 */
export function createSectionErrorBoundary(sectionName: string) {
  return class extends Component<Omit<Props, "onError">, State> {
    static displayName = `ErrorBoundary(${sectionName})`;
    
    constructor(props: Omit<Props, "onError">) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError(): State {
      return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
      recordTelemetryEvent("render_error", error, {
        boundary: "SectionErrorBoundary",
        sectionName,
        componentStack: errorInfo.componentStack?.slice(0, 1000),
      });
    }

    handleRetry = (): void => {
      this.setState({ hasError: false });
    };

    render() {
      if (this.state.hasError) {
        return (
          <div className="flex flex-col items-center justify-center p-6 min-h-[200px] bg-muted/20 rounded-lg border border-destructive/20">
            <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
            <h3 className="text-lg font-semibold text-destructive mb-1">
              {sectionName} failed to load
            </h3>
            <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
              There was an error loading this section. Please try again.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleRetry}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        );
      }

      return this.props.children;
    }
  };
}
