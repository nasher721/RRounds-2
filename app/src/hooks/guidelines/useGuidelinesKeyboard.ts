/**
 * Clinical Guidelines Keyboard Shortcuts Hook
 * Handles keyboard navigation for the guidelines panel
 */

import { useEffect } from 'react';

interface UseGuidelinesKeyboardOptions {
  isOpen: boolean;
  hasActiveGuideline: boolean;
  onTogglePanel: () => void;
  onClosePanel: () => void;
  onCloseGuideline: () => void;
}

export function useGuidelinesKeyboard({
  isOpen,
  hasActiveGuideline,
  onTogglePanel,
  onClosePanel,
  onCloseGuideline
}: UseGuidelinesKeyboardOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + G to toggle panel
      if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        e.preventDefault();
        onTogglePanel();
        return;
      }

      // Escape to close
      if (e.key === 'Escape') {
        if (hasActiveGuideline) {
          e.preventDefault();
          onCloseGuideline();
        } else if (isOpen) {
          e.preventDefault();
          onClosePanel();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, hasActiveGuideline, onTogglePanel, onClosePanel, onCloseGuideline]);
}
