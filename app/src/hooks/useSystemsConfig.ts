/**
 * Hook for managing customizable systems review sections
 * Persists configuration to localStorage
 */

import { useState, useEffect, useCallback } from 'react';
import { safeLocalStorage } from '@/utils/safeStorage';

export interface SystemConfig {
  key: string;
  label: string;
  shortLabel: string;
  icon: string;
  enabled: boolean;
  sortOrder: number;
  isCustom: boolean;
}

// Default systems that ship with the app
export const DEFAULT_SYSTEMS: SystemConfig[] = [
  { key: 'neuro', label: 'Neuro', shortLabel: 'Neuro', icon: '🧠', enabled: true, sortOrder: 0, isCustom: false },
  { key: 'cv', label: 'Cardiovascular', shortLabel: 'CV', icon: '❤️', enabled: true, sortOrder: 1, isCustom: false },
  { key: 'resp', label: 'Respiratory', shortLabel: 'Resp', icon: '🫁', enabled: true, sortOrder: 2, isCustom: false },
  { key: 'renalGU', label: 'Renal/GU', shortLabel: 'Renal/GU', icon: '💧', enabled: true, sortOrder: 3, isCustom: false },
  { key: 'gi', label: 'GI/Nutrition', shortLabel: 'GI', icon: '🍽️', enabled: true, sortOrder: 4, isCustom: false },
  { key: 'endo', label: 'Endocrine', shortLabel: 'Endo', icon: '⚡', enabled: true, sortOrder: 5, isCustom: false },
  { key: 'heme', label: 'Hematology', shortLabel: 'Heme', icon: '🩸', enabled: true, sortOrder: 6, isCustom: false },
  { key: 'infectious', label: 'Infectious', shortLabel: 'ID', icon: '🦠', enabled: true, sortOrder: 7, isCustom: false },
  { key: 'skinLines', label: 'Skin/Lines', shortLabel: 'Skin/Lines', icon: '🩹', enabled: true, sortOrder: 8, isCustom: false },
  { key: 'dispo', label: 'Disposition', shortLabel: 'Dispo', icon: '🏠', enabled: true, sortOrder: 9, isCustom: false },
];

const STORAGE_KEY = 'handoff-systems-config';

export const useSystemsConfig = () => {
  const [systems, setSystems] = useState<SystemConfig[]>(() => {
    try {
      const saved = safeLocalStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Merge with defaults to ensure new default systems are added
        const savedKeys = new Set(parsed.map((s: SystemConfig) => s.key));
        const merged = [...parsed];
        DEFAULT_SYSTEMS.forEach((defaultSys) => {
          if (!savedKeys.has(defaultSys.key)) {
            merged.push(defaultSys);
          }
        });
        return merged.sort((a: SystemConfig, b: SystemConfig) => a.sortOrder - b.sortOrder);
      }
    } catch (e) {
      console.error('Failed to load systems config:', e);
    }
    return DEFAULT_SYSTEMS;
  });

  // Persist to localStorage when systems change
  useEffect(() => {
    safeLocalStorage.setItem(STORAGE_KEY, JSON.stringify(systems));
  }, [systems]);

  // Get only enabled systems, sorted
  const enabledSystems = systems
    .filter((s) => s.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // Get labels map for compatibility with existing code
  const systemLabels = systems.reduce((acc, s) => {
    if (s.enabled) acc[s.key] = s.label;
    return acc;
  }, {} as Record<string, string>);

  const systemLabelsShort = systems.reduce((acc, s) => {
    if (s.enabled) acc[s.key] = s.shortLabel;
    return acc;
  }, {} as Record<string, string>);

  const systemIcons = systems.reduce((acc, s) => {
    if (s.enabled) acc[s.key] = s.icon;
    return acc;
  }, {} as Record<string, string>);

  // Toggle a system on/off
  const toggleSystem = useCallback((key: string) => {
    setSystems((prev) =>
      prev.map((s) => (s.key === key ? { ...s, enabled: !s.enabled } : s))
    );
  }, []);

  // Update a system's properties
  const updateSystem = useCallback((key: string, updates: Partial<SystemConfig>) => {
    setSystems((prev) =>
      prev.map((s) => (s.key === key ? { ...s, ...updates } : s))
    );
  }, []);

  // Add a new custom system
  const addSystem = useCallback((config: Omit<SystemConfig, 'sortOrder' | 'isCustom'>) => {
    setSystems((prev) => {
      // Generate a unique key if not provided or if it conflicts
      let key = config.key || config.label.toLowerCase().replace(/[^a-z0-9]/g, '');
      const existingKeys = new Set(prev.map((s) => s.key));
      let counter = 1;
      while (existingKeys.has(key)) {
        key = `${config.key || config.label.toLowerCase().replace(/[^a-z0-9]/g, '')}_${counter}`;
        counter++;
      }

      const newSystem: SystemConfig = {
        ...config,
        key,
        sortOrder: prev.length,
        isCustom: true,
      };
      return [...prev, newSystem];
    });
  }, []);

  // Remove a custom system
  const removeSystem = useCallback((key: string) => {
    setSystems((prev) => prev.filter((s) => s.key !== key || !s.isCustom));
  }, []);

  // Reorder systems
  const reorderSystems = useCallback((fromIndex: number, toIndex: number) => {
    setSystems((prev) => {
      const result = [...prev];
      const [removed] = result.splice(fromIndex, 1);
      result.splice(toIndex, 0, removed);
      return result.map((s, i) => ({ ...s, sortOrder: i }));
    });
  }, []);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    setSystems(DEFAULT_SYSTEMS);
  }, []);

  return {
    systems,
    enabledSystems,
    systemLabels,
    systemLabelsShort,
    systemIcons,
    toggleSystem,
    updateSystem,
    addSystem,
    removeSystem,
    reorderSystems,
    resetToDefaults,
  };
};
