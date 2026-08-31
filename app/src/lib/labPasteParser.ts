export interface ParsedLabValue {
  key: string;
  label: string;
  value: string;
  unit: string;
  panel: "BMP" | "CBC" | "ABG" | "Coagulation";
}

interface LabDefinition extends Omit<ParsedLabValue, "value"> {
  patterns: RegExp[];
}

const LAB_DEFINITIONS: LabDefinition[] = [
  { key: "na", label: "Na", unit: "mmol/L", panel: "BMP", patterns: [/\bna\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i, /\bsodium\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i] },
  { key: "k", label: "K", unit: "mmol/L", panel: "BMP", patterns: [/\bk\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i, /\bpotassium\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i] },
  { key: "cl", label: "Cl", unit: "mmol/L", panel: "BMP", patterns: [/\bcl\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i, /\bchloride\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i] },
  { key: "hco3", label: "HCO3", unit: "mmol/L", panel: "BMP", patterns: [/\bhco3\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i, /\bbicarb(?:onate)?\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i] },
  { key: "bun", label: "BUN", unit: "mg/dL", panel: "BMP", patterns: [/\bbun\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i] },
  { key: "cr", label: "Cr", unit: "mg/dL", panel: "BMP", patterns: [/\bcr\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i, /\bcreatinine\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i] },
  { key: "glucose", label: "Glucose", unit: "mg/dL", panel: "BMP", patterns: [/\bglu(?:cose)?\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i] },
  { key: "ca", label: "Ca", unit: "mg/dL", panel: "BMP", patterns: [/\bca\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i, /\bcalcium\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i] },
  { key: "wbc", label: "WBC", unit: "K/uL", panel: "CBC", patterns: [/\bwbc\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i, /\bwhite\s+blood\s+cells?\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i] },
  { key: "hgb", label: "Hgb", unit: "g/dL", panel: "CBC", patterns: [/\bhgb\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i, /\bhemoglobin\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i] },
  { key: "hct", label: "Hct", unit: "%", panel: "CBC", patterns: [/\bhct\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i, /\bhematocrit\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i] },
  { key: "plt", label: "Plt", unit: "K/uL", panel: "CBC", patterns: [/\bplt\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i, /\bplatelets?\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i] },
  { key: "ph", label: "pH", unit: "", panel: "ABG", patterns: [/\bph\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i] },
  { key: "pco2", label: "pCO2", unit: "mmHg", panel: "ABG", patterns: [/\bpco2\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i] },
  { key: "po2", label: "pO2", unit: "mmHg", panel: "ABG", patterns: [/\bpo2\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i] },
  { key: "o2sat", label: "O2 sat", unit: "%", panel: "ABG", patterns: [/\bo2\s*sat(?:uration)?\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i] },
  { key: "pt", label: "PT", unit: "sec", panel: "Coagulation", patterns: [/\bpt\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i] },
  { key: "inr", label: "INR", unit: "", panel: "Coagulation", patterns: [/\binr\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i] },
  { key: "ptt", label: "PTT", unit: "sec", panel: "Coagulation", patterns: [/\bptt\s*[:=]?\s*(-?\d+(?:\.\d+)?)/i] },
];

export function parseLabText(text: string): ParsedLabValue[] {
  return LAB_DEFINITIONS.flatMap((definition) => {
    const match = definition.patterns.map((pattern) => text.match(pattern)).find(Boolean);
    if (!match?.[1]) return [];
    return [{
      key: definition.key,
      label: definition.label,
      value: match[1],
      unit: definition.unit,
      panel: definition.panel,
    }];
  });
}

export function formatParsedLabs(values: ParsedLabValue[]): string {
  const panels: ParsedLabValue["panel"][] = ["BMP", "CBC", "ABG", "Coagulation"];
  return panels.flatMap((panel) => {
    const panelValues = values.filter((value) => value.panel === panel);
    if (panelValues.length === 0) return [];
    const line = panelValues.map((lab) => `${lab.label} ${lab.value}${lab.unit ? ` ${lab.unit}` : ""}`).join(", ");
    return [`${panel}: ${line}`];
  }).join("\n");
}
