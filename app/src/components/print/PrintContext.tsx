import * as React from 'react';
import { usePrintState } from './usePrintState';
import type { Patient } from '@/types/patient';
import type { PatientTodo } from '@/types/todo';
import type { PatientTodosMap } from './types';
import { systemKeys } from './constants';

interface PrintContextValue extends ReturnType<typeof usePrintState> {
  patients: Patient[];
  patientTodos: PatientTodosMap;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  showNotesColumn: boolean;
  showTodosColumn: boolean;
  enabledSystemKeys: string[];
  getPatientTodos: (patientId: string) => PatientTodo[];
}

const PrintContext = React.createContext<PrintContextValue | null>(null);

export const usePrintContext = () => {
  const context = React.useContext(PrintContext);
  if (!context) {
    throw new Error('usePrintContext must be used within a PrintContextProvider');
  }
  return context;
};

interface PrintContextProviderProps {
  children: React.ReactNode;
  patients: Patient[];
  patientTodos: PatientTodosMap;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const PrintContextProvider = ({
  children,
  patients,
  patientTodos,
  activeTab,
  setActiveTab,
}: PrintContextProviderProps) => {
  const printState = usePrintState();
  const { columns, isColumnEnabled } = printState;
  
  const showNotesColumn = columns.find(c => c.key === "notes")?.enabled ?? false;
  const showTodosColumn = columns.find(c => c.key === "todos")?.enabled ?? true;
  
  const enabledSystemKeys = systemKeys.filter((key: string) => isColumnEnabled(`systems.${key}`));
  
  const getPatientTodos = (patientId: string) => patientTodos[patientId] || [];

  return (
    <PrintContext.Provider value={{
      ...printState,
      patients,
      patientTodos,
      activeTab,
      setActiveTab,
      showNotesColumn,
      showTodosColumn,
      enabledSystemKeys,
      getPatientTodos,
    }}>
      {children}
    </PrintContext.Provider>
  );
};
