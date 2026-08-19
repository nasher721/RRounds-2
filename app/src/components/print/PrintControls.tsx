import { Button } from "@/components/ui/button";
import {
    FileText,
    FileSpreadsheet,
    Printer,
    Type,
    Loader2,
    ChevronDown,
    FileCode,
    Columns2,
    FileType2,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface PrintControlsProps {
    onExportPDF: () => void;
    onExportExcel: () => void;
    onExportWord: () => void;
    onExportTXT: () => void;
    onExportRTF: () => void;
    onExportMarkdown: () => void;
    onExportTwoColumnText: () => void;
    onPrint: () => void;
    isGenerating: boolean;
    /** Base filename the next export will produce; shown in the More menu. */
    filenamePreview?: string;
}

function defaultFilename(extension: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `patient-rounding-${year}-${month}-${day}.${extension}`;
}

export function PrintControls({
    onExportPDF,
    onExportExcel,
    onExportWord,
    onExportTXT,
    onExportRTF,
    onExportMarkdown,
    onExportTwoColumnText,
    onPrint,
    isGenerating,
    filenamePreview,
}: PrintControlsProps) {
    const fileName = filenamePreview ?? defaultFilename('pdf');

    return (
        <div
            className="flex items-center gap-1.5"
            role="toolbar"
            aria-label="Print and export"
            aria-busy={isGenerating}
        >
            <output className="sr-only">
                {isGenerating ? 'Generating export document…' : ''}
            </output>

            <Button
                type="button"
                onClick={onPrint}
                disabled={isGenerating}
                aria-label={isGenerating ? 'Preparing document' : 'Print document'}
                className="gap-1.5"
            >
                {isGenerating ? (
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden />
                ) : (
                    <Printer className="h-4 w-4" aria-hidden="true" />
                )}
                Print
            </Button>

            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onExportPDF}
                            disabled={isGenerating}
                            aria-label="Export as PDF document"
                            className="gap-1.5"
                        >
                            <FileText className="h-4 w-4 text-rose-500" aria-hidden="true" />
                            <span className="hidden sm:inline">PDF</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export the previewed layout as PDF</TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onExportExcel}
                            disabled={isGenerating}
                            aria-label="Export as Excel spreadsheet"
                            className="gap-1.5"
                        >
                            <FileSpreadsheet className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                            <span className="hidden sm:inline">Excel</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export the patient list as a spreadsheet</TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onExportWord}
                            disabled={isGenerating}
                            aria-label="Export as Word document"
                            className="gap-1.5"
                        >
                            <FileType2 className="h-4 w-4 text-sky-500" aria-hidden="true" />
                            <span className="hidden lg:inline">Word</span>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Export as an editable Word document</TooltipContent>
                </Tooltip>
            </TooltipProvider>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={isGenerating}
                        aria-label="More export formats"
                        aria-haspopup="menu"
                        className="gap-1"
                    >
                        <span className="hidden sm:inline">More</span>
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" role="menu" className="w-64">
                    <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                        Saves as{' '}
                        <span className="block truncate font-mono text-[11px] text-foreground">
                            {fileName}
                        </span>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={onExportTwoColumnText}
                        aria-label="Export ICU rounds as two-column print text"
                    >
                        <Columns2 className="mr-2 h-4 w-4 text-blue-700" aria-hidden="true" />
                        ICU two-column print (.txt)
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onClick={onExportRTF}
                        aria-label="Export as Rich Text Format"
                    >
                        <Type className="mr-2 h-4 w-4 text-violet-500" aria-hidden="true" />
                        Rich text (.rtf)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={onExportTXT}
                        aria-label="Export as plain text"
                    >
                        <FileText className="mr-2 h-4 w-4 text-slate-500" aria-hidden="true" />
                        Plain text (.txt)
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        onClick={onExportMarkdown}
                        aria-label="Export as Markdown"
                    >
                        <FileCode className="mr-2 h-4 w-4 text-orange-500" aria-hidden="true" />
                        Markdown (.md)
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}
