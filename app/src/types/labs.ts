/**
 * Lab Value Types for Fishbone Display
 * Supports structured lab data with trending capabilities
 */

// Individual lab value with trending support
export interface LabValue {
  value: number | null;
  previousValue?: number | null;
  unit?: string;
  timestamp?: string;
  previousTimestamp?: string;
}

// Basic Metabolic Panel (BMP) structure
export interface BMPLabs {
  na?: LabValue;    // Sodium
  k?: LabValue;     // Potassium
  cl?: LabValue;    // Chloride
  co2?: LabValue;   // Bicarbonate
  bun?: LabValue;   // Blood Urea Nitrogen
  cr?: LabValue;    // Creatinine
  glu?: LabValue;   // Glucose
}

// Complete Blood Count (CBC) structure
export interface CBCLabs {
  wbc?: LabValue;   // White Blood Cells
  hgb?: LabValue;   // Hemoglobin
  hct?: LabValue;   // Hematocrit
  plt?: LabValue;   // Platelets
}

// Combined structured labs
export interface StructuredLabs {
  bmp?: BMPLabs;
  cbc?: CBCLabs;
  rawText?: string; // Fallback for unstructured text
}

// Normal ranges for lab values (adult ranges)
export const LAB_NORMAL_RANGES: Record<string, { low: number; high: number; unit: string }> = {
  // BMP
  na: { low: 135, high: 145, unit: 'mEq/L' },
  k: { low: 3.5, high: 5.0, unit: 'mEq/L' },
  cl: { low: 98, high: 106, unit: 'mEq/L' },
  co2: { low: 22, high: 29, unit: 'mEq/L' },
  bun: { low: 7, high: 20, unit: 'mg/dL' },
  cr: { low: 0.7, high: 1.3, unit: 'mg/dL' },
  glu: { low: 70, high: 100, unit: 'mg/dL' },
  // CBC
  wbc: { low: 4.5, high: 11.0, unit: 'K/uL' },
  hgb: { low: 12.0, high: 17.5, unit: 'g/dL' },
  hct: { low: 36, high: 50, unit: '%' },
  plt: { low: 150, high: 400, unit: 'K/uL' },
};

// Helper to determine if a value is high, low, or normal
export type LabStatus = 'high' | 'low' | 'normal' | 'unknown';

export const getLabStatus = (labKey: string, value: number | null | undefined): LabStatus => {
  if (value === null || value === undefined) return 'unknown';
  const range = LAB_NORMAL_RANGES[labKey];
  if (!range) return 'unknown';
  if (value > range.high) return 'high';
  if (value < range.low) return 'low';
  return 'normal';
};

// Helper to calculate delta between current and previous value
export const getLabDelta = (current: number | null | undefined, previous: number | null | undefined): number | null => {
  if (current === null || current === undefined || previous === null || previous === undefined) {
    return null;
  }
  return Number((current - previous).toFixed(2));
};

// Parse raw lab text to structured format (basic parsing)
export const parseLabText = (text: string): StructuredLabs => {
  if (!text || text.trim() === '') {
    return { rawText: '' };
  }
  
  const result: StructuredLabs = {
    bmp: {},
    cbc: {},
    rawText: text,
  };

  const numberPattern = '(\\d+(?:\\.\\d+)?)';
  const trendSeparator = '(?:/|->|→)';
  const prevKeywords = '(?:prev|previous|prior)';

  const parseLabValue = (source: string, labels: string[]): LabValue | null => {
    for (const label of labels) {
      const trendRegex = new RegExp(
        `${label}\\s*[:=]?\\s*${numberPattern}\\s*${trendSeparator}\\s*${numberPattern}`,
        'i'
      );
      const prevRegex = new RegExp(
        `${label}\\s*[:=]?\\s*${numberPattern}[^\\d]{0,8}${prevKeywords}\\s*[:=]?\\s*${numberPattern}`,
        'i'
      );
      const simpleRegex = new RegExp(`${label}\\s*[:\\s]+${numberPattern}`, 'i');

      const trendMatch = source.match(trendRegex);
      if (trendMatch) {
        return {
          value: parseFloat(trendMatch[1]),
          previousValue: parseFloat(trendMatch[2]),
        };
      }

      const prevMatch = source.match(prevRegex);
      if (prevMatch) {
        return {
          value: parseFloat(prevMatch[1]),
          previousValue: parseFloat(prevMatch[2]),
        };
      }

      const simpleMatch = source.match(simpleRegex);
      if (simpleMatch) {
        return { value: parseFloat(simpleMatch[1]) };
      }
    }

    return null;
  };

  // Common lab patterns (case insensitive)
  const patterns: Array<{
    target: 'bmp' | 'cbc';
    key: keyof BMPLabs | keyof CBCLabs;
    labels: string[];
  }> = [
    { target: 'bmp', key: 'na', labels: ['na', 'sodium'] },
    { target: 'bmp', key: 'k', labels: ['k', 'potassium'] },
    { target: 'bmp', key: 'cl', labels: ['cl', 'chloride'] },
    { target: 'bmp', key: 'co2', labels: ['co2', 'bicarb', 'hco3'] },
    { target: 'bmp', key: 'bun', labels: ['bun'] },
    { target: 'bmp', key: 'cr', labels: ['cr', 'creatinine'] },
    { target: 'bmp', key: 'glu', labels: ['glu', 'glucose'] },
    { target: 'cbc', key: 'wbc', labels: ['wbc'] },
    { target: 'cbc', key: 'hgb', labels: ['hgb', 'hemoglobin'] },
    { target: 'cbc', key: 'hct', labels: ['hct', 'hematocrit'] },
    { target: 'cbc', key: 'plt', labels: ['plt', 'platelets'] },
  ];

  for (const { target, key, labels } of patterns) {
    const parsedValue = parseLabValue(text, labels);
    if (parsedValue && !isNaN(parsedValue.value ?? NaN)) {
      if (target === 'bmp') {
        result.bmp![key as keyof BMPLabs] = parsedValue;
      } else {
        result.cbc![key as keyof CBCLabs] = parsedValue;
      }
    }
  }
  
  return result;
};
