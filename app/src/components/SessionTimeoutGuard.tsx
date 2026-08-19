import * as React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  SESSION_IDLE_TIMEOUT_SECONDS,
  SESSION_IDLE_WARNING_SECONDS,
} from '@/config/sessionPolicy';
import { useAuth } from '@/hooks/useAuth';

interface IdleSessionBoundaryProps {
  onSessionEnd: () => Promise<void>;
  timeoutMs?: number;
  warningMs?: number;
}

/**
 * Client-side privacy boundary for an unattended open workspace. Hosted Auth
 * enforces the same inactivity value at refresh time; this guard closes the UI
 * at the exact browser-activity deadline instead of waiting for the next JWT.
 */
export function IdleSessionBoundary({
  onSessionEnd,
  timeoutMs = SESSION_IDLE_TIMEOUT_SECONDS * 1_000,
  warningMs = SESSION_IDLE_WARNING_SECONDS * 1_000,
}: IdleSessionBoundaryProps): React.ReactElement {
  const effectiveWarningMs = Math.min(warningMs, Math.max(1, timeoutMs - 1));
  const deadlineRef = React.useRef(Date.now() + timeoutMs);
  const endingRef = React.useRef(false);
  const warningOpenRef = React.useRef(false);
  const onSessionEndRef = React.useRef(onSessionEnd);
  const [remainingSeconds, setRemainingSeconds] = React.useState<number | null>(null);

  React.useEffect(() => {
    onSessionEndRef.current = onSessionEnd;
  }, [onSessionEnd]);

  const resetDeadline = React.useCallback(() => {
    deadlineRef.current = Date.now() + timeoutMs;
    endingRef.current = false;
    warningOpenRef.current = false;
    setRemainingSeconds(null);
  }, [timeoutMs]);

  const endSession = React.useCallback(() => {
    if (endingRef.current) return;
    endingRef.current = true;
    warningOpenRef.current = false;
    setRemainingSeconds(null);
    void onSessionEndRef.current().catch(() => {
      // Auth sign-out still clears the local workspace before rejecting a
      // failed remote revoke. Reset only for injected/test handlers that fail
      // without unmounting this authenticated boundary.
      resetDeadline();
      console.error('Automatic session termination failed');
    });
  }, [resetDeadline]);

  React.useEffect(() => {
    deadlineRef.current = Date.now() + timeoutMs;

    const evaluateDeadline = () => {
      if (endingRef.current) return;
      const remainingMs = deadlineRef.current - Date.now();
      if (remainingMs <= 0) {
        endSession();
        return;
      }
      if (remainingMs <= effectiveWarningMs) {
        warningOpenRef.current = true;
        setRemainingSeconds(Math.max(1, Math.ceil(remainingMs / 1_000)));
      }
    };

    const recordActivity = () => {
      if (endingRef.current || warningOpenRef.current) return;
      deadlineRef.current = Date.now() + timeoutMs;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') evaluateDeadline();
    };

    const activityEvents: Array<keyof WindowEventMap> = ['keydown', 'pointerdown', 'touchstart', 'wheel'];
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, recordActivity, { passive: true });
    });
    document.addEventListener('visibilitychange', handleVisibilityChange);
    const intervalMs = Math.min(1_000, Math.max(50, Math.floor(effectiveWarningMs / 4)));
    const intervalId = window.setInterval(evaluateDeadline, intervalMs);
    evaluateDeadline();

    return () => {
      window.clearInterval(intervalId);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, recordActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [effectiveWarningMs, endSession, timeoutMs]);

  return (
    <AlertDialog open={remainingSeconds !== null} onOpenChange={() => undefined}>
      <AlertDialogContent data-testid="session-timeout-warning">
        <AlertDialogHeader>
          <AlertDialogTitle>Session ending soon</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              For privacy, this inactive workspace will close and require sign-in again.
            </span>
            <span className="block font-medium text-foreground" aria-hidden="true">
              Automatic sign-out in {remainingSeconds ?? 0} seconds.
            </span>
            <span className="sr-only">
              Automatic sign-out will occur soon unless you choose Stay signed in.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row">
          <AlertDialogCancel
            className="min-h-[44px] bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground"
            onClick={resetDeadline}
          >
            Stay signed in
          </AlertDialogCancel>
          <AlertDialogAction
            className="min-h-[44px] border border-destructive/30 bg-background text-destructive shadow-sm hover:bg-destructive/10"
            onClick={endSession}
          >
            Sign out now
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function SessionTimeoutGuard(): React.ReactElement {
  const { signOut } = useAuth();
  return <IdleSessionBoundary onSessionEnd={signOut} />;
}
