import { toast } from "@/hooks/use-toast";
import { recordTelemetryEvent } from "@/lib/observability/telemetry";
import { getUserFacingErrorMessage } from "@/lib/userFacingErrors";

interface ErrorHandlerOptions {
  title?: string;
  description?: string;
  duration?: number;
}

/**
 * Standalone error handler – can be used outside of React components.
 */
export function handleError(error: unknown, options: ErrorHandlerOptions = {}) {
  const {
    title = 'Something went wrong',
    duration = 5000,
  } = options;
  const description = options.description ?? getUserFacingErrorMessage(error);

  recordTelemetryEvent('handled_error', error, { operation: 'handleError' });

  toast({
    title,
    description,
    variant: "destructive",
    duration,
  });
}

/**
 * React hook version – returns the same handleError function.
 * Prefer this when inside a component for consistency.
 */
export function useErrorHandler() {
  return handleError;
}

export function showSuccess(message: string, title = 'Success') {
  toast({
    title,
    description: message,
    duration: 3000,
  });
}

export function showInfo(message: string, title = 'Notice') {
  toast({
    title,
    description: message,
    duration: 4000,
  });
}
