/**
 * SectionSettingsPanel Component
 * Panel for configuring individual section settings
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
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
import { X, ChevronDown, Palette, LayoutGrid, Type } from 'lucide-react';
import type { LayoutSection, LayoutSectionStyle } from '@/types/layoutDesigner';
import { SECTION_LABELS } from '@/types/layoutDesigner';

interface SectionSettingsPanelProps {
  section: LayoutSection;
  onUpdate: (updates: Partial<LayoutSection>) => void;
  onClose: () => void;
}

// Predefined color options
const COLOR_OPTIONS = [
  { value: '#ffffff', label: 'White' },
  { value: '#f8fafc', label: 'Slate 50' },
  { value: '#f1f5f9', label: 'Slate 100' },
  { value: '#e2e8f0', label: 'Slate 200' },
  { value: '#fef3c7', label: 'Amber 100' },
  { value: '#fce7f3', label: 'Pink 100' },
  { value: '#dbeafe', label: 'Blue 100' },
  { value: '#dcfce7', label: 'Green 100' },
  { value: '#e0e7ff', label: 'Indigo 100' },
  { value: '#fef2f2', label: 'Red 100' },
];

export const SectionSettingsPanel = ({
  section,
  onUpdate,
  onClose,
}: SectionSettingsPanelProps) => {
  const [layoutOpen, setLayoutOpen] = React.useState(true);
  const [styleOpen, setStyleOpen] = React.useState(true);
  const [typographyOpen, setTypographyOpen] = React.useState(false);

  const sectionLabel = SECTION_LABELS[section.type] || section.label;

  const updateStyle = (updates: Partial<LayoutSectionStyle>) => {
    onUpdate({
      style: { ...section.style, ...updates },
    });
  };

  return (
    <div className="mt-4 rounded-lg border bg-background p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold">Section Settings</h4>
          <p className="text-xs text-muted-foreground">{sectionLabel}</p>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Label */}
      <div className="space-y-2">
        <Label htmlFor="section-label" className="text-xs">Custom Label</Label>
        <Input
          id="section-label"
          value={section.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder={sectionLabel}
          className="h-8 text-sm"
        />
      </div>

      {/* Layout settings */}
      <Collapsible open={layoutOpen} onOpenChange={setLayoutOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between h-8 px-2"
          >
            <span className="flex items-center gap-2 text-xs font-medium">
              <LayoutGrid className="h-3.5 w-3.5" />
              Layout
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform',
                layoutOpen && 'rotate-180'
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          {/* Width */}
          <div className="space-y-2">
            <Label className="text-xs">Width</Label>
            <Select
              value={String(section.width || 'auto')}
              onValueChange={(value) =>
                onUpdate({
                  width: value === 'auto' ? 'auto' : value as LayoutSection['width'],
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="full">Full Width</SelectItem>
                <SelectItem value="half">Half (50%)</SelectItem>
                <SelectItem value="third">Third (33%)</SelectItem>
                <SelectItem value="quarter">Quarter (25%)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Custom width (pixel value) */}
          {typeof section.width === 'number' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Custom Width: {section.width}px</Label>
              </div>
              <Slider
                value={[section.width]}
                min={50}
                max={500}
                step={10}
                onValueChange={([value]) => onUpdate({ width: value })}
              />
            </div>
          )}

          {/* Height */}
          <div className="space-y-2">
            <Label className="text-xs">Height</Label>
            <Select
              value={String(section.height || 'auto')}
              onValueChange={(value) =>
                onUpdate({
                  height: value === 'auto' ? 'auto' : value as LayoutSection['height'],
                })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="fixed">Fixed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Collapsed state */}
          <div className="flex items-center justify-between">
            <Label className="text-xs">Start Collapsed</Label>
            <Switch
              checked={section.collapsed || false}
              onCheckedChange={(checked) => onUpdate({ collapsed: checked })}
              className="scale-75"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Style settings */}
      <Collapsible open={styleOpen} onOpenChange={setStyleOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between h-8 px-2"
          >
            <span className="flex items-center gap-2 text-xs font-medium">
              <Palette className="h-3.5 w-3.5" />
              Appearance
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform',
                styleOpen && 'rotate-180'
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          {/* Background color */}
          <div className="space-y-2">
            <Label className="text-xs">Background Color</Label>
            <div className="flex flex-wrap gap-1">
              {COLOR_OPTIONS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => updateStyle({ backgroundColor: color.value })}
                  className={cn(
                    'w-6 h-6 rounded border-2 transition-all',
                    section.style?.backgroundColor === color.value
                      ? 'border-primary scale-110'
                      : 'border-transparent hover:border-muted-foreground/50'
                  )}
                  style={{ backgroundColor: color.value }}
                  title={color.label}
                />
              ))}
              <button
                onClick={() => updateStyle({ backgroundColor: undefined })}
                className={cn(
                  'w-6 h-6 rounded border-2 bg-white relative overflow-hidden',
                  !section.style?.backgroundColor
                    ? 'border-primary'
                    : 'border-muted'
                )}
                title="None"
              >
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-full h-0.5 bg-destructive rotate-45" />
                </div>
              </button>
            </div>
          </div>

          {/* Header style */}
          <div className="space-y-2">
            <Label className="text-xs">Header Style</Label>
            <Select
              value={section.style?.headerStyle || 'simple'}
              onValueChange={(value) =>
                updateStyle({ headerStyle: value as LayoutSectionStyle['headerStyle'] })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Header</SelectItem>
                <SelectItem value="simple">Simple</SelectItem>
                <SelectItem value="accent">Accent Line</SelectItem>
                <SelectItem value="filled">Filled Background</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Border */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Border Width: {section.style?.borderWidth || 0}px</Label>
            </div>
            <Slider
              value={[section.style?.borderWidth || 0]}
              min={0}
              max={4}
              step={1}
              onValueChange={([value]) => updateStyle({ borderWidth: value })}
            />
          </div>

          {/* Border radius */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Border Radius: {section.style?.borderRadius || 0}px</Label>
            </div>
            <Slider
              value={[section.style?.borderRadius || 0]}
              min={0}
              max={16}
              step={2}
              onValueChange={([value]) => updateStyle({ borderRadius: value })}
            />
          </div>

          {/* Padding */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Padding: {section.style?.padding || 8}px</Label>
            </div>
            <Slider
              value={[section.style?.padding || 8]}
              min={0}
              max={24}
              step={2}
              onValueChange={([value]) => updateStyle({ padding: value })}
            />
          </div>

          {/* Show icon */}
          <div className="flex items-center justify-between">
            <Label className="text-xs">Show Icon</Label>
            <Switch
              checked={section.style?.showIcon ?? true}
              onCheckedChange={(checked) => updateStyle({ showIcon: checked })}
              className="scale-75"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Typography settings */}
      <Collapsible open={typographyOpen} onOpenChange={setTypographyOpen}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-between h-8 px-2"
          >
            <span className="flex items-center gap-2 text-xs font-medium">
              <Type className="h-3.5 w-3.5" />
              Typography
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform',
                typographyOpen && 'rotate-180'
              )}
            />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-2">
          {/* Font size */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">
                Font Size: {section.style?.fontSize || 'inherit'}
                {section.style?.fontSize ? 'pt' : ''}
              </Label>
            </div>
            <Slider
              value={[section.style?.fontSize || 10]}
              min={6}
              max={16}
              step={1}
              onValueChange={([value]) => updateStyle({ fontSize: value })}
            />
          </div>

          {/* Font weight */}
          <div className="space-y-2">
            <Label className="text-xs">Font Weight</Label>
            <Select
              value={section.style?.fontWeight || 'normal'}
              onValueChange={(value) =>
                updateStyle({ fontWeight: value as LayoutSectionStyle['fontWeight'] })
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="semibold">Semibold</SelectItem>
                <SelectItem value="bold">Bold</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Text color */}
          <div className="space-y-2">
            <Label className="text-xs">Text Color</Label>
            <Input
              type="color"
              value={section.style?.textColor || '#1f2937'}
              onChange={(e) => updateStyle({ textColor: e.target.value })}
              className="h-8 w-full p-1"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
};
