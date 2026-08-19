/**
 * useLayoutDesigner Hook
 * Comprehensive state management for the layout designer with persistence and undo/redo
 */

import * as React from 'react';
import { useToast } from '@/hooks/use-toast';
import type {
  LayoutConfig,
  LayoutSection,
  LayoutViewType,
  GlobalLayoutStyles,
  PageSettings,
  CardLayoutConfig,
  GridLayoutConfig,
  NewspaperLayoutConfig,
  TimelineLayoutConfig,
  MagazineLayoutConfig,
  SavedLayout,
} from '@/types/layoutDesigner';
import { LAYOUT_TEMPLATES, getDefaultLayout, createCustomLayout } from './defaultLayouts';
import {
  createScopedPrintStorage,
  quarantineLegacyPrintPreferences,
} from '@/lib/print/preferences';
import type { StorageLike } from '@/utils/safeStorage';

// Storage keys
const STORAGE_KEYS = {
  SAVED_LAYOUTS: 'layoutDesigner_savedLayouts',
  CURRENT_LAYOUT_ID: 'layoutDesigner_currentLayoutId',
  RECENT_LAYOUTS: 'layoutDesigner_recentLayouts',
} as const;

// Maximum undo/redo stack size
const MAX_HISTORY_SIZE = 50;
const MAX_RECENT_LAYOUTS = 5;

interface UseLayoutDesignerOptions {
  initialLayoutId?: string;
  autoSave?: boolean;
  autoSaveDelay?: number;
  storageOwnerId?: string | null;
}

const loadSavedLayouts = (storage: StorageLike): SavedLayout[] => {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEYS.SAVED_LAYOUTS) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed as SavedLayout[] : [];
  } catch {
    return [];
  }
};

const loadRecentLayoutIds = (storage: StorageLike): string[] => {
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEYS.RECENT_LAYOUTS) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
};

const loadCurrentLayout = (
  storage: StorageLike,
  savedLayouts: SavedLayout[],
  initialLayoutId?: string,
): LayoutConfig => {
  const savedId = initialLayoutId || storage.getItem(STORAGE_KEYS.CURRENT_LAYOUT_ID);
  const builtIn = LAYOUT_TEMPLATES.find(layout => layout.id === savedId);
  if (builtIn) return builtIn;
  return savedLayouts.find(layout => layout.id === savedId)?.config ?? getDefaultLayout();
};

export const useLayoutDesigner = (options: UseLayoutDesignerOptions = {}) => {
  const { toast } = useToast();
  const {
    initialLayoutId,
    autoSave = true,
    autoSaveDelay = 1000,
    storageOwnerId = null,
  } = options;
  const layoutStorage = React.useMemo(
    () => createScopedPrintStorage(storageOwnerId),
    [storageOwnerId],
  );
  const initiallySavedLayouts = React.useMemo(
    () => loadSavedLayouts(layoutStorage),
    [layoutStorage],
  );
  const [loadedStorageOwnerId, setLoadedStorageOwnerId] = React.useState(storageOwnerId);

  // Load saved layouts from the current owner's isolated namespace.
  const [savedLayouts, setSavedLayouts] = React.useState<SavedLayout[]>(initiallySavedLayouts);

  // Load recent layout IDs
  const [recentLayoutIds, setRecentLayoutIds] = React.useState<string[]>(() =>
    loadRecentLayoutIds(layoutStorage)
  );

  // Initialize current layout
  const [currentLayout, setCurrentLayout] = React.useState<LayoutConfig>(() =>
    loadCurrentLayout(layoutStorage, initiallySavedLayouts, initialLayoutId)
  );

  // Undo/Redo stacks
  const [undoStack, setUndoStack] = React.useState<LayoutConfig[]>([]);
  const [redoStack, setRedoStack] = React.useState<LayoutConfig[]>([]);

  // Selected section for editing
  const [selectedSectionId, setSelectedSectionId] = React.useState<string | null>(null);

  // Designer mode
  const [previewMode, setPreviewMode] = React.useState<'design' | 'preview'>('design');
  const [previewScale, setPreviewScale] = React.useState(1);

  // Dragging state
  const [isDragging, setIsDragging] = React.useState(false);

  // Auto-save timer ref
  const autoSaveTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Persist only when state has been loaded for the active owner. This guard
  // prevents an A-to-B render from writing A's layouts into B's namespace.
  React.useEffect(() => {
    if (loadedStorageOwnerId !== storageOwnerId) return;
    layoutStorage.setItem(STORAGE_KEYS.SAVED_LAYOUTS, JSON.stringify(savedLayouts));
  }, [layoutStorage, loadedStorageOwnerId, savedLayouts, storageOwnerId]);

  // Persist recent layouts to localStorage
  React.useEffect(() => {
    if (loadedStorageOwnerId !== storageOwnerId) return;
    layoutStorage.setItem(STORAGE_KEYS.RECENT_LAYOUTS, JSON.stringify(recentLayoutIds));
  }, [layoutStorage, loadedStorageOwnerId, recentLayoutIds, storageOwnerId]);

  // Persist current layout ID
  React.useEffect(() => {
    if (loadedStorageOwnerId !== storageOwnerId) return;
    layoutStorage.setItem(STORAGE_KEYS.CURRENT_LAYOUT_ID, currentLayout.id);
  }, [currentLayout.id, layoutStorage, loadedStorageOwnerId, storageOwnerId]);

  React.useEffect(() => {
    quarantineLegacyPrintPreferences();
    if (loadedStorageOwnerId === storageOwnerId) return;

    const nextSavedLayouts = loadSavedLayouts(layoutStorage);
    setSavedLayouts(nextSavedLayouts);
    setRecentLayoutIds(loadRecentLayoutIds(layoutStorage));
    setCurrentLayout(loadCurrentLayout(layoutStorage, nextSavedLayouts, initialLayoutId));
    setUndoStack([]);
    setRedoStack([]);
    setSelectedSectionId(null);
    setLoadedStorageOwnerId(storageOwnerId);
  }, [initialLayoutId, layoutStorage, loadedStorageOwnerId, storageOwnerId]);

  // Push to history for undo
  const pushToHistory = React.useCallback((layout: LayoutConfig) => {
    setUndoStack(prev => {
      const newStack = [...prev, layout];
      if (newStack.length > MAX_HISTORY_SIZE) {
        return newStack.slice(newStack.length - MAX_HISTORY_SIZE);
      }
      return newStack;
    });
    setRedoStack([]); // Clear redo stack on new change
  }, []);

  // Update layout with history tracking
  const updateLayout = React.useCallback((updates: Partial<LayoutConfig>) => {
    setCurrentLayout(prev => {
      pushToHistory(prev);
      return {
        ...prev,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
    });
  }, [pushToHistory]);

  // Undo
  const undo = React.useCallback(() => {
    if (undoStack.length === 0) return;

    const previousLayout = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, currentLayout]);
    setUndoStack(prev => prev.slice(0, -1));
    setCurrentLayout(previousLayout);

    toast({ title: 'Undo', description: 'Reverted to previous state' });
  }, [undoStack, currentLayout, toast]);

  // Redo
  const redo = React.useCallback(() => {
    if (redoStack.length === 0) return;

    const nextLayout = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, currentLayout]);
    setRedoStack(prev => prev.slice(0, -1));
    setCurrentLayout(nextLayout);

    toast({ title: 'Redo', description: 'Restored change' });
  }, [redoStack, currentLayout, toast]);

  // Select a layout (built-in or saved)
  const selectLayout = React.useCallback((layoutId: string) => {
    // Check built-in layouts
    const builtIn = LAYOUT_TEMPLATES.find(l => l.id === layoutId);
    if (builtIn) {
      pushToHistory(currentLayout);
      setCurrentLayout(builtIn);

      // Add to recent
      setRecentLayoutIds(prev => {
        const filtered = prev.filter(id => id !== layoutId);
        return [layoutId, ...filtered].slice(0, MAX_RECENT_LAYOUTS);
      });
      return;
    }

    // Check saved layouts
    const saved = savedLayouts.find(l => l.id === layoutId);
    if (saved) {
      pushToHistory(currentLayout);
      setCurrentLayout(saved.config);

      // Add to recent
      setRecentLayoutIds(prev => {
        const filtered = prev.filter(id => id !== layoutId);
        return [layoutId, ...filtered].slice(0, MAX_RECENT_LAYOUTS);
      });
    }
  }, [currentLayout, savedLayouts, pushToHistory]);

  // Save current layout as a new saved layout
  const saveLayout = React.useCallback((name: string, description?: string) => {
    const newLayout: SavedLayout = {
      id: `saved-${Date.now()}`,
      name,
      description,
      config: {
        ...currentLayout,
        id: `saved-${Date.now()}`,
        name,
        description,
        isBuiltIn: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setSavedLayouts(prev => [...prev, newLayout]);
    setCurrentLayout(newLayout.config);

    toast({
      title: 'Layout Saved',
      description: `"${name}" has been saved to your layouts.`,
    });

    return newLayout;
  }, [currentLayout, toast]);

  // Update an existing saved layout
  const updateSavedLayout = React.useCallback((layoutId: string) => {
    setSavedLayouts(prev => prev.map(layout => {
      if (layout.id === layoutId) {
        return {
          ...layout,
          config: currentLayout,
          updatedAt: new Date().toISOString(),
        };
      }
      return layout;
    }));

    toast({
      title: 'Layout Updated',
      description: 'Your changes have been saved.',
    });
  }, [currentLayout, toast]);

  // Delete a saved layout
  const deleteSavedLayout = React.useCallback((layoutId: string) => {
    setSavedLayouts(prev => prev.filter(l => l.id !== layoutId));

    // If deleting current layout, switch to default
    if (currentLayout.id === layoutId) {
      setCurrentLayout(getDefaultLayout());
    }

    toast({
      title: 'Layout Deleted',
      description: 'The layout has been removed.',
    });
  }, [currentLayout.id, toast]);

  // Duplicate a layout
  const duplicateLayout = React.useCallback((layoutId: string) => {
    const layout = LAYOUT_TEMPLATES.find(l => l.id === layoutId)
      || savedLayouts.find(l => l.id === layoutId)?.config;

    if (layout) {
      const duplicated = createCustomLayout(layoutId, `${layout.name} (Copy)`);

      const newSaved: SavedLayout = {
        id: duplicated.id,
        name: duplicated.name,
        config: duplicated,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setSavedLayouts(prev => [...prev, newSaved]);
      setCurrentLayout(duplicated);

      toast({
        title: 'Layout Duplicated',
        description: `Created "${duplicated.name}"`,
      });
    }
  }, [savedLayouts, toast]);

  // Export layout as JSON
  const exportLayout = React.useCallback((layout?: LayoutConfig) => {
    const layoutToExport = layout || currentLayout;
    const blob = new Blob([JSON.stringify(layoutToExport, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `layout-${layoutToExport.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast({
      title: 'Layout Exported',
      description: 'Layout saved as JSON file.',
    });
  }, [currentLayout, toast]);

  // Import layout from JSON
  const importLayout = React.useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string) as LayoutConfig;

        if (!data.name || !data.sections) {
          throw new Error('Invalid layout format');
        }

        const importedLayout: SavedLayout = {
          id: `imported-${Date.now()}`,
          name: data.name + ' (Imported)',
          config: {
            ...data,
            id: `imported-${Date.now()}`,
            isBuiltIn: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        setSavedLayouts(prev => [...prev, importedLayout]);
        setCurrentLayout(importedLayout.config);

        toast({
          title: 'Layout Imported',
          description: `"${importedLayout.name}" has been added.`,
        });
      } catch {
        toast({
          title: 'Import Failed',
          description: 'Could not parse the layout file.',
          variant: 'destructive',
        });
      }
    };
    reader.readAsText(file);
  }, [toast]);

  // ==========================================================================
  // Section Management
  // ==========================================================================

  // Update a specific section
  const updateSection = React.useCallback((sectionId: string, updates: Partial<LayoutSection>) => {
    updateLayout({
      sections: currentLayout.sections.map(section =>
        section.id === sectionId ? { ...section, ...updates } : section
      ),
    });
  }, [currentLayout.sections, updateLayout]);

  // Toggle section enabled state
  const toggleSection = React.useCallback((sectionId: string) => {
    updateSection(sectionId, {
      enabled: !currentLayout.sections.find(s => s.id === sectionId)?.enabled,
    });
  }, [currentLayout.sections, updateSection]);

  // Reorder sections (for drag and drop)
  const reorderSections = React.useCallback((fromIndex: number, toIndex: number) => {
    const sections = [...currentLayout.sections];
    const [removed] = sections.splice(fromIndex, 1);
    sections.splice(toIndex, 0, removed);

    // Update order numbers
    const reorderedSections = sections.map((section, index) => ({
      ...section,
      order: index,
    }));

    updateLayout({ sections: reorderedSections });
  }, [currentLayout.sections, updateLayout]);

  // Add a new section
  const addSection = React.useCallback((section: Omit<LayoutSection, 'order'>) => {
    const newSection: LayoutSection = {
      ...section,
      order: currentLayout.sections.length,
    };
    updateLayout({
      sections: [...currentLayout.sections, newSection],
    });
  }, [currentLayout.sections, updateLayout]);

  // Remove a section
  const removeSection = React.useCallback((sectionId: string) => {
    updateLayout({
      sections: currentLayout.sections.filter(s => s.id !== sectionId),
    });
    if (selectedSectionId === sectionId) {
      setSelectedSectionId(null);
    }
  }, [currentLayout.sections, selectedSectionId, updateLayout]);

  // ==========================================================================
  // Style Updates
  // ==========================================================================

  // Update global styles
  const updateGlobalStyles = React.useCallback((updates: Partial<GlobalLayoutStyles>) => {
    updateLayout({
      globalStyles: { ...currentLayout.globalStyles, ...updates },
    });
  }, [currentLayout.globalStyles, updateLayout]);

  // Update page settings
  const updatePageSettings = React.useCallback((updates: Partial<PageSettings>) => {
    updateLayout({
      pageSettings: { ...currentLayout.pageSettings, ...updates },
    });
  }, [currentLayout.pageSettings, updateLayout]);

  // Update card config
  const updateCardConfig = React.useCallback((updates: Partial<CardLayoutConfig>) => {
    const cardConfig = currentLayout.cardConfig ??
      LAYOUT_TEMPLATES.find(layout => layout.cardConfig)?.cardConfig;
    if (!cardConfig) return;

    updateLayout({
      cardConfig: { ...cardConfig, ...updates },
    });
  }, [currentLayout.cardConfig, updateLayout]);

  // Update grid config
  const updateGridConfig = React.useCallback((updates: Partial<GridLayoutConfig>) => {
    const gridConfig = currentLayout.gridConfig ??
      LAYOUT_TEMPLATES.find(layout => layout.gridConfig)?.gridConfig;
    if (!gridConfig) return;

    updateLayout({
      gridConfig: { ...gridConfig, ...updates },
    });
  }, [currentLayout.gridConfig, updateLayout]);

  // Update newspaper config
  const updateNewspaperConfig = React.useCallback((updates: Partial<NewspaperLayoutConfig>) => {
    const newspaperConfig = currentLayout.newspaperConfig ??
      LAYOUT_TEMPLATES.find(layout => layout.newspaperConfig)?.newspaperConfig;
    if (!newspaperConfig) return;

    updateLayout({
      newspaperConfig: { ...newspaperConfig, ...updates },
    });
  }, [currentLayout.newspaperConfig, updateLayout]);

  // Update timeline config
  const updateTimelineConfig = React.useCallback((updates: Partial<TimelineLayoutConfig>) => {
    const timelineConfig = currentLayout.timelineConfig ??
      LAYOUT_TEMPLATES.find(layout => layout.timelineConfig)?.timelineConfig;
    if (!timelineConfig) return;

    updateLayout({
      timelineConfig: { ...timelineConfig, ...updates },
    });
  }, [currentLayout.timelineConfig, updateLayout]);

  // Update magazine config
  const updateMagazineConfig = React.useCallback((updates: Partial<MagazineLayoutConfig>) => {
    const magazineConfig = currentLayout.magazineConfig ??
      LAYOUT_TEMPLATES.find(layout => layout.magazineConfig)?.magazineConfig;
    if (!magazineConfig) return;

    updateLayout({
      magazineConfig: { ...magazineConfig, ...updates },
    });
  }, [currentLayout.magazineConfig, updateLayout]);

  // Change view type
  const setViewType = React.useCallback((viewType: LayoutViewType) => {
    updateLayout({ viewType });
  }, [updateLayout]);

  // Reset to default layout
  const resetToDefault = React.useCallback(() => {
    pushToHistory(currentLayout);
    setCurrentLayout(getDefaultLayout());
    toast({
      title: 'Reset Complete',
      description: 'Layout has been reset to default.',
    });
  }, [currentLayout, pushToHistory, toast]);

  // Get all available layouts (built-in + saved)
  const allLayouts = React.useMemo(() => {
    return [
      ...LAYOUT_TEMPLATES,
      ...savedLayouts.map(s => s.config),
    ];
  }, [savedLayouts]);

  // Get recent layouts
  const recentLayouts = React.useMemo(() => {
    return recentLayoutIds
      .map(id => allLayouts.find(l => l.id === id))
      .filter(Boolean) as LayoutConfig[];
  }, [recentLayoutIds, allLayouts]);

  // Get selected section
  const selectedSection = React.useMemo(() => {
    return currentLayout.sections.find(s => s.id === selectedSectionId) || null;
  }, [currentLayout.sections, selectedSectionId]);

  // Check if layout has unsaved changes
  const hasUnsavedChanges = React.useMemo(() => {
    if (currentLayout.isBuiltIn) {
      return undoStack.length > 0;
    }
    const savedVersion = savedLayouts.find(l => l.id === currentLayout.id);
    if (!savedVersion) return undoStack.length > 0;
    return JSON.stringify(savedVersion.config) !== JSON.stringify(currentLayout);
  }, [currentLayout, savedLayouts, undoStack.length]);

  // Cleanup auto-save timer
  React.useEffect(() => {
    const timerRef = autoSaveTimerRef;
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return {
    // State
    currentLayout,
    savedLayouts,
    selectedSectionId,
    selectedSection,
    previewMode,
    previewScale,
    isDragging,
    undoStack,
    redoStack,
    allLayouts,
    recentLayouts,
    builtInLayouts: LAYOUT_TEMPLATES,
    hasUnsavedChanges,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,

    // Layout management
    selectLayout,
    saveLayout,
    updateSavedLayout,
    deleteSavedLayout,
    duplicateLayout,
    exportLayout,
    importLayout,
    resetToDefault,

    // Section management
    updateSection,
    toggleSection,
    reorderSections,
    addSection,
    removeSection,
    setSelectedSectionId,

    // Style updates
    updateGlobalStyles,
    updatePageSettings,
    updateCardConfig,
    updateGridConfig,
    updateNewspaperConfig,
    updateTimelineConfig,
    updateMagazineConfig,
    setViewType,

    // Designer controls
    setPreviewMode,
    setPreviewScale,
    setIsDragging,
    undo,
    redo,
  };
};

export type UseLayoutDesignerReturn = ReturnType<typeof useLayoutDesigner>;
