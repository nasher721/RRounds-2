/**
 * ChangeTrackingContext
 * Global context for change tracking settings
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";
import type { ChangeTrackingState, ChangeTrackingStyles, DaySettings } from "@/types/changeTracking";
import { DEFAULT_TRACKING_COLOR, DEFAULT_STYLES } from "@/types/changeTracking";
import { safeLocalStorage } from "@/utils/safeStorage";

interface ChangeTrackingContextValue {
  enabled: boolean;
  color: string;
  styles: ChangeTrackingStyles;
  toggleEnabled: () => void;
  setColor: (color: string) => void;
  toggleStyle: (style: keyof ChangeTrackingStyles) => void;
  wrapWithMarkup: (text: string) => string;
  wrapHtmlWithMarkup: (html: string) => string;
}

const ChangeTrackingContext = createContext<ChangeTrackingContextValue | null>(null);

const STORAGE_KEY = "changeTrackingSettings";

const escapeMarkupText = (text: string): string => text
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

const getTodayDate = () => new Date().toISOString().split("T")[0];

const loadDaySettings = (date: string): DaySettings | null => {
  try {
    const stored = safeLocalStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const allSettings: Record<string, DaySettings> = JSON.parse(stored);
    return allSettings[date] || null;
  } catch {
    return null;
  }
};

const saveDaySettings = (settings: DaySettings) => {
  try {
    const stored = safeLocalStorage.getItem(STORAGE_KEY);
    const allSettings: Record<string, DaySettings> = stored ? JSON.parse(stored) : {};
    allSettings[settings.date] = settings;
    // Keep only last 30 days
    const dates = Object.keys(allSettings).sort().reverse();
    const trimmed: Record<string, DaySettings> = {};
    dates.slice(0, 30).forEach(d => { trimmed[d] = allSettings[d]; });
    safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.error("Failed to save change tracking settings:", e);
  }
};

export const ChangeTrackingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const today = getTodayDate();
  
  const [state, setState] = useState<ChangeTrackingState>(() => {
    const saved = loadDaySettings(today);
    if (saved) {
      return {
        enabled: saved.enabled,
        color: saved.color,
        styles: saved.styles ?? DEFAULT_STYLES,
      };
    }
    return {
      enabled: false,
      color: DEFAULT_TRACKING_COLOR,
      styles: DEFAULT_STYLES,
    };
  });

  // Save whenever state changes
  useEffect(() => {
    saveDaySettings({
      date: today,
      enabled: state.enabled,
      color: state.color,
      styles: state.styles,
    });
  }, [state, today]);

  const toggleEnabled = useCallback(() => {
    setState(prev => ({ ...prev, enabled: !prev.enabled }));
  }, []);

  const setColor = useCallback((color: string) => {
    setState(prev => ({ ...prev, color }));
  }, []);

  const toggleStyle = useCallback((style: keyof ChangeTrackingStyles) => {
    setState(prev => ({
      ...prev,
      styles: { ...prev.styles, [style]: !prev.styles[style] },
    }));
  }, []);

  // Create marked span HTML
  const wrapWithMarkup = useCallback((text: string): string => {
    if (!state.enabled || !text) return text;
    
    const activeStyles: string[] = [];
    const styleStr: string[] = [];
    
    if (state.styles.textColor) {
      activeStyles.push("color");
      styleStr.push(`color: ${state.color}`);
    }
    if (state.styles.backgroundColor) {
      activeStyles.push("background");
      styleStr.push(`background-color: ${state.color}33`);
    }
    if (state.styles.italic) {
      activeStyles.push("italic");
      styleStr.push("font-style: italic");
    }
    
    if (activeStyles.length === 0) return text;
    
    return `<span data-marked="true" data-date="${today}" data-styles="${activeStyles.join(",")}" style="${styleStr.join("; ")}">${escapeMarkupText(text)}</span>`;
  }, [state, today]);

  // Preserve imported/generated formatting while marking each newly inserted
  // text node. Plain-text insertions should continue using wrapWithMarkup.
  const wrapHtmlWithMarkup = useCallback((html: string): string => {
    if (!state.enabled || !html || typeof document === "undefined") return html;

    const container = document.createElement("div");
    container.innerHTML = html;
    // Use the numeric constant as well as the named DOM constant is not
    // exposed as a global in every browser-like test environment.
    const walker = document.createTreeWalker(container, 4 /* SHOW_TEXT */);
    const textNodes: Text[] = [];
    let node = walker.nextNode();
    while (node) {
      textNodes.push(node as Text);
      node = walker.nextNode();
    }

    textNodes.forEach((textNode) => {
      if (!textNode.nodeValue?.trim() || textNode.parentElement?.closest('[data-marked="true"]')) return;
      const replacement = document.createElement("span");
      replacement.innerHTML = wrapWithMarkup(textNode.nodeValue);
      textNode.replaceWith(...Array.from(replacement.childNodes));
    });

    return container.innerHTML;
  }, [state.enabled, wrapWithMarkup]);

  const value = useMemo(() => ({
    enabled: state.enabled,
    color: state.color,
    styles: state.styles,
    toggleEnabled,
    setColor,
    toggleStyle,
    wrapWithMarkup,
    wrapHtmlWithMarkup,
  }), [state, toggleEnabled, setColor, toggleStyle, wrapWithMarkup, wrapHtmlWithMarkup]);

  return (
    <ChangeTrackingContext.Provider value={value}>
      {children}
    </ChangeTrackingContext.Provider>
  );
};

export const useChangeTracking = () => {
  const context = useContext(ChangeTrackingContext);
  if (!context) {
    throw new Error("useChangeTracking must be used within ChangeTrackingProvider");
  }
  return context;
};
