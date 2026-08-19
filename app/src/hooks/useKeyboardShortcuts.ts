import { useEffect, useCallback } from "react";

export interface KeyboardShortcutActions {
  onAddPatient?: () => void;
  onSearch?: () => void;
  onCollapseAll?: () => void;
  onPrint?: () => void;
  /** Focus patient search (plain `/` when not typing in a field) */
  onSlashFocusSearch?: () => void;
  /** Open new patient flow (plain `n` / `N` when not typing in a field) */
  onKeyNAddPatient?: () => void;
  /** Desktop: next patient in filtered list (`Cmd/Ctrl` + `]`) */
  onNextPatient?: () => void;
  /** Desktop: previous patient in filtered list (`Cmd/Ctrl` + `[`) */
  onPrevPatient?: () => void;
}

/**
 * Provides keyboard shortcuts for common rounding actions.
 * All shortcuts use Ctrl/Cmd modifier to avoid conflicts with text editing.
 *
 * Shortcuts:
 * - Ctrl+Shift+N: Add new patient
 * - Ctrl+K or Ctrl+Shift+F: Focus search bar
 * - Ctrl+Shift+C: Collapse/expand all patients
 * - Ctrl+P: Print/export (overrides browser print)
 * - `/`: Focus patient search (when focus is not in an input, textarea, or contenteditable)
 * - `n` / `N`: Open new patient (same guard as `/`)
 * - Cmd/Ctrl + `]`: Next patient (when not editing a field)
 * - Cmd/Ctrl + `[`: Previous patient (when not editing a field)
 */
export function useKeyboardShortcuts(actions: KeyboardShortcutActions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isEditing =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      const isModifier = event.ctrlKey || event.metaKey;

      if (!isModifier && !isEditing) {
        if (event.key === "/" && actions.onSlashFocusSearch) {
          event.preventDefault();
          actions.onSlashFocusSearch();
          return;
        }
        if ((event.key === "n" || event.key === "N") && actions.onKeyNAddPatient) {
          event.preventDefault();
          actions.onKeyNAddPatient();
          return;
        }
      }

      if (!isModifier) return;

      // Ctrl+K: Focus search (works even in inputs)
      if (event.key === "k") {
        event.preventDefault();
        actions.onSearch?.();
        return;
      }

      // Skip other shortcuts when editing
      if (isEditing) return;

      if (event.code === "BracketRight" && actions.onNextPatient) {
        event.preventDefault();
        actions.onNextPatient();
        return;
      }
      if (event.code === "BracketLeft" && actions.onPrevPatient) {
        event.preventDefault();
        actions.onPrevPatient();
        return;
      }

      // Ctrl+Shift+N: Add new patient
      if (event.shiftKey && event.key === "N") {
        event.preventDefault();
        actions.onAddPatient?.();
        return;
      }

      // Ctrl+Shift+F: Focus search (alternative)
      if (event.shiftKey && event.key === "F") {
        event.preventDefault();
        actions.onSearch?.();
        return;
      }

      // Ctrl+Shift+C: Collapse all
      if (event.shiftKey && event.key === "C") {
        event.preventDefault();
        actions.onCollapseAll?.();
        return;
      }

      // Ctrl+P: Print/export
      if (event.key === "p") {
        event.preventDefault();
        actions.onPrint?.();
        return;
      }
    },
    [actions]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
