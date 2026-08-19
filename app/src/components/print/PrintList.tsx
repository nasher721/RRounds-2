import type { Patient } from '@/types/patient';
import type { PatientTodo } from '@/types/todo';
import { PrintPatientHeader } from './list-components/PrintPatientHeader';
import { PrintSection } from './list-components/PrintSection';
import { PrintSystemsReview } from './list-components/PrintSystemsReview';
import { PrintTodos } from './list-components/PrintTodos';
import { PrintRoundingNotes } from './list-components/PrintRoundingNotes';
import { formatMedicationsHtml } from './utils';

interface PrintListProps {
  patients: Patient[];
  printFontSize: number;
  fontCSS: string;
  enabledSystemKeys: string[];
  showNotesColumn: boolean;
  showTodosColumn: boolean;
  getPatientTodos: (patientId: string) => PatientTodo[];
  isColumnEnabled: (key: string) => boolean;
}

export const PrintList = ({
  patients,
  printFontSize,
  fontCSS,
  enabledSystemKeys,
  showNotesColumn,
  showTodosColumn,
  getPatientTodos,
  isColumnEnabled,
}: PrintListProps) => {
  return (
    <div
      className="space-y-6 print-container"
      style={{
        "--print-font": fontCSS,
        "--print-fs": `${printFontSize}px`
      } as React.CSSProperties}
    >
      {patients.map((patient, index) => (
        <div key={patient.id} className="border-4 border-primary rounded-lg overflow-hidden mb-4 break-inside-avoid shadow-md">
          <PrintPatientHeader
            patient={patient}
            index={index}
            fontSize={printFontSize}
          />

          <div className="p-4 space-y-4 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isColumnEnabled("clinicalSummary") && (
                <PrintSection
                  title="Clinical Summary"
                  content={patient.clinicalSummary}
                  fontSize={printFontSize}
                  variant="primary"
                />
              )}
              {isColumnEnabled("intervalEvents") && (
                <PrintSection
                  title="Interval Events"
                  content={patient.intervalEvents}
                  fontSize={printFontSize}
                  variant="primary"
                />
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isColumnEnabled("imaging") && (
                <PrintSection
                  title="Imaging"
                  content={patient.imaging}
                  fontSize={printFontSize}
                  variant="blue"
                />
              )}
              {isColumnEnabled("labs") && (
                <PrintSection
                  title="Labs"
                  content={patient.labs}
                  fontSize={printFontSize}
                  variant="green"
                />
              )}
            </div>

            {isColumnEnabled("medications") && (patient.medications?.infusions?.length || patient.medications?.scheduled?.length || patient.medications?.prn?.length || patient.medications?.rawText) && (
              <PrintSection
                title="Medications"
                content={formatMedicationsHtml(patient.medications)}
                fontSize={printFontSize}
                variant="orange"
              />
            )}

            <PrintSystemsReview
              systems={patient.systems}
              enabledSystemKeys={enabledSystemKeys}
              fontSize={printFontSize}
            />

            {showTodosColumn && getPatientTodos(patient.id).length > 0 && (
              <PrintTodos
                todos={getPatientTodos(patient.id)}
                fontSize={printFontSize}
              />
            )}

            {showNotesColumn && (
              <PrintRoundingNotes fontSize={printFontSize} />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
