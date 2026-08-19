/**
 * Layout Designer Types
 * Comprehensive type definitions for the patient list export layout designer
 */

// Layout view types
export type LayoutViewType =
  | 'table'
  | 'cards'
  | 'grid'
  | 'newspaper'
  | 'timeline'
  | 'condensed'
  | 'magazine'
  | 'kanban';

// Section types that can be included in layouts
export type LayoutSectionType =
  | 'patient'
  | 'clinicalSummary'
  | 'intervalEvents'
  | 'imaging'
  | 'labs'
  | 'medications'
  | 'todos'
  | 'notes'
  | 'systems'
  | 'systems.neuro'
  | 'systems.cv'
  | 'systems.resp'
  | 'systems.renalGU'
  | 'systems.gi'
  | 'systems.endo'
  | 'systems.heme'
  | 'systems.infectious'
  | 'systems.skinLines'
  | 'systems.dispo'
  | 'vitals'
  | 'codeStatus'
  | 'allergies'
  | 'contacts';

// Individual section configuration
export interface LayoutSection {
  id: string;
  type: LayoutSectionType;
  label: string;
  enabled: boolean;
  order: number;
  width?: 'auto' | 'full' | 'half' | 'third' | 'quarter' | number;
  height?: 'auto' | 'fixed' | number;
  style?: LayoutSectionStyle;
  collapsed?: boolean;
}

// Section styling options
export interface LayoutSectionStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;
  fontSize?: number;
  fontWeight?: 'normal' | 'medium' | 'semibold' | 'bold';
  textColor?: string;
  headerStyle?: 'none' | 'simple' | 'accent' | 'filled';
  showIcon?: boolean;
}

// Card layout configuration
export interface CardLayoutConfig {
  columns: 1 | 2 | 3 | 4;
  gap: 'none' | 'small' | 'medium' | 'large';
  cardStyle: 'flat' | 'elevated' | 'bordered' | 'glass';
  headerPosition: 'top' | 'side' | 'inline';
  contentFlow: 'vertical' | 'horizontal' | 'grid';
  showDividers: boolean;
  compactSections: boolean;
}

// Grid layout configuration
export interface GridLayoutConfig {
  rows: number;
  columns: number;
  cellSpacing: number;
  fillOrder: 'row' | 'column';
  equalCells: boolean;
}

// Newspaper layout configuration
export interface NewspaperLayoutConfig {
  columns: 2 | 3 | 4;
  columnGap: number;
  flowType: 'balanced' | 'sequential';
  showColumnRules: boolean;
}

// Timeline layout configuration
export interface TimelineLayoutConfig {
  orientation: 'vertical' | 'horizontal';
  showConnectors: boolean;
  connectorStyle: 'solid' | 'dashed' | 'dotted';
  nodeStyle: 'circle' | 'square' | 'diamond';
  alternating: boolean;
}

// Magazine layout configuration
export interface MagazineLayoutConfig {
  heroPatient: boolean;
  heroSize: 'large' | 'medium';
  gridStyle: 'masonry' | 'uniform';
  showSummaryCards: boolean;
}

// Complete layout configuration
export interface LayoutConfig {
  id: string;
  name: string;
  description?: string;
  viewType: LayoutViewType;
  sections: LayoutSection[];
  cardConfig?: CardLayoutConfig;
  gridConfig?: GridLayoutConfig;
  newspaperConfig?: NewspaperLayoutConfig;
  timelineConfig?: TimelineLayoutConfig;
  magazineConfig?: MagazineLayoutConfig;
  globalStyles: GlobalLayoutStyles;
  pageSettings: PageSettings;
  isBuiltIn?: boolean;
  isDefault?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

// Global styling for the entire layout
export interface GlobalLayoutStyles {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  accentColor: string;
  borderStyle: 'none' | 'light' | 'medium' | 'heavy';
  borderRadius: 'none' | 'small' | 'medium' | 'large';
  shadowStyle: 'none' | 'subtle' | 'medium' | 'strong';
  spacing: 'compact' | 'normal' | 'relaxed';
  headerStyle: 'minimal' | 'standard' | 'detailed' | 'branded';
}

// Page settings for printing
export interface PageSettings {
  orientation: 'portrait' | 'landscape';
  margins: 'narrow' | 'normal' | 'wide' | { top: number; right: number; bottom: number; left: number };
  patientsPerPage: number | 'auto';
  onePatientPerPage: boolean;
  showPageNumbers: boolean;
  showTimestamp: boolean;
  showHeader: boolean;
  showFooter: boolean;
  headerContent?: string;
  footerContent?: string;
  pageBreakBetweenPatients: boolean;
}

// Saved custom layout
export interface SavedLayout {
  id: string;
  name: string;
  description?: string;
  config: LayoutConfig;
  thumbnail?: string;
  createdAt: string;
  updatedAt: string;
  isDefault?: boolean;
}

// Layout designer state
export interface LayoutDesignerState {
  currentLayout: LayoutConfig;
  savedLayouts: SavedLayout[];
  selectedSectionId: string | null;
  isDragging: boolean;
  previewMode: 'design' | 'preview';
  previewScale: number;
  undoStack: LayoutConfig[];
  redoStack: LayoutConfig[];
}

// Drag and drop types
export interface DragItem {
  id: string;
  type: 'section' | 'zone';
  index: number;
  parentId?: string;
}

export interface DropZone {
  id: string;
  accepts: LayoutSectionType[];
  direction: 'horizontal' | 'vertical';
}

// Layout designer actions
export type LayoutDesignerAction =
  | { type: 'SET_LAYOUT'; payload: LayoutConfig }
  | { type: 'UPDATE_SECTION'; payload: { id: string; updates: Partial<LayoutSection> } }
  | { type: 'REORDER_SECTIONS'; payload: { fromIndex: number; toIndex: number } }
  | { type: 'ADD_SECTION'; payload: LayoutSection }
  | { type: 'REMOVE_SECTION'; payload: string }
  | { type: 'SELECT_SECTION'; payload: string | null }
  | { type: 'UPDATE_GLOBAL_STYLES'; payload: Partial<GlobalLayoutStyles> }
  | { type: 'UPDATE_PAGE_SETTINGS'; payload: Partial<PageSettings> }
  | { type: 'UPDATE_CARD_CONFIG'; payload: Partial<CardLayoutConfig> }
  | { type: 'UPDATE_GRID_CONFIG'; payload: Partial<GridLayoutConfig> }
  | { type: 'UPDATE_NEWSPAPER_CONFIG'; payload: Partial<NewspaperLayoutConfig> }
  | { type: 'UPDATE_TIMELINE_CONFIG'; payload: Partial<TimelineLayoutConfig> }
  | { type: 'UPDATE_MAGAZINE_CONFIG'; payload: Partial<MagazineLayoutConfig> }
  | { type: 'SET_VIEW_TYPE'; payload: LayoutViewType }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'RESET' };

// Export format options
export interface ExportOptions {
  format: 'pdf' | 'docx' | 'html' | 'rtf' | 'txt' | 'excel' | 'json';
  layout: LayoutConfig;
  includeStyles: boolean;
  paperSize: 'letter' | 'a4' | 'legal';
  quality: 'draft' | 'normal' | 'high';
}

// Helper type for section labels
export const SECTION_LABELS: Record<LayoutSectionType, string> = {
  patient: 'Patient Info',
  clinicalSummary: 'Clinical Summary',
  intervalEvents: 'Interval Events',
  imaging: 'Imaging',
  labs: 'Labs',
  medications: 'Medications',
  todos: 'To-Do Items',
  notes: 'Notes',
  systems: 'Systems Review',
  'systems.neuro': 'Neuro',
  'systems.cv': 'Cardiovascular',
  'systems.resp': 'Respiratory',
  'systems.renalGU': 'Renal/GU',
  'systems.gi': 'GI/Nutrition',
  'systems.endo': 'Endocrine',
  'systems.heme': 'Hematology',
  'systems.infectious': 'Infectious Disease',
  'systems.skinLines': 'Skin/Lines',
  'systems.dispo': 'Disposition',
  vitals: 'Vital Signs',
  codeStatus: 'Code Status',
  allergies: 'Allergies',
  contacts: 'Contacts',
};

// Helper type for view type labels
export const VIEW_TYPE_LABELS: Record<LayoutViewType, { label: string; description: string; icon: string }> = {
  table: { label: 'Table', description: 'Traditional row-based table layout', icon: 'Table' },
  cards: { label: 'Cards', description: 'Individual patient cards', icon: 'LayoutGrid' },
  grid: { label: 'Grid', description: 'Flexible grid arrangement', icon: 'Grid3x3' },
  newspaper: { label: 'Newspaper', description: 'Multi-column flowing text', icon: 'Newspaper' },
  timeline: { label: 'Timeline', description: 'Chronological patient view', icon: 'Clock' },
  condensed: { label: 'Condensed', description: 'Compact single-line entries', icon: 'AlignJustify' },
  magazine: { label: 'Magazine', description: 'Featured patient with grid', icon: 'BookOpen' },
  kanban: { label: 'Kanban', description: 'Status-based columns', icon: 'Columns' },
};
