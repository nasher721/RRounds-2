import { Patient } from "@/types/patient";
import { SwipeablePatientCard } from "./SwipeablePatientCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Users, Search, UserPlus, FileDown } from "lucide-react";

interface MobilePatientListProps {
  patients: Patient[];
  onPatientSelect: (patient: Patient) => void;
  onPatientDelete: (id: string) => void;
  onPatientDuplicate: (id: string) => void;
  searchQuery?: string;
  onAddPatient?: () => void;
  onOpenImport?: () => void;
}

export const MobilePatientList = ({
  patients,
  onPatientSelect,
  onPatientDelete,
  onPatientDuplicate,
  searchQuery,
  onAddPatient,
  onOpenImport,
}: MobilePatientListProps) => {
  if (patients.length === 0) {
    const isSearching = !!searchQuery;

    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-5">
          {isSearching ? (
            <Search className="h-6 w-6 text-muted-foreground" />
          ) : (
            <Users className="h-6 w-6 text-muted-foreground" />
          )}
        </div>

        <h3 className="text-lg font-semibold tracking-tight mb-1.5">
          {isSearching ? "No patients found" : "No patients yet"}
        </h3>
        <p className="text-sm text-muted-foreground max-w-[240px] leading-relaxed">
          {isSearching
            ? "Try adjusting your search or filter."
            : "Add your first patient to start rounding."}
        </p>

        {!isSearching && (
          <div className="flex flex-col gap-2.5 mt-8 w-full max-w-[280px]">
            <Button
              onClick={onAddPatient}
              disabled={!onAddPatient}
              className="w-full h-11 rounded-xl font-medium"
              size="lg"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add patient
            </Button>
            <Button
              variant="outline"
              onClick={onOpenImport}
              disabled={!onOpenImport}
              className="w-full h-11 rounded-xl font-medium"
              size="lg"
            >
              <FileDown className="h-4 w-4 mr-2" />
              Import Patient List
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {patients.length} {patients.length === 1 ? "patient" : "patients"}
        </span>
      </div>

      <div className="flex flex-col gap-1.5 px-3 pb-4">
        {patients.map((patient, index) => (
          <Card
            key={patient.id}
            className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden"
          >
            <CardContent className="p-0">
              <SwipeablePatientCard
                patient={patient}
                onSelect={onPatientSelect}
                onDelete={onPatientDelete}
                onDuplicate={onPatientDuplicate}
                index={index}
              />
            </CardContent>
          </Card>
        ))}
      </div>

      {patients.length === 1 && (
        <p className="px-4 pb-4 text-center text-xs text-muted-foreground">
          Swipe left on a patient for quick actions
        </p>
      )}
    </div>
  );
};
