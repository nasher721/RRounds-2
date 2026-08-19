// PhraseManager is intentionally NOT re-exported here: it is only consumed via
// React.lazy from the dashboards/ToolsSheet (direct "@/components/phrases/PhraseManager"
// imports). Re-exporting it from this barrel would pull the manager and its
// editor subgraph into the eager entry bundle, because RichTextEditor and
// ImagePasteEditor statically import the picker/dialog from this barrel.
export { PhraseFormDialog } from './PhraseFormDialog';
export { PhrasePicker } from './PhrasePicker';
