import { useEffect, useRef } from "react";

/**
 * Hook to manage focus return when a dialog/modal closes.
 * Stores the previously focused element and returns focus to it on unmount/close.
 * 
 * Radix UI Dialog already traps focus within the dialog content,
 * but this hook ensures focus returns to the trigger element on close.
 */
export function useFocusReturn() {
  return useRef<HTMLElement | null>(null);
}

/**
 * Hook to manage focus trap within a container.
 * Ensures tab key cycles through focusable elements within the container
 * and doesn't escape to the rest of the page.
 * 
 * Note: Radix UI Dialog already implements focus trap by default.
 * This hook is provided for cases where additional focus trap is needed.
 */
export function useFocusTrap(containerRef: React.RefObject<HTMLElement | null>) {
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Store the currently focused element
    previousActiveElementRef.current = document.activeElement as HTMLElement;

    // Get all focusable elements within the container
    const getFocusableElements = () => {
      const focusableSelectors = [
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        'a[href]',
        '[tabindex]:not([tabindex="-1"])',
      ].join(', ');

      return Array.from(container.querySelectorAll<HTMLElement>(focusableSelectors));
    };

    const focusableElements = getFocusableElements();
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement || document.activeElement === container) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);

    // Focus the first focusable element when the trap activates
    if (firstElement) {
      firstElement.focus();
    }

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      
      // Return focus to the previously focused element
      if (previousActiveElementRef.current && previousActiveElementRef.current.focus) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [containerRef]);

  return previousActiveElementRef;
}
