/**
 * Clinical Phrase Expander - Handles dynamic field expansion and calculations
 */

import type { 
  ClinicalPhrase, 
  PhraseField, 
  ExpandedPhrase,
  ConditionalLogic,
  PatientDataSource 
} from '@/types/phrases';
import type { Patient } from '@/types/patient';

// Extract all field keys from content template
export const extractFieldKeys = (content: string): string[] => {
  const regex = /\{\{(\w+)\}\}/g;
  const matches: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    matches.push(match[1]);
  }
  return [...new Set(matches)];
};

// Evaluate conditional logic
export const evaluateCondition = (
  condition: ConditionalLogic['if'],
  values: Record<string, unknown>
): boolean => {
  const fieldValue = values[condition.field];
  const compareValue = condition.value;

  switch (condition.operator) {
    case 'equals':
      return fieldValue === compareValue;
    case 'not_equals':
      return fieldValue !== compareValue;
    case 'contains':
      return typeof fieldValue === 'string' && 
             typeof compareValue === 'string' && 
             fieldValue.toLowerCase().includes(compareValue.toLowerCase());
    case 'greater_than':
      return Number(fieldValue) > Number(compareValue);
    case 'less_than':
      return Number(fieldValue) < Number(compareValue);
    case 'is_empty':
      return fieldValue === '' || fieldValue === null || fieldValue === undefined;
    case 'is_not_empty':
      return fieldValue !== '' && fieldValue !== null && fieldValue !== undefined;
    default:
      return false;
  }
};

// Get patient data value by path
export const getPatientDataValue = (
  patient: Patient | undefined,
  source: PatientDataSource
): string => {
  if (!patient) return '';

  const path = source.source;
  const parts = path.split('.');

  // Handle simple properties
  switch (parts[0]) {
    case 'name':
      return patient.name || '';
    case 'bed':
      return patient.bed || '';
    case 'clinical_summary':
      return patient.clinicalSummary || '';
    case 'labs':
      return patient.labs || '';
    case 'imaging':
      return patient.imaging || '';
    case 'interval_events':
      return patient.intervalEvents || '';
    case 'hospital_day':
      // Calculate hospital days from created_at
      if (patient.createdAt) {
        const created = new Date(patient.createdAt);
        const now = new Date();
        const days = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return `Hospital Day #${days}`;
      }
      return 'Hospital Day #1';
    case 'systems':
      if (parts.length > 1 && patient.systems) {
        const systemKey = parts[1] as keyof typeof patient.systems;
        return patient.systems[systemKey] || '';
      }
      return '';
    default:
      return '';
  }
};

const MAX_FORMULA_LENGTH = 1000;
const MAX_FORMULA_TOKENS = 500;
const MAX_FORMULA_DEPTH = 50;

class ArithmeticParser {
  private index = 0;
  private tokenCount = 0;

  constructor(
    private readonly expression: string,
    private readonly values: Record<string, unknown>,
  ) {}

  evaluate(): number {
    const result = this.parseAdditive(0);
    this.skipWhitespace();

    if (this.index !== this.expression.length || !Number.isFinite(result)) {
      throw new Error('Invalid arithmetic expression');
    }

    return result;
  }

  private parseAdditive(depth: number): number {
    let result = this.parseMultiplicative(depth);

    while (true) {
      this.skipWhitespace();
      const operator = this.expression[this.index];
      if (operator !== '+' && operator !== '-') break;

      this.consumeToken();
      this.index += 1;
      const operand = this.parseMultiplicative(depth);
      result = operator === '+' ? result + operand : result - operand;
      this.assertFinite(result);
    }

    return result;
  }

  private parseMultiplicative(depth: number): number {
    let result = this.parseUnary(depth);

    while (true) {
      this.skipWhitespace();
      const operator = this.expression[this.index];
      if (operator !== '*' && operator !== '/') break;

      this.consumeToken();
      this.index += 1;
      const operand = this.parseUnary(depth);
      if (operator === '/' && operand === 0) {
        throw new Error('Division by zero');
      }
      result = operator === '*' ? result * operand : result / operand;
      this.assertFinite(result);
    }

    return result;
  }

  private parseUnary(depth: number): number {
    this.assertDepth(depth);
    this.skipWhitespace();
    const operator = this.expression[this.index];

    if (operator === '+' || operator === '-') {
      this.consumeToken();
      this.index += 1;
      const operand = this.parseUnary(depth + 1);
      return operator === '-' ? -operand : operand;
    }

    return this.parsePrimary(depth);
  }

  private parsePrimary(depth: number): number {
    this.assertDepth(depth);
    this.skipWhitespace();
    const next = this.expression[this.index];

    if (next === '(') {
      this.consumeToken();
      this.index += 1;
      const result = this.parseAdditive(depth + 1);
      this.skipWhitespace();
      if (this.expression[this.index] !== ')') {
        throw new Error('Unbalanced parentheses');
      }
      this.consumeToken();
      this.index += 1;
      return result;
    }

    if (next && /[\d.]/.test(next)) {
      return this.readNumber();
    }

    if (next && /[A-Za-z_]/.test(next)) {
      return this.readVariable();
    }

    throw new Error('Expected a number, variable, or parenthesized expression');
  }

  private readNumber(): number {
    const match = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(this.expression.slice(this.index));
    if (!match) throw new Error('Invalid number');

    this.consumeToken();
    this.index += match[0].length;
    const value = Number(match[0]);
    this.assertFinite(value);
    return value;
  }

  private readVariable(): number {
    const match = /^[A-Za-z_][A-Za-z0-9_]*/.exec(this.expression.slice(this.index));
    if (!match) throw new Error('Invalid variable');

    this.consumeToken();
    this.index += match[0].length;
    if (!Object.prototype.hasOwnProperty.call(this.values, match[0])) {
      throw new Error('Unknown variable');
    }

    const value = Number(this.values[match[0]]);
    return Number.isFinite(value) ? value : 0;
  }

  private skipWhitespace(): void {
    while (/\s/.test(this.expression[this.index] ?? '')) {
      this.index += 1;
    }
  }

  private consumeToken(): void {
    this.tokenCount += 1;
    if (this.tokenCount > MAX_FORMULA_TOKENS) {
      throw new Error('Formula is too complex');
    }
  }

  private assertDepth(depth: number): void {
    if (depth > MAX_FORMULA_DEPTH) {
      throw new Error('Formula nesting is too deep');
    }
  }

  private assertFinite(value: number): void {
    if (!Number.isFinite(value)) {
      throw new Error('Formula result is not finite');
    }
  }
}

// Calculate formula result without executing dynamic JavaScript.
export const calculateFormula = (
  formula: string,
  values: Record<string, unknown>
): number | null => {
  if (formula.length > MAX_FORMULA_LENGTH) return null;

  try {
    const separatorIndex = formula.indexOf('=');
    const expression = (separatorIndex >= 0 ? formula.slice(separatorIndex + 1) : formula).trim();
    if (!expression) return null;

    const result = new ArithmeticParser(expression, values).evaluate();
    return Math.round((result + Math.sign(result) * Number.EPSILON) * 100) / 100;
  } catch {
    return null;
  }
};

// Generate grammatically correct sentence from checkbox selections
export const generateSentenceFromSelections = (
  selections: string[],
  positivePrefix = 'Patient reports ',
  negativePrefix = 'Patient denies ',
  conjunction = ' and '
): string => {
  if (selections.length === 0) return '';
  
  const positives = selections.filter(s => !s.startsWith('no_') && !s.startsWith('denies_'));
  const negatives = selections.filter(s => s.startsWith('no_') || s.startsWith('denies_'))
    .map(s => s.replace(/^(no_|denies_)/, ''));

  const parts: string[] = [];
  
  if (positives.length > 0) {
    const formatted = formatList(positives, conjunction);
    parts.push(`${positivePrefix}${formatted}.`);
  }
  
  if (negatives.length > 0) {
    const formatted = formatList(negatives, conjunction);
    parts.push(`${negativePrefix}${formatted}.`);
  }

  return parts.join(' ');
};

// Format list with proper grammar
const formatList = (items: string[], conjunction: string): string => {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  if (items.length === 2) return items.join(conjunction);
  
  const last = items.pop();
  return `${items.join(', ')},${conjunction}${last}`;
};

// Main phrase expansion function
export const expandPhrase = (
  phrase: ClinicalPhrase,
  fields: PhraseField[],
  values: Record<string, unknown>,
  patient?: Patient
): ExpandedPhrase => {
  let content = phrase.content;
  const usedFields: string[] = [];
  const calculatedValues: Record<string, number> = {};

  // Sort fields by sort order
  const sortedFields = [...fields].sort((a, b) => a.sortOrder - b.sortOrder);

  // Process each field
  for (const field of sortedFields) {
    // Check conditional logic
    if (field.conditionalLogic) {
      const shouldShow = evaluateCondition(field.conditionalLogic.if, values);
      
      if (field.conditionalLogic.then === 'hide' && shouldShow) {
        // Replace with empty string
        content = content.replace(new RegExp(`\\{\\{${field.fieldKey}\\}\\}`, 'g'), '');
        continue;
      }
      
      if (field.conditionalLogic.then === 'show' && !shouldShow) {
        content = content.replace(new RegExp(`\\{\\{${field.fieldKey}\\}\\}`, 'g'), '');
        continue;
      }

      if (field.conditionalLogic.then === 'set_value' && shouldShow && field.conditionalLogic.thenValue) {
        values[field.fieldKey] = field.conditionalLogic.thenValue;
      }
    }

    let fieldValue: string;

    switch (field.fieldType) {
      case 'patient_data': {
        const source = field.options as PatientDataSource;
        fieldValue = getPatientDataValue(patient, source);
        break;
      }

      case 'calculation': {
        if (field.calculationFormula) {
          const result = calculateFormula(field.calculationFormula, values);
          if (result !== null) {
            calculatedValues[field.fieldKey] = result;
            fieldValue = String(result);
          } else {
            fieldValue = field.defaultValue || '';
          }
        } else {
          fieldValue = field.defaultValue || '';
        }
        break;
      }

      case 'checkbox': {
        const selectedItems = values[field.fieldKey];
        if (Array.isArray(selectedItems)) {
          fieldValue = generateSentenceFromSelections(selectedItems);
        } else {
          fieldValue = String(values[field.fieldKey] ?? field.defaultValue ?? '');
        }
        break;
      }

      case 'date': {
        const dateValue = values[field.fieldKey];
        if (dateValue) {
          const date = new Date(dateValue as string);
          fieldValue = date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
        } else {
          fieldValue = field.defaultValue || new Date().toLocaleDateString();
        }
        break;
      }

      default:
        fieldValue = String(values[field.fieldKey] ?? field.defaultValue ?? '');
    }

    // Replace placeholder in content
    const placeholder = `{{${field.fieldKey}}}`;
    if (content.includes(placeholder)) {
      content = content.replace(new RegExp(placeholder, 'g'), fieldValue);
      usedFields.push(field.fieldKey);
    }
  }

  // Handle any remaining placeholders with empty string
  content = content.replace(/\{\{\w+\}\}/g, '');

  // Clean up extra whitespace and newlines
  content = content.replace(/\n{3,}/g, '\n\n').trim();

  return {
    content,
    usedFields,
    calculatedValues,
  };
};

// Validate field values
export const validateFieldValues = (
  fields: PhraseField[],
  values: Record<string, unknown>
): Record<string, string> => {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const value = values[field.fieldKey];
    const validation = field.validation;

    if (!validation) continue;

    // Required check
    if (validation.required && (value === '' || value === null || value === undefined)) {
      errors[field.fieldKey] = validation.message || `${field.label} is required`;
      continue;
    }

    // Number validations
    if (field.fieldType === 'number' && value !== '' && value !== null && value !== undefined) {
      const numValue = Number(value);
      if (validation.min !== undefined && numValue < validation.min) {
        errors[field.fieldKey] = validation.message || `${field.label} must be at least ${validation.min}`;
      }
      if (validation.max !== undefined && numValue > validation.max) {
        errors[field.fieldKey] = validation.message || `${field.label} must be at most ${validation.max}`;
      }
    }

    // Pattern validation
    if (validation.pattern && typeof value === 'string') {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(value)) {
        errors[field.fieldKey] = validation.message || `${field.label} has invalid format`;
      }
    }
  }

  return errors;
};

// Search phrases by text
export const searchPhrases = (
  phrases: ClinicalPhrase[],
  query: string
): ClinicalPhrase[] => {
  const lowerQuery = query.toLowerCase();
  return phrases.filter(p => 
    p.name.toLowerCase().includes(lowerQuery) ||
    p.content.toLowerCase().includes(lowerQuery) ||
    p.shortcut?.toLowerCase().includes(lowerQuery) ||
    p.description?.toLowerCase().includes(lowerQuery)
  );
};
