import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ScrollArea,
} from "@/components/ui/scroll-area";
import {
  Type,
  ArrowUpDown,
  LogOut,
  Printer,
  Trash2,
  Sparkles,
  PenLine,
  ListTodo,
  FileText,
  TestTube,
  Eye,
  Calendar,
  ImageIcon,
  Pill,
  Activity,
  RotateCcw,
  Users,
  Sun,
  Moon,
  Laptop,
  Contrast,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  Palette,
  Bell,
  ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSettings } from "@/contexts/SettingsContext";
import { useTheme } from "@/components/theme-provider";
import {
  CLINICAL_SECTIONS,
  DEFAULT_SECTION_VISIBILITY,
  MIN_GLOBAL_FONT_SIZE_PX,
  MAX_GLOBAL_FONT_SIZE_PX,
  type ClinicalSectionKey,
} from "@/constants/config";
import { SpecialtySelectionPanel } from "@/components/settings/SpecialtySelectionPanel";
import { AIModelSettingsPanel } from "@/components/settings/AIModelSettingsPanel";
import { ObservabilitySupportCard } from "@/components/settings/ObservabilitySupportCard";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  Calendar,
  ImageIcon,
  TestTube,
  Pill,
  Activity,
};

interface MobileSettingsPanelProps {
  globalFontSize: number;
  onFontSizeChange: (size: number) => void;
  sortBy: "number" | "room" | "name";
  onSortChange: (sort: "number" | "room" | "name") => void;
  changeTracking: {
    enabled: boolean;
    color: string;
    styles: { textColor: boolean; backgroundColor: boolean; italic: boolean };
    toggleEnabled: () => void;
    setColor: (color: string) => void;
    toggleStyle: (style: "textColor" | "backgroundColor" | "italic") => void;
  };
  onSignOut: () => void;
  onOpenPrint: () => void;
  onClearAll: () => void;
  onOpenAutotexts: () => void;
  onOpenPhrases: () => void;
  onOpenBatchCourse?: () => void;
  userEmail?: string;
  todosAlwaysVisible?: boolean;
  onTodosAlwaysVisibleChange?: (visible: boolean) => void;
  showLabFishbones?: boolean;
  onShowLabFishbonesChange?: (show: boolean) => void;
  patientCount?: number;
  editorToolbarMode?: 'minimal' | 'full' | 'custom';
  onEditorToolbarModeChange?: (mode: 'minimal' | 'full' | 'custom') => void;
}

const colorPresets = [
  "#ef4444", // red
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#3b82f6", // blue
  "#8b5cf6", // purple
];

type SettingsSection = "display" | "sections" | "tracking" | "actions" | null;

export const MobileSettingsPanel = ({
  globalFontSize,
  onFontSizeChange,
  sortBy,
  onSortChange,
  changeTracking,
  onSignOut,
  onOpenPrint,
  onClearAll,
  onOpenAutotexts,
  onOpenPhrases,
  onOpenBatchCourse,
  userEmail,
  todosAlwaysVisible = false,
  onTodosAlwaysVisibleChange,
  showLabFishbones = true,
  onShowLabFishbonesChange,
  patientCount = 0,
  editorToolbarMode = 'minimal',
  onEditorToolbarModeChange,
}: MobileSettingsPanelProps) => {
  const { sectionVisibility, setSectionVisibility, resetSectionVisibility } = useSettings();
  const { theme, setTheme, highContrast, setHighContrast } = useTheme();
  const [expandedSection, setExpandedSection] = React.useState<SettingsSection>(null);

  const toggleSection = (key: ClinicalSectionKey) => {
    setSectionVisibility({
      ...sectionVisibility,
      [key]: !sectionVisibility[key],
    });
  };

  const visibleSectionCount = CLINICAL_SECTIONS.filter(s => sectionVisibility[s.key]).length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-4 border-b border-border/50 bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <SlidersHorizontal className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-base tracking-tight">Settings</h2>
            {userEmail && (
              <p className="text-sm text-muted-foreground mt-0.5 truncate">{userEmail}</p>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3 pb-8">

          {/* --- Display Section --- */}
          <Collapsible
            open={expandedSection === 'display'}
            onOpenChange={(open) => setExpandedSection(open ? 'display' : null)}
          >
            <Card className="rounded-2xl border-border/50 overflow-hidden">
              <CollapsibleTrigger asChild>
                <button className="w-full px-4 py-3.5 flex items-center justify-between min-h-[48px]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Palette className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="font-semibold text-sm tracking-tight">Display</span>
                  </div>
                  {expandedSection === 'display' ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 px-4 pb-4 space-y-5">
                  {/* Font Size */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Type className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Font Size</span>
                      </div>
                      <span className="text-sm font-mono text-muted-foreground tabular-nums">
                        {globalFontSize}px
                      </span>
                    </div>
                    <Slider
                      value={[globalFontSize]}
                      min={MIN_GLOBAL_FONT_SIZE_PX}
                      max={MAX_GLOBAL_FONT_SIZE_PX}
                      step={1}
                      onValueChange={(v) => onFontSizeChange(v[0])}
                      className="w-full"
                    />
                  </div>

                  {/* Theme */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {theme === "dark" ? (
                        <Moon className="h-4 w-4 text-muted-foreground" />
                      ) : theme === "light" ? (
                        <Sun className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Laptop className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm font-medium">Theme</span>
                    </div>
                    <Select value={theme} onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}>
                      <SelectTrigger className="w-32 h-9 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">
                          <div className="flex items-center gap-2">
                            <Sun className="h-3 w-3" />
                            <span>Light</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="dark">
                          <div className="flex items-center gap-2">
                            <Moon className="h-3 w-3" />
                            <span>Dark</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="system">
                          <div className="flex items-center gap-2">
                            <Laptop className="h-3 w-3" />
                            <span>System</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* High Contrast */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Contrast className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden="true" />
                      <Label htmlFor="mobile-high-contrast" className="text-sm font-medium cursor-pointer">
                        High contrast
                      </Label>
                    </div>
                    <Switch
                      id="mobile-high-contrast"
                      checked={highContrast}
                      onCheckedChange={setHighContrast}
                      aria-label="High contrast"
                    />
                  </div>

                  {/* Sort By */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Sort By</span>
                    </div>
                    <Select value={sortBy} onValueChange={(v) => onSortChange(v as "number" | "room" | "name")}>
                      <SelectTrigger className="w-36 h-9 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="number">Order Added</SelectItem>
                        <SelectItem value="room">Room</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Editor Toolbar */}
                  {onEditorToolbarModeChange && (
                    <div className="space-y-2">
                      <span className="text-sm font-medium">Text box toolbar</span>
                      <Select value={editorToolbarMode} onValueChange={(v) => onEditorToolbarModeChange(v as 'minimal' | 'full' | 'custom')}>
                        <SelectTrigger className="w-full h-10 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="minimal">Minimal (essential + More)</SelectItem>
                          <SelectItem value="full">Full</SelectItem>
                          <SelectItem value="custom">Custom</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Specialty / Role */}
          <SpecialtySelectionPanel />

          {/* --- Preferences Toggles --- */}
          <div className="space-y-3">
            {/* Todos Always Visible */}
            <Card className="rounded-2xl border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ListTodo className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div>
                      <Label htmlFor="mobile-todos-visible" className="text-sm font-medium cursor-pointer">
                        Todos Always Visible
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Show inline instead of popup
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="mobile-todos-visible"
                    checked={todosAlwaysVisible}
                    onCheckedChange={onTodosAlwaysVisibleChange}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Lab Fishbone */}
            <Card className="rounded-2xl border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <TestTube className="h-3.5 w-3.5 text-amber-600" />
                    </div>
                    <div>
                      <Label htmlFor="mobile-lab-fishbones" className="text-sm font-medium cursor-pointer">
                        Lab Fishbone Display
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Show BMP/CBC in graphical fishbone format
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="mobile-lab-fishbones"
                    checked={showLabFishbones}
                    onCheckedChange={onShowLabFishbonesChange}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* --- Section Visibility --- */}
          <Collapsible
            open={expandedSection === 'sections'}
            onOpenChange={(open) => setExpandedSection(open ? 'sections' : null)}
          >
            <Card className="rounded-2xl border-border/50 overflow-hidden">
              <CollapsibleTrigger asChild>
                <button className="w-full px-4 py-3.5 flex items-center justify-between min-h-[48px]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                      <Eye className="h-3.5 w-3.5 text-emerald-600" />
                    </div>
                    <span className="font-semibold text-sm tracking-tight">Section Visibility</span>
                    <Badge variant="secondary" className="rounded-lg text-[10px] font-medium ml-1">
                      {visibleSectionCount}/{CLINICAL_SECTIONS.length}
                    </Badge>
                  </div>
                  {expandedSection === 'sections' ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 px-4 pb-4 space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Toggle which clinical sections are visible for all patients.
                  </p>
                  <div className="space-y-2">
                    {CLINICAL_SECTIONS.map((section) => {
                      const IconComponent = iconMap[section.icon];
                      return (
                        <div
                          key={section.key}
                          className="flex items-center justify-between p-2.5 rounded-xl border border-border/30 bg-muted/20"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={cn(
                              "w-7 h-7 rounded-lg flex items-center justify-center",
                              sectionVisibility[section.key] ? "bg-primary/10" : "bg-muted/50"
                            )}>
                              {IconComponent && (
                                <IconComponent className={cn(
                                  "h-3.5 w-3.5",
                                  sectionVisibility[section.key] ? "text-primary" : "text-muted-foreground/50"
                                )} />
                              )}
                            </div>
                            <Label
                              htmlFor={`mobile-section-${section.key}`}
                              className={cn(
                                "text-sm cursor-pointer",
                                !sectionVisibility[section.key] && "text-muted-foreground/50"
                              )}
                            >
                              {section.label}
                            </Label>
                          </div>
                          <Switch
                            id={`mobile-section-${section.key}`}
                            checked={sectionVisibility[section.key]}
                            onCheckedChange={() => toggleSection(section.key)}
                            className="scale-[0.85]"
                          />
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={resetSectionVisibility}
                    className="w-full h-9 rounded-xl text-xs text-muted-foreground gap-1.5"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset to Defaults
                  </Button>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* --- Change Tracking --- */}
          <Collapsible
            open={expandedSection === 'tracking'}
            onOpenChange={(open) => setExpandedSection(open ? 'tracking' : null)}
          >
            <Card className="rounded-2xl border-border/50 overflow-hidden">
              <CollapsibleTrigger asChild>
                <button className="w-full px-4 py-3.5 flex items-center justify-between min-h-[48px]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-purple-500/10 flex items-center justify-center">
                      <PenLine className="h-3.5 w-3.5 text-purple-600" />
                    </div>
                    <span className="font-semibold text-sm tracking-tight">Mark New Text</span>
                    <Switch
                      checked={changeTracking.enabled}
                      onCheckedChange={changeTracking.toggleEnabled}
                      onClick={(e) => e.stopPropagation()}
                      className="scale-[0.85]"
                    />
                  </div>
                  {expandedSection === 'tracking' && changeTracking.enabled ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 px-4 pb-4 space-y-4">
                  {/* Color Selection */}
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-muted-foreground">Highlight Color</span>
                    <div className="flex items-center gap-2.5">
                      {colorPresets.map((color) => (
                        <button
                          key={color}
                          onClick={() => changeTracking.setColor(color)}
                          className={cn(
                            "h-8 w-8 rounded-full transition-all",
                            changeTracking.color === color
                              ? "ring-2 ring-offset-2 ring-primary scale-110 shadow-md"
                              : "ring-1 ring-border/30 hover:ring-border"
                          )}
                          style={{ backgroundColor: color }}
                          aria-label={`Select highlight color ${color}`}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Style Toggles */}
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-muted-foreground">Apply Style</span>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant={changeTracking.styles.textColor ? "default" : "outline"}
                        size="sm"
                        onClick={() => changeTracking.toggleStyle("textColor")}
                        className="rounded-xl h-9"
                      >
                        Text Color
                      </Button>
                      <Button
                        variant={changeTracking.styles.backgroundColor ? "default" : "outline"}
                        size="sm"
                        onClick={() => changeTracking.toggleStyle("backgroundColor")}
                        className="rounded-xl h-9"
                      >
                        Highlight
                      </Button>
                      <Button
                        variant={changeTracking.styles.italic ? "default" : "outline"}
                        size="sm"
                        onClick={() => changeTracking.toggleStyle("italic")}
                        className="rounded-xl h-9"
                      >
                        Italic
                      </Button>
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="p-3 rounded-xl bg-muted/50 border border-border/30">
                    <span className="text-xs font-medium text-muted-foreground block mb-1.5">Preview:</span>
                    <span
                      style={{
                        color: changeTracking.styles.textColor ? changeTracking.color : undefined,
                        backgroundColor: changeTracking.styles.backgroundColor
                          ? `${changeTracking.color}25`
                          : undefined,
                        fontStyle: changeTracking.styles.italic ? "italic" : undefined,
                        padding: changeTracking.styles.backgroundColor ? "0.125rem 0.375rem" : undefined,
                        borderRadius: changeTracking.styles.backgroundColor ? "0.375rem" : undefined,
                      }}
                      className="text-sm"
                    >
                      New text will look like this
                    </span>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          <AIModelSettingsPanel />
          <ObservabilitySupportCard variant="mobile" />

          {/* --- AI Tools --- */}
          {onOpenBatchCourse && patientCount > 0 && (
            <Card className="rounded-2xl border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="font-semibold text-sm tracking-tight">AI Tools</span>
                </div>
                <Button
                  variant="ghost"
                  className="w-full justify-start h-12 rounded-xl"
                  onClick={onOpenBatchCourse}
                >
                  <Users className="h-4 w-4 mr-3 shrink-0" />
                  <span className="flex-1 text-left text-sm">Batch Course Generator</span>
                  <Badge variant="outline" className="rounded-lg text-[10px]">AI</Badge>
                </Button>
              </CardContent>
            </Card>
          )}

          {/* --- Quick Actions --- */}
          <Collapsible
            open={expandedSection === 'actions'}
            onOpenChange={(open) => setExpandedSection(open ? 'actions' : null)}
          >
            <Card className="rounded-2xl border-border/50 overflow-hidden">
              <CollapsibleTrigger asChild>
                <button className="w-full px-4 py-3.5 flex items-center justify-between min-h-[48px]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-slate-500/10 flex items-center justify-center">
                      <ShieldCheck className="h-3.5 w-3.5 text-slate-600" />
                    </div>
                    <span className="font-semibold text-sm tracking-tight">Quick Actions</span>
                  </div>
                  {expandedSection === 'actions' ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0 px-4 pb-4 space-y-1">
                  <ActionButton icon={FileText} label="Clinical Phrases" onClick={onOpenPhrases} />
                  <ActionButton icon={Sparkles} label="Autotexts & Templates" onClick={onOpenAutotexts} />
                  <ActionButton icon={Printer} label="Print / Export" onClick={onOpenPrint} />
                  <div className="pt-3 border-t border-border/30 mt-3">
                    <ActionButton icon={Trash2} label="Clear All Patients" onClick={onClearAll} destructive />
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* --- Sign Out --- */}
          <Button
            variant="outline"
            className="w-full h-12 rounded-xl gap-2 text-sm font-medium"
            onClick={onSignOut}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </ScrollArea>
    </div>
  );
};

interface ActionButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}

function ActionButton({ icon: Icon, label, onClick, destructive }: ActionButtonProps) {
  return (
    <Button
      variant="ghost"
      className={cn(
        "w-full justify-start h-12 rounded-xl",
        destructive && "text-destructive hover:text-destructive hover:bg-destructive/10"
      )}
      onClick={onClick}
    >
      <Icon className="h-4 w-4 mr-3 shrink-0 text-muted-foreground" />
      <span className="flex-1 text-left text-sm">{label}</span>
    </Button>
  );
}

export default MobileSettingsPanel;
