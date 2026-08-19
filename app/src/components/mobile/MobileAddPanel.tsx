import { Card } from "@/components/ui/card";
import { Plus, FileUp, Wand2 } from "lucide-react";
import { SmartPatientImport } from "@/components/SmartPatientImport";
import type { PatientSystems, PatientMedications } from "@/types/patient";

interface MobileAddPanelProps {
  onAddPatient: () => void;
  onOpenImport: () => void;
  onSmartImport: (patient: {
    name: string;
    bed: string;
    clinicalSummary: string;
    intervalEvents: string;
    imaging: string;
    labs: string;
    systems: PatientSystems;
    medications?: PatientMedications;
  }) => Promise<void>;
}

export const MobileAddPanel = ({ onAddPatient, onOpenImport, onSmartImport }: MobileAddPanelProps) => {
  return (
    <div className="p-4 space-y-4 pb-20">
      <h2 className="text-xl font-semibold mb-4">Add Patients</h2>

      <Card 
        className="p-6 cursor-pointer hover:bg-secondary/50 active:bg-secondary transition-colors"
        onClick={onAddPatient}
      >
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Plus className="h-7 w-7 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">New Patient</h3>
            <p className="text-sm text-muted-foreground">
              Add a blank patient card to start documenting
            </p>
          </div>
        </div>
      </Card>

      <SmartPatientImport
        onImportPatient={onSmartImport}
        trigger={
          <Card className="p-6 cursor-pointer hover:bg-secondary/50 active:bg-secondary transition-colors">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                <Wand2 className="h-7 w-7 text-purple-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg">Smart Import</h3>
                <p className="text-sm text-muted-foreground">
                  Paste notes and AI organizes them
                </p>
              </div>
            </div>
          </Card>
        }
      />

      <Card 
        className="p-6 cursor-pointer hover:bg-secondary/50 active:bg-secondary transition-colors"
        onClick={onOpenImport}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onOpenImport();
          }
        }}
        aria-label="Import Patient List - Upload a list file or paste patient text"
      >
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
            <FileUp className="h-7 w-7 text-blue-500" />
          </div>
          <div>
            <h3 className="font-semibold text-lg">Import Patient List</h3>
            <p className="text-sm text-muted-foreground">
              Word, Excel, CSV, image, or paste (multiple patients)
            </p>
          </div>
        </div>
      </Card>

      <div className="pt-4 border-t border-border">
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Quick Tips</h3>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Type autotext shortcuts followed by space to expand</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>Paste images directly into imaging fields</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary">•</span>
            <span>All changes sync automatically to the cloud</span>
          </li>
        </ul>
      </div>
    </div>
  );
};
