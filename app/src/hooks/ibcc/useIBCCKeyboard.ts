/**
 * IBCC Keyboard Shortcuts Hook
 * Handles keyboard navigation for the IBCC panel
 */

import { useEffect, useCallback } from 'react';

interface UseIBCCKeyboardOptions {
  isOpen: boolean;
  hasActiveChapter: boolean;
  onTogglePanel: () => void;
  onClosePanel: () => void;
  onCloseChapter: () => void;
}

export function useIBCCKeyboard({
  isOpen,
  hasActiveChapter,
  onTogglePanel,
  onClosePanel,
  onCloseChapter,
}: UseIBCCKeyboardOptions) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ctrl+I or Cmd+I to toggle IBCC panel
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      onTogglePanel();
      return;
    }

    // Escape to close
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      if (hasActiveChapter) {
        onCloseChapter();
      } else {
        onClosePanel();
      }
    }
  }, [isOpen, hasActiveChapter, onTogglePanel, onClosePanel, onCloseChapter]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
