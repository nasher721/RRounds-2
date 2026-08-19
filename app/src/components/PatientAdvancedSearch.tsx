import * as React from "react";
import { Command } from "cmdk";
import { Search, Filter, X, ArrowUpDown, Zap, Clock, Pill, TestTube, FileText, Activity, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { useDebounce } from "@/hooks/useDebounce";
import { PatientFilterType, STORAGE_KEYS } from "@/constants/config";
import type { Patient } from "@/types/patient";

interface AdvancedFilterOptions {
  searchIn: {
    name: boolean;
    bed: boolean;
    clinicalSummary: boolean;
    intervalEvents: boolean;
    imaging: boolean;
    labs: boolean;
    medications: boolean;
    systems: boolean;
  };
  medications: {
    onPressors: boolean;
    onVentilator: boolean;
    onDialysis: boolean;
  };
  labs: {
    criticalOnly: boolean;
    abnOnly: boolean;
  };
  todos: {
    incompleteOnly: boolean;
    overdueOnly: boolean;
  };
  timeRange: {
    enabled: boolean;
    hours: number;
  };
}

const defaultFilterOptions: AdvancedFilterOptions = {
  searchIn: {
    name: true,
    bed: true,
    clinicalSummary: true,
    intervalEvents: true,
    imaging: true,
    labs: true,
    medications: true,
    systems: true,
  },
  medications: {
    onPressors: false,
    onVentilator: false,
    onDialysis: false,
  },
  labs: {
    criticalOnly: false,
    abnOnly: false,
  },
  todos: {
    incompleteOnly: false,
    overdueOnly: false,
  },
  timeRange: {
    enabled: false,
    hours: 24,
  },
};

interface PatientAdvancedSearchProps {
  patients: Patient[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  filter: PatientFilterType;
  setFilter: (filter: PatientFilterType) => void;
  onPatientSelect: (patientId: string) => void;
}

export function PatientAdvancedSearch({
  patients,
  searchQuery,
  setSearchQuery,
  filter,
  setFilter,
  onPatientSelect,
}: PatientAdvancedSearchProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [filterOptions, setFilterOptions] = React.useState<AdvancedFilterOptions>(defaultFilterOptions);
  const [matchedPatientCount, setMatchedPatientCount] = React.useState(0);
  const [activePatientIndex, setActivePatientIndex] = React.useState(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const debouncedSearch = useDebounce(searchQuery, 300);

  const matchedPatients = React.useMemo(() => {
    if (!debouncedSearch && filter === PatientFilterType.All && !hasActiveFilters(filterOptions)) {
      return patients;
    }

    const searchLower = debouncedSearch.toLowerCase();

    return patients.filter((patient) => {
      const matchesSearch = !debouncedSearch || (
        (filterOptions.searchIn.name && patient.name.toLowerCase().includes(searchLower)) ||
        (filterOptions.searchIn.bed && patient.bed.toLowerCase().includes(searchLower)) ||
        (filterOptions.searchIn.clinicalSummary && patient.clinicalSummary.toLowerCase().includes(searchLower)) ||
        (filterOptions.searchIn.intervalEvents && patient.intervalEvents.toLowerCase().includes(searchLower)) ||
        (filterOptions.searchIn.imaging && patient.imaging.toLowerCase().includes(searchLower)) ||
        (filterOptions.searchIn.labs && patient.labs.toLowerCase().includes(searchLower)) ||
        (filterOptions.searchIn.medications && (
          patient.medications.infusions.some(m => m.toLowerCase().includes(searchLower)) ||
          patient.medications.scheduled.some(m => m.toLowerCase().includes(searchLower)) ||
          patient.medications.prn.some(m => m.toLowerCase().includes(searchLower))
        )) ||
        (filterOptions.searchIn.systems && Object.values(patient.systems).some(v => 
          v.toLowerCase().includes(searchLower)
        ))
      );

      if (!matchesSearch) return false;

      const medsText = [
        ...patient.medications.infusions,
        ...patient.medications.scheduled,
        ...patient.medications.prn,
      ].join(' ').toLowerCase();

      if (filterOptions.medications.onPressors) {
        const pressors = ['norepinephrine', 'epinephrine', 'dopamine', 'dobutamine', 'vasopressin', 'phenylephrine', 'milrinone'];
        if (!pressors.some(p => medsText.includes(p))) return false;
      }

      if (filterOptions.medications.onVentilator) {
        if (!medsText.includes('ventilator') && !medsText.includes('intubated') && !medsText.includes('trach')) return false;
      }

      if (filterOptions.medications.onDialysis) {
        if (!medsText.includes('dialysis') && !medsText.includes('crrt') && !medsText.includes('hemodialysis')) return false;
      }

      const labsText = patient.labs.toLowerCase();
      if (filterOptions.labs.criticalOnly) {
        const criticalPatterns = [
          /\bk\s*[<>]?\s*[6-9]\b/i,
          /\bna\s*[<>]?\s*12[0-9]\b/i,
          /\bglucose\s*[<>]?\s*[45]00\b/i,
          /\bhgb\s*[<>]?\s*[67]\b/i,
          /\bplt\s*[<>]?\s*[12]0\b/i,
          /\bph\s*[<>]?\s*[7]\.[12]\b/i,
        ];
        if (!criticalPatterns.some(p => p.test(labsText))) return false;
      }

      if (filterOptions.labs.abnOnly) {
        const abnPatterns = [
          /\bk\s*[<>]/i,
          /\bna\s*[<>]/i,
          /\bcl\s*[<>]/i,
          /\bbun\s*[<>]/i,
          /\bcr\s*[<>]/i,
          /\bglucose\s*[<>]/i,
        ];
        if (!abnPatterns.some(p => p.test(labsText))) return false;
      }

      if (filter === PatientFilterType.Filled) {
        const hasSomeContent =
          patient.clinicalSummary ||
          patient.intervalEvents ||
          Object.values(patient.systems).some((v) => v);
        if (!hasSomeContent) return false;
      } else if (filter === PatientFilterType.Empty) {
        const isEmpty =
          !patient.clinicalSummary &&
          !patient.intervalEvents &&
          !Object.values(patient.systems).some((v) => v);
        if (!isEmpty) return false;
      }

      if (filterOptions.timeRange.enabled) {
        const cutoffDate = new Date(Date.now() - filterOptions.timeRange.hours * 60 * 60 * 1000);
        const lastModifiedDate = new Date(patient.lastModified);
        if (lastModifiedDate < cutoffDate) return false;
      }

      return true;
    });
  }, [patients, debouncedSearch, filter, filterOptions]);

  React.useEffect(() => {
    setMatchedPatientCount(matchedPatients.length);
  }, [matchedPatients]);

  const hasActiveFilters = (options: AdvancedFilterOptions): boolean => {
    return (
      Object.values(options.searchIn).some(v => !v) ||
      Object.values(options.medications).some(v => v) ||
      Object.values(options.labs).some(v => v) ||
      Object.values(options.todos).some(v => v) ||
      options.timeRange.enabled
    );
  };

  const clearFilters = () => {
    setFilterOptions(defaultFilterOptions);
    setShowAdvanced(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isOpen && matchedPatients.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActivePatientIndex(prev => Math.min(prev + 1, matchedPatients.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActivePatientIndex(prev => Math.max(prev - 1, -1));
      } else if (e.key === 'Enter' && activePatientIndex >= 0) {
        e.preventDefault();
        onPatientSelect(matchedPatients[activePatientIndex].id);
        setIsOpen(false);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        setActivePatientIndex(-1);
      }
    }
  };

  const highlightMatch = (text: string, query: string): React.ReactNode => {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() ? (
        <mark key={i} className="bg-yellow-200 dark:bg-yellow-700 rounded px-0.5">{part}</mark>
      ) : part
    );
  };

  return (
    <div className="relative w-full">
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
          <Input
            ref={inputRef}
            placeholder="Search patients... (Cmd+K for quick jump)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => {
              if (searchQuery || hasActiveFilters(filterOptions)) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            className="pl-10 h-9 bg-card/60 border-border/30 focus-visible:ring-1 focus-visible:ring-white/30 focus-visible:border-white/20 rounded-xl text-sm text-foreground placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 text-muted-foreground/60 hover:text-foreground"
              onClick={() => {
                setSearchQuery('');
                setActivePatientIndex(-1);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
        <Button
          variant={showAdvanced ? "default" : "outline"}
          size="sm"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="gap-1.5 h-9 rounded-lg"
        >
          <Filter className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Filters</span>
          {hasActiveFilters(filterOptions) && (
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">
              {Object.values(filterOptions.medications).filter(Boolean).length +
               Object.values(filterOptions.labs).filter(Boolean).length +
               (filterOptions.timeRange.enabled ? 1 : 0)}
            </Badge>
          )}
        </Button>
      </div>

      {showAdvanced && (
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleContent className="mt-2 p-4 bg-card/60 border border-border/20 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Search In</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-7 text-xs"
              >
                Clear All
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { key: 'name', label: 'Name' },
                { key: 'bed', label: 'Room' },
                { key: 'clinicalSummary', label: 'Summary' },
                { key: 'intervalEvents', label: 'Events' },
                { key: 'imaging', label: 'Imaging' },
                { key: 'labs', label: 'Labs' },
                { key: 'medications', label: 'Medications' },
                { key: 'systems', label: 'Systems' },
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center space-x-2">
                  <Checkbox
                    id={`search-${key}`}
                    checked={filterOptions.searchIn[key as keyof typeof filterOptions.searchIn]}
                    onCheckedChange={(checked) => 
                      setFilterOptions(prev => ({
                        ...prev,
                        searchIn: { ...prev.searchIn, [key]: checked }
                      }))
                    }
                  />
                  <Label htmlFor={`search-${key}`} className="text-xs cursor-pointer">
                    {label}
                  </Label>
                </div>
              ))}
            </div>

            <Separator />

            <div>
              <Label className="text-sm font-medium mb-2 block">Medication Filters</Label>
              <div className="flex gap-2">
                <Badge
                  variant={filterOptions.medications.onPressors ? "default" : "outline"}
                  className="cursor-pointer gap-1"
                  onClick={() => setFilterOptions(prev => ({
                    ...prev,
                    medications: { ...prev.medications, onPressors: !prev.medications.onPressors }
                  }))}
                >
                  <Zap className="h-3 w-3" />
                  On Pressors
                </Badge>
                <Badge
                  variant={filterOptions.medications.onVentilator ? "default" : "outline"}
                  className="cursor-pointer gap-1"
                  onClick={() => setFilterOptions(prev => ({
                    ...prev,
                    medications: { ...prev.medications, onVentilator: !prev.medications.onVentilator }
                  }))}
                >
                  <Activity className="h-3 w-3" />
                  Ventilated
                </Badge>
                <Badge
                  variant={filterOptions.medications.onDialysis ? "default" : "outline"}
                  className="cursor-pointer gap-1"
                  onClick={() => setFilterOptions(prev => ({
                    ...prev,
                    medications: { ...prev.medications, onDialysis: !prev.medications.onDialysis }
                  }))}
                >
                  <TestTube className="h-3 w-3" />
                  On Dialysis
                </Badge>
              </div>
            </div>

            <Separator />

            <div>
              <Label className="text-sm font-medium mb-2 block">Lab Filters</Label>
              <div className="flex gap-2">
                <Badge
                  variant={filterOptions.labs.criticalOnly ? "default" : "outline"}
                  className="cursor-pointer gap-1"
                  onClick={() => setFilterOptions(prev => ({
                    ...prev,
                    labs: { ...prev.labs, criticalOnly: !prev.labs.criticalOnly, abnOnly: false }
                  }))}
                >
                  <Zap className="h-3 w-3" />
                  Critical Only
                </Badge>
                <Badge
                  variant={filterOptions.labs.abnOnly ? "default" : "outline"}
                  className="cursor-pointer gap-1"
                  onClick={() => setFilterOptions(prev => ({
                    ...prev,
                    labs: { ...prev.labs, abnOnly: !prev.labs.abnOnly, criticalOnly: false }
                  }))}
                >
                  <TestTube className="h-3 w-3" />
                  Abnormal Only
                </Badge>
              </div>
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="time-range"
                    checked={filterOptions.timeRange.enabled}
                    onCheckedChange={(checked) => 
                      setFilterOptions(prev => ({
                        ...prev,
                        timeRange: { ...prev.timeRange, enabled: !!checked }
                      }))
                    }
                  />
                  <Label htmlFor="time-range" className="text-sm font-medium cursor-pointer">
                    Modified in last
                  </Label>
                </div>
              </div>
              <div className="flex items-center gap-3 pl-6">
                <Slider
                  value={[filterOptions.timeRange.hours]}
                  min={1}
                  max={168}
                  step={1}
                  disabled={!filterOptions.timeRange.enabled}
                  className="flex-1"
                  onValueChange={(v) => setFilterOptions(prev => ({
                    ...prev,
                    timeRange: { ...prev.timeRange, hours: v[0] }
                  }))}
                />
                <span className="text-sm font-medium w-16 text-right">
                  {filterOptions.timeRange.hours <= 24 ? `${filterOptions.timeRange.hours}h` :
                   filterOptions.timeRange.hours <= 168 ? `${Math.round(filterOptions.timeRange.hours / 24)}d` :
                   '1w+'}
                </span>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {(isOpen || (searchQuery && matchedPatients.length > 0)) && matchedPatients.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card/95 backdrop-blur-xl border border-border/20 rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="max-h-96 overflow-y-auto">
            {matchedPatients.slice(0, 10).map((patient, index) => (
              <div
                key={patient.id}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                  index === activePatientIndex ? 'bg-primary/10' : 'hover:bg-accent/50'
                } ${index === matchedPatients.length - 1 ? '' : 'border-b border-border/10'}`}
                onClick={() => {
                  onPatientSelect(patient.id);
                  setIsOpen(false);
                  setActivePatientIndex(-1);
                }}
                onMouseEnter={() => setActivePatientIndex(index)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm truncate">
                      {highlightMatch(patient.name, debouncedSearch)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {patient.bed}
                    </span>
                  </div>
                  {patient.clinicalSummary && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {highlightMatch(patient.clinicalSummary.slice(0, 100), debouncedSearch)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {patient.medications.infusions.length > 0 && (
                    <Badge variant="secondary" className="h-5 text-[10px] gap-1">
                      <Pill className="h-2.5 w-2.5" />
                      {patient.medications.infusions.length}
                    </Badge>
                  )}
                  <Badge variant="outline" className="h-5 text-[10px]">
                    {new Date(patient.lastModified).toLocaleDateString()}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-2 bg-muted/30 border-t border-border/10 flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {matchedPatients.length} patient{matchedPatients.length !== 1 ? 's' : ''} found
            </span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <ArrowUpDown className="h-3 w-3" />
                Navigate
              </span>
              <span className="flex items-center gap-1">
                <span className="border border-border/40 px-1.5 py-0.5 rounded text-[10px]">Enter</span>
                Select
              </span>
              <span className="flex items-center gap-1">
                <span className="border border-border/40 px-1.5 py-0.5 rounded text-[10px]">Esc</span>
                Close
              </span>
            </div>
          </div>
        </div>
      )}

      {isOpen && matchedPatients.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card/95 backdrop-blur-xl border border-border/20 rounded-xl shadow-xl z-50 p-6 text-center">
          <Search className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No patients match your search
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Try adjusting your search terms or filters
          </p>
        </div>
      )}
    </div>
  );
}
