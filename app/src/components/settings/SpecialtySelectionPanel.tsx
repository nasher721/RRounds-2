import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stethoscope, X, Info } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import {
  SPECIALTY_CATEGORIES,
  SPECIALTY_ROLES,
  getRoleById,
  getRolesByCategory,
  FEATURE_METADATA,
  type SpecialtyFeature,
} from "@/constants/specialties";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";

export const SpecialtySelectionPanel = () => {
  const { selectedSpecialty, setSelectedSpecialty } = useSettings();
  const [showFeatures, setShowFeatures] = useState(false);

  const currentRole = selectedSpecialty ? getRoleById(selectedSpecialty) : null;

  const handleSpecialtyChange = (value: string) => {
    if (value === 'none') {
      setSelectedSpecialty(null);
    } else {
      setSelectedSpecialty(value);
    }
  };

  const handleClear = () => {
    setSelectedSpecialty(null);
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Stethoscope className="h-4 w-4" />
          Specialty / Role
        </h3>
        {currentRole && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClear}
            className="h-7 px-2 text-xs text-muted-foreground"
          >
            <X className="h-3 w-3 mr-1" />
            Clear
          </Button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Select your medical role to customize which features and sections are shown.
      </p>

      <Select
        value={selectedSpecialty || 'none'}
        onValueChange={handleSpecialtyChange}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Select your specialty..." />
        </SelectTrigger>
        <SelectContent className="max-h-80">
          <SelectItem value="none">
            <span className="text-muted-foreground">No specialty selected</span>
          </SelectItem>
          {SPECIALTY_CATEGORIES.map((category) => {
            const roles = getRolesByCategory(category.id);
            if (roles.length === 0) return null;
            return (
              <SelectGroup key={category.id}>
                <SelectLabel className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
                  {category.label}
                </SelectLabel>
                {roles.map((role) => (
                  <SelectItem key={role.id} value={role.id}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            );
          })}
        </SelectContent>
      </Select>

      {currentRole && (
        <div className="space-y-3 animate-fade-in">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {SPECIALTY_CATEGORIES.find(c => c.id === currentRole.category)?.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {currentRole.description}
          </p>

          <Collapsible open={showFeatures} onOpenChange={setShowFeatures}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs w-full justify-start">
                <Info className="h-3 w-3 mr-1" />
                {showFeatures ? 'Hide' : 'Show'} tailored features ({currentRole.enabledFeatures.length})
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-1">
                {currentRole.enabledFeatures.map((feature) => {
                  const meta = FEATURE_METADATA[feature as SpecialtyFeature];
                  if (!meta) return null;
                  return (
                    <div key={feature} className="flex items-start gap-2 py-1">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                      <div>
                        <span className="text-xs font-medium">{meta.label}</span>
                        <span className="text-xs text-muted-foreground ml-1">
                          — {meta.description}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </Card>
  );
};
