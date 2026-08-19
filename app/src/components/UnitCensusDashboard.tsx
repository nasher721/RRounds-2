import * as React from "react";
import { Activity, AlertTriangle, BedDouble, ChevronRight, Clock, Filter, LayoutDashboard, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AcuityLevel, Patient } from "@/types/patient";

interface UnitMetrics {
  totalPatients: number;
  newAdmissions: number;
  recordedAcuity: number;
  recordedCritical: number;
}

const ACUITY_ORDER: Record<AcuityLevel, number> = {
  low: 1,
  moderate: 2,
  high: 3,
  critical: 4,
};

const ACUITY_STYLES: Record<AcuityLevel, string> = {
  low: 'border-green-200 bg-green-50 text-green-800',
  moderate: 'border-amber-200 bg-amber-50 text-amber-800',
  high: 'border-orange-200 bg-orange-50 text-orange-800',
  critical: 'border-red-200 bg-red-50 text-red-800',
};

const calculateUnitMetrics = (patients: Patient[]): UnitMetrics => {
  const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
  let newAdmissions = 0;
  let recordedAcuity = 0;
  let recordedCritical = 0;

  for (const patient of patients) {
    const createdAt = new Date(patient.createdAt).getTime();
    if (Number.isFinite(createdAt) && createdAt > twentyFourHoursAgo) newAdmissions += 1;
    if (patient.acuity) recordedAcuity += 1;
    if (patient.acuity === 'critical') recordedCritical += 1;
  }

  return {
    totalPatients: patients.length,
    newAdmissions,
    recordedAcuity,
    recordedCritical,
  };
};

interface UnitCensusDashboardProps {
  patients: Patient[];
  onPatientSelect?: (patient: Patient) => void;
  className?: string;
}

type SortBy = 'room' | 'name' | 'recorded-acuity';

export function UnitCensusDashboard({ patients, onPatientSelect, className }: UnitCensusDashboardProps) {
  const [sortBy, setSortBy] = React.useState<SortBy>('room');
  const [filterCritical, setFilterCritical] = React.useState(false);
  const metrics = React.useMemo(() => calculateUnitMetrics(patients), [patients]);

  const displayedPatients = React.useMemo(() => {
    const filtered = filterCritical
      ? patients.filter((patient) => patient.acuity === 'critical')
      : [...patients];

    return filtered.sort((left, right) => {
      if (sortBy === 'name') return (left.name || '').localeCompare(right.name || '');
      if (sortBy === 'recorded-acuity') {
        const leftRank = left.acuity ? ACUITY_ORDER[left.acuity] : 0;
        const rightRank = right.acuity ? ACUITY_ORDER[right.acuity] : 0;
        return rightRank - leftRank || (left.bed || '').localeCompare(right.bed || '');
      }
      return (left.bed || '').localeCompare(right.bed || '', undefined, { numeric: true });
    });
  }, [filterCritical, patients, sortBy]);

  const distribution = React.useMemo(() => {
    const counts: Record<AcuityLevel | 'not-recorded', number> = {
      low: 0,
      moderate: 0,
      high: 0,
      critical: 0,
      'not-recorded': 0,
    };
    for (const patient of patients) counts[patient.acuity ?? 'not-recorded'] += 1;
    return counts;
  }, [patients]);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className={cn("relative h-8 gap-2", className)}>
          <LayoutDashboard className="h-4 w-4" />
          <span>Census</span>
          {metrics.recordedCritical > 0 && (
            <Badge
              variant="destructive"
              aria-label={`${metrics.recordedCritical} patients with recorded critical acuity`}
              className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center p-0 text-[10px]"
            >
              {metrics.recordedCritical}
            </Badge>
          )}
        </Button>
      </SheetTrigger>

      <SheetContent className="w-[500px] sm:w-[640px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5" />
            Unit Census Dashboard
            <Badge variant="outline" className="ml-2">{metrics.totalPatients} patients</Badge>
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="mt-4 h-[calc(100vh-100px)]">
          <div className="space-y-6 pr-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <BedDouble className="h-4 w-4" />
                    <span className="text-xs">Total</span>
                  </div>
                  <p className="mt-1 text-2xl font-bold">{metrics.totalPatients}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs">New (24h)</span>
                  </div>
                  <p className="mt-1 text-2xl font-bold">{metrics.newAdmissions}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Activity className="h-4 w-4" />
                    <span className="text-xs">Acuity recorded</span>
                  </div>
                  <p className="mt-1 text-2xl font-bold">{metrics.recordedAcuity}</p>
                </CardContent>
              </Card>
              <Card className={cn(metrics.recordedCritical > 0 && "border-red-200 bg-red-50/50")}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AlertTriangle className={cn("h-4 w-4", metrics.recordedCritical > 0 && "text-red-600")} />
                    <span className="text-xs">Recorded critical</span>
                  </div>
                  <p className="mt-1 text-2xl font-bold">{metrics.recordedCritical}</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Activity className="h-4 w-4" />
                  Recorded acuity distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-5 gap-2">
                {([
                  ['critical', 'Critical'],
                  ['high', 'High'],
                  ['moderate', 'Moderate'],
                  ['low', 'Low'],
                  ['not-recorded', 'Not recorded'],
                ] as const).map(([level, label]) => (
                  <div key={level} className="rounded-md bg-secondary/30 p-2 text-center">
                    <p className="text-lg font-bold">{distribution[level]}</p>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold">Patient overview</h3>
              <div className="flex items-center gap-2">
                <Button
                  variant={filterCritical ? 'default' : 'outline'}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setFilterCritical((current) => !current)}
                >
                  <Filter className="mr-1 h-3 w-3" />
                  Recorded critical only
                </Button>
                <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortBy)}>
                  <SelectTrigger className="h-7 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="room">Room</SelectItem>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="recorded-acuity">Recorded acuity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2">
              {displayedPatients.map((patient) => (
                <Card
                  key={patient.id}
                  className={cn(
                    "cursor-pointer transition-shadow hover:shadow-md",
                    patient.acuity === 'critical' && "border-l-4 border-l-red-500",
                    patient.acuity === 'high' && "border-l-4 border-l-orange-500",
                  )}
                  onClick={() => onPatientSelect?.(patient)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{patient.name || 'Unnamed'}</span>
                          <Badge variant="outline" className="shrink-0 text-[10px]">{patient.bed || 'No bed'}</Badge>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {patient.clinicalSummary || 'No summary'}
                        </p>
                      </div>
                      {patient.acuity ? (
                        <Badge variant="outline" className={cn("capitalize", ACUITY_STYLES[patient.acuity])}>
                          {patient.acuity}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">Acuity not recorded</Badge>
                      )}
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              ))}

              {displayedPatients.length === 0 && (
                <div className="py-12 text-center text-muted-foreground">
                  <Users className="mx-auto mb-4 h-12 w-12 opacity-20" />
                  <p>{filterCritical ? 'No patients have recorded critical acuity' : 'No patients on unit'}</p>
                </div>
              )}
            </div>

            <div className="rounded-lg bg-secondary/30 p-3 text-center">
              <p className="text-xs text-muted-foreground">
                Acuity is manually recorded patient data. This dashboard does not infer clinical state from notes or labs.
              </p>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

interface CensusBadgeProps {
  patients: Patient[];
  className?: string;
}

export function CensusBadge({ patients, className }: CensusBadgeProps) {
  const metrics = React.useMemo(() => calculateUnitMetrics(patients), [patients]);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Badge variant="outline" className="gap-1">
        <Users className="h-3 w-3" />
        {metrics.totalPatients}
      </Badge>
      {metrics.recordedCritical > 0 && (
        <Badge variant="destructive" className="gap-1">
          <AlertTriangle className="h-3 w-3" />
          {metrics.recordedCritical} recorded critical
        </Badge>
      )}
    </div>
  );
}

export default UnitCensusDashboard;
