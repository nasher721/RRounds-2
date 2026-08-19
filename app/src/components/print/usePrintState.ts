import * as React from 'react';
import type { ColumnConfig, ColumnWidthsType, PrintPreset } from './types';
import { defaultColumns, defaultColumnWidths, defaultCombinedColumnWidths, fontFamilies } from './constants';
import { useToast } from '@/hooks/use-toast';
import { STORAGE_KEYS, DEFAULT_CONFIG } from '@/constants/config';
import { useAuth } from '@/hooks/useAuth';
import {
  createScopedPrintStorage,
  quarantineLegacyPrintPreferences,
} from '@/lib/print/preferences';
import type { StorageLike } from '@/utils/safeStorage';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface PrintState {
  columnWidths: ColumnWidthsType;
  combinedColumnWidths: Record<string, number>;
  columns: ColumnConfig[];
  printFontSize: number;
  printFontFamily: string;
  margins: 'narrow' | 'normal' | 'wide';
  headerStyle: 'minimal' | 'standard' | 'detailed';
  borderStyle: 'none' | 'light' | 'medium' | 'heavy';
  showPageNumbers: boolean;
  showTimestamp: boolean;
  alternateRowColors: boolean;
  compactMode: boolean;
  onePatientPerPage: boolean;
  autoFitFontSize: boolean;
  combinedColumns: string[];
  systemsReviewColumnCount: number;
  printOrientation: 'portrait' | 'landscape';
  customPresets: PrintPreset[];
  physicianName: string;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

type PrintAction =
  | { type: 'SET_FIELD'; field: keyof PrintState; value: PrintState[keyof PrintState] }
  | { type: 'HYDRATE_OWNER'; state: PrintState }
  | { type: 'LOAD_PRESET'; preset: PrintPreset }
  | { type: 'RESET_COLUMNS' }
  | { type: 'TOGGLE_COLUMN'; key: string }
  | { type: 'SELECT_ALL_COLUMNS' }
  | { type: 'DESELECT_ALL_COLUMNS' }
  | { type: 'TOGGLE_COMBINATION'; key: string };

// ---------------------------------------------------------------------------
// Initial state (reads from one owner's isolated storage once)
// ---------------------------------------------------------------------------

const parseStoredJson = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

function buildInitialState(storage: StorageLike): PrintState {
  const savedColumnWidths = storage.getItem(STORAGE_KEYS.PRINT_COLUMN_WIDTHS);
  const columnWidths: ColumnWidthsType = savedColumnWidths
    ? { ...defaultColumnWidths, ...parseStoredJson(savedColumnWidths, {}) }
    : defaultColumnWidths;

  const savedCombinedWidths = storage.getItem(STORAGE_KEYS.PRINT_COMBINED_COLUMN_WIDTHS);
  const combinedColumnWidths: Record<string, number> = savedCombinedWidths
    ? { ...defaultCombinedColumnWidths, ...parseStoredJson(savedCombinedWidths, {}) }
    : defaultCombinedColumnWidths;

  const savedColumnPrefs = storage.getItem(STORAGE_KEYS.PRINT_COLUMN_PREFS);
  const columns: ColumnConfig[] = savedColumnPrefs
    ? (() => {
      try {
        const savedCols = JSON.parse(savedColumnPrefs) as ColumnConfig[];
        return defaultColumns.map(col => {
          const savedCol = savedCols.find(s => s.key === col.key);
          return savedCol ? { ...col, enabled: savedCol.enabled } : col;
        });
      } catch {
        return defaultColumns;
      }
    })()
    : defaultColumns;

  const savedFontSize = storage.getItem(STORAGE_KEYS.PRINT_FONT_SIZE);
  const printFontSize = savedFontSize ? parseInt(savedFontSize, 10) : DEFAULT_CONFIG.PRINT_FONT_SIZE;

  const printFontFamily =
    storage.getItem(STORAGE_KEYS.PRINT_FONT_FAMILY) || DEFAULT_CONFIG.PRINT_FONT_FAMILY;

  const margins =
    (storage.getItem('printMargins') as PrintState['margins']) || DEFAULT_CONFIG.PRINT_MARGINS;

  const headerStyle =
    (storage.getItem('printHeaderStyle') as PrintState['headerStyle']) || DEFAULT_CONFIG.PRINT_HEADER_STYLE;

  const borderStyle =
    (storage.getItem('printBorderStyle') as PrintState['borderStyle']) || DEFAULT_CONFIG.PRINT_BORDER_STYLE;

  const savedShowPageNumbers = storage.getItem('printShowPageNumbers');
  const showPageNumbers = savedShowPageNumbers
    ? savedShowPageNumbers === 'true'
    : DEFAULT_CONFIG.PRINT_SHOW_PAGE_NUMBERS;

  const savedShowTimestamp = storage.getItem('printShowTimestamp');
  const showTimestamp = savedShowTimestamp
    ? savedShowTimestamp === 'true'
    : DEFAULT_CONFIG.PRINT_SHOW_TIMESTAMP;

  const savedAlternateRowColors = storage.getItem('printAlternateRowColors');
  const alternateRowColors = savedAlternateRowColors
    ? savedAlternateRowColors === 'true'
    : DEFAULT_CONFIG.PRINT_ALTERNATE_ROW_COLORS;

  const savedCompactMode = storage.getItem('printCompactMode');
  const compactMode = savedCompactMode
    ? savedCompactMode === 'true'
    : DEFAULT_CONFIG.PRINT_COMPACT_MODE;

  const onePatientPerPage =
    storage.getItem(STORAGE_KEYS.PRINT_ONE_PATIENT_PER_PAGE) === 'true';

  const autoFitFontSize =
    storage.getItem(STORAGE_KEYS.PRINT_AUTO_FIT_FONT_SIZE) === 'true';

  const savedCombinedColumns = storage.getItem(STORAGE_KEYS.PRINT_COMBINED_COLUMNS);
  const combinedColumns = parseStoredJson<string[]>(savedCombinedColumns, []);

  const savedSystemsCount = storage.getItem(STORAGE_KEYS.PRINT_SYSTEMS_REVIEW_COLUMN_COUNT);
  const systemsReviewColumnCount = savedSystemsCount
    ? parseInt(savedSystemsCount, 10)
    : DEFAULT_CONFIG.SYSTEMS_REVIEW_COLUMN_COUNT;

  const printOrientation =
    (storage.getItem(STORAGE_KEYS.PRINT_ORIENTATION) as PrintState['printOrientation']) ||
    DEFAULT_CONFIG.PRINT_ORIENTATION;

  const savedCustomPresets = storage.getItem(STORAGE_KEYS.PRINT_CUSTOM_PRESETS);
  const customPresets = parseStoredJson<PrintPreset[]>(savedCustomPresets, []);

  const physicianName = storage.getItem('printPhysicianName') || '';

  return {
    columnWidths,
    combinedColumnWidths,
    columns,
    printFontSize,
    printFontFamily,
    margins,
    headerStyle,
    borderStyle,
    showPageNumbers,
    showTimestamp,
    alternateRowColors,
    compactMode,
    onePatientPerPage,
    autoFitFontSize,
    combinedColumns,
    systemsReviewColumnCount,
    printOrientation,
    customPresets,
    physicianName,
  };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

function reducer(state: PrintState, action: PrintAction): PrintState {
  switch (action.type) {
    case 'HYDRATE_OWNER':
      return action.state;

    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };

    case 'LOAD_PRESET': {
      const p = action.preset;
      return {
        ...state,
        columns: p.columns,
        combinedColumns: p.combinedColumns,
        printOrientation: p.printOrientation,
        printFontSize: p.printFontSize,
        printFontFamily: p.printFontFamily,
        onePatientPerPage: p.onePatientPerPage,
        autoFitFontSize: p.autoFitFontSize,
        columnWidths: p.columnWidths,
        combinedColumnWidths: p.combinedColumnWidths,
        margins: p.margins,
        headerStyle: p.headerStyle,
        borderStyle: p.borderStyle,
        showPageNumbers: p.showPageNumbers,
        showTimestamp: p.showTimestamp,
        alternateRowColors: p.alternateRowColors,
        compactMode: p.compactMode,
        physicianName: p.physicianName ?? state.physicianName,
      };
    }

    case 'RESET_COLUMNS':
      return { ...state, columns: defaultColumns };

    case 'TOGGLE_COLUMN':
      return {
        ...state,
        columns: state.columns.map(col =>
          col.key === action.key ? { ...col, enabled: !col.enabled } : col
        ),
      };

    case 'SELECT_ALL_COLUMNS':
      return {
        ...state,
        columns: state.columns.map(col => ({ ...col, enabled: true })),
      };

    case 'DESELECT_ALL_COLUMNS':
      return {
        ...state,
        columns: state.columns.map(col =>
          col.key === 'patient' ? col : { ...col, enabled: false }
        ),
      };

    case 'TOGGLE_COMBINATION':
      return {
        ...state,
        combinedColumns: state.combinedColumns.includes(action.key)
          ? state.combinedColumns.filter(k => k !== action.key)
          : [...state.combinedColumns, action.key],
      };

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Persist state to the active owner's namespace after each change
// ---------------------------------------------------------------------------

function persistState(storage: StorageLike, state: PrintState) {
  storage.setItem(STORAGE_KEYS.PRINT_COLUMN_WIDTHS, JSON.stringify(state.columnWidths));
  storage.setItem(
    STORAGE_KEYS.PRINT_COMBINED_COLUMN_WIDTHS,
    JSON.stringify(state.combinedColumnWidths)
  );
  storage.setItem(STORAGE_KEYS.PRINT_COLUMN_PREFS, JSON.stringify(state.columns));
  storage.setItem(STORAGE_KEYS.PRINT_FONT_SIZE, state.printFontSize.toString());
  storage.setItem(STORAGE_KEYS.PRINT_FONT_FAMILY, state.printFontFamily);
  storage.setItem('printMargins', state.margins);
  storage.setItem('printHeaderStyle', state.headerStyle);
  storage.setItem('printBorderStyle', state.borderStyle);
  storage.setItem('printShowPageNumbers', state.showPageNumbers.toString());
  storage.setItem('printShowTimestamp', state.showTimestamp.toString());
  storage.setItem('printAlternateRowColors', state.alternateRowColors.toString());
  storage.setItem('printCompactMode', state.compactMode.toString());
  storage.setItem(
    STORAGE_KEYS.PRINT_ONE_PATIENT_PER_PAGE,
    state.onePatientPerPage.toString()
  );
  storage.setItem(
    STORAGE_KEYS.PRINT_AUTO_FIT_FONT_SIZE,
    state.autoFitFontSize.toString()
  );
  storage.setItem(
    STORAGE_KEYS.PRINT_COMBINED_COLUMNS,
    JSON.stringify(state.combinedColumns)
  );
  storage.setItem(
    STORAGE_KEYS.PRINT_SYSTEMS_REVIEW_COLUMN_COUNT,
    state.systemsReviewColumnCount.toString()
  );
  storage.setItem(STORAGE_KEYS.PRINT_ORIENTATION, state.printOrientation);
  storage.setItem(STORAGE_KEYS.PRINT_CUSTOM_PRESETS, JSON.stringify(state.customPresets));
  storage.setItem('printPhysicianName', state.physicianName);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export const usePrintStateForOwner = (storageOwnerId: string | null) => {
  const { toast } = useToast();
  const printStorage = React.useMemo(
    () => createScopedPrintStorage(storageOwnerId),
    [storageOwnerId],
  );
  const [loadedStorageOwnerId, setLoadedStorageOwnerId] = React.useState(storageOwnerId);

  const [state, dispatch] = React.useReducer(
    reducer,
    printStorage,
    buildInitialState
  );

  // Persist on every state change (batched — runs once per dispatch)
  React.useEffect(() => {
    if (loadedStorageOwnerId !== storageOwnerId) return;
    persistState(printStorage, state);
  }, [loadedStorageOwnerId, printStorage, state, storageOwnerId]);

  React.useEffect(() => {
    quarantineLegacyPrintPreferences();
    if (loadedStorageOwnerId === storageOwnerId) return;

    dispatch({ type: 'HYDRATE_OWNER', state: buildInitialState(printStorage) });
    setLoadedStorageOwnerId(storageOwnerId);
  }, [loadedStorageOwnerId, printStorage, storageOwnerId]);

  // ------------------------------------------------------------------
  // Public setter wrappers (API-compatible with the old useState shape)
  // ------------------------------------------------------------------

  const setColumnWidths = React.useCallback((v: ColumnWidthsType | ((prev: ColumnWidthsType) => ColumnWidthsType)) => {
    dispatch({
      type: 'SET_FIELD',
      field: 'columnWidths',
      value: typeof v === 'function' ? v(state.columnWidths) : v,
    });
  }, [state.columnWidths]);

  const setCombinedColumnWidths = React.useCallback(
    (v: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => {
      dispatch({
        type: 'SET_FIELD',
        field: 'combinedColumnWidths',
        value: typeof v === 'function' ? v(state.combinedColumnWidths) : v,
      });
    },
    [state.combinedColumnWidths]
  );

  const setColumns = React.useCallback(
    (v: ColumnConfig[] | ((prev: ColumnConfig[]) => ColumnConfig[])) => {
      dispatch({
        type: 'SET_FIELD',
        field: 'columns',
        value: typeof v === 'function' ? v(state.columns) : v,
      });
    },
    [state.columns]
  );

  const setPrintFontSize = React.useCallback((v: number) => {
    dispatch({ type: 'SET_FIELD', field: 'printFontSize', value: v });
  }, []);

  const setPrintFontFamily = React.useCallback((v: string) => {
    dispatch({ type: 'SET_FIELD', field: 'printFontFamily', value: v });
  }, []);

  const setMargins = React.useCallback((v: PrintState['margins']) => {
    dispatch({ type: 'SET_FIELD', field: 'margins', value: v });
  }, []);

  const setHeaderStyle = React.useCallback((v: PrintState['headerStyle']) => {
    dispatch({ type: 'SET_FIELD', field: 'headerStyle', value: v });
  }, []);

  const setBorderStyle = React.useCallback((v: PrintState['borderStyle']) => {
    dispatch({ type: 'SET_FIELD', field: 'borderStyle', value: v });
  }, []);

  const setShowPageNumbers = React.useCallback((v: boolean) => {
    dispatch({ type: 'SET_FIELD', field: 'showPageNumbers', value: v });
  }, []);

  const setShowTimestamp = React.useCallback((v: boolean) => {
    dispatch({ type: 'SET_FIELD', field: 'showTimestamp', value: v });
  }, []);

  const setAlternateRowColors = React.useCallback((v: boolean) => {
    dispatch({ type: 'SET_FIELD', field: 'alternateRowColors', value: v });
  }, []);

  const setCompactMode = React.useCallback((v: boolean) => {
    dispatch({ type: 'SET_FIELD', field: 'compactMode', value: v });
  }, []);

  const setOnePatientPerPage = React.useCallback((v: boolean) => {
    dispatch({ type: 'SET_FIELD', field: 'onePatientPerPage', value: v });
  }, []);

  const setAutoFitFontSize = React.useCallback((v: boolean) => {
    dispatch({ type: 'SET_FIELD', field: 'autoFitFontSize', value: v });
  }, []);

  const setCombinedColumns = React.useCallback(
    (v: string[] | ((prev: string[]) => string[])) => {
      dispatch({
        type: 'SET_FIELD',
        field: 'combinedColumns',
        value: typeof v === 'function' ? v(state.combinedColumns) : v,
      });
    },
    [state.combinedColumns]
  );

  const setSystemsReviewColumnCount = React.useCallback((v: number) => {
    dispatch({ type: 'SET_FIELD', field: 'systemsReviewColumnCount', value: v });
  }, []);

  const setPrintOrientation = React.useCallback((v: PrintState['printOrientation']) => {
    dispatch({ type: 'SET_FIELD', field: 'printOrientation', value: v });
  }, []);

  const setCustomPresets = React.useCallback(
    (v: PrintPreset[] | ((prev: PrintPreset[]) => PrintPreset[])) => {
      dispatch({
        type: 'SET_FIELD',
        field: 'customPresets',
        value: typeof v === 'function' ? v(state.customPresets) : v,
      });
    },
    [state.customPresets]
  );

  const setPhysicianName = React.useCallback((v: string) => {
    dispatch({ type: 'SET_FIELD', field: 'physicianName', value: v });
  }, []);

  // ------------------------------------------------------------------
  // Computed / derived helpers
  // ------------------------------------------------------------------

  const getFontFamilyCSS = React.useCallback(() => {
    return fontFamilies.find(f => f.value === state.printFontFamily)?.css || fontFamilies[0].css;
  }, [state.printFontFamily]);

  // ------------------------------------------------------------------
  // Column helpers
  // ------------------------------------------------------------------

  const toggleColumn = React.useCallback((key: string) => {
    dispatch({ type: 'TOGGLE_COLUMN', key });
  }, []);

  const selectAllColumns = React.useCallback(() => {
    dispatch({ type: 'SELECT_ALL_COLUMNS' });
  }, []);

  const deselectAllColumns = React.useCallback(() => {
    dispatch({ type: 'DESELECT_ALL_COLUMNS' });
  }, []);

  const toggleColumnCombination = React.useCallback((key: string) => {
    dispatch({ type: 'TOGGLE_COMBINATION', key });
  }, []);

  const isColumnEnabled = React.useCallback(
    (key: string): boolean => state.columns.find(c => c.key === key)?.enabled ?? false,
    [state.columns]
  );

  // ------------------------------------------------------------------
  // Preset helpers
  // ------------------------------------------------------------------

  const saveCurrentAsPreset = React.useCallback(
    (name: string) => {
      if (!name.trim()) {
        toast({
          title: 'Name required',
          description: 'Please enter a name for your preset.',
          variant: 'destructive',
        });
        return false;
      }

      const preset: PrintPreset = {
        id: Date.now().toString(),
        name: name.trim(),
        columns: state.columns,
        combinedColumns: state.combinedColumns,
        printOrientation: state.printOrientation,
        printFontSize: state.printFontSize,
        printFontFamily: state.printFontFamily,
        onePatientPerPage: state.onePatientPerPage,
        autoFitFontSize: state.autoFitFontSize,
        columnWidths: state.columnWidths,
        combinedColumnWidths: state.combinedColumnWidths,
        margins: state.margins,
        headerStyle: state.headerStyle,
        borderStyle: state.borderStyle,
        showPageNumbers: state.showPageNumbers,
        showTimestamp: state.showTimestamp,
        alternateRowColors: state.alternateRowColors,
        compactMode: state.compactMode,
        physicianName: state.physicianName,
        createdAt: new Date().toISOString(),
      };

      dispatch({
        type: 'SET_FIELD',
        field: 'customPresets',
        value: [...state.customPresets, preset],
      });

      toast({ title: 'Preset saved', description: `"${preset.name}" has been saved for quick access.` });
      return true;
    },
    [state, toast]
  );

  // Single dispatch → single re-render (was 17 setState calls before)
  const loadPreset = React.useCallback(
    (preset: PrintPreset) => {
      dispatch({ type: 'LOAD_PRESET', preset });
      toast({ title: 'Preset loaded', description: `"${preset.name}" settings applied.` });
    },
    [toast]
  );

  const deletePreset = React.useCallback(
    (presetId: string) => {
      dispatch({
        type: 'SET_FIELD',
        field: 'customPresets',
        value: state.customPresets.filter(p => p.id !== presetId),
      });
      toast({ title: 'Preset deleted', description: 'The preset has been removed.' });
    },
    [state.customPresets, toast]
  );

  const exportPreset = React.useCallback(
    (preset: PrintPreset) => {
      const exportData = { ...preset, exportedAt: new Date().toISOString(), version: '1.0' };
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `print-preset-${preset.name.toLowerCase().replace(/\s+/g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: 'Preset exported', description: `"${preset.name}" saved as JSON file.` });
    },
    [toast]
  );

  const importPreset = React.useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string);
          if (!data.name || !data.columns) throw new Error('Invalid preset format');
          const newPreset: PrintPreset = {
            id: Date.now().toString(),
            name: data.name + (state.customPresets.some(p => p.name === data.name) ? ' (imported)' : ''),
            columns: data.columns,
            combinedColumns: data.combinedColumns || [],
            printOrientation: data.printOrientation || 'portrait',
            printFontSize: data.printFontSize || 9,
            printFontFamily: data.printFontFamily || 'system',
            onePatientPerPage: data.onePatientPerPage || false,
            autoFitFontSize: data.autoFitFontSize || false,
            columnWidths: data.columnWidths || defaultColumnWidths,
            combinedColumnWidths: data.combinedColumnWidths || defaultCombinedColumnWidths,
            margins: data.margins || DEFAULT_CONFIG.PRINT_MARGINS,
            headerStyle: data.headerStyle || DEFAULT_CONFIG.PRINT_HEADER_STYLE,
            borderStyle: data.borderStyle || DEFAULT_CONFIG.PRINT_BORDER_STYLE,
            showPageNumbers: data.showPageNumbers ?? DEFAULT_CONFIG.PRINT_SHOW_PAGE_NUMBERS,
            showTimestamp: data.showTimestamp ?? DEFAULT_CONFIG.PRINT_SHOW_TIMESTAMP,
            alternateRowColors: data.alternateRowColors ?? DEFAULT_CONFIG.PRINT_ALTERNATE_ROW_COLORS,
            compactMode: data.compactMode ?? DEFAULT_CONFIG.PRINT_COMPACT_MODE,
            createdAt: new Date().toISOString(),
          };
          dispatch({
            type: 'SET_FIELD',
            field: 'customPresets',
            value: [...state.customPresets, newPreset],
          });
          toast({ title: 'Preset imported', description: `"${newPreset.name}" has been added.` });
        } catch {
          toast({
            title: 'Import failed',
            description: 'The file could not be parsed as a valid preset.',
            variant: 'destructive',
          });
        }
      };
      reader.readAsText(file);
    },
    [state.customPresets, toast]
  );

  // ------------------------------------------------------------------
  // Return  (same shape as before — no consumers need updating)
  // ------------------------------------------------------------------

  return {
    // State
    columnWidths: state.columnWidths,
    setColumnWidths,
    combinedColumnWidths: state.combinedColumnWidths,
    setCombinedColumnWidths,
    columns: state.columns,
    setColumns,
    printFontSize: state.printFontSize,
    setPrintFontSize,
    printFontFamily: state.printFontFamily,
    setPrintFontFamily,
    margins: state.margins,
    setMargins,
    headerStyle: state.headerStyle,
    setHeaderStyle,
    borderStyle: state.borderStyle,
    setBorderStyle,
    showPageNumbers: state.showPageNumbers,
    setShowPageNumbers,
    showTimestamp: state.showTimestamp,
    setShowTimestamp,
    alternateRowColors: state.alternateRowColors,
    setAlternateRowColors,
    compactMode: state.compactMode,
    setCompactMode,
    onePatientPerPage: state.onePatientPerPage,
    setOnePatientPerPage,
    autoFitFontSize: state.autoFitFontSize,
    setAutoFitFontSize,
    combinedColumns: state.combinedColumns,
    setCombinedColumns,
    systemsReviewColumnCount: state.systemsReviewColumnCount,
    setSystemsReviewColumnCount,
    printOrientation: state.printOrientation,
    setPrintOrientation,
    customPresets: state.customPresets,
    setCustomPresets,
    physicianName: state.physicianName,
    setPhysicianName,
    // Helpers
    getFontFamilyCSS,
    toggleColumn,
    selectAllColumns,
    deselectAllColumns,
    toggleColumnCombination,
    isColumnEnabled,
    saveCurrentAsPreset,
    loadPreset,
    deletePreset,
    exportPreset,
    importPreset,
  };
};

/** Public hook keeps its existing API while deriving the storage owner from auth. */
export const usePrintState = () => {
  const { user } = useAuth();
  return usePrintStateForOwner(user?.id ?? null);
};
