import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stethoscope, X } from "lucide-react";
import { useSettings } from "@/contexts/SettingsContext";
import {
  SPECIALTY_CATEGORIES,
  getRoleById,
  getRolesByCategory,
} from "@/constants/specialties";

export const DesktopSpecialtySelector = () => {
  const { selectedSpecialty, setSelectedSpecialty } = useSettings();

  const currentRole = selectedSpecialty ? getRoleById(selectedSpecialty) : null;

  const handleSpecialtyChange = (value: string) => {
    if (value === 'none') {
      setSelectedSpecialty(null);
    } else {
      setSelectedSpecialty(value);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={currentRole ? "default" : "ghost"}
          size="sm"
          className={`gap-1.5 h-8 text-xs ${!currentRole ? 'text-muted-foreground hover:text-foreground' : ''}`}
        >
          <Stethoscope className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">
            {currentRole ? currentRole.label : 'Role'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Specialty / Role</h4>
            {currentRole && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedSpecialty(null)}
                className="h-6 px-1.5 text-xs text-muted-foreground"
              >
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Customize features for your role.
          </p>

          <Select
            value={selectedSpecialty || 'none'}
            onValueChange={handleSpecialtyChange}
          >
            <SelectTrigger className="w-full h-8 text-xs">
              <SelectValue placeholder="Select your specialty..." />
            </SelectTrigger>
            <SelectContent className="max-h-80">
              <SelectItem value="none">
                <span className="text-muted-foreground">No specialty</span>
              </SelectItem>
              {SPECIALTY_CATEGORIES.map((category) => {
                const roles = getRolesByCategory(category.id);
                if (roles.length === 0) return null;
                return (
                  <SelectGroup key={category.id}>
                    <SelectLabel className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground pt-2">
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
            <div className="space-y-2 pt-1">
              <Badge variant="secondary" className="text-[10px]">
                {SPECIALTY_CATEGORIES.find(c => c.id === currentRole.category)?.label}
              </Badge>
              <p className="text-[11px] text-muted-foreground">
                {currentRole.description}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {currentRole.enabledFeatures.length} tailored features enabled
              </p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
