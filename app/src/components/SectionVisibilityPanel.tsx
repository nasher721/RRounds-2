import * as React from 'react';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Eye, 
  EyeOff, 
  FileText, 
  Calendar, 
  ImageIcon, 
  TestTube, 
  Pill, 
  Activity,
  RotateCcw 
} from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import { CLINICAL_SECTIONS, type ClinicalSectionKey, type SectionVisibility } from "@/constants/config";

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  Calendar,
  ImageIcon,
  TestTube,
  Pill,
  Activity,
};

/** Reusable section visibility form for use inside popover or dropdown. */
export function SectionVisibilityContent() {
  const { sectionVisibility, setSectionVisibility, resetSectionVisibility } = useSettings();

  const toggleSection = React.useCallback((key: ClinicalSectionKey) => {
    setSectionVisibility({
      ...sectionVisibility,
      [key]: !sectionVisibility[key],
    });
  }, [sectionVisibility, setSectionVisibility]);

  const allVisible = Object.values(sectionVisibility).every(Boolean);

  const toggleAll = React.useCallback(() => {
    const newValue = !allVisible;
    const newVisibility = CLINICAL_SECTIONS.reduce((acc, s) => {
      acc[s.key] = newValue;
      return acc;
    }, {} as SectionVisibility);
    setSectionVisibility(newVisibility);
  }, [allVisible, setSectionVisibility]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Section visibility</h4>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={toggleAll} className="h-7 px-2 text-xs">
            {allVisible ? 'Hide all' : 'Show all'}
          </Button>
          <Button variant="ghost" size="sm" onClick={resetSectionVisibility} className="h-7 px-2 text-xs text-muted-foreground" title="Reset to defaults">
            <RotateCcw className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {CLINICAL_SECTIONS.map((section) => {
          const IconComponent = iconMap[section.icon];
          return (
            <div key={section.key} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {IconComponent && <IconComponent className="h-4 w-4 text-muted-foreground" />}
                <Label htmlFor={`section-vis-${section.key}`} className="text-sm cursor-pointer">
                  {section.label}
                </Label>
              </div>
              <Switch
                id={`section-vis-${section.key}`}
                checked={sectionVisibility[section.key]}
                onCheckedChange={() => toggleSection(section.key)}
              />
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground pt-2 border-t border-border">
        Toggle which sections appear on patient cards.
      </p>
    </div>
  );
}

export const SectionVisibilityPanel = () => {
  const { sectionVisibility } = useSettings();
  const allVisible = Object.values(sectionVisibility).every(Boolean);
  const visibleCount = Object.values(sectionVisibility).filter(Boolean).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          {allVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          <span className="hidden sm:inline">Sections</span>
          <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">{visibleCount}/{CLINICAL_SECTIONS.length}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 bg-popover border border-border shadow-lg z-50" align="end">
        <SectionVisibilityContent />
      </PopoverContent>
    </Popover>
  );
};
