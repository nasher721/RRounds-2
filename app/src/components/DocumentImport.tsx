import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { FileText, FileUp, Loader2, FileType } from "lucide-react";
import { toast } from "sonner";
import {
  validateDocumentImportFile,
  validateDocxArchive,
  validateImportedDocumentContent,
} from "@/lib/documentImportSafety";
import { sanitizeHtml, sanitizePastedHtml } from "@/lib/sanitize";

interface DocumentImportProps {
  onImport: (content: string) => void;
  disabled?: boolean;
}

export const DocumentImport = ({ onImport, disabled }: DocumentImportProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileValidationError = validateDocumentImportFile(file.name, file.size);
    if (fileValidationError) {
      toast.error(fileValidationError);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsLoading(true);
    setOpen(false);

    try {
      const fileName = file.name.toLowerCase();
      let importedContent = "";

      if (fileName.endsWith(".txt")) {
        const text = await file.text();
        importedContent = sanitizePastedHtml("", text);
      } else if (fileName.endsWith(".docx")) {
        const arrayBuffer = await file.arrayBuffer();
        const archiveValidationError = validateDocxArchive(arrayBuffer);
        if (archiveValidationError) {
          toast.error(archiveValidationError);
          return;
        }
        const { default: mammoth } = await import("mammoth");
        const result = await mammoth.convertToHtml({ arrayBuffer });
        importedContent = sanitizeHtml(result.value);
      } else {
        toast.error("Unsupported file type. Please use .txt or .docx");
        return;
      }

      const contentValidationError = validateImportedDocumentContent(importedContent);
      if (contentValidationError) {
        toast.error(contentValidationError);
        return;
      }

      onImport(importedContent);
      toast.success(`Imported ${file.name}`);
    } catch {
      console.error("Document import failed");
      toast.error("Failed to import document");
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled || isLoading}
          title="Import Document"
          className="h-8 w-8 p-0"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileUp className="h-4 w-4" />
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Import Document
          </DialogTitle>
          <DialogDescription>
            Upload a text or Word file to insert its content into the current note field.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept=".txt,.docx"
          />

          <Card className="col-span-2 p-6 border-dashed border-2 cursor-pointer hover:bg-muted/50 transition-colors flex flex-col items-center justify-center gap-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <FileUp className="h-8 w-8 text-muted-foreground" />
            <div className="text-center">
              <p className="font-medium text-sm">Click to upload</p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports .txt and .docx
              </p>
            </div>
          </Card>

          <div className="col-span-2 grid grid-cols-2 gap-2">
            <div className="flex flex-col items-center gap-1 p-2 bg-muted/20 rounded-md text-xs text-muted-foreground">
              <FileType className="h-4 w-4" />
              <span>Text</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-2 bg-muted/20 rounded-md text-xs text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>Word</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
