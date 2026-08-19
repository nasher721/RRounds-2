/**
 * Dynamic form dialog for inserting clinical phrases
 * Displays input fields defined in the phrase and generates final content
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Loader2, Wand2 } from 'lucide-react';
import type { ClinicalPhrase, PhraseField, FieldOption, PatientDataSource } from '@/types/phrases';
import type { Patient } from '@/types/patient';
import { expandPhrase, validateFieldValues, evaluateCondition, getPatientDataValue } from '@/lib/phraseExpander';

interface PhraseFormDialogProps {
  phrase: ClinicalPhrase | null;
  fields: PhraseField[];
  patient?: Patient;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInsert: (content: string) => void;
  onLogUsage?: (values: Record<string, unknown>, content: string) => void;
}

export const PhraseFormDialog: React.FC<PhraseFormDialogProps> = ({
  phrase,
  fields,
  patient,
  open,
  onOpenChange,
  onInsert,
  onLogUsage,
}) => {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState('');
  const [isInserting, setIsInserting] = useState(false);

  // Initialize values with defaults
  useEffect(() => {
    if (!phrase || !fields.length) return;

    const initialValues: Record<string, unknown> = {};
    
    fields.forEach(field => {
      if (field.fieldType === 'patient_data' && patient) {
        initialValues[field.fieldKey] = getPatientDataValue(patient, field.options as PatientDataSource);
      } else if (field.fieldType === 'checkbox') {
        initialValues[field.fieldKey] = [];
      } else {
        initialValues[field.fieldKey] = field.defaultValue || '';
      }
    });

    setValues(initialValues);
    setErrors({});
  }, [phrase, fields, patient]);

  // Update preview when values change
  useEffect(() => {
    if (!phrase) return;
    const expanded = expandPhrase(phrase, fields, values, patient);
    setPreview(expanded.content);
  }, [phrase, fields, values, patient]);

  const handleValueChange = useCallback((fieldKey: string, value: unknown) => {
    setValues(prev => ({ ...prev, [fieldKey]: value }));
    // Clear error when user types
    if (errors[fieldKey]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[fieldKey];
        return next;
      });
    }
  }, [errors]);

  const handleCheckboxChange = useCallback((fieldKey: string, optionValue: string, checked: boolean) => {
    setValues(prev => {
      const current = (prev[fieldKey] as string[]) || [];
      if (checked) {
        return { ...prev, [fieldKey]: [...current, optionValue] };
      } else {
        return { ...prev, [fieldKey]: current.filter(v => v !== optionValue) };
      }
    });
  }, []);

  const handleInsert = useCallback(() => {
    if (!phrase) return;

    const validationErrors = validateFieldValues(fields, values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setIsInserting(true);
    
    const expanded = expandPhrase(phrase, fields, values, patient);
    onInsert(expanded.content);
    onLogUsage?.(values, expanded.content);
    
    setIsInserting(false);
    onOpenChange(false);
  }, [phrase, fields, values, patient, onInsert, onLogUsage, onOpenChange]);

  const isFieldVisible = useCallback((field: PhraseField): boolean => {
    if (!field.conditionalLogic) return true;
    
    const conditionMet = evaluateCondition(field.conditionalLogic.if, values);
    
    if (field.conditionalLogic.then === 'show') return conditionMet;
    if (field.conditionalLogic.then === 'hide') return !conditionMet;
    return true;
  }, [values]);

  const renderField = (field: PhraseField) => {
    if (!isFieldVisible(field)) return null;

    const error = errors[field.fieldKey];
    const value = values[field.fieldKey];

    switch (field.fieldType) {
      case 'text':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.fieldKey} className="flex items-center gap-2">
              {field.label}
              {field.validation?.required && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id={field.fieldKey}
              placeholder={field.placeholder || ''}
              value={(value as string) || ''}
              onChange={(e) => handleValueChange(field.fieldKey, e.target.value)}
              className={error ? 'border-destructive' : ''}
            />
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {error}
              </p>
            )}
          </div>
        );

      case 'number':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.fieldKey} className="flex items-center gap-2">
              {field.label}
              {field.validation?.required && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id={field.fieldKey}
              type="number"
              placeholder={field.placeholder || ''}
              value={(value as string) || ''}
              min={field.validation?.min}
              max={field.validation?.max}
              onChange={(e) => handleValueChange(field.fieldKey, e.target.value)}
              className={error ? 'border-destructive' : ''}
            />
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {error}
              </p>
            )}
          </div>
        );

      case 'date':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.fieldKey} className="flex items-center gap-2">
              {field.label}
              {field.validation?.required && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id={field.fieldKey}
              type="date"
              value={(value as string) || ''}
              onChange={(e) => handleValueChange(field.fieldKey, e.target.value)}
              className={error ? 'border-destructive' : ''}
            />
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {error}
              </p>
            )}
          </div>
        );

      case 'dropdown': {
        const dropdownOptions = field.options as FieldOption[];
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.fieldKey} className="flex items-center gap-2">
              {field.label}
              {field.validation?.required && <span className="text-destructive">*</span>}
            </Label>
            <Select
              value={(value as string) || ''}
              onValueChange={(v) => handleValueChange(field.fieldKey, v)}
            >
              <SelectTrigger className={error ? 'border-destructive' : ''}>
                <SelectValue placeholder={field.placeholder || 'Select...'} />
              </SelectTrigger>
              <SelectContent>
                {dropdownOptions?.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {error}
              </p>
            )}
          </div>
        );
      }

      case 'checkbox': {
        const checkboxOptions = field.options as FieldOption[];
        const checkedValues = (value as string[]) || [];
        return (
          <div key={field.id} className="space-y-2">
            <Label className="flex items-center gap-2">
              {field.label}
              {field.validation?.required && <span className="text-destructive">*</span>}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {checkboxOptions?.map((opt) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${field.fieldKey}-${opt.value}`}
                    checked={checkedValues.includes(opt.value)}
                    onCheckedChange={(checked) => 
                      handleCheckboxChange(field.fieldKey, opt.value, checked === true)
                    }
                  />
                  <Label 
                    htmlFor={`${field.fieldKey}-${opt.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {opt.label}
                  </Label>
                </div>
              ))}
            </div>
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {error}
              </p>
            )}
          </div>
        );
      }

      case 'radio': {
        const radioOptions = field.options as FieldOption[];
        return (
          <div key={field.id} className="space-y-2">
            <Label className="flex items-center gap-2">
              {field.label}
              {field.validation?.required && <span className="text-destructive">*</span>}
            </Label>
            <RadioGroup
              value={(value as string) || ''}
              onValueChange={(v) => handleValueChange(field.fieldKey, v)}
            >
              {radioOptions?.map((opt) => (
                <div key={opt.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={opt.value} id={`${field.fieldKey}-${opt.value}`} />
                  <Label 
                    htmlFor={`${field.fieldKey}-${opt.value}`}
                    className="text-sm font-normal cursor-pointer"
                  >
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
            {error && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {error}
              </p>
            )}
          </div>
        );
      }

      case 'patient_data':
        return (
          <div key={field.id} className="space-y-2">
            <Label className="flex items-center gap-2">
              {field.label}
              <Badge variant="secondary" className="text-xs">Auto-filled</Badge>
            </Label>
            <Input
              value={(value as string) || ''}
              readOnly
              className="bg-muted"
            />
          </div>
        );

      case 'calculation':
        return (
          <div key={field.id} className="space-y-2">
            <Label className="flex items-center gap-2">
              {field.label}
              <Badge variant="outline" className="text-xs">Calculated</Badge>
            </Label>
            <Input
              value={(value as string) || ''}
              readOnly
              className="bg-muted"
            />
            {field.calculationFormula && (
              <p className="text-xs text-muted-foreground">
                Formula: {field.calculationFormula}
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (!phrase) return null;

  const hasFields = fields.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            {phrase.name}
          </DialogTitle>
          <DialogDescription>
            {phrase.description?.trim()
              || "Fill phrase fields and preview the text that will be inserted into the note."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {hasFields ? (
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {fields
                  .sort((a, b) => a.sortOrder - b.sortOrder)
                  .map(renderField)}
              </div>
            </ScrollArea>
          ) : null}

          {/* Preview */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Preview</Label>
            <Textarea
              value={preview}
              readOnly
              className="h-32 bg-muted resize-none font-mono text-sm"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleInsert} disabled={isInserting}>
            {isInserting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Insert Text
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
