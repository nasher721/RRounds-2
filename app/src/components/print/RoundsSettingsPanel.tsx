import * as React from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  ArrowUp,
  Baseline,
  Columns2,
  Contrast,
  FileText,
  ListOrdered,
  RotateCcw,
  Sparkles,
  Type,
  UserRound,
} from "lucide-react";
import {
  DEFAULT_ROUNDS_SINGLE,
  DEFAULT_ROUNDS_TWO_COLUMN,
  ROUNDS_SECTION_DEFAULTS,
  ROUNDS_STYLE_PRESETS,
  type RoundsSectionConfig,
  type RoundsSettings,
} from "@/lib/print/roundsTypes";
import { fontFamilies } from "./constants";

interface RoundsSettingsPanelProps {
  settings: RoundsSettings;
  onChange: (patch: Partial<RoundsSettings>) => void;
}

// ── Small reusable controls ─────────────────────────────────────────────────

interface NumberSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
  hint?: string;
}

const NumberSlider = ({ label, value, min, max, step, unit, onChange, hint }: NumberSliderProps) => (
  <div className="space-y-1.5">
    <div className="flex items-baseline justify-between gap-2">
      <Label className="text-xs font-medium">{label}</Label>
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
        {Number.isInteger(value) ? value : value.toFixed(step < 0.1 ? 2 : 1)}
        {unit}
      </span>
    </div>
    <Slider
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(next) => onChange(next[0])}
      aria-label={label}
    />
    {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
  </div>
);

interface SwitchRowProps {
  id: string;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

const SwitchRow = ({ id, label, hint, checked, onChange }: SwitchRowProps) => (
  <div className="flex items-start justify-between gap-3">
    <div className="min-w-0 space-y-0.5">
      <Label htmlFor={id} className="text-xs font-medium">
        {label}
      </Label>
      {hint && <p className="text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
    <Switch id={id} checked={checked} onCheckedChange={onChange} className="mt-0.5 shrink-0" />
  </div>
);

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

const ColorField = ({ label, value, onChange }: ColorFieldProps) => {
  const [draft, setDraft] = React.useState(value);
  React.useEffect(() => setDraft(value), [value]);

  const commit = (next: string) => {
    setDraft(next);
    if (HEX.test(next.trim())) onChange(next.trim());
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="min-w-0 flex-1 truncate text-xs font-medium">{label}</Label>
      <div className="flex shrink-0 items-center gap-1.5">
        <Input
          value={draft}
          onChange={(event) => commit(event.target.value)}
          className="h-7 w-[5.5rem] font-mono text-[11px] uppercase"
          aria-label={`${label} hex value`}
          spellCheck={false}
        />
        <input
          type="color"
          value={HEX.test(draft) ? draft : value}
          onChange={(event) => commit(event.target.value)}
          className="h-7 w-8 cursor-pointer rounded border border-input bg-background p-0.5"
          aria-label={`${label} colour picker`}
        />
      </div>
    </div>
  );
};

// ── Section list row ────────────────────────────────────────────────────────

interface SectionRowProps {
  section: RoundsSectionConfig;
  index: number;
  total: number;
  onPatch: (patch: Partial<RoundsSectionConfig>) => void;
  onMove: (direction: -1 | 1) => void;
}

const SectionRow = ({ section, index, total, onPatch, onMove }: SectionRowProps) => (
  <div
    className={cn(
      "rounded-lg border p-2 transition-colors",
      section.enabled ? "border-border/70 bg-background" : "border-dashed border-border/50 bg-muted/30",
    )}
  >
    <div className="flex items-center gap-1.5">
      <Switch
        checked={section.enabled}
        onCheckedChange={(enabled) => onPatch({ enabled })}
        aria-label={`Include ${section.label}`}
        className="shrink-0"
      />
      <Input
        value={section.label}
        onChange={(event) => onPatch({ label: event.target.value })}
        className="h-7 min-w-0 flex-1 text-xs"
        aria-label={`${section.label} printed label`}
        maxLength={40}
      />
      <input
        type="color"
        value={section.color}
        onChange={(event) => onPatch({ color: event.target.value })}
        className="h-7 w-7 shrink-0 cursor-pointer rounded border border-input bg-background p-0.5"
        aria-label={`${section.label} bar colour`}
      />
      <div className="flex shrink-0 flex-col">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-3.5 w-6"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          aria-label={`Move ${section.label} up`}
        >
          <ArrowUp className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-3.5 w-6"
          disabled={index === total - 1}
          onClick={() => onMove(1)}
          aria-label={`Move ${section.label} down`}
        >
          <ArrowDown className="h-3 w-3" />
        </Button>
      </div>
    </div>
  </div>
);

// ── Panel ───────────────────────────────────────────────────────────────────

export function RoundsSettingsPanel({ settings, onChange }: RoundsSettingsPanelProps) {
  const enabledCount = settings.sections.filter((section) => section.enabled).length;

  const patchSection = (key: string, patch: Partial<RoundsSectionConfig>) => {
    onChange({
      sections: settings.sections.map((section) =>
        section.key === key ? { ...section, ...patch } : section,
      ),
    });
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const next = [...settings.sections];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ sections: next });
  };

  const resetToVariantDefault = () => {
    const base =
      settings.variant === "twoColumn" ? DEFAULT_ROUNDS_TWO_COLUMN : DEFAULT_ROUNDS_SINGLE;
    onChange({ ...base, sections: base.sections.map((section) => ({ ...section })) });
  };

  const resetSections = () => {
    onChange({ sections: ROUNDS_SECTION_DEFAULTS.map((section) => ({ ...section })) });
  };

  return (
    <div className="space-y-3">
      {/* Style presets */}
      <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold">Style presets</span>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-[11px]"
            onClick={resetToVariantDefault}
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {ROUNDS_STYLE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.description}
              onClick={() => onChange(preset.apply(settings))}
              className="rounded-lg border border-border/60 bg-background px-2 py-1.5 text-left text-[11px] font-medium leading-tight transition-colors hover:border-primary/60 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <Accordion type="multiple" defaultValue={["page", "typography"]} className="w-full">
        {/* ── Page ─────────────────────────────────────────────────────── */}
        <AccordionItem value="page">
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <Columns2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Page &amp; columns</span>
              <Badge variant="outline" className="ml-1 text-[10px] font-normal capitalize">
                {settings.pageSize} · {settings.variant === "twoColumn" ? `${settings.columnCount} col` : "1 col"}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Paper</Label>
                <Select
                  value={settings.pageSize}
                  onValueChange={(value) => onChange({ pageSize: value as RoundsSettings["pageSize"] })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="letter">US Letter</SelectItem>
                    <SelectItem value="a4">A4</SelectItem>
                    <SelectItem value="legal">Legal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Orientation</Label>
                <Select
                  value={settings.orientation}
                  onValueChange={(value) =>
                    onChange({ orientation: value as RoundsSettings["orientation"] })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">Portrait</SelectItem>
                    <SelectItem value="landscape">Landscape</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <NumberSlider
              label="Margin"
              value={settings.marginMm}
              min={3}
              max={40}
              step={0.5}
              unit=" mm"
              onChange={(marginMm) => onChange({ marginMm })}
              hint={`≈ ${(settings.marginMm / 25.4).toFixed(2)} inch on every side`}
            />

            <SwitchRow
              id="rounds-one-per-page"
              label="One patient per page"
              hint="Each patient starts on a fresh sheet."
              checked={settings.onePatientPerPage}
              onChange={(onePatientPerPage) => onChange({ onePatientPerPage })}
            />

            {settings.variant === "twoColumn" && (
              <div className="space-y-4 rounded-lg border border-border/60 p-3">
                <NumberSlider
                  label="Columns"
                  value={settings.columnCount}
                  min={1}
                  max={4}
                  step={1}
                  onChange={(columnCount) => onChange({ columnCount })}
                />
                <NumberSlider
                  label="Column gap"
                  value={settings.columnGapMm}
                  min={0}
                  max={20}
                  step={0.5}
                  unit=" mm"
                  onChange={(columnGapMm) => onChange({ columnGapMm })}
                />
                <SwitchRow
                  id="rounds-column-rule"
                  label="Separator rule"
                  hint="Vertical line between columns."
                  checked={settings.columnRule}
                  onChange={(columnRule) => onChange({ columnRule })}
                />
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Column fill</Label>
                  <Select
                    value={settings.columnFill}
                    onValueChange={(value) =>
                      onChange({ columnFill: value as RoundsSettings["columnFill"] })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="balance">Balanced — even columns</SelectItem>
                      <SelectItem value="sequential">Sequential — fill column 1 first</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    Sequential fills each column to the bottom of the page before the next one.
                  </p>
                </div>
              </div>
            )}

            {!settings.onePatientPerPage && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Between patients</Label>
                <Select
                  value={settings.patientSeparator}
                  onValueChange={(value) =>
                    onChange({ patientSeparator: value as RoundsSettings["patientSeparator"] })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rule">Horizontal rule</SelectItem>
                    <SelectItem value="space">Extra space</SelectItem>
                    <SelectItem value="none">Nothing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <SwitchRow
              id="rounds-keep-together"
              label="Keep sections whole"
              hint="Avoid splitting a system across a column or page break."
              checked={settings.keepSectionsTogether}
              onChange={(keepSectionsTogether) => onChange({ keepSectionsTogether })}
            />
          </AccordionContent>
        </AccordionItem>

        {/* ── Typography ───────────────────────────────────────────────── */}
        <AccordionItem value="typography">
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <Type className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Typography</span>
              <Badge variant="outline" className="ml-1 text-[10px] font-normal">
                {settings.bodyPt}pt body
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-4 pb-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Font</Label>
              <Select
                value={settings.fontFamily}
                onValueChange={(fontFamily) => onChange({ fontFamily })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fontFamilies.map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      {font.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <NumberSlider
              label="Body / data lines"
              value={settings.bodyPt}
              min={5}
              max={20}
              step={0.5}
              unit="pt"
              onChange={(bodyPt) => onChange({ bodyPt })}
            />
            <NumberSlider
              label="Problem titles"
              value={settings.titlePt}
              min={5}
              max={24}
              step={0.5}
              unit="pt"
              onChange={(titlePt) => onChange({ titlePt })}
            />
            <NumberSlider
              label="System header bars"
              value={settings.systemPt}
              min={5}
              max={24}
              step={0.5}
              unit="pt"
              onChange={(systemPt) => onChange({ systemPt })}
            />
            <NumberSlider
              label="Bed + patient name"
              value={settings.headerPt}
              min={6}
              max={36}
              step={0.5}
              unit="pt"
              onChange={(headerPt) => onChange({ headerPt })}
            />
            <NumberSlider
              label="Summary line"
              value={settings.summaryPt}
              min={5}
              max={20}
              step={0.5}
              unit="pt"
              onChange={(summaryPt) => onChange({ summaryPt })}
            />
            <NumberSlider
              label="Line height"
              value={settings.lineHeight}
              min={0.9}
              max={2.2}
              step={0.05}
              unit="×"
              onChange={(lineHeight) => onChange({ lineHeight })}
            />
            <NumberSlider
              label="Body indent"
              value={settings.indentPt}
              min={0}
              max={40}
              step={1}
              unit="pt"
              onChange={(indentPt) => onChange({ indentPt })}
            />
            <NumberSlider
              label="Space above sections"
              value={settings.sectionSpacingPt}
              min={0}
              max={30}
              step={1}
              unit="pt"
              onChange={(sectionSpacingPt) => onChange({ sectionSpacingPt })}
            />

            <SwitchRow
              id="rounds-bold-headings"
              label="Bold typed headings"
              hint="A source line ending in a colon prints as a bold problem title. Wording is unchanged."
              checked={settings.boldHeadingLines}
              onChange={(boldHeadingLines) => onChange({ boldHeadingLines })}
            />
          </AccordionContent>
        </AccordionItem>

        {/* ── Sections ─────────────────────────────────────────────────── */}
        <AccordionItem value="sections">
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <ListOrdered className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Sections</span>
              <Badge variant="outline" className="ml-1 text-[10px] font-normal">
                {enabledCount}/{settings.sections.length}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-2 pb-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] leading-snug text-muted-foreground">
                Toggle, rename, recolour and reorder. Printed top to bottom in this order.
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 shrink-0 px-1.5 text-[11px]"
                onClick={resetSections}
              >
                Reset
              </Button>
            </div>
            <div className="space-y-1.5">
              {settings.sections.map((section, index) => (
                <SectionRow
                  key={section.key}
                  section={section}
                  index={index}
                  total={settings.sections.length}
                  onPatch={(patch) => patchSection(section.key, patch)}
                  onMove={(direction) => moveSection(index, direction)}
                />
              ))}
            </div>

            <SwitchRow
              id="rounds-show-empty"
              label="Show empty sections"
              hint="Keep a header even when nothing is documented."
              checked={settings.showEmptySections}
              onChange={(showEmptySections) => onChange({ showEmptySections })}
            />
            <SwitchRow
              id="rounds-uppercase"
              label="Uppercase labels"
              checked={settings.uppercaseSectionLabels}
              onChange={(uppercaseSectionLabels) => onChange({ uppercaseSectionLabels })}
            />
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Disposition</Label>
              <Select
                value={settings.dispoStyle}
                onValueChange={(value) =>
                  onChange({ dispoStyle: value as RoundsSettings["dispoStyle"] })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Shaded bar at the bottom</SelectItem>
                  <SelectItem value="section">Ordinary section</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <NumberSlider
              label="Blank note lines"
              value={settings.notesLineCount}
              min={1}
              max={20}
              step={1}
              onChange={(notesLineCount) => onChange({ notesLineCount })}
              hint="Used by the Notes section when it is enabled above."
            />
            <SwitchRow
              id="rounds-todo-boxes"
              label="Checkboxes on to-dos"
              checked={settings.showTodoCheckboxes}
              onChange={(showTodoCheckboxes) => onChange({ showTodoCheckboxes })}
            />
          </AccordionContent>
        </AccordionItem>

        {/* ── Patient banner ───────────────────────────────────────────── */}
        <AccordionItem value="banner">
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Patient banner</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            <SwitchRow
              id="rounds-show-bed"
              label="Bed number"
              checked={settings.showBed}
              onChange={(showBed) => onChange({ showBed })}
            />
            <SwitchRow
              id="rounds-show-summary"
              label="One-line summary"
              hint="Printed verbatim from the clinical summary."
              checked={settings.showSummary}
              onChange={(showSummary) => onChange({ showSummary })}
            />
            <SwitchRow
              id="rounds-show-mrn"
              label="MRN (last 4)"
              checked={settings.showMrn}
              onChange={(showMrn) => onChange({ showMrn })}
            />
            <SwitchRow
              id="rounds-show-number"
              label="Patient number"
              checked={settings.showPatientNumber}
              onChange={(showPatientNumber) => onChange({ showPatientNumber })}
            />
            <SwitchRow
              id="rounds-show-age"
              label="Age"
              checked={settings.showAge}
              onChange={(showAge) => onChange({ showAge })}
            />
            <SwitchRow
              id="rounds-show-code"
              label="Code status"
              checked={settings.showCodeStatus}
              onChange={(showCodeStatus) => onChange({ showCodeStatus })}
            />
            <SwitchRow
              id="rounds-show-allergies"
              label="Alerts &amp; allergies"
              checked={settings.showAllergies}
              onChange={(showAllergies) => onChange({ showAllergies })}
            />
          </AccordionContent>
        </AccordionItem>

        {/* ── Colours ──────────────────────────────────────────────────── */}
        <AccordionItem value="colors">
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <Contrast className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Colour</span>
              <Badge variant="outline" className="ml-1 text-[10px] font-normal capitalize">
                {settings.colorMode}
              </Badge>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Colour mode</Label>
              <Select
                value={settings.colorMode}
                onValueChange={(value) =>
                  onChange({ colorMode: value as RoundsSettings["colorMode"] })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="color">Full colour</SelectItem>
                  <SelectItem value="grayscale">Greyscale</SelectItem>
                  <SelectItem value="mono">Ink saver (no fills)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Section header style</Label>
              <Select
                value={settings.sectionHeaderStyle}
                onValueChange={(value) =>
                  onChange({ sectionHeaderStyle: value as RoundsSettings["sectionHeaderStyle"] })
                }
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Filled bar</SelectItem>
                  <SelectItem value="underline">Coloured underline</SelectItem>
                  <SelectItem value="plain">Coloured text</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div
              className={cn(
                "space-y-2 rounded-lg border border-border/60 p-3",
                settings.colorMode === "mono" && "opacity-60",
              )}
            >
              <ColorField
                label="Banner background"
                value={settings.headerBg}
                onChange={(headerBg) => onChange({ headerBg })}
              />
              <ColorField
                label="Bed text"
                value={settings.headerTextColor}
                onChange={(headerTextColor) => onChange({ headerTextColor })}
              />
              <ColorField
                label="Name text"
                value={settings.headerAccentColor}
                onChange={(headerAccentColor) => onChange({ headerAccentColor })}
              />
              <ColorField
                label="Summary text"
                value={settings.summaryTextColor}
                onChange={(summaryTextColor) => onChange({ summaryTextColor })}
              />
              <ColorField
                label="Body text"
                value={settings.bodyTextColor}
                onChange={(bodyTextColor) => onChange({ bodyTextColor })}
              />
              <ColorField
                label="Problem titles"
                value={settings.titleColor}
                onChange={(titleColor) => onChange({ titleColor })}
              />
              <ColorField
                label="Dispo background"
                value={settings.dispoBg}
                onChange={(dispoBg) => onChange({ dispoBg })}
              />
              <ColorField
                label="Dispo text"
                value={settings.dispoTextColor}
                onChange={(dispoTextColor) => onChange({ dispoTextColor })}
              />
              {settings.colorMode === "mono" && (
                <p className="text-[11px] leading-snug text-muted-foreground">
                  Ink saver overrides these while it is active.
                </p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ── Document header ──────────────────────────────────────────── */}
        <AccordionItem value="document">
          <AccordionTrigger className="py-3 hover:no-underline">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">Document header</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            <SwitchRow
              id="rounds-doc-header"
              label="Show document header"
              hint="Title, team name and generation time above the first patient."
              checked={settings.showDocumentHeader}
              onChange={(showDocumentHeader) => onChange({ showDocumentHeader })}
            />
            <div className="space-y-1.5">
              <Label htmlFor="rounds-doc-title" className="text-xs font-medium">
                Title
              </Label>
              <Input
                id="rounds-doc-title"
                value={settings.documentTitle}
                onChange={(event) => onChange({ documentTitle: event.target.value })}
                className="h-8 text-xs"
                maxLength={80}
                disabled={!settings.showDocumentHeader}
              />
            </div>
            <SwitchRow
              id="rounds-timestamp"
              label="Generated timestamp"
              checked={settings.showTimestamp}
              onChange={(showTimestamp) => onChange({ showTimestamp })}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/20 p-2.5">
        <Baseline className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <p className="text-[11px] leading-snug text-muted-foreground">
          Every documented line prints verbatim in its original order. This format only changes
          structure and styling — never wording.
        </p>
      </div>
    </div>
  );
}
