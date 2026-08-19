import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  FileUp, 
  Loader2, 
  Table2, 
  ArrowRight, 
  Check, 
  AlertCircle, 
  Wand2,
  Upload,
  FileText
} from "lucide-react";
import {
  parseCSV,
  autoMapColumns,
  mapRowToPatient,
  mapValidRowsToPatients,
  validateRow,
  PATIENT_TARGET_FIELDS,
  type FieldMapping,
  type CSVParseResult,
  type ValidationError,
} from "@/lib/import/csvImport";
import {
  MAX_PATIENT_LIST_SPREADSHEET_BYTES,
  MAX_EXTRACTED_PATIENT_LIST_CHARS,
} from "@/lib/import/patientListImportSafety";

interface CSVColumnMapperProps {
  onImportPatients: (patients: Record<string, string>[]) => Promise<void>;
  noDialog?: boolean;
  hideHeader?: boolean;
}

type Step = "upload" | "mapping" | "preview";

export const CSVColumnMapper = ({
  onImportPatients,
  noDialog = false,
  hideHeader = false,
}: CSVColumnMapperProps) => {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [csvContent, setCsvContent] = useState("");
  const [parsedData, setParsedData] = useState<CSVParseResult | null>(null);
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const processCSV = useCallback((content: string) => {
    if (content.length > MAX_EXTRACTED_PATIENT_LIST_CHARS) {
      toast({
        title: "CSV is too large",
        description: "Split the patient list into smaller files before importing.",
        variant: "destructive",
      });
      return;
    }

    const parsed = parseCSV(content);

    if (parsed.errors.length > 0) {
      toast({
        title: "CSV needs correction",
        description: `Line ${parsed.errors[0].line}: ${parsed.errors[0].message}`,
        variant: "destructive",
      });
      return;
    }
    
    if (parsed.headers.length === 0) {
      toast({
        title: "Empty CSV",
        description: "The CSV file appears to be empty or has no headers.",
        variant: "destructive",
      });
      return;
    }

    if (parsed.rowCount === 0) {
      toast({
        title: "No data rows",
        description: "The CSV file has headers but no data rows.",
        variant: "destructive",
      });
      return;
    }

    setParsedData(parsed);
    
    const autoMappings = autoMapColumns(parsed.headers);
    setMappings(autoMappings);
    
    setStep("mapping");
    toast({
      title: "CSV parsed",
      description: `Found ${parsed.headers.length} columns and ${parsed.rowCount} rows. Review and adjust the mappings.`,
    });
  }, [toast]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_PATIENT_LIST_SPREADSHEET_BYTES) {
      toast({
        title: "CSV is too large",
        description: "Select a CSV file smaller than 15 MB or split the list into sections.",
        variant: "destructive",
      });
      return;
    }

    if (!file.name.endsWith('.csv') && !file.type.includes('csv') && !file.type.includes('text')) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file.",
        variant: "destructive",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        setCsvContent(content);
        processCSV(content);
      }
    };
    reader.onerror = () => {
      toast({
        title: "Error reading file",
        description: "Could not read the uploaded file.",
        variant: "destructive",
      });
    };
    reader.readAsText(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [toast, processCSV]);

  const handleTextPaste = () => {
    if (!csvContent.trim()) {
      toast({
        title: "No content",
        description: "Please paste CSV content first.",
        variant: "destructive",
      });
      return;
    }
    processCSV(csvContent);
  };

  const handleMappingChange = (csvColumn: string, targetField: string) => {
    setMappings(prev => {
      // Remove any existing mapping for this CSV column
      const filtered = prev.filter(m => m.csvColumn !== csvColumn);
      
      // If targetField is empty (skip), just return filtered
      if (!targetField) {
        return filtered;
      }
      
      // Add new mapping
      const target = PATIENT_TARGET_FIELDS.find(f => f.key === targetField);
      return [...filtered, {
        csvColumn,
        targetField,
        transform: target?.type === 'date' ? 'date' : undefined
      }];
    });
  };

  const handleAutoMap = () => {
    if (!parsedData) return;
    const autoMappings = autoMapColumns(parsedData.headers);
    setMappings(autoMappings);
    toast({
      title: "Auto-mapping complete",
      description: `Mapped ${autoMappings.length} columns automatically.`,
    });
  };

  const validateMappings = (): boolean => {
    if (!parsedData) return false;
    
    // Check if name is mapped (required)
    const nameMapped = mappings.some(m => m.targetField === 'name');
    if (!nameMapped) {
      toast({
        title: "Required field missing",
        description: "Patient Name is required for import.",
        variant: "destructive",
      });
      return false;
    }

    // Validate all rows
    const allErrors: ValidationError[] = [];
    parsedData.rows.forEach((row, rowIndex) => {
      const rowErrors = validateRow(row, parsedData.headers, mappings);
      rowErrors.forEach(err => {
        allErrors.push({ ...err, row: rowIndex + 1 });
      });
    });
    
    setErrors(allErrors);
    
    if (allErrors.length > 0) {
      toast({
        title: "Validation issues found",
        description: `${allErrors.length} issue(s) found. Review them below or proceed anyway.`,
        variant: "destructive",
      });
    }
    
    return true;
  };

  const handleProceedToPreview = () => {
    if (validateMappings()) {
      setStep("preview");
    }
  };

  const handleImport = async () => {
    if (!parsedData) return;

    setIsLoading(true);
    try {
      const patients = mapValidRowsToPatients(parsedData, mappings);

      await onImportPatients(patients);
      
      toast({
        title: "Import successful",
        description: `Imported ${patients.length} patient(s) from CSV.`,
      });
      
      handleClose();
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Import failed",
        description: "Failed to import patients from CSV.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setStep("upload");
    setCsvContent("");
    setParsedData(null);
    setMappings([]);
    setErrors([]);
  };

  // Check if name is mapped
  const isNameMapped = mappings.some(m => m.targetField === 'name');
  
  // Preview data for display (first 5 rows)
  const previewRows = parsedData?.rows.slice(0, 5) || [];
  
  // Count of valid rows (rows that pass validation)
  const validRowCount = parsedData?.rows.filter(row => {
    const rowErrors = validateRow(row, parsedData!.headers, mappings);
    return rowErrors.length === 0;
  }).length || 0;

  const content = (
    <>
      {!hideHeader ? (
        <DialogHeader className="flex-shrink-0">
          {/* DialogTitle works for both owned Dialog and parent Dialog wrappers (noDialog). */}
          <DialogTitle className="flex items-center gap-2">
            <Table2 className="h-5 w-5" aria-hidden="true" />
            Import from CSV
          </DialogTitle>
          <DialogDescription>
            Upload or paste CSV content, map columns to patient fields, then import selected rows.
          </DialogDescription>
        </DialogHeader>
      ) : null}

      <div className="flex-1 overflow-y-auto min-h-0 py-2">
        {step === "upload" && (
          <div className="space-y-4">
            <div className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground flex gap-3">
              <FileText className="h-5 w-5 flex-shrink-0 text-blue-500" />
              <p>
                Upload a CSV file or paste CSV content. The first row should contain column headers.
                Map each column to the corresponding patient field.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  onChange={handleFileUpload}
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  className="h-48 w-full rounded-lg border-2 border-dashed p-6 text-center transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 flex flex-col justify-center items-center"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Upload CSV file"
                >
                <Upload className="h-10 w-10 mb-4 text-primary/60" />
                <span className="font-medium text-lg">Upload CSV</span>
                <span className="text-sm text-muted-foreground mt-1">.csv file</span>
                </button>
              </div>

              <button
                type="button"
                className="h-48 rounded-lg border-2 border-dashed p-6 text-center transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 flex flex-col justify-center items-center"
                onClick={handleTextPaste}
                aria-label="Paste CSV content from clipboard"
              >
                <FileText className="h-10 w-10 mb-4 text-primary/60" />
                <span className="font-medium text-lg">Paste Content</span>
                <span className="text-sm text-muted-foreground mt-1">From Clipboard</span>
              </button>
            </div>

            <div className="space-y-2">
              <Label htmlFor="csv-content">Or paste CSV content here:</Label>
              <Textarea
                id="csv-content"
                placeholder="Name,Bed,MRN,Diagnosis&#10;John Doe,12A,12345, Pneumonia&#10;Jane Smith,12B,12346, CHF"
                value={csvContent}
                onChange={(e) => setCsvContent(e.target.value)}
                className="min-h-[150px] font-mono text-xs"
              />
            </div>

            <div className="flex justify-end">
              <Button onClick={handleTextPaste} disabled={!csvContent.trim()}>
                <ArrowRight className="h-4 w-4 mr-2" />
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "mapping" && parsedData && (
          <div className="space-y-4 h-full flex flex-col">
            <div className="flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {parsedData.headers.length} columns
                </Badge>
                <Badge variant="outline">
                  {parsedData.rowCount} rows
                </Badge>
              </div>
              <Button variant="outline" size="sm" onClick={handleAutoMap}>
                <Wand2 className="h-4 w-4 mr-2" />
                Auto-map
              </Button>
            </div>

            {/* Mapping section */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Map Columns to Patient Fields</Label>
              <div className="rounded-md border border-border/30 bg-card/40 p-3 space-y-2 max-h-[200px] overflow-y-auto">
                {parsedData.headers.map((header, headerIndex) => {
                  const currentMapping = mappings.find(m => m.csvColumn === header);
                  const mappingSelectId = `csv-column-mapping-${headerIndex}`;
                  return (
                    <div key={header} className="flex items-center gap-2">
                      <Label htmlFor={mappingSelectId} className="w-1/3 text-sm font-mono truncate" title={header}>
                        {header}
                      </Label>
                      <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <select
                        id={mappingSelectId}
                        aria-label={`Map CSV column ${header} to patient field`}
                        value={currentMapping?.targetField || ""}
                        onChange={(e) => handleMappingChange(header, e.target.value)}
                        className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        <option value="">-- Skip this column --</option>
                        {PATIENT_TARGET_FIELDS.map((field) => (
                          <option key={field.key} value={field.key}>
                            {field.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Preview table */}
            <div className="space-y-2 flex-1 min-h-0">
              <Label className="text-sm font-medium">Preview (first 5 rows)</Label>
              <div className="rounded-md border border-border/30 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      {parsedData.headers.map((header) => (
                        <th key={header} className="px-2 py-1 text-left font-medium whitespace-nowrap">
                          {header}
                          {mappings.find(m => m.csvColumn === header)?.targetField && (
                            <Badge variant="secondary" className="ml-1 text-[10px] py-0">
                              {PATIENT_TARGET_FIELDS.find(f => f.key === mappings.find(m => m.csvColumn === header)?.targetField)?.label}
                            </Badge>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row) => {
                      const rowKey = row.join('-');
                      return (
                        <tr key={rowKey} className="border-t border-border/30">
                          {row.map((cell) => (
                            <td key={cell} className="px-2 py-1 whitespace-nowrap">
                              {cell || <span className="text-muted-foreground">-</span>}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Validation errors */}
            {errors.length > 0 && (
              <div className="rounded-md bg-destructive/10 p-3 space-y-1">
                <div className="flex items-center gap-2 text-destructive text-sm font-medium">
                  <AlertCircle className="h-4 w-4" />
                  {errors.length} validation issue(s)
                </div>
                <ScrollArea className="h-20">
                  <div className="space-y-1">
                    {errors.slice(0, 5).map((err) => (
                      <p key={`${err.row}-${err.message}`} className="text-xs text-destructive">
                        Row {err.row}: {err.message}
                      </p>
                    ))}
                    {errors.length > 5 && (
                      <p className="text-xs text-muted-foreground">
                        ...and {errors.length - 5} more
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Required field warning */}
            {!isNameMapped && (
              <div className="rounded-md bg-warning/10 p-3 flex items-center gap-2 text-warning text-sm">
                <AlertCircle className="h-4 w-4" />
                Patient Name is required for import
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t mt-auto flex-shrink-0">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <div className="flex gap-2">
                <Button onClick={handleProceedToPreview} disabled={!isNameMapped}>
                  Preview Import
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {step === "preview" && parsedData && (
          <div className="space-y-4 h-full flex flex-col">
            <div className="flex justify-between items-center flex-shrink-0">
              <div className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                <span className="font-medium">Ready to import</span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{parsedData.rowCount} total rows</Badge>
                <Badge variant={errors.length === 0 ? "secondary" : "destructive"}>
                  {errors.length === 0 ? "All valid" : `${errors.length} issues`}
                </Badge>
              </div>
            </div>

            {/* Summary of mappings */}
            <div className="rounded-md bg-muted/30 p-3">
              <Label className="text-xs text-muted-foreground">Field Mappings:</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {mappings.map((mapping) => (
                  <Badge key={mapping.csvColumn} variant="secondary" className="text-xs">
                    {mapping.csvColumn} → {PATIENT_TARGET_FIELDS.find(f => f.key === mapping.targetField)?.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Preview of mapped data */}
            <div className="space-y-2 flex-1 min-h-0">
              <Label className="text-sm font-medium">Mapped Patient Data Preview</Label>
              <ScrollArea className="h-[300px] rounded-md border border-border/30">
                <div className="p-3 space-y-3">
                  {previewRows.map((row) => {
                    const mapped = mapRowToPatient(row, parsedData.headers, mappings);
                    const rowErrors = validateRow(row, parsedData.headers, mappings);
                    const rowKey = row.join('-');
                    
                    return (
                      <Card 
                        key={rowKey} 
                        className={`p-3 ${rowErrors.length > 0 ? 'border-destructive' : ''}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="font-medium">
                            {mapped.name || <span className="text-muted-foreground italic">No name</span>}
                          </div>
                          {rowErrors.length > 0 && (
                            <Badge variant="destructive" className="text-xs">
                              {rowErrors.length} issue(s)
                            </Badge>
                          )}
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {mapped.bed && <div><span className="font-medium">Bed:</span> {mapped.bed}</div>}
                          {mapped.room && <div><span className="font-medium">Room:</span> {mapped.room}</div>}
                          {mapped.mrn && <div><span className="font-medium">MRN:</span> {mapped.mrn}</div>}
                          {mapped.diagnosis && <div><span className="font-medium">Diagnosis:</span> {mapped.diagnosis}</div>}
                          {mapped.attending && <div><span className="font-medium">Attending:</span> {mapped.attending}</div>}
                          {mapped.service && <div><span className="font-medium">Service:</span> {mapped.service}</div>}
                        </div>
                      </Card>
                    );
                  })}
                  {parsedData.rowCount > 5 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      ... and {parsedData.rowCount - 5} more rows
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="flex justify-between items-center pt-4 border-t mt-auto flex-shrink-0">
              <Button variant="outline" onClick={() => setStep("mapping")}>
                Back to Mapping
              </Button>
              <div className="flex gap-2">
                <span className="text-sm text-muted-foreground self-center">
                  {validRowCount} valid rows will be imported
                </span>
                <Button onClick={handleImport} disabled={isLoading || validRowCount === 0}>
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Import {validRowCount} Patient{validRowCount !== 1 ? 's' : ''}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );

  if (noDialog) {
    return (
      <div className="max-w-3xl max-h-[80vh] flex flex-col">
        {content}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => o ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start gap-2">
          <Table2 className="h-4 w-4" />
          Import from CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        {content}
      </DialogContent>
    </Dialog>
  );
};
