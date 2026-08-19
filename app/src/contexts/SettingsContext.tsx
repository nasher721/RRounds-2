import * as React from 'react';
import type { User } from '@supabase/supabase-js';
import { STORAGE_KEYS, DEFAULT_CONFIG, DEFAULT_SECTION_VISIBILITY, DEFAULT_PATIENT_INFO_TOOLBAR_BUTTONS, normalizeGlobalFontSizeToPx, type SectionVisibility, type Theme } from '@/constants/config';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useAuth } from '@/hooks/useAuth';
import { getRoleById, type SpecialtyFeature } from '@/constants/specialties';
import { safeLocalStorage } from '@/utils/safeStorage';

export type SortBy = 'number' | 'room' | 'name';

interface SettingsContextType {
  globalFontSize: number;
  setGlobalFontSize: (size: number) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;

  // Todos visibility
  todosAlwaysVisible: boolean;
  setTodosAlwaysVisible: (visible: boolean) => void;

  // Sort preferences
  sortBy: SortBy;
  setSortBy: (sort: SortBy) => void;

  // Lab Fishbone toggle
  showLabFishbones: boolean;
  setShowLabFishbones: (show: boolean) => void;

  // Section visibility
  sectionVisibility: SectionVisibility;
  setSectionVisibility: (visibility: SectionVisibility) => void;
  resetSectionVisibility: () => void;

  // Specialty / medical role
  selectedSpecialty: string | null;
  setSelectedSpecialty: (specialtyId: string | null) => void;
  isFeatureEnabledForRole: (feature: SpecialtyFeature) => boolean;

  // Editor toolbar (affects all text boxes)
  editorToolbarMode: 'minimal' | 'full' | 'custom';
  setEditorToolbarMode: (mode: 'minimal' | 'full' | 'custom') => void;
  editorToolbarButtons: string[];
  setEditorToolbarButtons: (buttons: string[]) => void;

  // Patient info toolbar (affects patient info quick-insert in text boxes)
  patientInfoToolbarMode: 'minimal' | 'full' | 'custom';
  setPatientInfoToolbarMode: (mode: 'minimal' | 'full' | 'custom') => void;
  patientInfoToolbarButtons: string[];
  setPatientInfoToolbarButtons: (buttons: string[]) => void;

  // Sync status
  isSyncingSettings: boolean;
}

export const DEFAULT_EDITOR_TOOLBAR_BUTTONS = [
  'undo', 'redo', 'bold', 'italic', 'underline', 'bulletList', 'numberedList',
  'heading', 'indent', 'alignLeft', 'alignCenter', 'alignRight', 'link', 'find', 'fontSize',
] as const;

interface AppPreferences {
  globalFontSize: number;
  todosAlwaysVisible: boolean;
  sortBy: SortBy;
  showLabFishbones: boolean;
  selectedSpecialty: string | null;
  editorToolbarMode?: 'minimal' | 'full' | 'custom';
  editorToolbarButtons?: string[];
  patientInfoToolbarMode?: 'minimal' | 'full' | 'custom';
  patientInfoToolbarButtons?: string[];
}

type LegacyClinicalAIFields = {
  aiCredentials?: unknown;
  aiProvider?: unknown;
  aiModel?: unknown;
  aiFeatureModels?: unknown;
};

const withoutLegacyClinicalAIFields = (
  preferences: AppPreferences & LegacyClinicalAIFields,
): AppPreferences => {
  const sanitized = { ...preferences } as AppPreferences & LegacyClinicalAIFields;
  delete sanitized.aiCredentials;
  delete sanitized.aiProvider;
  delete sanitized.aiModel;
  delete sanitized.aiFeatureModels;
  return sanitized;
};

const SettingsContext = React.createContext<SettingsContextType | undefined>(undefined);

interface SettingsProviderProps {
  children: React.ReactNode;
}

const getPreferenceStorageKey = (key: string, ownerId: string | null): string => (
  ownerId ? `${key}:user:${ownerId}` : key
);

interface SettingsOwnerProviderProps extends SettingsProviderProps {
  user: User | null;
}

const SettingsOwnerProvider = ({ children, user }: SettingsOwnerProviderProps) => {
  const ownerId = user?.id ?? null;
  const [isSyncingSettings, setIsSyncingSettings] = React.useState(false);
  const syncTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const syncGenerationRef = React.useRef(0);
  const initialSyncDone = React.useRef(false);
  const isActiveRef = React.useRef(true);

  const [globalFontSize, setGlobalFontSizeState] = React.useState(() => {
    const storageKey = getPreferenceStorageKey(STORAGE_KEYS.GLOBAL_FONT_SIZE, ownerId);
    const saved = safeLocalStorage.getItem(storageKey);
    if (saved) {
      const parsed = parseInt(saved, 10);
      // Migrate from old default (14) to new smaller default
      if (parsed === 14) {
        safeLocalStorage.setItem(storageKey, String(DEFAULT_CONFIG.GLOBAL_FONT_SIZE));
        return DEFAULT_CONFIG.GLOBAL_FONT_SIZE;
      }
      const normalized = normalizeGlobalFontSizeToPx(parsed);
      if (normalized !== parsed) {
        safeLocalStorage.setItem(storageKey, String(normalized));
      }
      return normalized;
    }
    return DEFAULT_CONFIG.GLOBAL_FONT_SIZE;
  });

  const [todosAlwaysVisible, setTodosAlwaysVisibleState] = React.useState(() => {
    return safeLocalStorage.getItem(
      getPreferenceStorageKey(STORAGE_KEYS.TODOS_ALWAYS_VISIBLE, ownerId),
    ) === 'true';
  });

  const [sortBy, setSortByState] = React.useState<SortBy>(() => {
    const saved = safeLocalStorage.getItem(
      getPreferenceStorageKey(STORAGE_KEYS.PATIENT_SORT_BY, ownerId),
    );
    return (saved as SortBy) || DEFAULT_CONFIG.DEFAULT_SORT_BY;
  });

  const [theme, setThemeState] = React.useState<Theme>(() => {
    const saved = safeLocalStorage.getItem(STORAGE_KEYS.THEME) as Theme | null;
    return saved || DEFAULT_CONFIG.DEFAULT_THEME;
  });

  const [showLabFishbones, setShowLabFishbonesState] = React.useState(() => {
    const saved = safeLocalStorage.getItem(
      getPreferenceStorageKey(STORAGE_KEYS.SHOW_LAB_FISHBONES, ownerId),
    );
    return saved !== null ? saved === 'true' : true;
  });

  const [selectedSpecialty, setSelectedSpecialtyState] = React.useState<string | null>(() => {
    return safeLocalStorage.getItem(
      getPreferenceStorageKey(STORAGE_KEYS.SELECTED_SPECIALTY, ownerId),
    ) || null;
  });

  React.useLayoutEffect(() => {
    // Remove browser-side provider settings written by older builds. Clinical
    // AI policy is organization-managed and exists only on the Edge runtime.
    for (const key of [
      STORAGE_KEYS.AI_CREDENTIALS,
      STORAGE_KEYS.AI_PROVIDER,
      STORAGE_KEYS.AI_MODEL,
      STORAGE_KEYS.AI_FEATURE_MODELS,
    ]) {
      safeLocalStorage.removeItem(key);
      safeLocalStorage.removeItem(getPreferenceStorageKey(key, ownerId));
    }
  }, [ownerId]);

  const [sectionVisibility, setSectionVisibilityState] = React.useState<SectionVisibility>(() => {
    const saved = safeLocalStorage.getItem(
      getPreferenceStorageKey(STORAGE_KEYS.SECTION_VISIBILITY, ownerId),
    );
    if (saved) {
      try {
        return { ...DEFAULT_SECTION_VISIBILITY, ...JSON.parse(saved) };
      } catch {
        return DEFAULT_SECTION_VISIBILITY;
      }
    }
    return DEFAULT_SECTION_VISIBILITY;
  });

  const [editorToolbarMode, setEditorToolbarModeState] = React.useState<'minimal' | 'full' | 'custom'>(() => {
    const saved = safeLocalStorage.getItem(
      getPreferenceStorageKey(STORAGE_KEYS.EDITOR_TOOLBAR_MODE, ownerId),
    );
    return (saved === 'minimal' || saved === 'full' || saved === 'custom') ? saved : 'minimal';
  });

  const [editorToolbarButtons, setEditorToolbarButtonsState] = React.useState<string[]>(() => {
    const saved = safeLocalStorage.getItem(
      getPreferenceStorageKey(STORAGE_KEYS.EDITOR_TOOLBAR_BUTTONS, ownerId),
    );
    if (!saved) return [...DEFAULT_EDITOR_TOOLBAR_BUTTONS];
    try {
      const parsed = JSON.parse(saved) as string[];
      return Array.isArray(parsed) ? parsed : [...DEFAULT_EDITOR_TOOLBAR_BUTTONS];
    } catch {
      return [...DEFAULT_EDITOR_TOOLBAR_BUTTONS];
    }
  });

  const [patientInfoToolbarMode, setPatientInfoToolbarModeState] = React.useState<'minimal' | 'full' | 'custom'>(() => {
    const saved = safeLocalStorage.getItem(
      getPreferenceStorageKey(STORAGE_KEYS.PATIENT_INFO_TOOLBAR_MODE, ownerId),
    );
    return (saved === 'minimal' || saved === 'full' || saved === 'custom') ? saved : 'minimal';
  });

  const [patientInfoToolbarButtons, setPatientInfoToolbarButtonsState] = React.useState<string[]>(() => {
    const saved = safeLocalStorage.getItem(
      getPreferenceStorageKey(STORAGE_KEYS.PATIENT_INFO_TOOLBAR_BUTTONS, ownerId),
    );
    if (!saved) return [...DEFAULT_PATIENT_INFO_TOOLBAR_BUTTONS];
    try {
      const parsed = JSON.parse(saved) as string[];
      return Array.isArray(parsed) ? parsed : [...DEFAULT_PATIENT_INFO_TOOLBAR_BUTTONS];
    } catch {
      return [...DEFAULT_PATIENT_INFO_TOOLBAR_BUTTONS];
    }
  });

  const buildAppPreferences = React.useCallback((): AppPreferences => ({
    globalFontSize,
    todosAlwaysVisible,
    sortBy,
    showLabFishbones,
    selectedSpecialty,
    editorToolbarMode,
    editorToolbarButtons,
    patientInfoToolbarMode,
    patientInfoToolbarButtons,
  }), [globalFontSize, todosAlwaysVisible, sortBy, showLabFishbones, selectedSpecialty, editorToolbarMode, editorToolbarButtons, patientInfoToolbarMode, patientInfoToolbarButtons]);

  const buildAppPreferencesRef = React.useRef(buildAppPreferences);
  buildAppPreferencesRef.current = buildAppPreferences;

  const preferenceStorageKey = React.useCallback(
    (key: string) => getPreferenceStorageKey(key, ownerId),
    [ownerId],
  );

  const applyAppPreferences = React.useCallback((prefs: Partial<AppPreferences>) => {
    if (prefs.globalFontSize !== undefined) {
      const normalized = normalizeGlobalFontSizeToPx(prefs.globalFontSize);
      setGlobalFontSizeState(normalized);
      safeLocalStorage.setItem(preferenceStorageKey(STORAGE_KEYS.GLOBAL_FONT_SIZE), String(normalized));
    }
    if (prefs.todosAlwaysVisible !== undefined) {
      setTodosAlwaysVisibleState(prefs.todosAlwaysVisible);
      safeLocalStorage.setItem(
        preferenceStorageKey(STORAGE_KEYS.TODOS_ALWAYS_VISIBLE),
        String(prefs.todosAlwaysVisible),
      );
    }
    if (prefs.sortBy !== undefined) {
      setSortByState(prefs.sortBy);
      safeLocalStorage.setItem(preferenceStorageKey(STORAGE_KEYS.PATIENT_SORT_BY), prefs.sortBy);
    }
    if (prefs.showLabFishbones !== undefined) {
      setShowLabFishbonesState(prefs.showLabFishbones);
      safeLocalStorage.setItem(
        preferenceStorageKey(STORAGE_KEYS.SHOW_LAB_FISHBONES),
        String(prefs.showLabFishbones),
      );
    }
    if (prefs.selectedSpecialty !== undefined) {
      setSelectedSpecialtyState(prefs.selectedSpecialty);
      const storageKey = preferenceStorageKey(STORAGE_KEYS.SELECTED_SPECIALTY);
      if (prefs.selectedSpecialty) {
        safeLocalStorage.setItem(storageKey, prefs.selectedSpecialty);
      } else {
        safeLocalStorage.removeItem(storageKey);
      }
    }

    if (prefs.editorToolbarMode !== undefined) {
      setEditorToolbarModeState(prefs.editorToolbarMode);
      safeLocalStorage.setItem(
        preferenceStorageKey(STORAGE_KEYS.EDITOR_TOOLBAR_MODE),
        prefs.editorToolbarMode,
      );
    }
    if (prefs.editorToolbarButtons !== undefined) {
      setEditorToolbarButtonsState(prefs.editorToolbarButtons);
      safeLocalStorage.setItem(
        preferenceStorageKey(STORAGE_KEYS.EDITOR_TOOLBAR_BUTTONS),
        JSON.stringify(prefs.editorToolbarButtons),
      );
    }
    if (prefs.patientInfoToolbarMode !== undefined) {
      setPatientInfoToolbarModeState(prefs.patientInfoToolbarMode);
      safeLocalStorage.setItem(
        preferenceStorageKey(STORAGE_KEYS.PATIENT_INFO_TOOLBAR_MODE),
        prefs.patientInfoToolbarMode,
      );
    }
    if (prefs.patientInfoToolbarButtons !== undefined) {
      setPatientInfoToolbarButtonsState(prefs.patientInfoToolbarButtons);
      safeLocalStorage.setItem(
        preferenceStorageKey(STORAGE_KEYS.PATIENT_INFO_TOOLBAR_BUTTONS),
        JSON.stringify(prefs.patientInfoToolbarButtons),
      );
    }
  }, [preferenceStorageKey]);

  // Sync settings to database with debounce
  const syncSettingsToDb = React.useCallback(async (visibility: SectionVisibility, appPreferences: AppPreferences) => {
    if (!user || !isActiveRef.current) return;

    try {
      const appPreferencesJson = JSON.parse(JSON.stringify(appPreferences)) as Json;
      const sectionVisibilityJson = JSON.parse(JSON.stringify(visibility)) as Json;
      const { error } = await supabase
        .from('user_settings')
        .upsert(
          {
            user_id: user.id,
            section_visibility: sectionVisibilityJson,
            app_preferences: appPreferencesJson,
          },
          { onConflict: 'user_id' }
        );
      if (!isActiveRef.current) return;
      if (error) throw error;
    } catch (err) {
      if (!isActiveRef.current) return;
      console.error('Failed to sync settings:', err);
    }
  }, [user]);

  // Load settings from database on login
  React.useEffect(() => {
    let cancelled = false;
    const isCurrentOwner = () => !cancelled && isActiveRef.current;

    const loadFromDb = async () => {
      if (!user || initialSyncDone.current) return;

      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('section_visibility, app_preferences')
          .eq('user_id', user.id)
          .maybeSingle();
        if (!isCurrentOwner()) return;
        if (error) throw error;

        if (data?.section_visibility) {
          const dbVisibility = data.section_visibility as unknown as SectionVisibility;
          setSectionVisibilityState(dbVisibility);
          safeLocalStorage.setItem(
            preferenceStorageKey(STORAGE_KEYS.SECTION_VISIBILITY),
            JSON.stringify(dbVisibility),
          );
        }

        if (data?.app_preferences) {
          const rawDbPreferences = data.app_preferences as unknown as AppPreferences & LegacyClinicalAIFields;
          const dbPreferences = withoutLegacyClinicalAIFields(rawDbPreferences);
          applyAppPreferences(dbPreferences);

          const hasLegacyClinicalAIFields = [
            'aiCredentials',
            'aiProvider',
            'aiModel',
            'aiFeatureModels',
          ].some((key) => Object.prototype.hasOwnProperty.call(rawDbPreferences, key));
          if (hasLegacyClinicalAIFields) {
            const { error: scrubError } = await supabase
              .from('user_settings')
              .upsert({
                user_id: user.id,
                section_visibility: (data.section_visibility ?? DEFAULT_SECTION_VISIBILITY) as Json,
                app_preferences: dbPreferences as unknown as Json,
              }, { onConflict: 'user_id' });
            if (!isCurrentOwner()) return;
            if (scrubError) throw scrubError;
          }
        }

        if (!data?.section_visibility || !data?.app_preferences) {
          const storedVisibility = safeLocalStorage.getItem(
            preferenceStorageKey(STORAGE_KEYS.SECTION_VISIBILITY),
          );
          let localVisibility: SectionVisibility = DEFAULT_SECTION_VISIBILITY;
          if (storedVisibility) {
            try {
              localVisibility = JSON.parse(storedVisibility) as SectionVisibility;
            } catch {
              localVisibility = DEFAULT_SECTION_VISIBILITY;
            }
          }

          const { error: initializeError } = await supabase
            .from('user_settings')
            .upsert({
              user_id: user.id,
              section_visibility: localVisibility as unknown as Json,
              app_preferences: buildAppPreferencesRef.current() as unknown as Json,
            }, { onConflict: 'user_id' });
          if (!isCurrentOwner()) return;
          if (initializeError) throw initializeError;
        }

        if (!isCurrentOwner()) return;
        initialSyncDone.current = true;
      } catch (err) {
        if (!isCurrentOwner()) return;
        console.error('Failed to load settings from DB:', err);
      }
    };

    void loadFromDb();
    return () => {
      cancelled = true;
    };
  }, [user, applyAppPreferences, preferenceStorageKey]);

  // Reset sync flag on logout
  React.useEffect(() => {
    if (!user) {
      initialSyncDone.current = false;
    }
  }, [user]);

  // Cleanup timeout on unmount to prevent memory leaks
  React.useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = null;
      }
    };
  }, []);

  // Persist font size
  React.useEffect(() => {
    safeLocalStorage.setItem(preferenceStorageKey(STORAGE_KEYS.GLOBAL_FONT_SIZE), String(globalFontSize));
  }, [globalFontSize, preferenceStorageKey]);

  // Persist todos visibility
  React.useEffect(() => {
    safeLocalStorage.setItem(
      preferenceStorageKey(STORAGE_KEYS.TODOS_ALWAYS_VISIBLE),
      String(todosAlwaysVisible),
    );
  }, [todosAlwaysVisible, preferenceStorageKey]);

  // Persist sort preference
  React.useEffect(() => {
    safeLocalStorage.setItem(preferenceStorageKey(STORAGE_KEYS.PATIENT_SORT_BY), sortBy);
  }, [sortBy, preferenceStorageKey]);

  // Persist lab fishbones preference
  React.useEffect(() => {
    safeLocalStorage.setItem(
      preferenceStorageKey(STORAGE_KEYS.SHOW_LAB_FISHBONES),
      String(showLabFishbones),
    );
  }, [showLabFishbones, preferenceStorageKey]);

  const setEditorToolbarMode = React.useCallback((mode: 'minimal' | 'full' | 'custom') => {
    setEditorToolbarModeState(mode);
    safeLocalStorage.setItem(preferenceStorageKey(STORAGE_KEYS.EDITOR_TOOLBAR_MODE), mode);
  }, [preferenceStorageKey]);

  const setEditorToolbarButtons = React.useCallback((buttons: string[]) => {
    setEditorToolbarButtonsState(buttons);
    safeLocalStorage.setItem(
      preferenceStorageKey(STORAGE_KEYS.EDITOR_TOOLBAR_BUTTONS),
      JSON.stringify(buttons),
    );
  }, [preferenceStorageKey]);

  const setPatientInfoToolbarMode = React.useCallback((mode: 'minimal' | 'full' | 'custom') => {
    setPatientInfoToolbarModeState(mode);
    safeLocalStorage.setItem(preferenceStorageKey(STORAGE_KEYS.PATIENT_INFO_TOOLBAR_MODE), mode);
  }, [preferenceStorageKey]);

  const setPatientInfoToolbarButtons = React.useCallback((buttons: string[]) => {
    setPatientInfoToolbarButtonsState(buttons);
    safeLocalStorage.setItem(
      preferenceStorageKey(STORAGE_KEYS.PATIENT_INFO_TOOLBAR_BUTTONS),
      JSON.stringify(buttons),
    );
  }, [preferenceStorageKey]);

  // Persist section visibility to local storage and sync to DB with debounce
  React.useEffect(() => {
    safeLocalStorage.setItem(
      preferenceStorageKey(STORAGE_KEYS.SECTION_VISIBILITY),
      JSON.stringify(sectionVisibility),
    );

    if (!user || !initialSyncDone.current) return;

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    const generation = ++syncGenerationRef.current;
    setIsSyncingSettings(true);
    const timeout = setTimeout(() => {
      syncTimeoutRef.current = null;
      void syncSettingsToDb(sectionVisibility, buildAppPreferences()).finally(() => {
        if (isActiveRef.current && syncGenerationRef.current === generation) {
          setIsSyncingSettings(false);
        }
      });
    }, 1000);
    syncTimeoutRef.current = timeout;

    return () => {
      clearTimeout(timeout);
      if (syncTimeoutRef.current === timeout) {
        syncTimeoutRef.current = null;
      }
    };
  }, [sectionVisibility, user, buildAppPreferences, preferenceStorageKey, syncSettingsToDb]);

  const setGlobalFontSize = React.useCallback((size: number) => {
    setGlobalFontSizeState(normalizeGlobalFontSizeToPx(size));
  }, []);

  const setTodosAlwaysVisible = React.useCallback((visible: boolean) => {
    setTodosAlwaysVisibleState(visible);
  }, []);

  const setSortBy = React.useCallback((sort: SortBy) => {
    setSortByState(sort);
  }, []);

  const setShowLabFishbones = React.useCallback((show: boolean) => {
    setShowLabFishbonesState(show);
  }, []);

  const setTheme = React.useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    safeLocalStorage.setItem(STORAGE_KEYS.THEME, newTheme);

    const root = document.documentElement;
    root.classList.remove('light', 'dark');

    if (newTheme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(newTheme);
    }
  }, []);

  const setSelectedSpecialty = React.useCallback((specialtyId: string | null) => {
    setSelectedSpecialtyState(specialtyId);
    const storageKey = preferenceStorageKey(STORAGE_KEYS.SELECTED_SPECIALTY);
    if (specialtyId) {
      safeLocalStorage.setItem(storageKey, specialtyId);
    } else {
      safeLocalStorage.removeItem(storageKey);
    }
  }, [preferenceStorageKey]);

  const isFeatureEnabledForRole = React.useCallback((feature: SpecialtyFeature): boolean => {
    if (!selectedSpecialty) return true; // No role selected = all features enabled
    const role = getRoleById(selectedSpecialty);
    if (!role) return true;
    return role.enabledFeatures.includes(feature);
  }, [selectedSpecialty]);

  const setSectionVisibility = React.useCallback((visibility: SectionVisibility) => {
    setSectionVisibilityState(visibility);
  }, []);

  const resetSectionVisibility = React.useCallback(() => {
    setSectionVisibilityState(DEFAULT_SECTION_VISIBILITY);
  }, []);

  const value: SettingsContextType = React.useMemo(() => ({
    globalFontSize,
    setGlobalFontSize,
    theme,
    setTheme,
    todosAlwaysVisible,
    setTodosAlwaysVisible,
    sortBy,
    setSortBy,
    showLabFishbones,
    setShowLabFishbones,
    sectionVisibility,
    setSectionVisibility,
    resetSectionVisibility,
    selectedSpecialty,
    setSelectedSpecialty,
    isFeatureEnabledForRole,
    editorToolbarMode,
    setEditorToolbarMode,
    editorToolbarButtons,
    setEditorToolbarButtons,
    patientInfoToolbarMode,
    setPatientInfoToolbarMode,
    patientInfoToolbarButtons,
    setPatientInfoToolbarButtons,
    isSyncingSettings,
  }), [
    globalFontSize,
    theme,
    todosAlwaysVisible,
    sortBy,
    showLabFishbones,
    sectionVisibility,
    selectedSpecialty,
    editorToolbarMode,
    editorToolbarButtons,
    patientInfoToolbarMode,
    patientInfoToolbarButtons,
    isSyncingSettings,
    setGlobalFontSize,
    setTheme,
    setTodosAlwaysVisible,
    setSortBy,
    setShowLabFishbones,
    setSelectedSpecialty,
    isFeatureEnabledForRole,
    setEditorToolbarMode,
    setEditorToolbarButtons,
    setPatientInfoToolbarMode,
    setPatientInfoToolbarButtons,
    setSectionVisibility,
    resetSectionVisibility,
  ]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const SettingsProvider = ({ children }: SettingsProviderProps) => {
  const { user } = useAuth();
  const ownerId = user?.id ?? 'anonymous';

  return (
    <SettingsOwnerProvider key={ownerId} user={user}>
      {children}
    </SettingsOwnerProvider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = React.useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
