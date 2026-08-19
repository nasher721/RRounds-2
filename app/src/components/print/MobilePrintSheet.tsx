import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  FileText,
  FileSpreadsheet,
  Printer,
  Loader2,
  Smartphone,
  Monitor,
  File,
  FileCode,
  FileType,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PRINT_TEMPLATES } from "@/types/printTemplates";

const TEMPLATE_ICON_MAP: Record<string, React.ElementType> = {
  FileText,
  List: FileText,
  FileSpreadsheet,
  MessageSquare: FileText,
  ArrowRightLeft: FileText,
  ClipboardCheck: FileText,
  Heart: FileText,
  Activity: FileText,
  Zap: FileText,
};

interface MobilePrintSheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onExportPDF: () => void;
  onExportExcel: () => void;
  onPrint: () => void;
  isGenerating: boolean;
  orientation: 'portrait' | 'landscape';
  onOrientationChange: (orientation: 'portrait' | 'landscape') => void;
  patientCount: number;
  selectedTemplate?: string;
  onSelectTemplate?: (templateId: string) => void;
  onExportWord?: () => void;
  onExportRTF?: () => void;
  onExportTXT?: () => void;
  onExportMarkdown?: () => void;
}

export function MobilePrintSheet({
  open,
  onOpenChange,
  onExportPDF,
  onExportExcel,
  onPrint,
  isGenerating,
  orientation,
  onOrientationChange,
  patientCount,
  selectedTemplate,
  onSelectTemplate,
  onExportWord,
  onExportRTF,
  onExportTXT,
  onExportMarkdown,
}: MobilePrintSheetProps) {
  const currentDate = new Date().toISOString().split('T')[0];
  const filenamePreview = `patient-rounding-${currentDate}.pdf`;
  const hasAdditionalExports = onExportWord || onExportRTF || onExportTXT || onExportMarkdown;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl px-4 pb-6 pt-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-center mb-4">
          <div className="w-12 h-1.5 bg-muted-foreground/20 rounded-full" />
        </div>

        <SheetHeader className="text-left pb-4">
          <SheetTitle className="text-xl">Export Report</SheetTitle>
          <SheetDescription>
            {patientCount} patient{patientCount !== 1 ? 's' : ''} will be included
          </SheetDescription>
        </SheetHeader>

        {onSelectTemplate && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Template</h3>
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
              {PRINT_TEMPLATES.map((template) => {
                const IconComponent = TEMPLATE_ICON_MAP[template.icon] || FileText;
                const isSelected = selectedTemplate === template.id;

                return (
                  <button
                    type="button"
                    key={template.id}
                    onClick={() => onSelectTemplate(template.id)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-full border whitespace-nowrap transition-all min-h-[44px]",
                      "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-background hover:border-primary/50 hover:bg-muted/50"
                    )}
                  >
                    <IconComponent className="h-4 w-4 flex-shrink-0" />
                    <span className="text-sm font-medium">{template.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-6">
          <Button
            size="lg"
            className="h-20 flex-col gap-1 bg-rose-500 hover:bg-rose-600 text-white"
            onClick={onExportPDF}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <FileText className="h-6 w-6" />
            )}
            <span className="text-sm font-medium">PDF</span>
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="h-20 flex-col gap-1 border-emerald-500 text-emerald-600 hover:bg-emerald-50"
            onClick={onExportExcel}
            disabled={isGenerating}
          >
            <FileSpreadsheet className="h-6 w-6" />
            <span className="text-sm font-medium">Excel</span>
          </Button>
        </div>

        {hasAdditionalExports && (
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">More Formats</h3>
            <div className="grid grid-cols-3 gap-2">
              {onExportWord && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-14 flex-col gap-0.5"
                  onClick={onExportWord}
                  disabled={isGenerating}
                >
                  <File className="h-4 w-4" />
                  <span className="text-xs font-medium">Word</span>
                  <span className="text-[10px] text-muted-foreground">.doc</span>
                </Button>
              )}
              {onExportRTF && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-14 flex-col gap-0.5"
                  onClick={onExportRTF}
                  disabled={isGenerating}
                >
                  <FileType className="h-4 w-4" />
                  <span className="text-xs font-medium">RTF</span>
                  <span className="text-[10px] text-muted-foreground">.rtf</span>
                </Button>
              )}
              {onExportTXT && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-14 flex-col gap-0.5"
                  onClick={onExportTXT}
                  disabled={isGenerating}
                >
                  <FileText className="h-4 w-4" />
                  <span className="text-xs font-medium">Text</span>
                  <span className="text-[10px] text-muted-foreground">.txt</span>
                </Button>
              )}
              {onExportMarkdown && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-14 flex-col gap-0.5"
                  onClick={onExportMarkdown}
                  disabled={isGenerating}
                >
                  <FileCode className="h-4 w-4" />
                  <span className="text-xs font-medium">Markdown</span>
                  <span className="text-[10px] text-muted-foreground">.md</span>
                </Button>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground">Quick Settings</h3>

          <div className="space-y-3">
            <Label className="text-base">Orientation</Label>
            <RadioGroup
              value={orientation}
              onValueChange={(value) => onOrientationChange(value as 'portrait' | 'landscape')}
              className="grid grid-cols-2 gap-3"
            >
              <div>
                <RadioGroupItem
                  value="portrait"
                  id="portrait"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="portrait"
                  className={cn(
                    "flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer min-h-[60px]",
                    "[&:has(:focus-visible)]:ring-2 [&:has(:focus-visible)]:ring-ring [&:has(:focus-visible)]:ring-offset-2"
                  )}
                >
                  <Smartphone className="h-5 w-5 mb-1" />
                  <span className="text-sm font-medium">Portrait</span>
                </Label>
              </div>
              <div>
                <RadioGroupItem
                  value="landscape"
                  id="landscape"
                  className="peer sr-only"
                />
                <Label
                  htmlFor="landscape"
                  className={cn(
                    "flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer min-h-[60px]",
                    "[&:has(:focus-visible)]:ring-2 [&:has(:focus-visible)]:ring-ring [&:has(:focus-visible)]:ring-offset-2"
                  )}
                >
                  <Monitor className="h-5 w-5 mb-1" />
                  <span className="text-sm font-medium">Landscape</span>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t">
          <Button
            size="lg"
            className="w-full h-12"
            onClick={onPrint}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Printer className="mr-2 h-5 w-5" />
                Print Document
              </>
            )}
          </Button>
        </div>

        <div className="mt-3 text-center">
          <p className="text-xs text-muted-foreground">
            File will be saved as: <span className="font-mono">{filenamePreview}</span>
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
