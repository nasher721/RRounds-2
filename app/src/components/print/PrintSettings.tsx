import * as React from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import {
  Layers,
  Plus,
  Trash2,
  Pencil,
  LayoutGrid,
  Type,
  FileText,
  Columns3,
  Ruler,
  Search,
  CheckSquare,
  Square,
} from "lucide-react";
import type { PrintSettings as SettingsType, ColumnConfig, ColumnWidthsType, CustomCombination } from "@/lib/print/types";
import { columnCombinations } from "./constants";
import { CustomCombinationDialog } from "./CustomCombinationDialog";

// ── WidthControl sub-component ──────────────────────────────────────────────

interface WidthControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

const WidthControl = ({ label, value, onChange, min = 50, max = 500, step = 5 }: WidthControlProps) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between">
      <Label className="text-xs">{label}: {value}px</Label>
    </div>
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(val) => onChange(val[0])}
    />
  </div>
);

// ── Props (UNCHANGED — no breaking changes) ─────────────────────────────────

interface PrintSettingsProps {
  settings: SettingsType;
  onUpdateSettings: (settings: Partial<SettingsType>) => void;
  onUpdateColumns: (columns: ColumnConfig[]) => void;
  onResetColumns: () => void;
  onToggleCombination?: (combinationKey: string) => void;
  customCombinations?: CustomCombination[];
  onAddCustomCombination?: (combination: CustomCombination) => void;
  onUpdateCustomCombination?: (combination: CustomCombination) => void;
  onDeleteCustomCombination?: (combinationKey: string) => void;
}

// ── Main Component ──────────────────────────────────────────────────────────

export function PrintSettings({
  settings,
  onUpdateSettings,
  onUpdateColumns,
  onResetColumns,
  onToggleCombination,
  customCombinations = [],
  onAddCustomCombination,
  onUpdateCustomCombination,
  onDeleteCustomCombination
}: PrintSettingsProps) {
  const [customDialogOpen, setCustomDialogOpen] = React.useState(false);
  const [editingCombination, setEditingCombination] = React.useState<CustomCombination | undefined>();
  const [columnSearch, setColumnSearch] = React.useState("");

  const fontFamilies = React.useMemo(() => [
    { value: 'system', label: 'System Default' },
    { value: 'arial', label: 'Arial' },
    { value: 'times', label: 'Times New Roman' },
    { value: 'georgia', label: 'Georgia' },
    { value: 'courier', label: 'Courier New' },
    { value: 'verdana', label: 'Verdana' },
    { value: 'trebuchet', label: 'Trebuchet MS' },
  ], []);

  // ── Column helpers ────────────────────────────────────────────────────────

  const handleToggleColumn = (key: string) => {
    const updatedColumns = settings.columns.map(col =>
      col.key === key ? { ...col, enabled: !col.enabled } : col
    );
    onUpdateColumns(updatedColumns);
  };

  const handleSelectAllColumns = () => {
    onUpdateColumns(settings.columns.map(col => ({ ...col, enabled: true })));
  };

  const handleDeselectAllColumns = () => {
    onUpdateColumns(settings.columns.map(col => ({ ...col, enabled: false })));
  };

  const handleToggleCombination = (combinationKey: string) => {
    if (onToggleCombination) {
      onToggleCombination(combinationKey);
    }
  };

  const isCombinationActive = (combinationKey: string) => {
    return (settings.combinedColumns || []).includes(combinationKey);
  };

  const combinedWidthOptions = React.useMemo(() => [
    ...columnCombinations,
    ...customCombinations
  ], [customCombinations]);

  // ── Derived counts ────────────────────────────────────────────────────────

  const enabledColumnsCount = settings.columns.filter(c => c.enabled).length;
  const totalColumnsCount = settings.columns.length;
  const activeCombinationsCount = (settings.combinedColumns || []).length;

  // ── Filtered columns (search) ────────────────────────────────────────────

  const searchLower = columnSearch.toLowerCase();
  const standardColumns = React.useMemo(() =>
    settings.columns.filter(c => !c.key.startsWith('systems.') && c.label.toLowerCase().includes(searchLower)),
    [settings.columns, searchLower]
  );
  const systemColumns = React.useMemo(() =>
    settings.columns.filter(c => c.key.startsWith('systems.') && c.label.toLowerCase().includes(searchLower)),
    [settings.columns, searchLower]
  );

  // ── Enabled-only width controls ───────────────────────────────────────────

  const enabledWidthColumns = React.useMemo(() => {
    const enabledKeys = new Set(settings.columns.filter(c => c.enabled).map(c => c.key));
    const widthMap: Array<{ key: string; label: string; value: number; max?: number }> = [];
    const cw = settings.columnWidths as ColumnWidthsType;

    if (enabledKeys.has('patient')) widthMap.push({ key: 'patient', label: 'Patient', value: cw.patient, max: 300 });
    if (enabledKeys.has('clinicalSummary')) widthMap.push({ key: 'summary', label: 'Summary', value: cw.summary });
    if (enabledKeys.has('intervalEvents')) widthMap.push({ key: 'events', label: 'Events', value: cw.events });
    if (enabledKeys.has('imaging')) widthMap.push({ key: 'imaging', label: 'Imaging', value: cw.imaging, max: 300 });
    if (enabledKeys.has('labs')) widthMap.push({ key: 'labs', label: 'Labs', value: cw.labs, max: 300 });
    if (enabledKeys.has('medications')) widthMap.push({ key: 'medications', label: 'Medications', value: cw.medications, max: 300 });
    if (enabledKeys.has('notes')) widthMap.push({ key: 'notes', label: 'Notes', value: cw.notes, max: 300 });
    if (enabledKeys.has('todos')) widthMap.push({ key: 'todos', label: 'Todos', value: cw.todos || 140, max: 300 });

    // System columns — show a single "Systems" control if any system column is enabled
    const hasEnabledSystem = settings.columns.some(c => c.key.startsWith('systems.') && enabledKeys.has(c.key));
    if (hasEnabledSystem) {
      widthMap.push({ key: 'systems.neuro', label: 'System Columns', value: cw['systems.neuro'], max: 200 });
    }

    return widthMap;
  }, [settings.columns, settings.columnWidths]);

  // ── Width change handler ─────────────────────────────────────────────────

  const handleWidthChange = (key: string, value: number) => {
    if (key === 'systems.neuro') {
      const systemKeys = Object.keys(settings.columnWidths).filter(k => k.startsWith('systems.'));
      const updatedSystems = systemKeys.reduce<Record<string, number>>((acc, k) => {
        acc[k] = value;
        return acc;
      }, {});
      onUpdateSettings({ columnWidths: { ...settings.columnWidths, ...updatedSystems } as ColumnWidthsType });
    } else {
      onUpdateSettings({ columnWidths: { ...settings.columnWidths, [key]: value } as ColumnWidthsType });
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
    <Accordion
      type="multiple"
      defaultValue={["layout", "typography"]}
      className="w-full"
    >
      {/* ── Layout Section (default open) ───────────────────────────────── */}
      <AccordionItem value="layout">
        <AccordionTrigger className="hover:no-underline motion-reduce:transition-none">
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4 text-muted-foreground" />
            <span>Layout</span>
            <Badge variant="outline" className="ml-2 text-xs font-normal">
              {settings.printOrientation === 'portrait' ? 'Portrait' : 'Landscape'}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="motion-reduce:transition-none">
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="orientation">Orientation</Label>
              <div className="flex bg-muted p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ printOrientation: 'portrait' })}
                  className={cn(
                    "px-3 py-1 text-xs rounded-md transition-all motion-reduce:transition-none",
                    settings.printOrientation === 'portrait' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                  )}
                >
                  Portrait
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateSettings({ printOrientation: 'landscape' })}
                  className={cn(
                    "px-3 py-1 text-xs rounded-md transition-all motion-reduce:transition-none",
                    settings.printOrientation === 'landscape' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                  )}
                >
                  Landscape
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="one-per-page">One Patient Per Page</Label>
                <p className="text-xs text-muted-foreground">Force each patient on a new page</p>
              </div>
              <Switch
                id="one-per-page"
                checked={settings.onePatientPerPage}
                onCheckedChange={(checked) => onUpdateSettings({ onePatientPerPage: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label>Margins</Label>
              <Select
                value={settings.margins}
                onValueChange={(value) => onUpdateSettings({ margins: value as SettingsType['margins'] })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select margins" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="narrow">Narrow</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="wide">Wide</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── Typography Section (default open) ───────────────────────────── */}
      <AccordionItem value="typography">
        <AccordionTrigger className="hover:no-underline motion-reduce:transition-none">
          <div className="flex items-center gap-2">
            <Type className="h-4 w-4 text-muted-foreground" />
            <span>Typography</span>
            <Badge variant="outline" className="ml-2 text-xs font-normal">
              {settings.printFontSize}pt
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="motion-reduce:transition-none">
          <div className="grid gap-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Font Family</Label>
              </div>
              <Select
                value={settings.printFontFamily}
                onValueChange={(value) => onUpdateSettings({ printFontFamily: value })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select font" />
                </SelectTrigger>
                <SelectContent>
                  {fontFamilies.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Font Size: {settings.printFontSize}pt</Label>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto-fit"
                    checked={settings.autoFitFontSize}
                    onCheckedChange={(checked) => onUpdateSettings({ autoFitFontSize: checked })}
                  />
                  <Label htmlFor="auto-fit" className="text-xs font-normal text-muted-foreground">Auto-fit</Label>
                </div>
              </div>
              <Slider
                value={[settings.printFontSize]}
                min={6}
                max={16}
                step={1}
                disabled={settings.autoFitFontSize}
                onValueChange={(val) => onUpdateSettings({ printFontSize: val[0] })}
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── Template Options Section ───────────────────────────────────── */}
      <AccordionItem value="template-options">
        <AccordionTrigger className="hover:no-underline motion-reduce:transition-none">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span>Template Options</span>
            <Badge variant="outline" className="ml-2 text-xs font-normal capitalize">
              {settings.headerStyle}
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="motion-reduce:transition-none">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Header Style</Label>
              <Select
                value={settings.headerStyle}
                onValueChange={(value) => onUpdateSettings({ headerStyle: value as SettingsType['headerStyle'] })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select header style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minimal">Minimal</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="detailed">Detailed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Border Style</Label>
              <Select
                value={settings.borderStyle}
                onValueChange={(value) => onUpdateSettings({ borderStyle: value as SettingsType['borderStyle'] })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select border style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="heavy">Heavy</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-page-numbers">Show Page Numbers</Label>
                <p className="text-xs text-muted-foreground">Display page numbers in the header</p>
              </div>
              <Switch
                id="show-page-numbers"
                checked={settings.showPageNumbers}
                onCheckedChange={(checked) => onUpdateSettings({ showPageNumbers: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-timestamp">Show Timestamp</Label>
                <p className="text-xs text-muted-foreground">Include the generated date &amp; time</p>
              </div>
              <Switch
                id="show-timestamp"
                checked={settings.showTimestamp}
                onCheckedChange={(checked) => onUpdateSettings({ showTimestamp: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="alternate-rows">Alternate Row Colors</Label>
                <p className="text-xs text-muted-foreground">Add striping to table rows</p>
              </div>
              <Switch
                id="alternate-rows"
                checked={settings.alternateRowColors}
                onCheckedChange={(checked) => onUpdateSettings({ alternateRowColors: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="compact-mode">Compact Mode</Label>
                <p className="text-xs text-muted-foreground">Reduce spacing for dense layouts</p>
              </div>
              <Switch
                id="compact-mode"
                checked={settings.compactMode}
                onCheckedChange={(checked) => onUpdateSettings({ compactMode: checked })}
              />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── Combine Sections ───────────────────────────────────────────── */}
      {onToggleCombination && (
        <AccordionItem value="combine">
          <AccordionTrigger className="hover:no-underline motion-reduce:transition-none">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <span>Combine Sections</span>
              {activeCombinationsCount > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">
                  {activeCombinationsCount} active
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="motion-reduce:transition-none">
            <p className="text-xs text-muted-foreground mb-4">
              Merge multiple sections into a single column for a more compact print layout.
            </p>

            {/* Preset Combinations */}
            <div className="space-y-2 mb-4">
              <Label className="text-xs font-semibold text-muted-foreground">PRESETS</Label>
              {columnCombinations.map(combo => {
                const isActive = isCombinationActive(combo.key);
                return (
                  <div
                    key={combo.key}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                      isActive
                        ? "bg-primary/10 border-primary"
                        : "bg-muted/30 border-transparent hover:bg-muted/50"
                    )}
                    onClick={() => handleToggleCombination(combo.key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleToggleCombination(combo.key);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id={`combo-${combo.key}`}
                        checked={isActive}
                        onCheckedChange={() => handleToggleCombination(combo.key)}
                      />
                      <Label
                        htmlFor={`combo-${combo.key}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {combo.label}
                      </Label>
                    </div>
                    {isActive && (
                      <Badge variant="secondary" className="text-xs">
                        Active
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Custom Combinations */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-muted-foreground">CUSTOM</Label>
                {onAddCustomCombination && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => {
                      setEditingCombination(undefined);
                      setCustomDialogOpen(true);
                    }}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                )}
              </div>

              {customCombinations.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">
                  No custom combinations yet. Click &quot;Add&quot; to create one.
                </p>
              ) : (
                customCombinations.map(combo => {
                  const isActive = isCombinationActive(combo.key);
                  return (
                    <div
                      key={combo.key}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border transition-colors",
                        isActive
                          ? "bg-primary/10 border-primary"
                          : "bg-muted/30 border-transparent hover:bg-muted/50"
                      )}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        className="flex items-center gap-2 flex-1 cursor-pointer"
                        onClick={() => handleToggleCombination(combo.key)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleToggleCombination(combo.key);
                          }
                        }}
                      >
                        <Checkbox
                          id={`combo-${combo.key}`}
                          checked={isActive}
                          onCheckedChange={() => handleToggleCombination(combo.key)}
                        />
                        <div className="flex flex-col">
                          <Label
                            htmlFor={`combo-${combo.key}`}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {combo.label}
                          </Label>
                          <span className="text-xs text-muted-foreground">
                            {combo.columns.length} sections
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {isActive && (
                          <Badge variant="secondary" className="text-xs mr-1">
                            Active
                          </Badge>
                        )}
                        {onUpdateCustomCombination && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingCombination(combo);
                              setCustomDialogOpen(true);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                        {onDeleteCustomCombination && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteCustomCombination(combo.key);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      )}

      {/* ── Columns Section ────────────────────────────────────────────── */}
      <AccordionItem value="columns">
        <AccordionTrigger className="hover:no-underline motion-reduce:transition-none">
          <div className="flex items-center gap-2">
            <Columns3 className="h-4 w-4 text-muted-foreground" />
            <span>Columns</span>
            <Badge variant="outline" className="ml-2 text-xs font-normal">
              {enabledColumnsCount}/{totalColumnsCount} enabled
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="motion-reduce:transition-none">
          {/* Search + Select All / Deselect All */}
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Filter columns…"
                value={columnSearch}
                onChange={(e) => setColumnSearch(e.target.value)}
                className="h-7 pl-8 text-xs"
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAllColumns}
              className="h-7 text-xs px-2 shrink-0"
              title="Select all columns"
            >
              <CheckSquare className="h-3.5 w-3.5 mr-1" />
              All
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeselectAllColumns}
              className="h-7 text-xs px-2 shrink-0"
              title="Deselect all columns"
            >
              <Square className="h-3.5 w-3.5 mr-1" />
              None
            </Button>
            <Button variant="ghost" size="sm" onClick={onResetColumns} className="h-7 text-xs px-2 shrink-0">
              Reset
            </Button>
          </div>

          <ScrollArea className="h-[250px] pr-4 border rounded-md p-2">
            <div className="space-y-2">
              {standardColumns.length > 0 &&
                standardColumns.map(col => (
                  <div key={col.key} className="flex items-center space-x-2">
                    <Checkbox
                      id={`col-${col.key}`}
                      checked={col.enabled}
                      onCheckedChange={() => handleToggleColumn(col.key)}
                    />
                    <Label htmlFor={`col-${col.key}`} className="text-sm font-normal cursor-pointer">
                      {col.label}
                    </Label>
                  </div>
                ))
              }

              {systemColumns.length > 0 && (
                <>
                  <div className="pt-2 pb-1">
                    <Label className="text-xs font-semibold text-muted-foreground">SYSTEMS</Label>
                  </div>
                  {systemColumns.map(col => (
                    <div key={col.key} className="flex items-center space-x-2 pl-2 border-l-2 border-muted ml-1">
                      <Checkbox
                        id={`col-${col.key}`}
                        checked={col.enabled}
                        onCheckedChange={() => handleToggleColumn(col.key)}
                      />
                      <Label htmlFor={`col-${col.key}`} className="text-sm font-normal cursor-pointer">
                        {col.label}
                      </Label>
                    </div>
                  ))}
                </>
              )}

              {standardColumns.length === 0 && systemColumns.length === 0 && columnSearch && (
                <p className="text-xs text-muted-foreground italic py-2 text-center">
                  No columns match &quot;{columnSearch}&quot;
                </p>
              )}
            </div>
          </ScrollArea>
        </AccordionContent>
      </AccordionItem>

      {/* ── Column Widths Section ──────────────────────────────────────── */}
      <AccordionItem value="widths">
        <AccordionTrigger className="hover:no-underline motion-reduce:transition-none">
          <div className="flex items-center gap-2">
            <Ruler className="h-4 w-4 text-muted-foreground" />
            <span>Column Widths</span>
            <Badge variant="outline" className="ml-2 text-xs font-normal">
              {enabledWidthColumns.length} adjustable
            </Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent className="motion-reduce:transition-none">
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Adjust widths for enabled columns. Changes apply immediately.
            </p>

            {enabledWidthColumns.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-2 text-center">
                Enable columns in the Columns section to adjust their widths.
              </p>
            ) : (
              <div className="grid gap-4">
                {enabledWidthColumns.map(col => (
                  <WidthControl
                    key={col.key}
                    label={col.label}
                    value={col.value}
                    onChange={(v) => handleWidthChange(col.key, v)}
                    max={col.max}
                  />
                ))}

                {/* Combined Column Widths (only for active combinations) */}
                {settings.combinedColumns.length > 0 && (
                  <div className="pt-2 border-t">
                    <Label className="text-xs font-semibold text-muted-foreground mb-3 block">
                      COMBINED COLUMN WIDTHS
                    </Label>
                    {combinedWidthOptions
                      .filter(option => settings.combinedColumns.includes(option.key))
                      .map(option => (
                        <WidthControl
                          key={option.key}
                          label={option.label}
                          value={settings.combinedColumnWidths[option.key] || 240}
                          onChange={(v) => onUpdateSettings({
                            combinedColumnWidths: {
                              ...settings.combinedColumnWidths,
                              [option.key]: v
                            }
                          })}
                          max={600}
                        />
                      ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>

    <CustomCombinationDialog
      open={customDialogOpen}
      onOpenChange={setCustomDialogOpen}
      existingCombination={editingCombination}
      onSave={(combo) => {
        if (editingCombination && onUpdateCustomCombination) {
          onUpdateCustomCombination(combo);
        } else if (onAddCustomCombination) {
          onAddCustomCombination(combo);
        }
      }}
    />
    </>
  );
}
