import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { PrintFormat } from "@/lib/print/types";
import type { RoundsVariant } from "@/lib/print/roundsTypes";

export type PrintFormatChoice =
  | { format: Exclude<PrintFormat, "rounds"> }
  | { format: "rounds"; variant: RoundsVariant };

interface PrintFormatPickerProps {
  format: PrintFormat;
  roundsVariant: RoundsVariant;
  onSelect: (choice: PrintFormatChoice) => void;
  className?: string;
}

// ── Thumbnails ──────────────────────────────────────────────────────────────
// Tiny abstract page diagrams. They make the difference between the layouts
// readable at a glance, which a text-only list of format names does not.

const Sheet = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 48 62" className="h-[3.25rem] w-[2.6rem]" aria-hidden="true">
    <rect x="0.5" y="0.5" width="47" height="61" rx="2.5" className="fill-background stroke-border" />
    {children}
  </svg>
);

const bar = (props: React.SVGProps<SVGRectElement>) => <rect rx="1" {...props} />;

const TableThumb = () => (
  <Sheet>
    {bar({ x: 6, y: 7, width: 36, height: 4, className: "fill-primary/70" })}
    {[16, 24, 32, 40, 48].map((y) => (
      <g key={y}>
        {bar({ x: 6, y, width: 10, height: 3, className: "fill-muted-foreground/35" })}
        {bar({ x: 19, y, width: 10, height: 3, className: "fill-muted-foreground/35" })}
        {bar({ x: 32, y, width: 10, height: 3, className: "fill-muted-foreground/35" })}
      </g>
    ))}
  </Sheet>
);

const CardsThumb = () => (
  <Sheet>
    {[7, 26, 45].map((y) => (
      <g key={y}>
        <rect x="6" y={y} width="36" height="14" rx="2" className="fill-muted/60 stroke-border" />
        {bar({ x: 9, y: y + 3, width: 16, height: 3, className: "fill-primary/60" })}
        {bar({ x: 9, y: y + 8, width: 28, height: 2.5, className: "fill-muted-foreground/35" })}
      </g>
    ))}
  </Sheet>
);

const ListThumb = () => (
  <Sheet>
    {[8, 19, 30, 41, 52].map((y) => (
      <g key={y}>
        {bar({ x: 6, y, width: 3, height: 6, className: "fill-primary/60" })}
        {bar({ x: 12, y: y + 1, width: 30, height: 2.5, className: "fill-muted-foreground/40" })}
        {bar({ x: 12, y: y + 5, width: 22, height: 2.5, className: "fill-muted-foreground/25" })}
      </g>
    ))}
  </Sheet>
);

const RoundsSingleThumb = () => (
  <Sheet>
    {bar({ x: 5, y: 6, width: 38, height: 8, className: "fill-slate-700" })}
    {bar({ x: 5, y: 18, width: 38, height: 3.5, className: "fill-[#1F4E79]" })}
    {bar({ x: 8, y: 24, width: 32, height: 2, className: "fill-muted-foreground/35" })}
    {bar({ x: 8, y: 28, width: 26, height: 2, className: "fill-muted-foreground/35" })}
    {bar({ x: 5, y: 33, width: 38, height: 3.5, className: "fill-[#C00000]" })}
    {bar({ x: 8, y: 39, width: 30, height: 2, className: "fill-muted-foreground/35" })}
    {bar({ x: 5, y: 44, width: 38, height: 3.5, className: "fill-[#2E75B6]" })}
    {bar({ x: 8, y: 50, width: 28, height: 2, className: "fill-muted-foreground/35" })}
    <rect x="5" y="54.5" width="38" height="4" rx="1" className="fill-[#EBF3FB] stroke-border" />
  </Sheet>
);

const RoundsTwoColThumb = () => (
  <Sheet>
    {bar({ x: 5, y: 6, width: 38, height: 7, className: "fill-slate-700" })}
    <line x1="24" y1="16" x2="24" y2="57" className="stroke-border" strokeDasharray="2 2" />
    {[5, 26].map((x) => (
      <g key={x}>
        {bar({ x, y: 17, width: 17, height: 3, className: "fill-[#1F4E79]" })}
        {bar({ x: x + 2, y: 22, width: 14, height: 1.8, className: "fill-muted-foreground/35" })}
        {bar({ x: x + 2, y: 25.5, width: 11, height: 1.8, className: "fill-muted-foreground/35" })}
        {bar({ x, y: 30, width: 17, height: 3, className: "fill-[#C00000]" })}
        {bar({ x: x + 2, y: 35, width: 13, height: 1.8, className: "fill-muted-foreground/35" })}
        {bar({ x, y: 39.5, width: 17, height: 3, className: "fill-[#375623]" })}
        {bar({ x: x + 2, y: 44.5, width: 14, height: 1.8, className: "fill-muted-foreground/35" })}
        {bar({ x: x + 2, y: 48, width: 10, height: 1.8, className: "fill-muted-foreground/35" })}
      </g>
    ))}
  </Sheet>
);

interface FormatOption {
  id: string;
  name: string;
  description: string;
  thumb: React.ReactNode;
  badge?: string;
  choice: PrintFormatChoice;
  isActive: (format: PrintFormat, variant: RoundsVariant) => boolean;
}

const FORMAT_OPTIONS: FormatOption[] = [
  {
    id: "rounds-single",
    name: "Rounds — single column",
    description: "One patient per page, full width, organ-system bars.",
    thumb: <RoundsSingleThumb />,
    badge: "Rounds",
    choice: { format: "rounds", variant: "single" },
    isActive: (format, variant) => format === "rounds" && variant === "single",
  },
  {
    id: "rounds-2col",
    name: "Rounds — two column",
    description: "Newspaper columns at 7.5pt, one patient per page.",
    thumb: <RoundsTwoColThumb />,
    badge: "Rounds",
    choice: { format: "rounds", variant: "twoColumn" },
    isActive: (format, variant) => format === "rounds" && variant === "twoColumn",
  },
  {
    id: "table",
    name: "Table",
    description: "Patients as rows, sections as columns.",
    thumb: <TableThumb />,
    choice: { format: "table" },
    isActive: (format) => format === "table",
  },
  {
    id: "cards",
    name: "Cards",
    description: "Bordered card per patient.",
    thumb: <CardsThumb />,
    choice: { format: "cards" },
    isActive: (format) => format === "cards",
  },
  {
    id: "list",
    name: "List",
    description: "Stacked sections in reading order.",
    thumb: <ListThumb />,
    choice: { format: "list" },
    isActive: (format) => format === "list",
  },
];

export function PrintFormatPicker({
  format,
  roundsVariant,
  onSelect,
  className,
}: PrintFormatPickerProps) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-2", className)}
      role="radiogroup"
      aria-label="Print format"
    >
      {FORMAT_OPTIONS.map((option) => {
        const active = option.isActive(format, roundsVariant);
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(option.choice)}
            className={cn(
              "group flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border/60 bg-background hover:border-border hover:bg-muted/40",
            )}
          >
            <div className={cn("shrink-0", active ? "opacity-100" : "opacity-80")}>
              {option.thumb}
            </div>
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-xs font-semibold leading-tight">{option.name}</span>
              </div>
              <p className="text-[11px] leading-snug text-muted-foreground">{option.description}</p>
            </div>
            {option.badge && (
              <Badge
                variant={active ? "default" : "secondary"}
                className="px-1.5 py-0 text-[10px] font-medium"
              >
                {option.badge}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );
}
