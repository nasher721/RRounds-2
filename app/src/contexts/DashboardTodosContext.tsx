/**
 * Separate context for per-patient todos map.
 * Splitting this from DashboardContext avoids re-rendering all dashboard consumers
 * when only todosMap changes (e.g. after refetch or todo mutations).
 */
import React, { createContext, useContext, ReactNode } from "react";
import type { PatientTodo } from "@/types/todo";
import type { PatientTodosVerification } from "@/hooks/useAllPatientTodos";

export type TodosMap = Record<string, PatientTodo[]>;

interface DashboardTodosContextType {
  todosMap: TodosMap;
  verification: PatientTodosVerification;
}

const DashboardTodosContext = createContext<DashboardTodosContextType | undefined>(undefined);

export function useDashboardTodos(): TodosMap;
export function useDashboardTodos(includeState: true): DashboardTodosContextType;
export function useDashboardTodos(
  includeState?: true,
): TodosMap | DashboardTodosContextType {
  const context = useContext(DashboardTodosContext);
  if (context === undefined) {
    throw new Error("useDashboardTodos must be used within a DashboardTodosProvider");
  }
  return includeState ? context : context.todosMap;
}

interface DashboardTodosProviderProps {
  todosMap: TodosMap;
  verification?: PatientTodosVerification;
  children: ReactNode;
}

export function DashboardTodosProvider({
  todosMap,
  verification = "verified",
  children,
}: DashboardTodosProviderProps) {
  const value = React.useMemo(
    () => ({ todosMap, verification }),
    [todosMap, verification],
  );
  return (
    <DashboardTodosContext.Provider value={value}>
      {children}
    </DashboardTodosContext.Provider>
  );
}
