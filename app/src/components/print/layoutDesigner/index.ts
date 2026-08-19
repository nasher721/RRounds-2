/**
 * Layout Designer Module
 * Export all layout designer components and hooks
 */

export { LayoutDesigner } from './LayoutDesigner';
export { LayoutPreview } from './LayoutPreview';
export { SortableSection, StaticSection } from './SortableSection';
export { SectionSettingsPanel } from './SectionSettingsPanel';
export { StyleSettingsPanel } from './StyleSettingsPanel';
export { useLayoutDesigner } from './useLayoutDesigner';
export {
  LAYOUT_TEMPLATES,
  getLayoutById,
  getDefaultLayout,
  createCustomLayout,
  createDefaultSections,
  defaultGlobalStyles,
  defaultPageSettings,
  defaultCardConfig,
  defaultGridConfig,
  defaultNewspaperConfig,
  defaultTimelineConfig,
  defaultMagazineConfig,
} from './defaultLayouts';

export type { UseLayoutDesignerReturn } from './useLayoutDesigner';
