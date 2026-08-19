import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Activity, Eraser, Layers3, Settings2 } from "lucide-react";
import { RichTextEditor } from "./RichTextEditor";
import { FieldTimestamp } from "./FieldTimestamp";
import { PatientTodos } from "./PatientTodos";
import type { Patient, PatientSystems } from "@/types/patient";
import type { AutoText } from "@/types/autotext";
import type { PatientTodo } from "@/types/todo";
import type { ChangeTrackingContextValue } from "@/types/changeTracking";
import { useSystemsConfig } from "@/hooks/useSystemsConfig";
import type { SystemsReviewMode } from "@/lib/dashboardPrefs";

interface PatientSystemsReviewProps {
  patient: Patient;
  todos: PatientTodo[];
  generating: boolean;
  autotexts?: AutoText[];
  globalFontSize: number;
  changeTracking: ChangeTrackingContextValue | null;
  onUpdate: (id: string, field: string, value: unknown) => void;
  addTodo: (text: string, section?: string | null) => Promise<PatientTodo | undefined>;
  toggleTodo: (id: string) => Promise<void>;
  deleteTodo: (id: string) => Promise<void>;
  generateTodos: (section?: string | null) => Promise<void>;
  onClearAll: () => void;
  onOpenConfig: () => void;
  systemsReviewMode?: SystemsReviewMode;
  systemsCustomCombineKeys?: string[];
  onSystemsReviewModeChange?: (mode: SystemsReviewMode) => void;
  onSystemsCustomCombineKeysChange?: (keys: string[]) => void;
  onAnyEditorFocus?: () => void;
}

const SYSTEM_ACCENT: Record<string, { bg: string; border: string; dot: string }> = {
  neuro: { bg: "bg-purple-500/8 dark:bg-purple-500/12", border: "border-purple-500/20", dot: "bg-purple-400" },
  cv: { bg: "bg-rose-500/8 dark:bg-rose-500/12", border: "border-rose-500/20", dot: "bg-rose-400" },
  resp: { bg: "bg-sky-500/8 dark:bg-sky-500/12", border: "border-sky-500/20", dot: "bg-sky-400" },
  renalGU: { bg: "bg-blue-500/8 dark:bg-blue-500/12", border: "border-blue-500/20", dot: "bg-blue-400" },
  gi: { bg: "bg-amber-500/8 dark:bg-amber-500/12", border: "border-amber-500/20", dot: "bg-amber-400" },
  endo: { bg: "bg-orange-500/8 dark:bg-orange-500/12", border: "border-orange-500/20", dot: "bg-orange-400" },
  heme: { bg: "bg-red-500/8 dark:bg-red-500/12", border: "border-red-500/20", dot: "bg-red-400" },
  infectious: { bg: "bg-green-500/8 dark:bg-green-500/12", border: "border-green-500/20", dot: "bg-green-400" },
  skinLines: { bg: "bg-teal-500/8 dark:bg-teal-500/12", border: "border-teal-500/20", dot: "bg-teal-400" },
  dispo: { bg: "bg-indigo-500/8 dark:bg-indigo-500/12", border: "border-indigo-500/20", dot: "bg-indigo-400" },
  default: { bg: "bg-secondary/30", border: "border-border/50", dot: "bg-primary/60" },
};

const getAccent = (key: string) => SYSTEM_ACCENT[key] ?? SYSTEM_ACCENT.default;

const normalizeCustomKeys = (keys: string[] | undefined, allowedKeys: string[]): string[] => {
  if (!keys?.length) return [];
  const allowed = new Set(allowedKeys);
  const unique = new Set<string>();
  keys.forEach((key) => {
    if (!allowed.has(key)) return;
    unique.add(key);
  });
  return Array.from(unique);
};

export const PatientSystemsReview = ({
  patient,
  todos,
  generating,
  autotexts,
  globalFontSize,
  changeTracking,
  onUpdate,
  addTodo,
  toggleTodo,
  deleteTodo,
  generateTodos,
  onClearAll,
  onOpenConfig,
  systemsReviewMode = "split",
  systemsCustomCombineKeys,
  onSystemsReviewModeChange,
  onSystemsCustomCombineKeysChange,
  onAnyEditorFocus,
}: PatientSystemsReviewProps) => {
  const { enabledSystems } = useSystemsConfig();

  const enabledSystemKeys = React.useMemo(() => enabledSystems.map((system) => system.key), [enabledSystems]);
  const normalizedCustomKeys = React.useMemo(
    () => normalizeCustomKeys(systemsCustomCombineKeys, enabledSystemKeys),
    [systemsCustomCombineKeys, enabledSystemKeys],
  );

  const effectiveCustomKeys = normalizedCustomKeys.length > 0 ? normalizedCustomKeys : enabledSystemKeys;
  const combinedKeys = systemsReviewMode === "combine_all" ? enabledSystemKeys : effectiveCustomKeys;
  const combinedKeysSet = React.useMemo(() => new Set(combinedKeys), [combinedKeys]);
  const combinedSystems = React.useMemo(
    () => enabledSystems.filter((system) => combinedKeysSet.has(system.key)),
    [enabledSystems, combinedKeysSet],
  );
  const splitRemainderSystems = React.useMemo(
    () =>
      systemsReviewMode === "combine_custom"
        ? enabledSystems.filter((system) => !combinedKeysSet.has(system.key))
        : [],
    [enabledSystems, combinedKeysSet, systemsReviewMode],
  );

  const hasSystemContent = React.useCallback(
    (key: string) => Boolean(patient.systems[key as keyof PatientSystems]),
    [patient.systems],
  );

  const handleToggleCustomSystem = React.useCallback(
    (key: string, checked: boolean) => {
      if (!onSystemsCustomCombineKeysChange) return;
      const next = checked
        ? Array.from(new Set([...effectiveCustomKeys, key]))
        : effectiveCustomKeys.filter((existing) => existing !== key);

      if (next.length === 0) {
        onSystemsCustomCombineKeysChange([key]);
        return;
      }

      onSystemsCustomCombineKeysChange(next);
    },
    [effectiveCustomKeys, onSystemsCustomCombineKeysChange],
  );

  const renderSystemCard = (system: (typeof enabledSystems)[number]) => {
    const filled = hasSystemContent(system.key);
    const accent = getAccent(system.key);
    return (
      <div
        key={system.key}
        data-systems-card
        className={`rounded-lg p-3 border transition-all duration-200 ${
          filled
            ? `${accent.bg} ${accent.border} shadow-card`
            : "bg-secondary/20 border-border/40 hover:border-border/60 hover:bg-secondary/30"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <label
            className={`text-xs font-semibold flex items-center gap-1.5 tracking-wide ${
              filled ? "text-foreground/80" : "text-muted-foreground"
            }`}
          >
            <span className="text-sm">{system.icon}</span>
            {system.label}
          </label>
          <div className="flex items-center gap-1.5">
            <PatientTodos
              todos={todos}
              section={system.key}
              patient={patient}
              generating={generating}
              onAddTodo={addTodo}
              onToggleTodo={toggleTodo}
              onDeleteTodo={deleteTodo}
              onGenerateTodos={(_, section) => generateTodos(section)}
            />
            {filled && <div className={`w-1.5 h-1.5 rounded-full ${accent.dot}`} aria-label="Has content" />}
          </div>
        </div>
        <div className="space-y-1">
          <RichTextEditor
            value={patient.systems[system.key as keyof PatientSystems] || ""}
            onChange={(value) => onUpdate(patient.id, `systems.${system.key}`, value)}
            placeholder={`${system.label}...`}
            minHeight="80px"
            autotexts={autotexts}
            fontSize={globalFontSize}
            changeTracking={changeTracking}
            patient={patient}
            section={system.key}
            popOutAvailable
          />
          <FieldTimestamp
            timestamp={patient.fieldTimestamps?.[`systems.${system.key}` as keyof typeof patient.fieldTimestamps]}
            className="pl-1"
          />
        </div>
      </div>
    );
  };

  return (
    <div
      className="space-y-3"
      onFocusCapture={(event) => {
        const targetElement = event.target;
        if (targetElement instanceof HTMLElement && targetElement.isContentEditable) {
          onAnyEditorFocus?.();
        }
      }}
      data-systems-combined={systemsReviewMode === "combine_all" ? "true" : undefined}
      data-systems-custom={systemsReviewMode === "combine_custom" ? "true" : undefined}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded flex items-center justify-center bg-primary/10 border border-primary/15">
            <Activity className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
          </div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Systems Review</h3>
        </div>
        <div className="flex gap-1 no-print flex-wrap items-center">
          <Select
            value={systemsReviewMode}
            onValueChange={(mode) => onSystemsReviewModeChange?.(mode as SystemsReviewMode)}
          >
            <SelectTrigger
              className="h-11 min-h-11 w-[148px] text-xs"
              data-systems-mode-selector
              aria-label="Systems review layout"
            >
              <SelectValue placeholder="View mode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="split">Split</SelectItem>
              <SelectItem value="combine_all">Combine all</SelectItem>
              <SelectItem value="combine_custom">Custom combine</SelectItem>
            </SelectContent>
          </Select>

          {systemsReviewMode === "combine_custom" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="min-h-11 h-11 px-3 text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-lg"
                  title="Choose systems to combine"
                >
                  <Layers3 className="h-3.5 w-3.5 mr-1" />
                  <span className="text-xs">Combined systems ({effectiveCustomKeys.length})</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs">Select systems to combine</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {enabledSystems.map((system) => {
                  const checked = effectiveCustomKeys.includes(system.key);
                  return (
                    <DropdownMenuCheckboxItem
                      key={system.key}
                      checked={checked}
                      onCheckedChange={(nextChecked) => handleToggleCustomSystem(system.key, Boolean(nextChecked))}
                    >
                      <span className="mr-1">{system.icon}</span>
                      {system.label}
                    </DropdownMenuCheckboxItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="min-h-11 h-11 px-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg"
            title="Clear all systems"
          >
            <Eraser className="h-3.5 w-3.5 mr-1" />
            <span className="text-xs">Clear All</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenConfig}
            className="min-h-11 h-11 px-3 text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-lg"
            title="Customize systems"
          >
            <Settings2 className="h-3.5 w-3.5 mr-1" />
            <span className="text-xs">Customize</span>
          </Button>
        </div>
      </div>

      {systemsReviewMode === "split" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">{enabledSystems.map(renderSystemCard)}</div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg p-3 border bg-card/60 border-border/50 shadow-card">
            <div className="mb-2 flex items-center gap-2">
              <Layers3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {systemsReviewMode === "combine_all" ? "Combined systems" : "Custom combined systems"}
              </p>
            </div>
            <div className="space-y-3">{combinedSystems.map(renderSystemCard)}</div>
          </div>

          {systemsReviewMode === "combine_custom" && splitRemainderSystems.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Uncombined systems</p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {splitRemainderSystems.map(renderSystemCard)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
