import * as React from "react";
import { createPortal } from "react-dom";
import { LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const PRIVACY_COMMAND = "toggle-privacy-curtain";

interface DesktopPrivacyCurtainProps {
  enabled: boolean;
}

/**
 * Opaque desktop-only shield for shared workstations and bedside transitions.
 * The app root is made inert while covered so protected content is also hidden
 * from keyboard navigation and the accessibility tree.
 */
export function DesktopPrivacyCurtain({ enabled }: DesktopPrivacyCurtainProps) {
  const isDesktop = enabled && window.desktop?.isDesktop === true;
  const [active, setActive] = React.useState(false);
  const revealButtonRef = React.useRef<HTMLButtonElement>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);

  const toggleCurtain = React.useCallback(() => {
    setActive((wasActive) => {
      if (!wasActive) {
        previousFocusRef.current = document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
      }
      return !wasActive;
    });
  }, []);

  const revealWorkspace = React.useCallback(() => {
    setActive(false);
  }, []);

  React.useEffect(() => {
    if (!isDesktop && active) setActive(false);
  }, [active, isDesktop]);

  React.useEffect(() => {
    if (!isDesktop) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;
      if (modifier && event.shiftKey && event.key.toLowerCase() === "l") {
        event.preventDefault();
        toggleCurtain();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const unsubscribe = window.desktop?.onCommand((command) => {
      if (command === PRIVACY_COMMAND) toggleCurtain();
    });

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      unsubscribe?.();
    };
  }, [isDesktop, toggleCurtain]);

  React.useEffect(() => {
    const appRoot = document.getElementById("root");
    if (!appRoot) return undefined;

    if (active) {
      appRoot.setAttribute("aria-hidden", "true");
      appRoot.setAttribute("inert", "");
      document.body.style.overflow = "hidden";
      const frame = window.requestAnimationFrame(() => revealButtonRef.current?.focus());
      return () => window.cancelAnimationFrame(frame);
    }

    appRoot.removeAttribute("aria-hidden");
    appRoot.removeAttribute("inert");
    document.body.style.overflow = "";
    previousFocusRef.current?.focus();
    return undefined;
  }, [active]);

  React.useEffect(() => () => {
    const appRoot = document.getElementById("root");
    appRoot?.removeAttribute("aria-hidden");
    appRoot?.removeAttribute("inert");
    document.body.style.overflow = "";
  }, []);

  if (!isDesktop || !active) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-curtain-title"
      aria-describedby="privacy-curtain-description"
      className="fixed inset-0 z-[100000] flex min-h-[100dvh] items-center justify-center bg-slate-950 px-6 py-12 text-slate-50"
    >
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 shadow-2xl shadow-black/30">
          <ShieldCheck className="h-8 w-8 text-emerald-300" aria-hidden="true" />
        </div>
        <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
          Privacy curtain active
        </p>
        <h1 id="privacy-curtain-title" className="mt-3 text-3xl font-semibold tracking-tight">
          Workspace hidden
        </h1>
        <p id="privacy-curtain-description" className="mx-auto mt-4 max-w-sm text-sm leading-6 text-slate-300">
          Patient information is covered while you step away or move between bedside workspaces.
        </p>
        <Button
          ref={revealButtonRef}
          type="button"
          size="lg"
          onClick={revealWorkspace}
          className="mt-8 min-h-12 w-full bg-emerald-300 text-slate-950 hover:bg-emerald-200 focus-visible:ring-emerald-300"
        >
          <LockKeyhole className="mr-2 h-4 w-4" aria-hidden="true" />
          Reveal workspace
        </Button>
        <p className="mt-4 text-xs text-slate-400">
          Press <kbd className="rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 font-mono">⌘⇧L</kbd> again to reveal
        </p>
      </div>
    </div>,
    document.body,
  );
}
