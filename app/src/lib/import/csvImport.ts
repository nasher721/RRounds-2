/**
 * CSV Import Utilities - Bulk patient import with mapping wizard
 * Handles CSV parsing, field mapping, and validation
 */

import { safeLocalStorage } from "@/utils/safeStorage";

export interface CSVColumn {
  header: string;
  sampleValues: string[];
}

export interface FieldMapping {
  csvColumn: string;
  targetField: string;
  transform?: 'uppercase' | 'lowercase' | 'titlecase' | 'date' | 'number';
  defaultValue?: string;
}

export interface ImportMapping {
  id: string;
  name: string;
  columns: FieldMapping[];
  createdAt: Date;
  lastUsed?: Date;
}

export interface CSVParseResult {
  headers: string[];
  rows: string[][];
  rowCount: number;
  errors: CSVParseError[];
}

export interface CSVParseError {
  line: number;
  message: string;
}

export interface ValidationError {
  row: number;
  column: string;
  message: string;
  value: string;
}

export interface ImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: ValidationError[];
}

/**
 * Parse CSV string into structured data
 */
export function parseCSV(csvText: string): CSVParseResult {
  const parsed = parseCSVRecords(csvText.replace(/^\uFEFF/, ''));
  const [headerRecord, ...dataRecords] = parsed.records;

  if (!headerRecord) {
    return { headers: [], rows: [], rowCount: 0, errors: parsed.errors };
  }

  const headers = headerRecord.fields;
  const errors = [...parsed.errors];
  const normalizedHeaders = new Set<string>();
  headers.forEach((header, index) => {
    const normalized = header.trim().toLocaleLowerCase();
    if (!normalized) {
      errors.push({
        line: headerRecord.line,
        message: `Column ${index + 1} has no header. Name every column before importing.`,
      });
    } else if (normalizedHeaders.has(normalized)) {
      errors.push({
        line: headerRecord.line,
        message: 'Duplicate column headers are not supported. Give every column a unique name.',
      });
    } else {
      normalizedHeaders.add(normalized);
    }
  });
  const rows = dataRecords.flatMap(({ fields, line }) => {
    if (fields.length === headers.length) return [fields];
    errors.push({
      line,
      message: `Expected ${headers.length} columns but found ${fields.length}. Check commas and quoted fields.`,
    });
    return [];
  });
  
  return {
    headers,
    rows,
    rowCount: rows.length,
    errors,
  };
}

/**
 * Parse complete CSV records so line breaks inside quoted clinical text remain
 * part of the same field. Splitting into physical lines first silently turns a
 * multiline note into a second, invalid patient row.
 */
function parseCSVRecords(csvText: string): {
  records: Array<{ fields: string[]; line: number }>;
  errors: CSVParseError[];
} {
  const records: Array<{ fields: string[]; line: number }> = [];
  const errors: CSVParseError[] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;
  let recordHasSyntax = false;
  let currentLine = 1;
  let recordLine = 1;
  let quotedFieldLine = 1;
  let quoteClosed = false;

  const pushField = () => {
    row.push(current.trim());
    current = '';
    quoteClosed = false;
  };
  const pushRecord = () => {
    pushField();
    if (recordHasSyntax) records.push({ fields: row, line: recordLine });
    row = [];
    recordHasSyntax = false;
    recordLine = currentLine + 1;
  };

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];

    if (char === '"') {
      recordHasSyntax = true;
      if (inQuotes && csvText[i + 1] === '"') {
        current += '"';
        i++;
      } else if (inQuotes) {
        inQuotes = false;
        quoteClosed = true;
      } else if (current.trim().length === 0 && !quoteClosed) {
        quotedFieldLine = currentLine;
        inQuotes = true;
      } else {
        errors.push({
          line: currentLine,
          message: quoteClosed
            ? 'Unexpected quote after a quoted field. Separate fields with a comma.'
            : 'Unexpected quote inside an unquoted field. Quote the complete field.',
        });
      }
    } else if (char === ',' && !inQuotes) {
      recordHasSyntax = true;
      pushField();
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && csvText[i + 1] === '\n') i++;
      pushRecord();
      currentLine++;
    } else if ((char === '\n' || char === '\r') && inQuotes) {
      recordHasSyntax = true;
      if (char === '\r' && csvText[i + 1] === '\n') i++;
      current += '\n';
      currentLine++;
    } else if (quoteClosed && !/\s/.test(char)) {
      errors.push({
        line: currentLine,
        message: 'Unexpected content after a closing quote. Separate fields with a comma.',
      });
      quoteClosed = false;
      current += char;
    } else {
      current += char;
      if (!/\s/.test(char)) recordHasSyntax = true;
    }
  }

  if (inQuotes) {
    errors.push({
      line: quotedFieldLine,
      message: 'Unclosed quoted field. Add the missing closing quote before importing.',
    });
  } else if (recordHasSyntax || row.length > 0 || current.length > 0) {
    pushRecord();
  }
  return { records, errors };
}

/**
 * Extract sample values from CSV columns
 */
export function extractColumnSamples(csvData: CSVParseResult, header: string): string[] {
  const headerIndex = csvData.headers.indexOf(header);
  if (headerIndex === -1) return [];
  
  return csvData.rows
    .slice(0, 10)
    .map(row => row[headerIndex])
    .filter(val => val && val.length > 0);
}

/**
 * Available target fields for mapping
 */
export const PATIENT_TARGET_FIELDS = [
  { key: 'name', label: 'Patient Name', type: 'string' },
  { key: 'mrn', label: 'MRN', type: 'string' },
  { key: 'dob', label: 'Date of Birth', type: 'date' },
  { key: 'gender', label: 'Gender', type: 'select', options: ['M', 'F', 'Male', 'Female', 'Other', 'Unknown'] },
  { key: 'room', label: 'Room', type: 'string' },
  { key: 'bed', label: 'Bed', type: 'string' },
  { key: 'admissionDate', label: 'Admission Date', type: 'date' },
  { key: 'diagnosis', label: 'Diagnosis', type: 'string' },
  { key: 'attending', label: 'Attending Physician', type: 'string' },
  { key: 'service', label: 'Service', type: 'string' },
  { key: 'codeStatus', label: 'Code Status', type: 'select', options: ['Full', 'DNR', 'DNI', 'Comfort'] },
  { key: 'isolation', label: 'Isolation', type: 'select', options: ['None', 'Contact', 'Droplet', 'Airborne'] },
];

type PatientTargetField = (typeof PATIENT_TARGET_FIELDS)[number];

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Lookup tables derived once from PATIENT_TARGET_FIELDS, so header auto-mapping and
 * row validation do not re-normalize the same constant field metadata on every call.
 */
const TARGET_FIELDS_BY_KEY = new Map<string, PatientTargetField>(
  PATIENT_TARGET_FIELDS.map(field => [field.key, field]),
);

const NORMALIZED_TARGETS = PATIENT_TARGET_FIELDS.map(field => ({
  field,
  key: field.key.toLowerCase(),
  label: normalizeHeader(field.label),
}));

const SELECT_FIELD_OPTIONS = new Map<string, { allowed: Set<string>; display: string }>(
  PATIENT_TARGET_FIELDS.flatMap(field =>
    'options' in field && field.options
      ? [[field.key, {
          allowed: new Set(field.options.map(option => option.toLowerCase())),
          display: field.options.join(', '),
        }] as [string, { allowed: Set<string>; display: string }]]
      : [],
  ),
);

/**
 * Auto-map columns based on header name similarity
 */
export function autoMapColumns(csvHeaders: string[]): FieldMapping[] {
  const mappings: FieldMapping[] = [];
  
  for (const csvHeader of csvHeaders) {
    const normalizedHeader = normalizeHeader(csvHeader);

    for (const { field, key, label } of NORMALIZED_TARGETS) {
      if (normalizedHeader.includes(key) ||
          key.includes(normalizedHeader) ||
          normalizedHeader.includes(label) ||
          label.includes(normalizedHeader)) {

        mappings.push({
          csvColumn: csvHeader,
          targetField: field.key,
          transform: field.type === 'date' ? 'date' : undefined
        });
        break;
      }
    }
  }
  
  return mappings;
}

/**
 * Apply transformations to a value
 */
export function transformValue(value: string, transform?: string): string {
  if (!value) return value;
  
  switch (transform) {
    case 'uppercase':
      return value.toUpperCase();
    case 'lowercase':
      return value.toLowerCase();
    case 'titlecase':
      return value.replace(/\w\S*/g, txt => 
        txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
      );
    case 'date':
      return parseDate(value);
    case 'number':
      return value.replace(/[^0-9.-]/g, '');
    default:
      return value;
  }
}

/**
 * Parse various date formats to ISO
 */
function parseDate(value: string): string {
  const date = new Date(value);
  if (!isNaN(date.getTime())) {
    return date.toISOString();
  }
  
  const parts = value.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
  if (parts) {
    const [, m, d, y] = parts;
    const year = y.length === 2 ? (parseInt(y) > 50 ? '19' : '20') + y : y;
    return new Date(parseInt(year), parseInt(m) - 1, parseInt(d)).toISOString();
  }
  
  return value;
}

/**
 * Validate a single row
 */
export function validateRow(
  row: string[], 
  headers: string[], 
  mapping: FieldMapping[]
): ValidationError[] {
  const errors: ValidationError[] = [];
  
  for (const map of mapping) {
    const colIndex = headers.indexOf(map.csvColumn);
    if (colIndex === -1) continue;
    
    const value = row[colIndex];
    const targetField = TARGET_FIELDS_BY_KEY.get(map.targetField);
    
    if (!targetField) continue;
    
    if (!value || value.trim() === '') {
      if (targetField.key === 'name' && !map.defaultValue) {
        errors.push({
          row: 0,
          column: map.csvColumn,
          message: `Required field "${targetField.label}" is empty`,
          value: value || '(empty)'
        });
      }
      continue;
    }
    
    const selectOptions = targetField.type === 'select'
      ? SELECT_FIELD_OPTIONS.get(targetField.key)
      : undefined;
    if (selectOptions && !selectOptions.allowed.has(value.trim().toLowerCase())) {
      errors.push({
        row: 0,
        column: map.csvColumn,
        message: `Invalid value "${value}". Must be one of: ${selectOptions.display}`,
        value
      });
    }

    if (targetField.type === 'date') {
      const parsedDate = new Date(value);
      if (Number.isNaN(parsedDate.getTime())) {
        errors.push({
          row: 0,
          column: map.csvColumn,
          message: `Invalid date: ${value}`,
          value
        });
      } else if (targetField.key === 'dob' && parsedDate.getTime() > Date.now()) {
        errors.push({
          row: 0,
          column: map.csvColumn,
          message: 'Date of birth cannot be in the future',
          value
        });
      }
    }
    
    if (targetField.type === 'number' && isNaN(parseFloat(value))) {
      errors.push({
        row: 0,
        column: map.csvColumn,
        message: `Invalid number: ${value}`,
        value
      });
    }
  }
  
  return errors;
}

/**
 * Apply mapping and transform to a row
 */
export function mapRowToPatient(
  row: string[],
  headers: string[],
  mapping: FieldMapping[]
): Record<string, string> {
  const patient: Record<string, string> = {};
  
  for (const map of mapping) {
    const colIndex = headers.indexOf(map.csvColumn);
    if (colIndex === -1) continue;
    
    let value = row[colIndex] || map.defaultValue || '';
    value = transformValue(value, map.transform);
    
    patient[map.targetField] = value;
  }
  
  return patient;
}

/** Map only rows that satisfy the currently selected field contract. */
export function mapValidRowsToPatients(
  csvData: CSVParseResult,
  mapping: FieldMapping[]
): Record<string, string>[] {
  if (csvData.errors.length > 0) return [];

  return csvData.rows
    .filter(row => validateRow(row, csvData.headers, mapping).length === 0)
    .map(row => mapRowToPatient(row, csvData.headers, mapping));
}

/**
 * Save mapping preset to localStorage
 */
export function saveMappingPreset(mapping: ImportMapping): void {
  const presets = getMappingPresets();
  const existing = presets.findIndex(p => p.id === mapping.id);
  
  if (existing >= 0) {
    presets[existing] = mapping;
  } else {
    presets.push(mapping);
  }
  
  safeLocalStorage.setItem('csvImportPresets', JSON.stringify(presets));
}

/**
 * Get saved mapping presets
 */
export function getMappingPresets(): ImportMapping[] {
  try {
    const stored = safeLocalStorage.getItem('csvImportPresets');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Delete a mapping preset
 */
export function deleteMappingPreset(id: string): void {
  const presets = getMappingPresets().filter(p => p.id !== id);
  safeLocalStorage.setItem('csvImportPresets', JSON.stringify(presets));
}
