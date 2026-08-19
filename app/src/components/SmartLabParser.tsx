import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardPaste, AlertTriangle, CheckCircle2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { toast } from "sonner";

interface LabValue {
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  isCritical: boolean;
  isAbnormal: boolean;
  trend?: 'up' | 'down' | 'stable';
  interpretation?: string;
}

interface ParsedLabs {
  bmp?: LabValue[];
  cmp?: LabValue[];
  cbc?: LabValue[];
  coag?: LabValue[];
  abg?: LabValue[];
  other?: LabValue[];
}

const getLabPanels = (labs: ParsedLabs): Array<[keyof ParsedLabs, LabValue[]]> => {
  const panels: Array<[keyof ParsedLabs, LabValue[]]> = [];

  for (const panel of Object.keys(labs) as Array<keyof ParsedLabs>) {
    const values = labs[panel];
    if (values) panels.push([panel, values]);
  }

  return panels;
};

const LAB_PATTERNS = {
  bmp: {
    sodium: [/na\s*[:=]?\s*(\d+\.?\d*)\s*(mmol\/L|mEq\/L)?/i, /sodium\s*[:=]?\s*(\d+\.?\d*)\s*(mmol\/L|mEq\/L)?/i],
    potassium: [/k\s*[:=]?\s*(\d+\.?\d*)\s*(mmol\/L|mEq\/L)?/i, /potassium\s*[:=]?\s*(\d+\.?\d*)\s*(mmol\/L|mEq\/L)?/i],
    chloride: [/cl\s*[:=]?\s*(\d+\.?\d*)\s*(mmol\/L|mEq\/L)?/i, /chloride\s*[:=]?\s*(\d+\.?\d*)\s*(mmol\/L|mEq\/L)?/i],
    bicarb: [/hco3\s*[:=]?\s*(\d+\.?\d*)\s*(mmol\/L|mEq\/L)?/i, /bicarbonate\s*[:=]?\s*(\d+\.?\d*)\s*(mmol\/L|mEq\/L)?/i],
    bun: [/bun\s*[:=]?\s*(\d+\.?\d*)\s*(mg\/dL)?/i],
    creatinine: [/cr\s*[:=]?\s*(\d+\.?\d*)\s*(mg\/dL)?/i, /creatinine\s*[:=]?\s*(\d+\.?\d*)\s*(mg\/dL)?/i],
    glucose: [/glu\s*[:=]?\s*(\d+\.?\d*)\s*(mg\/dL)?/i, /glucose\s*[:=]?\s*(\d+\.?\d*)\s*(mg\/dL)?/i],
    calcium: [/ca\s*[:=]?\s*(\d+\.?\d*)\s*(mg\/dL)?/i, /calcium\s*[:=]?\s*(\d+\.?\d*)\s*(mg\/dL)?/i],
  },
  cbc: {
    wbc: [/wbc\s*[:=]?\s*(\d+\.?\d*)\s*(K\/uL|x10\^3\/uL)?/i, /white.*blood.*cell\s*[:=]?\s*(\d+\.?\d*)/i],
    hgb: [/hgb\s*[:=]?\s*(\d+\.?\d*)\s*(g\/dL)?/i, /hemoglobin\s*[:=]?\s*(\d+\.?\d*)\s*(g\/dL)?/i],
    hct: [/hct\s*[:=]?\s*(\d+\.?\d*)\s*(%)?/i, /hematocrit\s*[:=]?\s*(\d+\.?\d*)\s*(%)?/i],
    plt: [/plt\s*[:=]?\s*(\d+)\s*(K\/uL|x10\^3\/uL)?/i, /platelet\s*[:=]?\s*(\d+)/i],
    neutrophils: [/neut\s*[:=]?\s*(\d+\.?\d*)\s*(%)?/i],
    lymphocytes: [/lymph\s*[:=]?\s*(\d+\.?\d*)\s*(%)?/i],
  },
  abg: {
    ph: [/ph\s*[:=]?\s*(\d+\.?\d+)/i],
    pco2: [/pco2\s*[:=]?\s*(\d+\.?\d*)\s*(mmHg)?/i],
    po2: [/po2\s*[:=]?\s*(\d+\.?\d*)\s*(mmHg)?/i],
    hco3: [/hco3\s*[:=]?\s*(\d+\.?\d*)\s*(mmol\/L|mEq\/L)?/i],
    o2sat: [/o2sat\s*[:=]?\s*(\d+\.?\d*)\s*(%)?/i, /saturation\s*[:=]?\s*(\d+\.?\d*)\s*(%)?/i],
  },
  coag: {
    pt: [/pt\s*[:=]?\s*(\d+\.?\d*)\s*(sec|s)?/i],
    inr: [/inr\s*[:=]?\s*(\d+\.?\d+)/i],
    ptt: [/ptt\s*[:=]?\s*(\d+\.?\d*)\s*(sec|s)?/i],
  },
};

const REFERENCE_RANGES = {
  sodium: { min: 135, max: 145, critical: { min: 120, max: 160 }, unit: 'mmol/L' },
  potassium: { min: 3.5, max: 5.1, critical: { min: 2.5, max: 6.5 }, unit: 'mmol/L' },
  chloride: { min: 98, max: 107, unit: 'mmol/L' },
  bicarb: { min: 22, max: 29, unit: 'mmol/L' },
  bun: { min: 7, max: 20, unit: 'mg/dL' },
  creatinine: { min: 0.6, max: 1.2, unit: 'mg/dL' },
  glucose: { min: 70, max: 100, critical: { min: 40, max: 500 }, unit: 'mg/dL' },
  calcium: { min: 8.5, max: 10.2, unit: 'mg/dL' },
  wbc: { min: 4.5, max: 11.0, critical: { min: 1, max: 40 }, unit: 'K/uL' },
  hgb: { min: 13.5, max: 17.5, critical: { min: 6, max: 20 }, unit: 'g/dL' },
  hct: { min: 38, max: 50, unit: '%' },
  plt: { min: 150, max: 450, critical: { min: 20, max: 1000 }, unit: 'K/uL' },
  neutrophils: { min: 40, max: 75, unit: '%' },
  lymphocytes: { min: 20, max: 45, unit: '%' },
  ph: { min: 7.35, max: 7.45, critical: { min: 7.1, max: 7.7 }, unit: '' },
  pco2: { min: 35, max: 45, critical: { min: 20, max: 70 }, unit: 'mmHg' },
  po2: { min: 80, max: 100, critical: { min: 50 }, unit: 'mmHg' },
  hco3_abg: { min: 22, max: 26, unit: 'mmol/L' },
  o2sat: { min: 95, max: 100, critical: { min: 85 }, unit: '%' },
  pt: { min: 9.4, max: 12.5, unit: 'sec' },
  inr: { min: 0.9, max: 1.1, critical: { max: 3 }, unit: '' },
  ptt: { min: 25, max: 37, unit: 'sec' },
};

const INTERPRETATIONS = {
  metabolic_alkalosis: (hco3: number, ph: number) => hco3 > 26 && ph > 7.45,
  metabolic_acidosis: (hco3: number, ph: number) => hco3 < 22 && ph < 7.35,
  respiratory_alkalosis: (pco2: number, ph: number) => pco2 < 35 && ph > 7.45,
  respiratory_acidosis: (pco2: number, ph: number) => pco2 > 45 && ph < 7.35,
  anemia: (hgb: number) => hgb < 13.5,
  thrombocytopenia: (plt: number) => plt < 150,
  leukopenia: (wbc: number) => wbc < 4.5,
  leukocytosis: (wbc: number) => wbc > 11,
  hyperkalemia: (k: number) => k > 5.1,
  hypokalemia: (k: number) => k < 3.5,
  hyponatremia: (na: number) => na < 135,
  hypernatremia: (na: number) => na > 145,
  azotemia: (bun: number, cr: number) => bun > 20 || cr > 1.2,
  hypoglycemia: (glu: number) => glu < 70,
  hyperglycemia: (glu: number) => glu > 100,
};

interface SmartLabParserProps {
  onLabsParsed: (labs: string) => void;
}

export function SmartLabParser({ onLabsParsed }: SmartLabParserProps) {
  const [open, setOpen] = React.useState(false);
  const [rawText, setRawText] = React.useState("");
  const [parsedLabs, setParsedLabs] = React.useState<ParsedLabs>({});
  const [interpretations, setInterpretations] = React.useState<string[]>([]);
  const [isParsing, setIsParsing] = React.useState(false);

  const parseLabValue = (text: string, name: string, patterns: RegExp[], referenceKey: string): LabValue | null => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const value = parseFloat(match[1]);
        const ref = REFERENCE_RANGES[referenceKey as keyof typeof REFERENCE_RANGES];
        
        if (!ref) return null;

        const criticalRef: { min?: number; max?: number } | undefined =
          'critical' in ref ? ref.critical : undefined;
        const isCritical = Boolean(criticalRef && (
          (criticalRef.min !== undefined && value < criticalRef.min) ||
          (criticalRef.max !== undefined && value > criticalRef.max)
        ));
        
        const isAbnormal = value < ref.min || value > ref.max;

        return {
          name: name.charAt(0).toUpperCase() + name.slice(1),
          value: match[1],
          unit: ref.unit,
          referenceRange: `${ref.min}-${ref.max} ${ref.unit}`,
          isCritical,
          isAbnormal,
        };
      }
    }
    return null;
  };

  const parseLabs = (text: string): ParsedLabs => {
    const result: ParsedLabs = {};

    const bmp: LabValue[] = [];
    const cmp: LabValue[] = [];
    const cbc: LabValue[] = [];
    const coag: LabValue[] = [];
    const abg: LabValue[] = [];
    const other: LabValue[] = [];

    const sodium = parseLabValue(text, 'sodium', LAB_PATTERNS.bmp.sodium, 'sodium');
    if (sodium) { bmp.push(sodium); cmp.push(sodium); }

    const potassium = parseLabValue(text, 'potassium', LAB_PATTERNS.bmp.potassium, 'potassium');
    if (potassium) { bmp.push(potassium); cmp.push(potassium); }

    const chloride = parseLabValue(text, 'chloride', LAB_PATTERNS.bmp.chloride, 'chloride');
    if (chloride) { bmp.push(chloride); cmp.push(chloride); }

    const bicarb = parseLabValue(text, 'bicarbonate', LAB_PATTERNS.bmp.bicarb, 'bicarb');
    if (bicarb) { bmp.push(bicarb); cmp.push(bicarb); }

    const bun = parseLabValue(text, 'bun', LAB_PATTERNS.bmp.bun, 'bun');
    if (bun) { bmp.push(bun); cmp.push(bun); }

    const creatinine = parseLabValue(text, 'creatinine', LAB_PATTERNS.bmp.creatinine, 'creatinine');
    if (creatinine) { bmp.push(creatinine); cmp.push(creatinine); }

    const glucose = parseLabValue(text, 'glucose', LAB_PATTERNS.bmp.glucose, 'glucose');
    if (glucose) { bmp.push(glucose); cmp.push(glucose); }

    const calcium = parseLabValue(text, 'calcium', LAB_PATTERNS.bmp.calcium, 'calcium');
    if (calcium) { bmp.push(calcium); cmp.push(calcium); }

    if (bmp.length > 0) result.bmp = bmp;
    if (cmp.length > 0) result.cmp = cmp;

    const wbc = parseLabValue(text, 'wbc', LAB_PATTERNS.cbc.wbc, 'wbc');
    if (wbc) cbc.push(wbc);

    const hgb = parseLabValue(text, 'hgb', LAB_PATTERNS.cbc.hgb, 'hgb');
    if (hgb) cbc.push(hgb);

    const hct = parseLabValue(text, 'hct', LAB_PATTERNS.cbc.hct, 'hct');
    if (hct) cbc.push(hct);

    const plt = parseLabValue(text, 'plt', LAB_PATTERNS.cbc.plt, 'plt');
    if (plt) cbc.push(plt);

    if (cbc.length > 0) result.cbc = cbc;

    const ph = parseLabValue(text, 'ph', LAB_PATTERNS.abg.ph, 'ph');
    const pco2 = parseLabValue(text, 'pco2', LAB_PATTERNS.abg.pco2, 'pco2');
    const po2 = parseLabValue(text, 'po2', LAB_PATTERNS.abg.po2, 'po2');
    const hco3_abg = parseLabValue(text, 'hco3', LAB_PATTERNS.abg.hco3, 'hco3_abg');
    const o2sat = parseLabValue(text, 'o2sat', LAB_PATTERNS.abg.o2sat, 'o2sat');

    const abgValues = [ph, pco2, po2, hco3_abg, o2sat].filter(Boolean) as LabValue[];
    if (abgValues.length > 0) result.abg = abgValues;

    const pt = parseLabValue(text, 'pt', LAB_PATTERNS.coag.pt, 'pt');
    const inr = parseLabValue(text, 'inr', LAB_PATTERNS.coag.inr, 'inr');
    const ptt = parseLabValue(text, 'ptt', LAB_PATTERNS.coag.ptt, 'ptt');

    const coagValues = [pt, inr, ptt].filter(Boolean) as LabValue[];
    if (coagValues.length > 0) result.coag = coagValues;

    return result;
  };

  const generateInterpretations = (labs: ParsedLabs): string[] => {
    const results: string[] = [];
    const values: Record<string, number> = {};

    labs.bmp?.forEach(lab => {
      const key = lab.name.toLowerCase();
      values[key] = parseFloat(lab.value);
    });

    labs.cbc?.forEach(lab => {
      const key = lab.name.toLowerCase();
      values[key] = parseFloat(lab.value);
    });

    labs.abg?.forEach(lab => {
      const key = lab.name.toLowerCase();
      values[key] = parseFloat(lab.value);
    });

    if (values.ph && values.hco3 && values.pco2) {
      if (INTERPRETATIONS.metabolic_acidosis(values.hco3, values.ph)) {
        results.push('Metabolic acidosis');
      } else if (INTERPRETATIONS.metabolic_alkalosis(values.hco3, values.ph)) {
        results.push('Metabolic alkalosis');
      } else if (INTERPRETATIONS.respiratory_acidosis(values.pco2, values.ph)) {
        results.push('Respiratory acidosis');
      } else if (INTERPRETATIONS.respiratory_alkalosis(values.pco2, values.ph)) {
        results.push('Respiratory alkalosis');
      }
    }

    if (values.potassium) {
      if (INTERPRETATIONS.hyperkalemia(values.potassium)) {
        results.push(values.potassium > 6 ? 'Severe hyperkalemia (risk of arrhythmia)' : 'Hyperkalemia');
      } else if (INTERPRETATIONS.hypokalemia(values.potassium)) {
        results.push('Hypokalemia');
      }
    }

    if (values.sodium) {
      if (INTERPRETATIONS.hyponatremia(values.sodium)) {
        results.push(values.sodium < 125 ? 'Severe hyponatremia' : 'Hyponatremia');
      } else if (INTERPRETATIONS.hypernatremia(values.sodium)) {
        results.push('Hypernatremia');
      }
    }

    if (values.hgb && INTERPRETATIONS.anemia(values.hgb)) {
      results.push(values.hgb < 8 ? 'Severe anemia' : 'Anemia');
    }

    if (values.wbc) {
      if (INTERPRETATIONS.leukopenia(values.wbc)) {
        results.push('Leukopenia');
      } else if (INTERPRETATIONS.leukocytosis(values.wbc)) {
        results.push(values.wbc > 20 ? 'Marked leukocytosis' : 'Leukocytosis');
      }
    }

    if (values.plt && INTERPRETATIONS.thrombocytopenia(values.plt)) {
      results.push(values.plt < 50 ? 'Severe thrombocytopenia' : 'Thrombocytopenia');
    }

    if (values.glucose) {
      if (INTERPRETATIONS.hypoglycemia(values.glucose)) {
        results.push('Hypoglycemia');
      } else if (INTERPRETATIONS.hyperglycemia(values.glucose)) {
        results.push(values.glucose > 200 ? 'Significant hyperglycemia' : 'Hyperglycemia');
      }
    }

    if (values.bun && values.creatinine && INTERPRETATIONS.azotemia(values.bun, values.creatinine)) {
      const ratio = values.bun / values.creatinine;
      if (ratio > 20) {
        results.push('Prerenal azotemia (elevated BUN/Cr ratio)');
      } else if (ratio < 10) {
        results.push('Intrinsic renal injury (low BUN/Cr ratio)');
      } else {
        results.push('Azotemia (elevated BUN/Cr)');
      }
    }

    return results;
  };

  const handleParse = () => {
    setIsParsing(true);
    setTimeout(() => {
      const parsed = parseLabs(rawText);
      const interp = generateInterpretations(parsed);
      setParsedLabs(parsed);
      setInterpretations(interp);
      setIsParsing(false);

      const criticalCount = [
        ...Object.values(parsed).flat(),
      ].filter(lab => lab.isCritical).length;

      if (criticalCount > 0) {
        toast.error(`Found ${criticalCount} critical value${criticalCount > 1 ? 's' : ''}`);
      } else if (Object.keys(parsed).length > 0) {
        toast.success(`Parsed ${Object.values(parsed).flat().length} lab values`);
      } else {
        toast.warning('No lab values recognized');
      }
    }, 300);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRawText(text);
      handleParse();
    } catch (err) {
      toast.error('Failed to read clipboard');
    }
  };

  const handleImport = () => {
    const formattedLabs = formatLabsForImport(parsedLabs);
    onLabsParsed(formattedLabs);
    setOpen(false);
    setRawText('');
    setParsedLabs({});
    setInterpretations([]);
    toast.success('Labs imported successfully');
  };

  const formatLabsForImport = (labs: ParsedLabs): string => {
    const lines: string[] = [];
    const criticalValues: string[] = [];

    getLabPanels(labs).forEach(([panel, values]) => {
      if (values.length > 0) {
        lines.push(`\n${panel.toUpperCase()}:`);
        values.forEach(lab => {
          const criticalMark = lab.isCritical ? ' ⚠️ CRITICAL' : lab.isAbnormal ? ' *' : '';
          lines.push(`  ${lab.name}: ${lab.value} ${lab.unit}${criticalMark}`);
          if (lab.isCritical) {
            criticalValues.push(`${lab.name}: ${lab.value} ${lab.unit} (Ref: ${lab.referenceRange})`);
          }
        });
      }
    });

    if (interpretations.length > 0) {
      lines.push('\nINTERPRETATION:');
      interpretations.forEach(interp => lines.push(`  - ${interp}`));
    }

    if (criticalValues.length > 0) {
      lines.unshift('\n⚠️ CRITICAL VALUES:');
      criticalValues.forEach(cv => lines.push(`  ${cv}`));
    }

    return lines.join('\n');
  };

  const LabValueDisplay = ({ lab }: { lab: LabValue }) => (
    <div className={`flex items-center justify-between p-2 rounded-lg border ${
      lab.isCritical ? 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800' :
      lab.isAbnormal ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800' :
      'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
    }`}>
      <div className="flex items-center gap-2">
        {lab.isCritical && <AlertTriangle className="h-4 w-4 text-red-700 dark:text-red-400" />}
        {lab.isAbnormal && !lab.isCritical && <Minus className="h-4 w-4 text-yellow-700 dark:text-yellow-400" />}
        {!lab.isAbnormal && <CheckCircle2 className="h-4 w-4 text-green-700 dark:text-green-400" />}
        <span className="text-sm font-medium">{lab.name}</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold">{lab.value} {lab.unit}</span>
        <span className="text-xs text-muted-foreground">{lab.referenceRange}</span>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ClipboardPaste className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Parse Labs</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Smart Lab Parser</DialogTitle>
          <DialogDescription>
            Paste lab results from your clipboard to automatically parse and interpret values
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button onClick={handlePaste} variant="outline" className="gap-1.5">
            <ClipboardPaste className="h-4 w-4" />
            Paste from Clipboard
          </Button>
          <Button onClick={handleParse} disabled={!rawText || isParsing} variant="outline" className="gap-1.5">
            {isParsing ? 'Parsing...' : 'Parse Text'}
          </Button>
        </div>

        <Textarea
          placeholder="Paste lab results here... (e.g., &quot;Na 138, K 5.2, Cr 1.8&quot;)"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          className="min-h-[120px] font-mono text-sm"
        />

        {Object.keys(parsedLabs).length > 0 && (
          <div className="flex-1 overflow-hidden flex flex-col">
            {interpretations.length > 0 && (
              <Alert className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Clinical Interpretation</AlertTitle>
                <AlertDescription className="mt-2">
                  <ul className="space-y-1">
                    {interpretations.map((interp, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span>{interp}</span>
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue={Object.keys(parsedLabs)[0]} className="flex-1 flex flex-col">
              <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-5">
                {Object.keys(parsedLabs).map(panel => (
                  <TabsTrigger key={panel} value={panel} className="text-xs">
                    {panel.toUpperCase()}
                  </TabsTrigger>
                ))}
              </TabsList>

              {getLabPanels(parsedLabs).map(([panel, values]) => (
                <TabsContent key={panel} value={panel} className="flex-1 overflow-y-auto mt-4">
                  <div className="space-y-2">
                    {values.map((lab, i) => (
                      <LabValueDisplay key={i} lab={lab} />
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </div>
        )}

        <div className="flex gap-2 pt-4 border-t">
          <Button onClick={handleImport} disabled={Object.keys(parsedLabs).length === 0} className="flex-1">
            Import to Patient Record
          </Button>
          <Button onClick={() => {
            setRawText('');
            setParsedLabs({});
            setInterpretations([]);
          }} variant="outline">
            Clear
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
