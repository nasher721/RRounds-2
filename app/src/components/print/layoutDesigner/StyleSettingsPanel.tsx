/**
 * StyleSettingsPanel Component
 * Panel for configuring global layout styles and page settings
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  ChevronDown,
  Type,
  Palette,
  FileText,
  LayoutGrid,
  Columns,
  Grid3x3,
  Clock,
  BookOpen,
} from 'lucide-react';
import type {
  LayoutConfig,
  GlobalLayoutStyles,
  PageSettings,
  CardLayoutConfig,
  GridLayoutConfig,
  NewspaperLayoutConfig,
  TimelineLayoutConfig,
  MagazineLayoutConfig,
} from '@/types/layoutDesigner';

interface StyleSettingsPanelProps {
  layout: LayoutConfig;
  onUpdateGlobalStyles: (updates: Partial<GlobalLayoutStyles>) => void;
  onUpdatePageSettings: (updates: Partial<PageSettings>) => void;
  onUpdateCardConfig?: (updates: Partial<CardLayoutConfig>) => void;
  onUpdateGridConfig?: (updates: Partial<GridLayoutConfig>) => void;
  onUpdateNewspaperConfig?: (updates: Partial<NewspaperLayoutConfig>) => void;
  onUpdateTimelineConfig?: (updates: Partial<TimelineLayoutConfig>) => void;
  onUpdateMagazineConfig?: (updates: Partial<MagazineLayoutConfig>) => void;
}

// Font family options
const FONT_FAMILIES = [
  { value: 'system', label: 'System Default' },
  { value: 'arial', label: 'Arial' },
  { value: 'times', label: 'Times New Roman' },
  { value: 'georgia', label: 'Georgia' },
  { value: 'courier', label: 'Courier New' },
  { value: 'verdana', label: 'Verdana' },
  { value: 'trebuchet', label: 'Trebuchet MS' },
];

// Color presets
const COLOR_PRESETS = {
  blue: { primary: '#3b82f6', accent: '#60a5fa', secondary: '#64748b' },
  green: { primary: '#059669', accent: '#10b981', secondary: '#64748b' },
  purple: { primary: '#7c3aed', accent: '#a78bfa', secondary: '#64748b' },
  red: { primary: '#dc2626', accent: '#f87171', secondary: '#64748b' },
  orange: { primary: '#ea580c', accent: '#fb923c', secondary: '#64748b' },
  teal: { primary: '#0891b2', accent: '#22d3ee', secondary: '#64748b' },
  pink: { primary: '#db2777', accent: '#f472b6', secondary: '#64748b' },
  neutral: { primary: '#374151', accent: '#6b7280', secondary: '#9ca3af' },
};

export const StyleSettingsPanel = ({
  layout,
  onUpdateGlobalStyles,
  onUpdatePageSettings,
  onUpdateCardConfig,
  onUpdateGridConfig,
  onUpdateNewspaperConfig,
  onUpdateTimelineConfig,
  onUpdateMagazineConfig,
}: StyleSettingsPanelProps) => {
  const [typographyOpen, setTypographyOpen] = React.useState(true);
  const [colorsOpen, setColorsOpen] = React.useState(true);
  const [pageOpen, setPageOpen] = React.useState(true);
  const [layoutSpecificOpen, setLayoutSpecificOpen] = React.useState(true);

  const { globalStyles, pageSettings, viewType } = layout;

  return (
    <div className="space-y-4">
      {/* Typography */}
      <Collapsible open={typographyOpen} onOpenChange={setTypographyOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between h-9 px-2">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Type className="h-4 w-4" />
              Typography
            </span>
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', typographyOpen && 'rotate-180')}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3 px-1">
          {/* Font family */}
          <div className="space-y-2">
            <Label className="text-xs">Font Family</Label>
            <Select
              value={globalStyles.fontFamily}
              onValueChange={(value) => onUpdateGlobalStyles({ fontFamily: value })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FONT_FAMILIES.map((font) => (
                  <SelectItem key={font.value} value={font.value}>
                    {font.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Font size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Font Size: {globalStyles.fontSize}pt</Label>
            </div>
            <Slider
              value={[globalStyles.fontSize]}
              min={6}
              max={16}
              step={1}
              onValueChange={([value]) => onUpdateGlobalStyles({ fontSize: value })}
            />
          </div>

          {/* Line height */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Line Height: {globalStyles.lineHeight}</Label>
            </div>
            <Slider
              value={[globalStyles.lineHeight * 10]}
              min={10}
              max={20}
              step={1}
              onValueChange={([value]) => onUpdateGlobalStyles({ lineHeight: value / 10 })}
            />
          </div>

          {/* Spacing */}
          <div className="space-y-2">
            <Label className="text-xs">Spacing</Label>
            <div className="flex bg-muted p-1 rounded-lg">
              {(['compact', 'normal', 'relaxed'] as const).map((spacing) => (
                <button
                  key={spacing}
                  onClick={() => onUpdateGlobalStyles({ spacing })}
                  className={cn(
                    'flex-1 px-2 py-1 text-xs rounded-md transition-all capitalize',
                    globalStyles.spacing === spacing
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {spacing}
                </button>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Colors */}
      <Collapsible open={colorsOpen} onOpenChange={setColorsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between h-9 px-2">
            <span className="flex items-center gap-2 text-sm font-medium">
              <Palette className="h-4 w-4" />
              Colors & Style
            </span>
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', colorsOpen && 'rotate-180')}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3 px-1">
          {/* Color presets */}
          <div className="space-y-2">
            <Label className="text-xs">Color Theme</Label>
            <div className="grid grid-cols-4 gap-2">
              {Object.entries(COLOR_PRESETS).map(([name, colors]) => (
                <button
                  key={name}
                  onClick={() =>
                    onUpdateGlobalStyles({
                      primaryColor: colors.primary,
                      accentColor: colors.accent,
                      secondaryColor: colors.secondary,
                    })
                  }
                  className={cn(
                    'flex flex-col items-center gap-1 p-2 rounded-lg border transition-all',
                    globalStyles.primaryColor === colors.primary
                      ? 'border-primary ring-1 ring-primary/50'
                      : 'border-transparent hover:bg-muted/50'
                  )}
                >
                  <div
                    className="w-6 h-6 rounded-full"
                    style={{ backgroundColor: colors.primary }}
                  />
                  <span className="text-[10px] capitalize text-muted-foreground">{name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Custom colors */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Primary</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={globalStyles.primaryColor}
                  onChange={(e) => onUpdateGlobalStyles({ primaryColor: e.target.value })}
                  className="h-8 w-10 p-1"
                />
                <Input
                  value={globalStyles.primaryColor}
                  onChange={(e) => onUpdateGlobalStyles({ primaryColor: e.target.value })}
                  className="h-8 text-xs flex-1"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Accent</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={globalStyles.accentColor}
                  onChange={(e) => onUpdateGlobalStyles({ accentColor: e.target.value })}
                  className="h-8 w-10 p-1"
                />
                <Input
                  value={globalStyles.accentColor}
                  onChange={(e) => onUpdateGlobalStyles({ accentColor: e.target.value })}
                  className="h-8 text-xs flex-1"
                />
              </div>
            </div>
          </div>

          {/* Border style */}
          <div className="space-y-2">
            <Label className="text-xs">Border Style</Label>
            <div className="flex bg-muted p-1 rounded-lg">
              {(['none', 'light', 'medium', 'heavy'] as const).map((style) => (
                <button
                  key={style}
                  onClick={() => onUpdateGlobalStyles({ borderStyle: style })}
                  className={cn(
                    'flex-1 px-2 py-1 text-xs rounded-md transition-all capitalize',
                    globalStyles.borderStyle === style
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {style}
                </button>
              ))}
            </div>
          </div>

          {/* Border radius */}
          <div className="space-y-2">
            <Label className="text-xs">Border Radius</Label>
            <div className="flex bg-muted p-1 rounded-lg">
              {(['none', 'small', 'medium', 'large'] as const).map((radius) => (
                <button
                  key={radius}
                  onClick={() => onUpdateGlobalStyles({ borderRadius: radius })}
                  className={cn(
                    'flex-1 px-2 py-1 text-xs rounded-md transition-all capitalize',
                    globalStyles.borderRadius === radius
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {radius}
                </button>
              ))}
            </div>
          </div>

          {/* Shadow style */}
          <div className="space-y-2">
            <Label className="text-xs">Shadow</Label>
            <div className="flex bg-muted p-1 rounded-lg">
              {(['none', 'subtle', 'medium', 'strong'] as const).map((shadow) => (
                <button
                  key={shadow}
                  onClick={() => onUpdateGlobalStyles({ shadowStyle: shadow })}
                  className={cn(
                    'flex-1 px-2 py-1 text-xs rounded-md transition-all capitalize',
                    globalStyles.shadowStyle === shadow
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {shadow}
                </button>
              ))}
            </div>
          </div>

          {/* Header style */}
          <div className="space-y-2">
            <Label className="text-xs">Header Style</Label>
            <Select
              value={globalStyles.headerStyle}
              onValueChange={(value) =>
                onUpdateGlobalStyles({ headerStyle: value as GlobalLayoutStyles['headerStyle'] })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="minimal">Minimal</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="detailed">Detailed</SelectItem>
                <SelectItem value="branded">Branded</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Page Settings */}
      <Collapsible open={pageOpen} onOpenChange={setPageOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between h-9 px-2">
            <span className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4" />
              Page Settings
            </span>
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', pageOpen && 'rotate-180')}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3 px-1">
          {/* Orientation */}
          <div className="space-y-2">
            <Label className="text-xs">Orientation</Label>
            <div className="flex bg-muted p-1 rounded-lg">
              <button
                onClick={() => onUpdatePageSettings({ orientation: 'portrait' })}
                className={cn(
                  'flex-1 px-3 py-1 text-xs rounded-md transition-all',
                  pageSettings.orientation === 'portrait'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Portrait
              </button>
              <button
                onClick={() => onUpdatePageSettings({ orientation: 'landscape' })}
                className={cn(
                  'flex-1 px-3 py-1 text-xs rounded-md transition-all',
                  pageSettings.orientation === 'landscape'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Landscape
              </button>
            </div>
          </div>

          {/* Margins */}
          <div className="space-y-2">
            <Label className="text-xs">Margins</Label>
            <div className="flex bg-muted p-1 rounded-lg">
              {(['narrow', 'normal', 'wide'] as const).map((margin) => (
                <button
                  key={margin}
                  onClick={() => onUpdatePageSettings({ margins: margin })}
                  className={cn(
                    'flex-1 px-2 py-1 text-xs rounded-md transition-all capitalize',
                    pageSettings.margins === margin
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {margin}
                </button>
              ))}
            </div>
          </div>

          {/* Patients per page */}
          <div className="space-y-2">
            <Label className="text-xs">Patients Per Page</Label>
            <Select
              value={String(pageSettings.patientsPerPage)}
              onValueChange={(value) =>
                onUpdatePageSettings({
                  patientsPerPage: value === 'auto' ? 'auto' : parseInt(value, 10),
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="6">6</SelectItem>
                <SelectItem value="8">8</SelectItem>
                <SelectItem value="12">12</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs">One Patient Per Page</Label>
              <Switch
                checked={pageSettings.onePatientPerPage}
                onCheckedChange={(checked) =>
                  onUpdatePageSettings({ onePatientPerPage: checked })
                }
                className="scale-75"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Show Page Numbers</Label>
              <Switch
                checked={pageSettings.showPageNumbers}
                onCheckedChange={(checked) =>
                  onUpdatePageSettings({ showPageNumbers: checked })
                }
                className="scale-75"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Show Timestamp</Label>
              <Switch
                checked={pageSettings.showTimestamp}
                onCheckedChange={(checked) =>
                  onUpdatePageSettings({ showTimestamp: checked })
                }
                className="scale-75"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Show Header</Label>
              <Switch
                checked={pageSettings.showHeader}
                onCheckedChange={(checked) =>
                  onUpdatePageSettings({ showHeader: checked })
                }
                className="scale-75"
              />
            </div>

            <div className="flex items-center justify-between">
              <Label className="text-xs">Page Break Between Patients</Label>
              <Switch
                checked={pageSettings.pageBreakBetweenPatients}
                onCheckedChange={(checked) =>
                  onUpdatePageSettings({ pageBreakBetweenPatients: checked })
                }
                className="scale-75"
              />
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Layout-Specific Settings */}
      <Collapsible open={layoutSpecificOpen} onOpenChange={setLayoutSpecificOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between h-9 px-2">
            <span className="flex items-center gap-2 text-sm font-medium">
              {viewType === 'cards' && <LayoutGrid className="h-4 w-4" />}
              {viewType === 'grid' && <Grid3x3 className="h-4 w-4" />}
              {viewType === 'newspaper' && <Columns className="h-4 w-4" />}
              {viewType === 'timeline' && <Clock className="h-4 w-4" />}
              {viewType === 'magazine' && <BookOpen className="h-4 w-4" />}
              {!['cards', 'grid', 'newspaper', 'timeline', 'magazine'].includes(viewType) && (
                <LayoutGrid className="h-4 w-4" />
              )}
              Layout Options
            </span>
            <ChevronDown
              className={cn('h-4 w-4 transition-transform', layoutSpecificOpen && 'rotate-180')}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-3 px-1">
          {/* Card layout options */}
          {viewType === 'cards' && layout.cardConfig && onUpdateCardConfig && (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Columns</Label>
                <div className="flex bg-muted p-1 rounded-lg">
                  {([1, 2, 3, 4] as const).map((cols) => (
                    <button
                      key={cols}
                      onClick={() => onUpdateCardConfig({ columns: cols })}
                      className={cn(
                        'flex-1 px-2 py-1 text-xs rounded-md transition-all',
                        layout.cardConfig?.columns === cols
                          ? 'bg-background shadow-sm text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {cols}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Card Style</Label>
                <Select
                  value={layout.cardConfig.cardStyle}
                  onValueChange={(value) =>
                    onUpdateCardConfig({ cardStyle: value as CardLayoutConfig['cardStyle'] })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flat">Flat</SelectItem>
                    <SelectItem value="elevated">Elevated</SelectItem>
                    <SelectItem value="bordered">Bordered</SelectItem>
                    <SelectItem value="glass">Glass</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Gap</Label>
                <div className="flex bg-muted p-1 rounded-lg">
                  {(['none', 'small', 'medium', 'large'] as const).map((gap) => (
                    <button
                      key={gap}
                      onClick={() => onUpdateCardConfig({ gap })}
                      className={cn(
                        'flex-1 px-2 py-1 text-xs rounded-md transition-all capitalize',
                        layout.cardConfig?.gap === gap
                          ? 'bg-background shadow-sm text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {gap}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Show Dividers</Label>
                <Switch
                  checked={layout.cardConfig.showDividers}
                  onCheckedChange={(checked) =>
                    onUpdateCardConfig({ showDividers: checked })
                  }
                  className="scale-75"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Compact Sections</Label>
                <Switch
                  checked={layout.cardConfig.compactSections}
                  onCheckedChange={(checked) =>
                    onUpdateCardConfig({ compactSections: checked })
                  }
                  className="scale-75"
                />
              </div>
            </>
          )}

          {/* Grid layout options */}
          {viewType === 'grid' && layout.gridConfig && onUpdateGridConfig && (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Rows: {layout.gridConfig.rows}</Label>
                <Slider
                  value={[layout.gridConfig.rows]}
                  min={1}
                  max={4}
                  step={1}
                  onValueChange={([value]) => onUpdateGridConfig({ rows: value })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Columns: {layout.gridConfig.columns}</Label>
                <Slider
                  value={[layout.gridConfig.columns]}
                  min={1}
                  max={4}
                  step={1}
                  onValueChange={([value]) => onUpdateGridConfig({ columns: value })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Cell Spacing: {layout.gridConfig.cellSpacing}px</Label>
                <Slider
                  value={[layout.gridConfig.cellSpacing]}
                  min={0}
                  max={32}
                  step={4}
                  onValueChange={([value]) => onUpdateGridConfig({ cellSpacing: value })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Equal Cell Sizes</Label>
                <Switch
                  checked={layout.gridConfig.equalCells}
                  onCheckedChange={(checked) =>
                    onUpdateGridConfig({ equalCells: checked })
                  }
                  className="scale-75"
                />
              </div>
            </>
          )}

          {/* Newspaper layout options */}
          {viewType === 'newspaper' && layout.newspaperConfig && onUpdateNewspaperConfig && (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Columns</Label>
                <div className="flex bg-muted p-1 rounded-lg">
                  {([2, 3, 4] as const).map((cols) => (
                    <button
                      key={cols}
                      onClick={() => onUpdateNewspaperConfig({ columns: cols })}
                      className={cn(
                        'flex-1 px-2 py-1 text-xs rounded-md transition-all',
                        layout.newspaperConfig?.columns === cols
                          ? 'bg-background shadow-sm text-foreground'
                          : 'text-muted-foreground hover:text-foreground'
                      )}
                    >
                      {cols}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Column Gap: {layout.newspaperConfig.columnGap}px</Label>
                <Slider
                  value={[layout.newspaperConfig.columnGap]}
                  min={8}
                  max={48}
                  step={4}
                  onValueChange={([value]) => onUpdateNewspaperConfig({ columnGap: value })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Show Column Rules</Label>
                <Switch
                  checked={layout.newspaperConfig.showColumnRules}
                  onCheckedChange={(checked) =>
                    onUpdateNewspaperConfig({ showColumnRules: checked })
                  }
                  className="scale-75"
                />
              </div>
            </>
          )}

          {/* Timeline layout options */}
          {viewType === 'timeline' && layout.timelineConfig && onUpdateTimelineConfig && (
            <>
              <div className="space-y-2">
                <Label className="text-xs">Orientation</Label>
                <div className="flex bg-muted p-1 rounded-lg">
                  <button
                    onClick={() => onUpdateTimelineConfig({ orientation: 'vertical' })}
                    className={cn(
                      'flex-1 px-2 py-1 text-xs rounded-md transition-all',
                      layout.timelineConfig?.orientation === 'vertical'
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Vertical
                  </button>
                  <button
                    onClick={() => onUpdateTimelineConfig({ orientation: 'horizontal' })}
                    className={cn(
                      'flex-1 px-2 py-1 text-xs rounded-md transition-all',
                      layout.timelineConfig?.orientation === 'horizontal'
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Horizontal
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Node Style</Label>
                <Select
                  value={layout.timelineConfig.nodeStyle}
                  onValueChange={(value) =>
                    onUpdateTimelineConfig({ nodeStyle: value as TimelineLayoutConfig['nodeStyle'] })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="circle">Circle</SelectItem>
                    <SelectItem value="square">Square</SelectItem>
                    <SelectItem value="diamond">Diamond</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Show Connectors</Label>
                <Switch
                  checked={layout.timelineConfig.showConnectors}
                  onCheckedChange={(checked) =>
                    onUpdateTimelineConfig({ showConnectors: checked })
                  }
                  className="scale-75"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-xs">Alternating Layout</Label>
                <Switch
                  checked={layout.timelineConfig.alternating}
                  onCheckedChange={(checked) =>
                    onUpdateTimelineConfig({ alternating: checked })
                  }
                  className="scale-75"
                />
              </div>
            </>
          )}

          {/* Magazine layout options */}
          {viewType === 'magazine' && layout.magazineConfig && onUpdateMagazineConfig && (
            <>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Hero Patient</Label>
                <Switch
                  checked={layout.magazineConfig.heroPatient}
                  onCheckedChange={(checked) =>
                    onUpdateMagazineConfig({ heroPatient: checked })
                  }
                  className="scale-75"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Hero Size</Label>
                <div className="flex bg-muted p-1 rounded-lg">
                  <button
                    onClick={() => onUpdateMagazineConfig({ heroSize: 'medium' })}
                    className={cn(
                      'flex-1 px-2 py-1 text-xs rounded-md transition-all',
                      layout.magazineConfig?.heroSize === 'medium'
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Medium
                  </button>
                  <button
                    onClick={() => onUpdateMagazineConfig({ heroSize: 'large' })}
                    className={cn(
                      'flex-1 px-2 py-1 text-xs rounded-md transition-all',
                      layout.magazineConfig?.heroSize === 'large'
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Large
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Grid Style</Label>
                <div className="flex bg-muted p-1 rounded-lg">
                  <button
                    onClick={() => onUpdateMagazineConfig({ gridStyle: 'uniform' })}
                    className={cn(
                      'flex-1 px-2 py-1 text-xs rounded-md transition-all',
                      layout.magazineConfig?.gridStyle === 'uniform'
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Uniform
                  </button>
                  <button
                    onClick={() => onUpdateMagazineConfig({ gridStyle: 'masonry' })}
                    className={cn(
                      'flex-1 px-2 py-1 text-xs rounded-md transition-all',
                      layout.magazineConfig?.gridStyle === 'masonry'
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Masonry
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Default message for unsupported types */}
          {!['cards', 'grid', 'newspaper', 'timeline', 'magazine'].includes(viewType) && (
            <p className="text-xs text-muted-foreground text-center py-4">
              No additional options for this layout type.
            </p>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
