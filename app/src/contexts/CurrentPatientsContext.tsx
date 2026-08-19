import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { Patient } from "@/types/patient";

interface CurrentPatientsContextType {
  patients: Patient[];
  setPatients: (patients: Patient[]) => void;
  activePatientId: string | null;
  setActivePatientId: (patientId: string | null) => void;
}

const CurrentPatientsContext = createContext<CurrentPatientsContextType | undefined>(undefined);

export function useCurrentPatients(): Patient[] {
  const ctx = useContext(CurrentPatientsContext);
  return ctx?.patients ?? [];
}

export function useSetCurrentPatients(): (patients: Patient[]) => void {
  const ctx = useContext(CurrentPatientsContext);
  return ctx?.setPatients ?? (() => {});
}

export function useActivePatientId(): string | null {
  return useContext(CurrentPatientsContext)?.activePatientId ?? null;
}

export function useSetActivePatientId(): (patientId: string | null) => void {
  const ctx = useContext(CurrentPatientsContext);
  return ctx?.setActivePatientId ?? (() => {});
}

interface CurrentPatientsProviderProps {
  children: ReactNode;
}

export function CurrentPatientsProvider({ children }: CurrentPatientsProviderProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const stableSet = useCallback((next: Patient[]) => {
    setPatients(next);
  }, []);
  const stableSetActivePatientId = useCallback((patientId: string | null) => {
    setActivePatientId(patientId);
  }, []);
  const value = React.useMemo(
    () => ({ patients, setPatients: stableSet, activePatientId, setActivePatientId: stableSetActivePatientId }),
    [patients, stableSet, activePatientId, stableSetActivePatientId]
  );
  return (
    <CurrentPatientsContext.Provider value={value}>
      {children}
    </CurrentPatientsContext.Provider>
  );
}
