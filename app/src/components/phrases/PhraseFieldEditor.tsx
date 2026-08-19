/**
 * PhraseFieldEditor - Manage dynamic fields for clinical phrases
 */

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Type,
  Hash,
  Calendar,
  List,
  CheckSquare,
  CircleDot,
  User,
  Calculator,
  GitBranch,
} from 'lucide-react';
import type { PhraseField, PhraseFieldType, FieldOption, FieldValidation, ConditionalLogic, PatientDataSource } from '@/types/phrases';

interface PhraseFieldEditorProps {
  fields: PhraseField[];
  onChange: (fields: PhraseField[]) => void;
  phraseContent: string;
}

const FIELD_TYPE_OPTIONS: { value: PhraseFieldType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'text', label: 'Text', icon: <Type className="h-4 w-4" />, description: 'Free text input' },
  { value: 'number', label: 'Number', icon: <Hash className="h-4 w-4" />, description: 'Numeric value' },
  { value: 'date', label: 'Date', icon: <Calendar className="h-4 w-4" />, description: 'Date picker' },
  { value: 'dropdown', label: 'Dropdown', icon: <List className="h-4 w-4" />, description: 'Select from options' },
  { value: 'checkbox', label: 'Checkbox', icon: <CheckSquare className="h-4 w-4" />, description: 'Multiple selections' },
  { value: 'radio', label: 'Radio', icon: <CircleDot className="h-4 w-4" />, description: 'Single selection' },
  { value: 'patient_data', label: 'Patient Data', icon: <User className="h-4 w-4" />, description: 'Auto-fill from patient' },
  { value: 'calculation', label: 'Calculation', icon: <Calculator className="h-4 w-4" />, description: 'Computed value' },
  { value: 'conditional', label: 'Conditional', icon: <GitBranch className="h-4 w-4" />, description: 'Show/hide based on rules' },
];

const PATIENT_DATA_SOURCES = [
  { value: 'name', label: 'Patient Name' },
  { value: 'age', label: 'Age' },
  { value: 'mrn', label: 'MRN' },
  { value: 'bed', label: 'Bed/Room' },
  { value: 'hospital_day', label: 'Hospital Day' },
  { value: 'allergies', label: 'Allergies' },
  { value: 'labs.creatinine', label: 'Latest Creatinine' },
  { value: 'labs.potassium', label: 'Latest Potassium' },
  { value: 'labs.hemoglobin', label: 'Latest Hemoglobin' },
];

export const PhraseFieldEditor: React.FC<PhraseFieldEditorProps> = ({
  fields,
  onChange,
  phraseContent,
}) => {
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  // Extract field keys from content
  const contentFields = React.useMemo(() => {
    const matches = phraseContent.match(/\{\{([^}]+)\}\}/g) || [];
    return matches.map(m => m.replace(/\{\{|\}\}/g, ''));
  }, [phraseContent]);

  const toggleField = useCallback((fieldId: string) => {
    setExpandedFields(prev => {
      const next = new Set(prev);
      if (next.has(fieldId)) {
        next.delete(fieldId);
      } else {
        next.add(fieldId);
      }
      return next;
    });
  }, []);

  const addField = useCallback((e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const newField: PhraseField = {
      id: `temp_${Date.now()}`,
      phraseId: '',
      fieldKey: `field_${fields.length + 1}`,
      fieldType: 'text',
      label: 'New Field',
      placeholder: null,
      defaultValue: null,
      options: null,
      validation: null,
      conditionalLogic: null,
      calculationFormula: null,
      sortOrder: fields.length,
      createdAt: new Date().toISOString(),
    };
    const updatedFields = [...fields, newField];
    onChange(updatedFields);
    setExpandedFields(prev => new Set([...prev, newField.id]));
  }, [fields, onChange]);

  const updateField = useCallback((index: number, updates: Partial<PhraseField>) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  }, [fields, onChange]);

  const removeField = useCallback((index: number) => {
    onChange(fields.filter((_, i) => i !== index));
  }, [fields, onChange]);

  const addOption = useCallback((fieldIndex: number) => {
    const field = fields[fieldIndex];
    const currentOptions = Array.isArray(field.options) ? field.options : [];
    const newOptions: FieldOption[] = [
      ...currentOptions,
      { value: `option_${currentOptions.length + 1}`, label: 'New Option' }
    ];
    updateField(fieldIndex, { options: newOptions });
  }, [fields, updateField]);

  const updateOption = useCallback((fieldIndex: number, optionIndex: number, updates: Partial<FieldOption>) => {
    const field = fields[fieldIndex];
    const currentOptions = Array.isArray(field.options) ? [...field.options] : [];
    currentOptions[optionIndex] = { ...currentOptions[optionIndex], ...updates };
    updateField(fieldIndex, { options: currentOptions });
  }, [fields, updateField]);

  const removeOption = useCallback((fieldIndex: number, optionIndex: number) => {
    const field = fields[fieldIndex];
    const currentOptions = Array.isArray(field.options) ? field.options : [];
    updateField(fieldIndex, { options: currentOptions.filter((_, i) => i !== optionIndex) });
  }, [fields, updateField]);

  const getFieldTypeInfo = (type: PhraseFieldType) => {
    return FIELD_TYPE_OPTIONS.find(o => o.value === type) || FIELD_TYPE_OPTIONS[0];
  };

  const renderFieldOptions = (field: PhraseField, fieldIndex: number) => {
    const options = Array.isArray(field.options) ? field.options : [];

    return (
      <div className="space-y-2 mt-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm">Options</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => addOption(fieldIndex)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Add
          </Button>
        </div>
        <div className="space-y-2">
          {options.map((option, optIndex) => (
            <div key={optIndex} className="flex items-center gap-2">
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
              <Input
                value={option.value}
                onChange={e => updateOption(fieldIndex, optIndex, { value: e.target.value })}
                placeholder="Value"
                className="flex-1"
              />
              <Input
                value={option.label}
                onChange={e => updateOption(fieldIndex, optIndex, { label: e.target.value })}
                placeholder="Label"
                className="flex-1"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeOption(fieldIndex, optIndex)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {options.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">
              No options defined
            </p>
          )}
        </div>
      </div>
    );
  };

  const renderPatientDataConfig = (field: PhraseField, fieldIndex: number) => {
    const source = (field.options as PatientDataSource | null)?.source || '';

    return (
      <div className="space-y-2 mt-3">
        <Label className="text-sm">Patient Data Source</Label>
        <Select
          value={source}
          onValueChange={v => updateField(fieldIndex, { 
            options: { source: v } as PatientDataSource 
          })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select data source" />
          </SelectTrigger>
          <SelectContent>
            {PATIENT_DATA_SOURCES.map(s => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  };

  const renderCalculationConfig = (field: PhraseField, fieldIndex: number) => {
    return (
      <div className="space-y-2 mt-3">
        <Label className="text-sm">Formula</Label>
        <Textarea
          value={field.calculationFormula || ''}
          onChange={e => updateField(fieldIndex, { calculationFormula: e.target.value })}
          placeholder="e.g., bmi = weight / (height * height)"
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Reference other fields using their field keys
        </p>
      </div>
    );
  };

  const renderValidationConfig = (field: PhraseField, fieldIndex: number) => {
    const validation = field.validation || {};

    const updateValidation = (updates: Partial<FieldValidation>) => {
      updateField(fieldIndex, { 
        validation: { ...validation, ...updates } 
      });
    };

    return (
      <div className="space-y-3 mt-3 pt-3 border-t">
        <Label className="text-sm font-medium">Validation</Label>
        
        <div className="flex items-center justify-between">
          <Label className="text-sm text-muted-foreground">Required</Label>
          <Switch
            checked={validation.required || false}
            onCheckedChange={v => updateValidation({ required: v })}
          />
        </div>

        {(field.fieldType === 'number' || field.fieldType === 'text') && (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {field.fieldType === 'number' ? 'Min Value' : 'Min Length'}
              </Label>
              <Input
                type="number"
                value={validation.min ?? ''}
                onChange={e => updateValidation({ min: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="Min"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">
                {field.fieldType === 'number' ? 'Max Value' : 'Max Length'}
              </Label>
              <Input
                type="number"
                value={validation.max ?? ''}
                onChange={e => updateValidation({ max: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="Max"
              />
            </div>
          </div>
        )}

        {field.fieldType === 'text' && (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Pattern (regex)</Label>
            <Input
              value={validation.pattern || ''}
              onChange={e => updateValidation({ pattern: e.target.value })}
              placeholder="e.g., ^[A-Z]{2}\\d{6}$"
              className="font-mono text-sm"
            />
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Error Message</Label>
          <Input
            value={validation.message || ''}
            onChange={e => updateValidation({ message: e.target.value })}
            placeholder="Custom error message"
          />
        </div>
      </div>
    );
  };

  const renderConditionalConfig = (field: PhraseField, fieldIndex: number) => {
    const logic = field.conditionalLogic || {
      if: { field: '', operator: 'equals' as const, value: '' },
      then: 'show' as const,
      thenValue: '',
    };

    const updateLogic = (updates: Partial<ConditionalLogic>) => {
      updateField(fieldIndex, { 
        conditionalLogic: { ...logic, ...updates } 
      });
    };

    const updateCondition = (updates: Partial<ConditionalLogic['if']>) => {
      updateLogic({ if: { ...logic.if, ...updates } });
    };

    const otherFields = fields.filter((_, i) => i !== fieldIndex);

    return (
      <div className="space-y-3 mt-3 pt-3 border-t">
        <Label className="text-sm font-medium">Conditional Logic</Label>

        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">When field</Label>
            <Select
              value={logic.if.field}
              onValueChange={v => updateCondition({ field: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                {otherFields.map(f => (
                  <SelectItem key={f.id} value={f.fieldKey}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Operator</Label>
            <Select
              value={logic.if.operator}
              onValueChange={v => updateCondition({ operator: v as ConditionalLogic['if']['operator'] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">Equals</SelectItem>
                <SelectItem value="not_equals">Not Equals</SelectItem>
                <SelectItem value="contains">Contains</SelectItem>
                <SelectItem value="greater_than">Greater Than</SelectItem>
                <SelectItem value="less_than">Less Than</SelectItem>
                <SelectItem value="is_empty">Is Empty</SelectItem>
                <SelectItem value="is_not_empty">Is Not Empty</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Value</Label>
            <Input
              value={String(logic.if.value || '')}
              onChange={e => updateCondition({ value: e.target.value })}
              placeholder="Value"
              disabled={logic.if.operator === 'is_empty' || logic.if.operator === 'is_not_empty'}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Then</Label>
            <Select
              value={logic.then}
              onValueChange={v => updateLogic({ then: v as ConditionalLogic['then'] })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="show">Show this field</SelectItem>
                <SelectItem value="hide">Hide this field</SelectItem>
                <SelectItem value="require">Make required</SelectItem>
                <SelectItem value="set_value">Set value</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {logic.then === 'set_value' && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Set to</Label>
              <Input
                value={logic.thenValue || ''}
                onChange={e => updateLogic({ thenValue: e.target.value })}
                placeholder="Value"
              />
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <Label className="text-base font-semibold">Dynamic Fields</Label>
          <p className="text-xs text-muted-foreground mt-1">
            Define interactive fields that users fill when inserting phrases
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={(e) => addField(e)}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Field
        </Button>
      </div>

      {/* Detected placeholders hint */}
      {contentFields.length > 0 && (
        <div className="p-2 rounded-md bg-accent/50 border">
          <p className="text-xs text-muted-foreground mb-1">
            Detected placeholders in content:
          </p>
          <div className="flex flex-wrap gap-1">
            {contentFields.map((key, i) => (
              <Badge key={i} variant="secondary" className="font-mono text-xs">
                {`{{${key}}}`}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Fields list */}
      <div className="space-y-2">
        {fields.map((field, index) => {
          const typeInfo = getFieldTypeInfo(field.fieldType);
          const isExpanded = expandedFields.has(field.id);
          const isLinked = contentFields.includes(field.fieldKey);

          return (
            <Collapsible
              key={field.id}
              open={isExpanded}
              onOpenChange={() => toggleField(field.id)}
            >
              <div className="border rounded-lg">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center gap-2 p-3 cursor-pointer hover:bg-accent/50">
                    <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                    {typeInfo.icon}
                    <span className="font-medium flex-1">{field.label}</span>
                    <Badge variant="outline" className="font-mono text-xs">
                      {`{{${field.fieldKey}}}`}
                    </Badge>
                    {isLinked && (
                      <Badge variant="secondary" className="text-xs">
                        Linked
                      </Badge>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeField(index);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="px-3 pb-3 space-y-3">
                    <Separator />

                    {/* Basic settings */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-sm">Field Key</Label>
                        <Input
                          value={field.fieldKey}
                          onChange={e => updateField(index, { fieldKey: e.target.value })}
                          placeholder="field_key"
                          className="font-mono"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm">Label</Label>
                        <Input
                          value={field.label}
                          onChange={e => updateField(index, { label: e.target.value })}
                          placeholder="Display label"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-sm">Field Type</Label>
                        <Select
                          value={field.fieldType}
                          onValueChange={v => updateField(index, { 
                            fieldType: v as PhraseFieldType,
                            options: ['dropdown', 'checkbox', 'radio'].includes(v) ? [] : null,
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {FIELD_TYPE_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <div className="flex items-center gap-2">
                                  {opt.icon}
                                  <span>{opt.label}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-sm">Placeholder</Label>
                        <Input
                          value={field.placeholder || ''}
                          onChange={e => updateField(index, { placeholder: e.target.value })}
                          placeholder="Placeholder text"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-sm">Default Value</Label>
                      <Input
                        value={field.defaultValue || ''}
                        onChange={e => updateField(index, { defaultValue: e.target.value })}
                        placeholder="Default value (optional)"
                      />
                    </div>

                    {/* Type-specific config */}
                    {['dropdown', 'checkbox', 'radio'].includes(field.fieldType) && 
                      renderFieldOptions(field, index)
                    }

                    {field.fieldType === 'patient_data' && 
                      renderPatientDataConfig(field, index)
                    }

                    {field.fieldType === 'calculation' && 
                      renderCalculationConfig(field, index)
                    }

                    {/* Validation */}
                    {!['patient_data', 'calculation'].includes(field.fieldType) &&
                      renderValidationConfig(field, index)
                    }

                    {/* Conditional logic */}
                    {fields.length > 1 && renderConditionalConfig(field, index)}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}

        {fields.length === 0 && (
          <div className="text-center py-6 border rounded-lg border-dashed">
            <p className="text-sm text-muted-foreground">
              No dynamic fields defined
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Add fields to create interactive phrase templates
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
