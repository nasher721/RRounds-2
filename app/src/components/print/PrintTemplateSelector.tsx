import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  FileText,
  List,
  FileSpreadsheet,
  MessageSquare,
  ArrowRightLeft,
  ClipboardCheck,
  Heart,
  Activity,
  Zap,
  Check,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PrintTemplateType } from "@/types/printTemplates";
import { PRINT_TEMPLATES } from "@/types/printTemplates";

const ICON_MAP: Record<string, React.ElementType> = {
  FileText,
  List,
  FileSpreadsheet,
  MessageSquare,
  ArrowRightLeft,
  ClipboardCheck,
  Heart,
  Activity,
  Zap,
};

interface PrintTemplateSelectorProps {
  selectedTemplate: PrintTemplateType;
  onSelectTemplate: (template: PrintTemplateType) => void;
  className?: string;
}

function MiniLayoutPreview({
  template,
  isSelected,
  prefersReducedMotion,
}: {
  template: (typeof PRINT_TEMPLATES)[0];
  isSelected: boolean;
  prefersReducedMotion: boolean;
}) {
  const enabledSectionsCount = template.sections.filter((s) => s.enabled).length;
  const isPortrait = template.layout.orientation === "portrait";
  const headerColor = template.styling.headerColor;
  const accentColor = template.styling.accentColor;
  const visibleSections = Math.min(enabledSectionsCount, 5);
  const hasMore = enabledSectionsCount > 5;

  const sectionWidths = React.useMemo(
    () => Array.from({ length: visibleSections }, () => 60 + Math.random() * 30),
    [visibleSections]
  );

  return (
    <motion.div
      className={cn(
        "relative overflow-hidden rounded-lg border-2 transition-colors duration-200",
        isPortrait ? "w-14 h-18" : "w-18 h-12",
        isSelected ? "bg-white shadow-md" : "bg-muted/20"
      )}
      style={{
        borderColor: isSelected ? accentColor : "transparent",
      }}
      animate={!prefersReducedMotion ? {
        scale: isSelected ? 1.02 : 1,
      } : {}}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
      <div
        className="h-3 w-full"
        style={{ backgroundColor: headerColor }}
      />
      <div className="flex flex-col gap-[3px] p-1.5 pt-1">
        {sectionWidths.map((width, i) => (
          <motion.div
            key={template.id + '-' + Math.round(width)}
            className="h-[3px] rounded-sm"
            style={{ 
              backgroundColor: isSelected ? accentColor : "hsl(var(--muted-foreground) / 0.25)",
              width: `${width}%`,
            }}
            initial={!prefersReducedMotion ? { width: 0 } : {}}
            animate={!prefersReducedMotion ? { width: `${width}%` } : {}}
            transition={{ duration: 0.3, delay: i * 0.05 }}
          />
        ))}
        {hasMore && (
          <div className="text-[7px] text-muted-foreground leading-none mt-0.5">
            +{enabledSectionsCount - 5}
          </div>
        )}
      </div>
      <div
        className={cn(
          "absolute bottom-1 right-1 w-2 h-2 rounded-full transition-colors duration-200",
          isPortrait 
            ? isSelected ? "bg-blue-500 shadow-sm shadow-blue-500/50" : "bg-blue-300"
            : isSelected ? "bg-amber-500 shadow-sm shadow-amber-500/50" : "bg-amber-300"
        )}
      />
    </motion.div>
  );
}

export function PrintTemplateSelector({
  selectedTemplate,
  onSelectTemplate,
  className,
}: PrintTemplateSelectorProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-tight">Print Templates</h3>
        <Badge variant="secondary" className="text-xs font-medium px-2.5 py-0.5">
          {PRINT_TEMPLATES.length} available
        </Badge>
      </div>

      <ScrollArea className="h-[420px] pr-4">
        <div className="space-y-2" role="listbox" aria-label="Print templates">
          {PRINT_TEMPLATES.map((template, index) => {
            const IconComponent = ICON_MAP[template.icon] || FileText;
            const isSelected = selectedTemplate === template.id;
            const enabledSectionsCount = template.sections.filter((s) => s.enabled).length;
            const ringStyle = isSelected
              ? ({ '--tw-ring-color': template.styling.accentColor } as React.CSSProperties)
              : undefined;

            return (
              <motion.div
                key={template.id}
                initial={!prefersReducedMotion ? { opacity: 0, y: 8 } : {}}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.03 }}
              >
                <Card
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  className={cn(
                    "group relative cursor-pointer transition-all duration-200",
                    "border shadow-sm hover:shadow-md",
                    "hover:-translate-y-[1px]",
                    isSelected && "ring-2 ring-offset-1"
                  )}
                  style={{
                    ...ringStyle,
                    borderColor: isSelected 
                      ? template.styling.accentColor 
                      : "hsl(var(--border) / 0.6)",
                    backgroundColor: isSelected 
                      ? `color-mix(in srgb, ${template.styling.headerColor} 3%, white)` 
                      : undefined,
                  }}
                  onClick={() => onSelectTemplate(template.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectTemplate(template.id);
                    }
                  }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <MiniLayoutPreview
                        template={template}
                        isSelected={isSelected}
                        prefersReducedMotion={prefersReducedMotion}
                      />
                      
                      <div
                        className={cn(
                          "p-2 rounded-xl flex-shrink-0 transition-all duration-200",
                          isSelected
                            ? "text-white shadow-lg"
                            : "bg-muted/60 text-muted-foreground group-hover:bg-muted"
                        )}
                        style={{
                          backgroundColor: isSelected ? template.styling.headerColor : undefined,
                        }}
                      >
                        <IconComponent className="h-4 w-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-[15px] font-semibold tracking-tight truncate">
                            {template.name}
                          </h4>
                          {isSelected && (
                            <motion.div
                              initial={!prefersReducedMotion ? { scale: 0 } : {}}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 500, damping: 25 }}
                            >
                              <Check
                                className="h-4 w-4 flex-shrink-0"
                                style={{ color: template.styling.accentColor }}
                                strokeWidth={3}
                              />
                            </motion.div>
                          )}
                        </div>
                        
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 leading-relaxed">
                          {template.description}
                        </p>

                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant={isSelected ? "default" : "secondary"}
                                className={cn(
                                  "text-[10px] px-2 py-0 h-5 font-medium cursor-help",
                                  "transition-colors duration-200",
                                  isSelected && "text-white"
                                )}
                                style={{
                                  backgroundColor: isSelected ? template.styling.accentColor : undefined,
                                }}
                              >
                                {template.layout.orientation === "portrait" ? "Portrait" : "Landscape"}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{template.layout.orientation === "portrait" ? "Portrait orientation (taller than wide)" : "Landscape orientation (wider than tall)"}</p>
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant={isSelected ? "default" : "secondary"}
                                className={cn(
                                  "text-[10px] px-2 py-0 h-5 font-medium cursor-help",
                                  "transition-colors duration-200",
                                  isSelected && "text-white"
                                )}
                                style={{
                                  backgroundColor: isSelected ? template.styling.accentColor : undefined,
                                }}
                              >
                                {template.layout.columns} column{template.layout.columns > 1 ? "s" : ""}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{template.layout.columns} column{template.layout.columns > 1 ? "s" : ""} in the print layout</p>
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge
                                variant={isSelected ? "default" : "secondary"}
                                className={cn(
                                  "text-[10px] px-2 py-0 h-5 font-medium cursor-help",
                                  "transition-colors duration-200",
                                  isSelected && "text-white"
                                )}
                                style={{
                                  backgroundColor: isSelected ? template.styling.accentColor : undefined,
                                }}
                              >
                                {enabledSectionsCount} section{enabledSectionsCount !== 1 ? "s" : ""}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{enabledSectionsCount} enabled section{enabledSectionsCount !== 1 ? "s" : ""} (Patient, Labs, etc.)</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

export function PrintTemplateSelectorCompact({
  selectedTemplate,
  onSelectTemplate,
  className,
}: PrintTemplateSelectorProps) {
  const prefersReducedMotion = useReducedMotion() ?? false;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Quick Templates
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-2" role="listbox" aria-label="Print templates">
        {PRINT_TEMPLATES.slice(0, 6).map((template, index) => {
          const IconComponent = ICON_MAP[template.icon] || FileText;
          const isSelected = selectedTemplate === template.id;
          const ringStyle = isSelected
            ? ({ '--tw-ring-color': template.styling.accentColor } as React.CSSProperties)
            : undefined;

          return (
            <motion.button
              type="button"
              key={template.id}
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelectTemplate(template.id)}
              initial={!prefersReducedMotion ? { opacity: 0, scale: 0.95 } : {}}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2, delay: index * 0.03 }}
              whileHover={!prefersReducedMotion ? { scale: 1.02 } : {}}
              whileTap={!prefersReducedMotion ? { scale: 0.98 } : {}}
              className={cn(
                "flex items-center gap-2.5 p-3 rounded-xl border text-left transition-colors duration-200",
                "focus:outline-none focus:ring-2 focus:ring-offset-1",
                isSelected
                  ? "border-2 shadow-sm"
                  : "border-border/60 hover:border-border hover:bg-muted/30"
              )}
              style={{
                ...ringStyle,
                borderColor: isSelected ? template.styling.accentColor : undefined,
                backgroundColor: isSelected 
                  ? `color-mix(in srgb, ${template.styling.headerColor} 4%, white)` 
                  : undefined,
              }}
            >
              <div
                className={cn(
                  "p-1.5 rounded-lg flex-shrink-0 transition-colors duration-200",
                )}
                style={{
                  backgroundColor: isSelected 
                    ? template.styling.headerColor 
                    : "hsl(var(--muted))",
                  color: isSelected ? "white" : "hsl(var(--muted-foreground))",
                }}
              >
                <IconComponent className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold leading-tight truncate block">
                  {template.name}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {template.layout.orientation === "portrait" ? "P" : "L"} · {template.layout.columns}c
                </span>
              </div>
              {isSelected && (
                <motion.div
                  initial={!prefersReducedMotion ? { scale: 0 } : {}}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 500, damping: 25 }}
                >
                  <Check
                    className="h-4 w-4 flex-shrink-0"
                    style={{ color: template.styling.accentColor }}
                    strokeWidth={3}
                  />
                </motion.div>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

export default PrintTemplateSelector;
