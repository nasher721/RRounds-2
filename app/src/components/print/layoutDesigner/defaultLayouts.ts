/**
 * Default Layout Templates
 * Pre-built layout configurations for common use cases
 */

import type {
  LayoutConfig,
  LayoutSection,
  GlobalLayoutStyles,
  PageSettings,
  CardLayoutConfig,
  GridLayoutConfig,
  NewspaperLayoutConfig,
  TimelineLayoutConfig,
  MagazineLayoutConfig,
} from '@/types/layoutDesigner';

// Default sections that can be used in layouts
export const createDefaultSections = (): LayoutSection[] => [
  { id: 'patient', type: 'patient', label: 'Patient Info', enabled: true, order: 0, width: 'auto' },
  { id: 'clinicalSummary', type: 'clinicalSummary', label: 'Clinical Summary', enabled: true, order: 1, width: 'full' },
  { id: 'intervalEvents', type: 'intervalEvents', label: 'Interval Events', enabled: true, order: 2, width: 'full' },
  { id: 'imaging', type: 'imaging', label: 'Imaging', enabled: true, order: 3, width: 'half' },
  { id: 'labs', type: 'labs', label: 'Labs', enabled: true, order: 4, width: 'half' },
  { id: 'systems.neuro', type: 'systems.neuro', label: 'Neuro', enabled: true, order: 5, width: 'half' },
  { id: 'systems.cv', type: 'systems.cv', label: 'Cardiovascular', enabled: true, order: 6, width: 'half' },
  { id: 'systems.resp', type: 'systems.resp', label: 'Respiratory', enabled: true, order: 7, width: 'half' },
  { id: 'systems.renalGU', type: 'systems.renalGU', label: 'Renal/GU', enabled: true, order: 8, width: 'half' },
  { id: 'systems.gi', type: 'systems.gi', label: 'GI/Nutrition', enabled: true, order: 9, width: 'half' },
  { id: 'systems.endo', type: 'systems.endo', label: 'Endocrine', enabled: true, order: 10, width: 'half' },
  { id: 'systems.heme', type: 'systems.heme', label: 'Hematology', enabled: true, order: 11, width: 'half' },
  { id: 'systems.infectious', type: 'systems.infectious', label: 'Infectious Disease', enabled: true, order: 12, width: 'half' },
  { id: 'systems.skinLines', type: 'systems.skinLines', label: 'Skin/Lines', enabled: true, order: 13, width: 'half' },
  { id: 'systems.dispo', type: 'systems.dispo', label: 'Disposition', enabled: true, order: 14, width: 'half' },
  { id: 'medications', type: 'medications', label: 'Medications', enabled: true, order: 15, width: 'full' },
  { id: 'todos', type: 'todos', label: 'To-Do Items', enabled: true, order: 16, width: 'full' },
  { id: 'notes', type: 'notes', label: 'Notes', enabled: false, order: 17, width: 'full' },
];

// Default global styles
export const defaultGlobalStyles: GlobalLayoutStyles = {
  fontFamily: 'system',
  fontSize: 10,
  lineHeight: 1.4,
  primaryColor: '#3b82f6',
  secondaryColor: '#64748b',
  backgroundColor: '#ffffff',
  textColor: '#1f2937',
  accentColor: '#60a5fa',
  borderStyle: 'light',
  borderRadius: 'small',
  shadowStyle: 'none',
  spacing: 'normal',
  headerStyle: 'standard',
};

// Default page settings
export const defaultPageSettings: PageSettings = {
  orientation: 'portrait',
  margins: 'normal',
  patientsPerPage: 'auto',
  onePatientPerPage: false,
  showPageNumbers: true,
  showTimestamp: true,
  showHeader: true,
  showFooter: false,
  pageBreakBetweenPatients: false,
};

// Default card layout config
export const defaultCardConfig: CardLayoutConfig = {
  columns: 1,
  gap: 'medium',
  cardStyle: 'bordered',
  headerPosition: 'top',
  contentFlow: 'vertical',
  showDividers: true,
  compactSections: false,
};

// Default grid layout config
export const defaultGridConfig: GridLayoutConfig = {
  rows: 2,
  columns: 2,
  cellSpacing: 16,
  fillOrder: 'row',
  equalCells: true,
};

// Default newspaper layout config
export const defaultNewspaperConfig: NewspaperLayoutConfig = {
  columns: 2,
  columnGap: 24,
  flowType: 'balanced',
  showColumnRules: true,
};

// Default timeline layout config
export const defaultTimelineConfig: TimelineLayoutConfig = {
  orientation: 'vertical',
  showConnectors: true,
  connectorStyle: 'solid',
  nodeStyle: 'circle',
  alternating: false,
};

// Default magazine layout config
export const defaultMagazineConfig: MagazineLayoutConfig = {
  heroPatient: true,
  heroSize: 'large',
  gridStyle: 'uniform',
  showSummaryCards: true,
};

// =============================================================================
// BUILT-IN LAYOUT TEMPLATES
// =============================================================================

export const LAYOUT_TEMPLATES: LayoutConfig[] = [
  // 1. Classic Table Layout
  {
    id: 'classic-table',
    name: 'Classic Table',
    description: 'Traditional row-based table layout with all sections as columns',
    viewType: 'table',
    isBuiltIn: true,
    sections: [
      { id: 'patient', type: 'patient', label: 'Patient', enabled: true, order: 0, width: 100 },
      { id: 'clinicalSummary', type: 'clinicalSummary', label: 'Summary', enabled: true, order: 1, width: 150 },
      { id: 'intervalEvents', type: 'intervalEvents', label: 'Events', enabled: true, order: 2, width: 150 },
      { id: 'imaging', type: 'imaging', label: 'Imaging', enabled: true, order: 3, width: 120 },
      { id: 'labs', type: 'labs', label: 'Labs', enabled: true, order: 4, width: 120 },
      { id: 'todos', type: 'todos', label: 'Tasks', enabled: true, order: 5, width: 140 },
    ],
    globalStyles: {
      ...defaultGlobalStyles,
      borderStyle: 'medium',
      spacing: 'compact',
    },
    pageSettings: {
      ...defaultPageSettings,
      orientation: 'landscape',
    },
  },

  // 2. Patient Cards Layout
  {
    id: 'patient-cards',
    name: 'Patient Cards',
    description: 'Individual patient cards with structured sections',
    viewType: 'cards',
    isBuiltIn: true,
    isDefault: true,
    sections: createDefaultSections(),
    cardConfig: {
      columns: 1,
      gap: 'large',
      cardStyle: 'elevated',
      headerPosition: 'top',
      contentFlow: 'vertical',
      showDividers: true,
      compactSections: false,
    },
    globalStyles: {
      ...defaultGlobalStyles,
      borderRadius: 'medium',
      shadowStyle: 'subtle',
    },
    pageSettings: {
      ...defaultPageSettings,
      onePatientPerPage: true,
    },
  },

  // 3. Compact Grid Layout
  {
    id: 'compact-grid',
    name: 'Compact Grid',
    description: 'Fit multiple patients in a grid arrangement',
    viewType: 'grid',
    isBuiltIn: true,
    sections: [
      { id: 'patient', type: 'patient', label: 'Patient', enabled: true, order: 0, width: 'full' },
      { id: 'clinicalSummary', type: 'clinicalSummary', label: 'One-Liner', enabled: true, order: 1, width: 'full' },
      { id: 'labs', type: 'labs', label: 'Labs', enabled: true, order: 2, width: 'half' },
      { id: 'todos', type: 'todos', label: 'Tasks', enabled: true, order: 3, width: 'half' },
    ],
    gridConfig: {
      rows: 2,
      columns: 2,
      cellSpacing: 12,
      fillOrder: 'row',
      equalCells: true,
    },
    globalStyles: {
      ...defaultGlobalStyles,
      fontSize: 8,
      spacing: 'compact',
      borderStyle: 'light',
    },
    pageSettings: {
      ...defaultPageSettings,
      orientation: 'landscape',
      patientsPerPage: 4,
    },
  },

  // 4. Newspaper Style Layout
  {
    id: 'newspaper-style',
    name: 'Newspaper Style',
    description: 'Multi-column flowing text layout like a newspaper',
    viewType: 'newspaper',
    isBuiltIn: true,
    sections: [
      { id: 'patient', type: 'patient', label: 'Patient', enabled: true, order: 0, width: 'full' },
      { id: 'clinicalSummary', type: 'clinicalSummary', label: 'Summary', enabled: true, order: 1, width: 'full' },
      { id: 'intervalEvents', type: 'intervalEvents', label: 'Events', enabled: true, order: 2, width: 'full' },
      { id: 'systems', type: 'systems', label: 'Systems', enabled: true, order: 3, width: 'full' },
      { id: 'todos', type: 'todos', label: 'Plan', enabled: true, order: 4, width: 'full' },
    ],
    newspaperConfig: {
      columns: 3,
      columnGap: 20,
      flowType: 'balanced',
      showColumnRules: true,
    },
    globalStyles: {
      ...defaultGlobalStyles,
      fontFamily: 'times',
      fontSize: 9,
      lineHeight: 1.5,
    },
    pageSettings: defaultPageSettings,
  },

  // 5. Timeline Layout
  {
    id: 'timeline-view',
    name: 'Timeline View',
    description: 'Chronological patient entries along a timeline',
    viewType: 'timeline',
    isBuiltIn: true,
    sections: [
      { id: 'patient', type: 'patient', label: 'Patient', enabled: true, order: 0 },
      { id: 'clinicalSummary', type: 'clinicalSummary', label: 'Status', enabled: true, order: 1 },
      { id: 'intervalEvents', type: 'intervalEvents', label: 'Updates', enabled: true, order: 2 },
      { id: 'todos', type: 'todos', label: 'Next Steps', enabled: true, order: 3 },
    ],
    timelineConfig: {
      orientation: 'vertical',
      showConnectors: true,
      connectorStyle: 'solid',
      nodeStyle: 'circle',
      alternating: true,
    },
    globalStyles: {
      ...defaultGlobalStyles,
      primaryColor: '#7c3aed',
      accentColor: '#a78bfa',
    },
    pageSettings: defaultPageSettings,
  },

  // 6. Condensed List Layout
  {
    id: 'condensed-list',
    name: 'Condensed List',
    description: 'Ultra-compact single-line patient entries',
    viewType: 'condensed',
    isBuiltIn: true,
    sections: [
      { id: 'patient', type: 'patient', label: 'Pt', enabled: true, order: 0, width: 80 },
      { id: 'clinicalSummary', type: 'clinicalSummary', label: 'Dx', enabled: true, order: 1, width: 200 },
      { id: 'todos', type: 'todos', label: 'Tasks', enabled: true, order: 2, width: 150 },
    ],
    globalStyles: {
      ...defaultGlobalStyles,
      fontSize: 7,
      spacing: 'compact',
      borderStyle: 'none',
    },
    pageSettings: {
      ...defaultPageSettings,
      orientation: 'landscape',
      patientsPerPage: 20,
      margins: 'narrow',
    },
  },

  // 7. Magazine Layout
  {
    id: 'magazine-layout',
    name: 'Magazine Layout',
    description: 'Featured patient with supporting grid',
    viewType: 'magazine',
    isBuiltIn: true,
    sections: createDefaultSections(),
    magazineConfig: {
      heroPatient: true,
      heroSize: 'large',
      gridStyle: 'masonry',
      showSummaryCards: true,
    },
    globalStyles: {
      ...defaultGlobalStyles,
      borderRadius: 'large',
      shadowStyle: 'medium',
    },
    pageSettings: {
      ...defaultPageSettings,
      orientation: 'portrait',
    },
  },

  // 8. Kanban Board Layout
  {
    id: 'kanban-board',
    name: 'Kanban Board',
    description: 'Patients organized by status columns',
    viewType: 'kanban',
    isBuiltIn: true,
    sections: [
      { id: 'patient', type: 'patient', label: 'Patient', enabled: true, order: 0 },
      { id: 'clinicalSummary', type: 'clinicalSummary', label: 'Summary', enabled: true, order: 1 },
      { id: 'systems.dispo', type: 'systems.dispo', label: 'Dispo', enabled: true, order: 2 },
      { id: 'todos', type: 'todos', label: 'Tasks', enabled: true, order: 3 },
    ],
    globalStyles: {
      ...defaultGlobalStyles,
      primaryColor: '#059669',
      accentColor: '#10b981',
      borderRadius: 'medium',
    },
    pageSettings: {
      ...defaultPageSettings,
      orientation: 'landscape',
    },
  },

  // 9. ICU Rounds Template
  {
    id: 'icu-rounds',
    name: 'ICU Rounds',
    description: 'Comprehensive ICU rounding format',
    viewType: 'cards',
    isBuiltIn: true,
    sections: [
      { id: 'patient', type: 'patient', label: 'Patient', enabled: true, order: 0 },
      { id: 'intervalEvents', type: 'intervalEvents', label: 'Overnight Events', enabled: true, order: 1, width: 'full' },
      { id: 'systems.neuro', type: 'systems.neuro', label: 'Neuro/Sedation', enabled: true, order: 2, width: 'half' },
      { id: 'systems.cv', type: 'systems.cv', label: 'CV/Hemodynamics', enabled: true, order: 3, width: 'half' },
      { id: 'systems.resp', type: 'systems.resp', label: 'Resp/Vent', enabled: true, order: 4, width: 'half' },
      { id: 'systems.renalGU', type: 'systems.renalGU', label: 'Renal/FEN', enabled: true, order: 5, width: 'half' },
      { id: 'systems.gi', type: 'systems.gi', label: 'GI/Nutrition', enabled: true, order: 6, width: 'half' },
      { id: 'systems.infectious', type: 'systems.infectious', label: 'ID', enabled: true, order: 7, width: 'half' },
      { id: 'systems.heme', type: 'systems.heme', label: 'Heme', enabled: true, order: 8, width: 'third' },
      { id: 'systems.endo', type: 'systems.endo', label: 'Endo', enabled: true, order: 9, width: 'third' },
      { id: 'systems.skinLines', type: 'systems.skinLines', label: 'Lines/Access', enabled: true, order: 10, width: 'third' },
      { id: 'labs', type: 'labs', label: 'Labs', enabled: true, order: 11, width: 'half' },
      { id: 'imaging', type: 'imaging', label: 'Imaging', enabled: true, order: 12, width: 'half' },
      { id: 'todos', type: 'todos', label: 'Plan', enabled: true, order: 13, width: 'full' },
    ],
    cardConfig: {
      columns: 1,
      gap: 'medium',
      cardStyle: 'bordered',
      headerPosition: 'top',
      contentFlow: 'grid',
      showDividers: true,
      compactSections: false,
    },
    globalStyles: {
      ...defaultGlobalStyles,
      primaryColor: '#0891b2',
      accentColor: '#22d3ee',
      fontSize: 9,
    },
    pageSettings: {
      ...defaultPageSettings,
      onePatientPerPage: true,
    },
  },

  // 10. SBAR Format
  {
    id: 'sbar-format',
    name: 'SBAR Format',
    description: 'Situation-Background-Assessment-Recommendation',
    viewType: 'cards',
    isBuiltIn: true,
    sections: [
      { id: 'patient', type: 'patient', label: 'Patient', enabled: true, order: 0 },
      { id: 'clinicalSummary', type: 'clinicalSummary', label: 'Situation', enabled: true, order: 1, width: 'full', style: { headerStyle: 'filled', backgroundColor: '#fef3c7' } },
      { id: 'intervalEvents', type: 'intervalEvents', label: 'Background', enabled: true, order: 2, width: 'full', style: { headerStyle: 'filled', backgroundColor: '#dbeafe' } },
      { id: 'labs', type: 'labs', label: 'Assessment', enabled: true, order: 3, width: 'full', style: { headerStyle: 'filled', backgroundColor: '#dcfce7' } },
      { id: 'todos', type: 'todos', label: 'Recommendation', enabled: true, order: 4, width: 'full', style: { headerStyle: 'filled', backgroundColor: '#fce7f3' } },
    ],
    cardConfig: {
      columns: 1,
      gap: 'medium',
      cardStyle: 'flat',
      headerPosition: 'top',
      contentFlow: 'vertical',
      showDividers: false,
      compactSections: false,
    },
    globalStyles: {
      ...defaultGlobalStyles,
      primaryColor: '#059669',
      borderRadius: 'medium',
    },
    pageSettings: {
      ...defaultPageSettings,
      patientsPerPage: 2,
    },
  },

  // 11. Sign-Out Sheet
  {
    id: 'signout-sheet',
    name: 'Sign-Out Sheet',
    description: 'Quick cross-cover reference sheet',
    viewType: 'table',
    isBuiltIn: true,
    sections: [
      { id: 'patient', type: 'patient', label: 'Pt/Rm', enabled: true, order: 0, width: 70 },
      { id: 'clinicalSummary', type: 'clinicalSummary', label: 'One-Liner', enabled: true, order: 1, width: 180 },
      { id: 'codeStatus', type: 'codeStatus', label: 'Code', enabled: true, order: 2, width: 50 },
      { id: 'allergies', type: 'allergies', label: 'Allergies', enabled: true, order: 3, width: 80 },
      { id: 'todos', type: 'todos', label: 'Tasks/If-Then', enabled: true, order: 4, width: 180 },
      { id: 'contacts', type: 'contacts', label: 'Contact', enabled: true, order: 5, width: 80 },
    ],
    globalStyles: {
      ...defaultGlobalStyles,
      fontSize: 8,
      spacing: 'compact',
      primaryColor: '#dc2626',
      borderStyle: 'medium',
    },
    pageSettings: {
      ...defaultPageSettings,
      orientation: 'landscape',
      patientsPerPage: 8,
      margins: 'narrow',
    },
  },

  // 12. Handoff Template
  {
    id: 'shift-handoff',
    name: 'Shift Handoff',
    description: 'Optimized for end-of-shift transitions',
    viewType: 'cards',
    isBuiltIn: true,
    sections: [
      { id: 'patient', type: 'patient', label: 'Patient', enabled: true, order: 0 },
      { id: 'clinicalSummary', type: 'clinicalSummary', label: 'One-Liner', enabled: true, order: 1, width: 'full' },
      { id: 'intervalEvents', type: 'intervalEvents', label: 'Overnight/Recent', enabled: true, order: 2, width: 'full' },
      { id: 'labs', type: 'labs', label: 'Key Labs', enabled: true, order: 3, width: 'half' },
      { id: 'imaging', type: 'imaging', label: 'Imaging', enabled: true, order: 4, width: 'half' },
      { id: 'todos', type: 'todos', label: 'Pending/If-Then', enabled: true, order: 5, width: 'full' },
    ],
    cardConfig: {
      columns: 1,
      gap: 'medium',
      cardStyle: 'bordered',
      headerPosition: 'top',
      contentFlow: 'vertical',
      showDividers: true,
      compactSections: true,
    },
    globalStyles: {
      ...defaultGlobalStyles,
      primaryColor: '#7c3aed',
      accentColor: '#a78bfa',
    },
    pageSettings: {
      ...defaultPageSettings,
      patientsPerPage: 3,
    },
  },
];

// Get a layout template by ID
export const getLayoutById = (id: string): LayoutConfig | undefined => {
  return LAYOUT_TEMPLATES.find(layout => layout.id === id);
};

// Get the default layout
export const getDefaultLayout = (): LayoutConfig => {
  return LAYOUT_TEMPLATES.find(layout => layout.isDefault) || LAYOUT_TEMPLATES[0];
};

// Create a new custom layout based on a template
export const createCustomLayout = (
  baseLayoutId: string,
  name: string,
  description?: string
): LayoutConfig => {
  const baseLayout = getLayoutById(baseLayoutId) || getDefaultLayout();
  return {
    ...baseLayout,
    id: `custom-${Date.now()}`,
    name,
    description,
    isBuiltIn: false,
    isDefault: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};
