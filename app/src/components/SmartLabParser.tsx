import * as React from "react";
import { ClipboardPaste, TestTube } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatParsedLabs, parseLabText, type ParsedLabValue } from "@/lib/labPasteParser";

interface SmartLabParserProps {
  onLabsParsed: (labs: string) => void;
}

export function SmartLabParser({ onLabsParsed }: SmartLabParserProps) {
  const [open, setOpen] = React.useState(false);
  const [rawText, setRawText] = React.useState("");
  const [parsedLabs, setParsedLabs] = React.useState<ParsedLabValue[]>([]);

  const parse = React.useCallback((text: string) => {
    const values = parseLabText(text);
    setParsedLabs(values);
    if (values.length > 0) toast.success(`Parsed ${values.length} lab values for review`);
    else toast.warning("No supported lab values recognized");
  }, []);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRawText(text);
      parse(text);
    } catch {
      toast.error("Clipboard access was unavailable. Paste into the text box instead.");
    }
  };

  const handleImport = () => {
    const formatted = formatParsedLabs(parsedLabs);
    if (!formatted) return;
    onLabsParsed(formatted);
    setOpen(false);
    setRawText("");
    setParsedLabs([]);
    toast.success("Reviewed lab text added to the chart");
  };

  const panels = React.useMemo(
    () => (["BMP", "CBC", "ABG", "Coagulation"] as const)
      .map((panel) => ({ panel, values: parsedLabs.filter((lab) => lab.panel === panel) }))
      .filter(({ values }) => values.length > 0),
    [parsedLabs],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ClipboardPaste className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Parse Labs</span>
          <span className="sm:hidden">Paste</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Lab paste parser</DialogTitle>
          <DialogDescription>
            Extract supported values from pasted text, review them, then add the formatted text to this chart. No ranges, flags, or clinical interpretations are inferred.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          <Button onClick={handlePaste} variant="outline" className="gap-1.5">
            <ClipboardPaste className="h-4 w-4" aria-hidden="true" /> Paste from clipboard
          </Button>
          <Button onClick={() => parse(rawText)} disabled={!rawText.trim()} variant="outline">Parse text</Button>
        </div>

        <Textarea
          aria-label="Lab text to parse"
          placeholder="Paste lab results here, for example: Na 138, K 4.2, Cr 1.1, WBC 8.4"
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          className="min-h-28"
        />

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {panels.length > 0 ? panels.map(({ panel, values }) => (
            <section key={panel} className="rounded-lg border border-border/50 p-3">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <TestTube className="h-4 w-4 text-primary" aria-hidden="true" /> {panel}
              </h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {values.map((lab) => (
                  <div key={lab.key} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                    <span className="font-medium">{lab.label}</span>
                    <span>{lab.value}{lab.unit ? ` ${lab.unit}` : ""}</span>
                  </div>
                ))}
              </div>
            </section>
          )) : (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Parsed values will appear here for review.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t pt-3">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleImport} disabled={parsedLabs.length === 0}>Add reviewed labs</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
