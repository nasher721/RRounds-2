/**
 * LayoutDesigner Component
 * Main layout designer with drag-and-drop section arrangement
 */

import * as React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  LayoutTemplate,
  Layers,
  Palette,
  Settings,
  Save,
  Download,
  Upload,
  Undo2,
  Redo2,
  Eye,
  Pencil,
  Plus,
  Copy,
  Trash2,
  Check,
  Table,
  LayoutGrid,
  Grid3x3,
  Newspaper,
  Clock,
  AlignJustify,
  BookOpen,
  Columns,
  RefreshCw,
  FileJson,
} from 'lucide-react';
import { useLayoutDesigner } from './useLayoutDesigner';
import { SortableSection, StaticSection } from './SortableSection';
import { SectionSettingsPanel } from './SectionSettingsPanel';
import { StyleSettingsPanel } from './StyleSettingsPanel';
import { LayoutPreview } from './LayoutPreview';
import { VIEW_TYPE_LABELS } from '@/types/layoutDesigner';
import type { LayoutViewType, LayoutConfig, LayoutSection } from '@/types/layoutDesigner';

// View type icons
const VIEW_TYPE_ICONS: Record<LayoutViewType, React.ElementType> = {
  table: Table,
  cards: LayoutGrid,
  grid: Grid3x3,
  newspaper: Newspaper,
  timeline: Clock,
  condensed: AlignJustify,
  magazine: BookOpen,
  kanban: Columns,
};

interface LayoutDesignerProps {
  onApplyLayout?: (layout: LayoutConfig) => void;
  onClose?: () => void;
  storageOwnerId?: string | null;
}

export const LayoutDesigner = ({ onApplyLayout, onClose, storageOwnerId = null }: LayoutDesignerProps) => {
  const {
    currentLayout,
    savedLayouts,
    builtInLayouts,
    recentLayouts,
    selectedSectionId,
    selectedSection,
    previewMode,
    previewScale,
    hasUnsavedChanges,
    canUndo,
    canRedo,
    selectLayout,
    saveLayout,
    updateSavedLayout,
    deleteSavedLayout,
    duplicateLayout,
    exportLayout,
    importLayout,
    resetToDefault,
    updateSection,
    toggleSection,
    reorderSections,
    addSection,
    removeSection,
    setSelectedSectionId,
    updateGlobalStyles,
    updatePageSettings,
    updateCardConfig,
    updateGridConfig,
    updateNewspaperConfig,
    updateTimelineConfig,
    updateMagazineConfig,
    setViewType,
    setPreviewMode,
    setPreviewScale,
    setIsDragging,
    undo,
    redo,
  } = useLayoutDesigner({ storageOwnerId });

  const [activeTab, setActiveTab] = React.useState<'templates' | 'sections' | 'styles'>('templates');
  const [saveDialogOpen, setSaveDialogOpen] = React.useState(false);
  const [newLayoutName, setNewLayoutName] = React.useState('');
  const [newLayoutDescription, setNewLayoutDescription] = React.useState('');
  const [activeDragId, setActiveDragId] = React.useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
    setIsDragging(true);
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDragId(null);
    setIsDragging(false);

    if (over && active.id !== over.id) {
      const oldIndex = currentLayout.sections.findIndex(s => s.id === active.id);
      const newIndex = currentLayout.sections.findIndex(s => s.id === over.id);
      reorderSections(oldIndex, newIndex);
    }
  };

  // Get the active section being dragged
  const activeDragSection = activeDragId
    ? currentLayout.sections.find(s => s.id === activeDragId)
    : null;

  // Handle save layout
  const handleSaveLayout = () => {
    if (newLayoutName.trim()) {
      saveLayout(newLayoutName.trim(), newLayoutDescription.trim() || undefined);
      setSaveDialogOpen(false);
      setNewLayoutName('');
      setNewLayoutDescription('');
    }
  };

  // Handle import file
  const handleImportFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      importLayout(file);
      event.target.value = '';
    }
  };

  // Apply layout and close
  const handleApply = () => {
    onApplyLayout?.(currentLayout);
    onClose?.();
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <LayoutTemplate className="h-5 w-5 text-primary shrink-0" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Layout Designer</h2>
            <p className="text-xs text-muted-foreground">
              Customize how your patient list is exported
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={undo}
                  disabled={!canUndo}
                  aria-label="Undo"
                >
                  <Undo2 className="h-4 w-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={redo}
                  disabled={!canRedo}
                  aria-label="Redo"
                >
                  <Redo2 className="h-4 w-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Separator orientation="vertical" className="h-6" />

          {/* Preview/Edit toggle */}
          <div
            className="flex bg-muted p-1 rounded-lg"
            role="group"
            aria-label="Design or preview mode"
          >
            <button
              type="button"
              onClick={() => setPreviewMode('design')}
              aria-pressed={previewMode === 'design'}
              className={cn(
                'px-3 py-1.5 min-h-[36px] text-xs rounded-md transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                previewMode === 'design'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Pencil className="h-3 w-3 shrink-0" aria-hidden />
              Design
            </button>
            <button
              type="button"
              onClick={() => setPreviewMode('preview')}
              aria-pressed={previewMode === 'preview'}
              className={cn(
                'px-3 py-1.5 min-h-[36px] text-xs rounded-md transition-all flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                previewMode === 'preview'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Eye className="h-3 w-3 shrink-0" aria-hidden />
              Preview
            </button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Reset */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={resetToDefault}
                  aria-label="Reset to default layout"
                >
                  <RefreshCw className="h-4 w-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Reset to Default</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Export */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => exportLayout()}
                  aria-label="Export layout to file"
                >
                  <Download className="h-4 w-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Export Layout</TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {/* Import */}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Import layout from file"
                >
                  <Upload className="h-4 w-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Import Layout</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="sr-only"
            tabIndex={-1}
            aria-label="Import layout JSON file"
            onChange={handleImportFile}
          />

          {/* Save */}
          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-1.5">
                <Save className="h-4 w-4 shrink-0" aria-hidden />
                Save
                {hasUnsavedChanges && (
                  <Badge variant="secondary" className="ml-1 px-1 py-0 text-[10px]">
                    Modified
                  </Badge>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Layout</DialogTitle>
                <DialogDescription>
                  Save your current layout configuration for future use.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="layout-name">Name</Label>
                  <Input
                    id="layout-name"
                    value={newLayoutName}
                    onChange={(e) => setNewLayoutName(e.target.value)}
                    placeholder="My Custom Layout"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="layout-description">Description (optional)</Label>
                  <Input
                    id="layout-description"
                    value={newLayoutDescription}
                    onChange={(e) => setNewLayoutDescription(e.target.value)}
                    placeholder="A brief description..."
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSaveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSaveLayout} disabled={!newLayoutName.trim()}>
                  Save Layout
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Separator orientation="vertical" className="h-6" />

          {/* Apply */}
          <Button type="button" onClick={handleApply} className="gap-1.5">
            <Check className="h-4 w-4 shrink-0" aria-hidden />
            Apply Layout
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - Settings */}
        <div className="w-80 flex-shrink-0 border-r">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as typeof activeTab)}
            className="h-full flex flex-col"
          >
            <TabsList className="grid w-full grid-cols-3 mx-4 mt-4" aria-label="Layout designer panels">
              <TabsTrigger value="templates" className="text-xs gap-1">
                <LayoutTemplate className="h-3 w-3 shrink-0" aria-hidden />
                Templates
              </TabsTrigger>
              <TabsTrigger value="sections" className="text-xs gap-1">
                <Layers className="h-3 w-3 shrink-0" aria-hidden />
                Sections
              </TabsTrigger>
              <TabsTrigger value="styles" className="text-xs gap-1">
                <Palette className="h-3 w-3 shrink-0" aria-hidden />
                Styles
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden">
              {/* Templates Tab */}
              <TabsContent value="templates" className="h-full mt-0 p-4">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-6">
                    {/* Current layout info */}
                    <div className="rounded-lg border bg-muted/30 p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          CURRENT LAYOUT
                        </span>
                        {currentLayout.isBuiltIn && (
                          <Badge variant="secondary" className="text-[10px]">
                            Built-in
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium">{currentLayout.name}</p>
                      {currentLayout.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {currentLayout.description}
                        </p>
                      )}
                    </div>

                    {/* View type selector */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">
                        VIEW TYPE
                      </Label>
                      <div className="grid grid-cols-4 gap-2">
                        {(Object.keys(VIEW_TYPE_LABELS) as LayoutViewType[]).map((viewType) => {
                          const Icon = VIEW_TYPE_ICONS[viewType];
                          const { label } = VIEW_TYPE_LABELS[viewType];
                          const isActive = currentLayout.viewType === viewType;

                          return (
                            <TooltipProvider key={viewType}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    type="button"
                                    onClick={() => setViewType(viewType)}
                                    aria-pressed={isActive}
                                    aria-label={`${label} view`}
                                    className={cn(
                                      'flex flex-col items-center gap-1 p-2 min-h-[64px] rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                      isActive
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-transparent hover:border-border hover:bg-muted/50'
                                    )}
                                  >
                                    <Icon className="h-5 w-5 shrink-0" aria-hidden />
                                    <span className="text-[10px] font-medium">{label}</span>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                  {VIEW_TYPE_LABELS[viewType].description}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}
                      </div>
                    </div>

                    {/* Recent layouts */}
                    {recentLayouts.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">
                          RECENT
                        </Label>
                        <div className="space-y-1">
                          {recentLayouts.map((layout) => (
                            <button
                              key={layout.id}
                              type="button"
                              onClick={() => selectLayout(layout.id)}
                              aria-current={currentLayout.id === layout.id ? 'true' : undefined}
                              aria-label={`Select recent layout, ${layout.name}`}
                              className={cn(
                                'w-full text-left p-2 rounded-lg border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                                currentLayout.id === layout.id
                                  ? 'border-primary bg-primary/5'
                                  : 'border-transparent hover:bg-muted/50'
                              )}
                            >
                              <p className="text-sm font-medium truncate">{layout.name}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Built-in templates */}
                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground">
                        BUILT-IN TEMPLATES
                      </Label>
                      <div className="space-y-1">
                        {builtInLayouts.map((layout) => {
                          const Icon = VIEW_TYPE_ICONS[layout.viewType];
                          return (
                            <div
                              key={layout.id}
                              className={cn(
                                'flex items-stretch rounded-lg border transition-all group',
                                currentLayout.id === layout.id
                                  ? 'border-primary bg-primary/5'
                                  : 'border-transparent hover:bg-muted/50'
                              )}
                            >
                              <button
                                type="button"
                                onClick={() => selectLayout(layout.id)}
                                aria-current={currentLayout.id === layout.id ? 'true' : undefined}
                                aria-label={`Select built-in template, ${layout.name}`}
                                className="flex min-w-0 flex-1 items-center gap-2 p-2 text-left rounded-l-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                              >
                                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium truncate">{layout.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {layout.description}
                                  </p>
                                </div>
                              </button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0 self-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"
                                aria-label={`Duplicate template ${layout.name}`}
                                onClick={() => duplicateLayout(layout.id)}
                              >
                                <Copy className="h-3 w-3" aria-hidden />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Saved layouts */}
                    {savedLayouts.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-muted-foreground">
                          MY LAYOUTS
                        </Label>
                        <div className="space-y-1">
                          {savedLayouts.map((saved) => {
                            const Icon = VIEW_TYPE_ICONS[saved.config.viewType];
                            return (
                              <div
                                key={saved.id}
                                className={cn(
                                  'flex items-stretch rounded-lg border transition-all group',
                                  currentLayout.id === saved.id
                                    ? 'border-primary bg-primary/5'
                                    : 'border-transparent hover:bg-muted/50'
                                )}
                              >
                                <button
                                  type="button"
                                  onClick={() => selectLayout(saved.id)}
                                  aria-current={currentLayout.id === saved.id ? 'true' : undefined}
                                  aria-label={`Select saved layout, ${saved.name}`}
                                  className="flex min-w-0 flex-1 items-center gap-2 p-2 text-left rounded-l-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                                >
                                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                                  <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium truncate">{saved.name}</p>
                                    {saved.description && (
                                      <p className="text-xs text-muted-foreground truncate">
                                        {saved.description}
                                      </p>
                                    )}
                                  </div>
                                </button>
                                <div className="flex shrink-0 items-center gap-0.5 pr-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    aria-label={`Export layout ${saved.name}`}
                                    onClick={() => exportLayout(saved.config)}
                                  >
                                    <FileJson className="h-3 w-3" aria-hidden />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    aria-label={`Duplicate layout ${saved.name}`}
                                    onClick={() => duplicateLayout(saved.id)}
                                  >
                                    <Copy className="h-3 w-3" aria-hidden />
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-destructive"
                                    aria-label={`Delete saved layout ${saved.name}`}
                                    onClick={() => deleteSavedLayout(saved.id)}
                                  >
                                    <Trash2 className="h-3 w-3" aria-hidden />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Sections Tab */}
              <TabsContent value="sections" className="h-full mt-0 p-4">
                <ScrollArea className="h-full pr-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-medium text-muted-foreground">
                        LAYOUT SECTIONS
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Drag to reorder
                      </p>
                    </div>

                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={currentLayout.sections.map(s => s.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {currentLayout.sections.map((section) => (
                            <SortableSection
                              key={section.id}
                              section={section}
                              isSelected={selectedSectionId === section.id}
                              onSelect={() => setSelectedSectionId(section.id)}
                              onToggle={() => toggleSection(section.id)}
                              onRemove={() => removeSection(section.id)}
                              onSettings={() => setSelectedSectionId(section.id)}
                              isDragging={activeDragId === section.id}
                            />
                          ))}
                        </div>
                      </SortableContext>

                      <DragOverlay>
                        {activeDragSection && (
                          <div className="opacity-80">
                            <StaticSection section={activeDragSection} />
                          </div>
                        )}
                      </DragOverlay>
                    </DndContext>

                    {/* Section settings panel */}
                    {selectedSection && (
                      <SectionSettingsPanel
                        section={selectedSection}
                        onUpdate={(updates) =>
                          updateSection(selectedSection.id, updates)
                        }
                        onClose={() => setSelectedSectionId(null)}
                      />
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Styles Tab */}
              <TabsContent value="styles" className="h-full mt-0 p-4">
                <ScrollArea className="h-full pr-4">
                  <StyleSettingsPanel
                    layout={currentLayout}
                    onUpdateGlobalStyles={updateGlobalStyles}
                    onUpdatePageSettings={updatePageSettings}
                    onUpdateCardConfig={updateCardConfig}
                    onUpdateGridConfig={updateGridConfig}
                    onUpdateNewspaperConfig={updateNewspaperConfig}
                    onUpdateTimelineConfig={updateTimelineConfig}
                    onUpdateMagazineConfig={updateMagazineConfig}
                  />
                </ScrollArea>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Right panel - Preview */}
        <div className="flex-1 overflow-hidden bg-muted/30">
          <LayoutPreview
            layout={currentLayout}
            scale={previewScale}
            onScaleChange={setPreviewScale}
            mode={previewMode}
          />
        </div>
      </div>
    </div>
  );
};
