import * as React from "react";
import { RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  activateWaitingServiceWorker,
  SERVICE_WORKER_UPDATE_EVENT,
  clearServiceWorkerUpdateReady,
  isServiceWorkerUpdateReady,
} from "@/lib/serviceWorkerUpdate";

interface ServiceWorkerUpdatePromptProps {
  onActivate?: () => Promise<boolean>;
  onReload?: () => void;
}

export function ServiceWorkerUpdatePrompt({
  onActivate = activateWaitingServiceWorker,
  onReload = () => window.location.reload(),
}: ServiceWorkerUpdatePromptProps): React.ReactElement | null {
  const [isVisible, setIsVisible] = React.useState(isServiceWorkerUpdateReady);
  const [isActivating, setIsActivating] = React.useState(false);
  const [activationFailed, setActivationFailed] = React.useState(false);

  React.useEffect(() => {
    const showPrompt = () => {
      setActivationFailed(false);
      setIsVisible(true);
    };
    window.addEventListener(SERVICE_WORKER_UPDATE_EVENT, showPrompt);
    return () => window.removeEventListener(SERVICE_WORKER_UPDATE_EVENT, showPrompt);
  }, []);

  if (!isVisible) return null;

  const dismiss = () => {
    clearServiceWorkerUpdateReady();
    setIsVisible(false);
  };

  const refresh = async () => {
    setActivationFailed(false);
    setIsActivating(true);
    const activated = await onActivate().catch(() => false);
    if (!activated) {
      setActivationFailed(true);
      setIsActivating(false);
      return;
    }
    dismiss();
    onReload();
  };

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-[110] mx-auto flex max-w-xl items-center gap-3 rounded-xl border border-border bg-background p-3 text-sm text-foreground shadow-lg sm:inset-x-auto sm:right-4 sm:mx-0"
    >
      <RefreshCw className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        An updated version of Rolling Rounds is ready.
        {activationFailed && (
          <span className="mt-1 block text-destructive">
            The update couldn&apos;t activate. Try again when this page is online.
          </span>
        )}
      </p>
      <Button
        type="button"
        size="sm"
        className="min-h-11 sm:min-h-9"
        onClick={() => void refresh()}
        disabled={isActivating}
      >
        {isActivating ? "Activating…" : "Refresh now"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-11 w-11 shrink-0 sm:h-9 sm:w-9"
        onClick={dismiss}
        disabled={isActivating}
        aria-label="Later"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
