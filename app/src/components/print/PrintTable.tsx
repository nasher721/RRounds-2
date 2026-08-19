import type { Patient } from '@/types/patient';
import type { PatientTodo } from '@/types/todo';
import type { ColumnWidthsType } from './types';
import { systemLabels } from './constants';
import { cleanInlineStyles, formatTodosHtml, formatMedicationsHtml } from './utils';
import { cn } from '@/lib/utils';
import * as React from 'react';
import { patientExportIdentifierLine } from '@/lib/patientIdentity';

interface PrintTableProps {
  patients: Patient[];
  columns: { key: string; enabled: boolean }[];
  columnWidths: ColumnWidthsType;
  printFontSize: number;
  fontCSS: string;
  enabledSystemKeys: string[];
  showNotesColumn: boolean;
  showTodosColumn: boolean;
  getPatientTodos: (patientId: string) => PatientTodo[];
  isColumnEnabled: (key: string) => boolean;
}

export const PrintTable = ({
  patients,
  columnWidths,
  printFontSize,
  fontCSS,
  enabledSystemKeys,
  showNotesColumn,
  showTodosColumn,
  getPatientTodos,
  isColumnEnabled,
}: PrintTableProps) => {
  return (
    <div className="overflow-x-auto">
      <table className="print-table" style={{ '--print-font': fontCSS } as React.CSSProperties}>
        <thead>
          <tr className="bg-primary text-primary-foreground">
            {isColumnEnabled("patient") && (
              <th
                className="border border-border p-3 text-left font-bold uppercase print-col-dynamic"
                style={{ '--col-width': columnWidths.patient, '--print-fs': `${printFontSize + 1}px` } as React.CSSProperties}
              >
                Patient
              </th>
            )}
            {isColumnEnabled("clinicalSummary") && (
              <th
                className="border border-border p-3 text-left font-bold uppercase print-col-dynamic"
                style={{ '--col-width': columnWidths.summary, '--print-fs': `${printFontSize + 1}px` } as React.CSSProperties}
              >
                Clinical Summary
              </th>
            )}
            {isColumnEnabled("intervalEvents") && (
              <th
                className="border border-border p-3 text-left font-bold uppercase print-col-dynamic"
                style={{ '--col-width': columnWidths.events, '--print-fs': `${printFontSize + 1}px` } as React.CSSProperties}
              >
                Interval Events
              </th>
            )}
            {isColumnEnabled("imaging") && (
              <th
                className="border border-border p-3 text-left font-bold uppercase print-col-dynamic"
                style={{ '--col-width': columnWidths.imaging, '--print-fs': `${printFontSize + 1}px` } as React.CSSProperties}
              >
                Imaging
              </th>
            )}
            {isColumnEnabled("labs") && (
              <th
                className="border border-border p-3 text-left font-bold uppercase print-col-dynamic"
                style={{ '--col-width': columnWidths.labs, '--print-fs': `${printFontSize + 1}px` } as React.CSSProperties}
              >
                Labs
              </th>
            )}
            {isColumnEnabled("medications") && (
              <th
                className="border border-border p-3 text-left font-bold bg-orange-500 text-white uppercase print-col-dynamic"
                style={{ '--col-width': columnWidths.medications, '--print-fs': `${printFontSize + 1}px` } as React.CSSProperties}
              >
                Medications
              </th>
            )}
            {enabledSystemKeys.map(key => (
              <th
                key={key}
                className="border border-border p-3 text-left font-bold uppercase print-col-dynamic"
                style={{
                  '--col-width': columnWidths[`systems.${key}` as keyof ColumnWidthsType] || 90,
                  '--print-fs': `${printFontSize}px`
                } as React.CSSProperties}
              >
                {systemLabels[key]}
              </th>
            ))}
            {showTodosColumn && (
              <th
                className="border border-border p-3 text-left font-bold bg-violet-500 text-white uppercase print-col-dynamic"
                style={{ '--col-width': columnWidths.todos, '--print-fs': `${printFontSize + 1}px` } as React.CSSProperties}
              >
                Todos
              </th>
            )}
            {showNotesColumn && (
              <th
                className="border border-border p-3 text-left font-bold bg-amber-500 text-white uppercase print-col-dynamic"
                style={{ '--col-width': columnWidths.notes, '--print-fs': `${printFontSize + 1}px` } as React.CSSProperties}
              >
                Notes
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {patients.map((patient, idx) => (
            <tr key={patient.id} className={cn("border-b-2 border-primary/40", idx % 2 === 0 ? "bg-white" : "bg-muted/20")}>
              {isColumnEnabled("patient") && (
                <td className="border border-border p-3 align-top">
                  <div className="font-bold text-primary" style={{ fontSize: 'calc(var(--print-fs) + 1px)' } as React.CSSProperties}>{patient.name || 'Unnamed'}</div>
                  <div className="text-muted-foreground" style={{ fontSize: 'calc(var(--print-fs) - 1px)' } as React.CSSProperties}>{patientExportIdentifierLine(patient)}</div>
                </td>
              )}
              {isColumnEnabled("clinicalSummary") && (
                <td className="border border-border p-3 align-top">
                  <div
                    className="whitespace-pre-wrap break-words"
                    style={{ fontSize: 'var(--print-fs)' } as React.CSSProperties}
                    dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.clinicalSummary) }}
                  />
                </td>
              )}
              {isColumnEnabled("intervalEvents") && (
                <td className="border border-border p-3 align-top">
                  <div
                    className="whitespace-pre-wrap break-words"
                    style={{ fontSize: 'var(--print-fs)' } as React.CSSProperties}
                    dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.intervalEvents) }}
                  />
                </td>
              )}
              {isColumnEnabled("imaging") && (
                <td className="border border-border p-3 align-top">
                  <div
                    className="whitespace-pre-wrap break-words"
                    style={{ fontSize: 'var(--print-fs)' } as React.CSSProperties}
                    dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.imaging) }}
                  />
                </td>
              )}
              {isColumnEnabled("labs") && (
                <td className="border border-border p-3 align-top">
                  <div
                    className="whitespace-pre-wrap break-words"
                    style={{ fontSize: 'var(--print-fs)' } as React.CSSProperties}
                    dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.labs) }}
                  />
                </td>
              )}
              {isColumnEnabled("medications") && (
                <td className="border border-border p-2 align-top bg-orange-50/50">
                  <div
                    className="whitespace-pre-wrap break-words"
                    style={{ fontSize: 'var(--print-fs)' } as React.CSSProperties}
                    dangerouslySetInnerHTML={{ __html: formatMedicationsHtml(patient.medications) }}
                  />
                </td>
              )}
              {enabledSystemKeys.map(key => (
                <td key={key} className="border border-border p-2 align-top">
                  <div
                    className="whitespace-pre-wrap break-words"
                    style={{ fontSize: 'calc(var(--print-fs) - 1px)' } as React.CSSProperties}
                    dangerouslySetInnerHTML={{ __html: cleanInlineStyles(patient.systems[key as keyof typeof patient.systems]) }}
                  />
                </td>
              ))}
              {showTodosColumn && (
                <td className="border border-border p-2 align-top bg-violet-50/50">
                  <div
                    className="whitespace-pre-wrap break-words"
                    style={{ fontSize: 'var(--print-fs)' } as React.CSSProperties}
                    dangerouslySetInnerHTML={{ __html: formatTodosHtml(getPatientTodos(patient.id)) }}
                  />
                </td>
              )}
              {showNotesColumn && (
                <td className="border border-border p-2 align-top bg-amber-50/50">
                  <div className="min-h-[80px] w-full relative">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="border-b border-amber-200/60 h-[16px] w-full" />
                    ))}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
