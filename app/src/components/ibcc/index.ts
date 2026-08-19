/**
 * IBCC Components - Barrel Export
 *
 * Only the lazy panel wrapper is exported here. IBCCChapterView and
 * IBCCTrigger are reachable through the React.lazy IBCCPanelContent chunk;
 * re-exporting them from this eagerly imported barrel would drag the
 * 160 KB chapter-content data module into the entry bundle.
 */

export { IBCCPanel } from './IBCCPanelLazy';
