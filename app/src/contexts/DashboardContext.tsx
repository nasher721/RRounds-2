import React, { createContext, useContext, ReactNode } from "react";
import { Patient } from "@/types/patient";
import { AutoText, Template } from "@/types/autotext";
import { MobileTab } from "@/components/layout";
import { PatientFilterType } from "@/constants/config";
import { type usePatients } from "@/hooks/usePatients";
import type { PatientSaveState } from "@/hooks/patients/usePatientMutations";
import type { PatientRosterVerification } from "@/hooks/patients/usePatientFetch";

type PatientActions = ReturnType<typeof usePatients>;

/** Todos are provided via DashboardTodosContext (useDashboardTodos) to limit re-renders when only todos change. */
interface DashboardContextType {
    // Data
    user: { email?: string } | null;
    patients: Patient[];
    filteredPatients: Patient[];
    autotexts: AutoText[];
    templates: Template[];
    customDictionary: Record<string, string>;

    // State
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    filter: PatientFilterType;
    setFilter: (filter: PatientFilterType) => void;
    selectedPatient: Patient | null;
    mobileTab: MobileTab;
    setMobileTab: (tab: MobileTab) => void;
    lastSaved: Date;
    patientListViewMode: "rich" | "compact";
    setPatientListViewMode: (mode: "rich" | "compact") => void;
    patientSaveStates?: Record<string, PatientSaveState>;
    /** Trust level for the visible patient roster. */
    patientVerification?: PatientRosterVerification;

    // Actions
    onAddPatient: () => void;
    onAddPatientWithData: PatientActions["addPatientWithData"];
    onUpdatePatient: PatientActions["updatePatient"];
    onRemovePatient: PatientActions["removePatient"];
    onDuplicatePatient: PatientActions["duplicatePatient"];
    onToggleCollapse: PatientActions["toggleCollapse"];
    onCollapseAll: PatientActions["collapseAll"];
    onClearAll: PatientActions["clearAll"];
    onImportPatients: PatientActions["importPatients"];
    /** Refresh patient list from the server (e.g. manual sync) */
    onRefetchPatients: () => void | Promise<void>;

    // Autotext Actions
    onAddAutotext: (shortcut: string, expansion: string, category: string) => Promise<boolean>;
    onRemoveAutotext: (shortcut: string) => Promise<void>;
    onAddTemplate: (name: string, content: string, category: string) => Promise<boolean>;
    onRemoveTemplate: (id: string) => Promise<void>;
    onImportDictionary: (entries: Record<string, string>) => Promise<boolean | void>;

    // Auth
    onSignOut: () => void;
    onPatientSelect: (patient: Patient | null) => void;

    /** Desktop list/detail: which patient is shown in the main pane */
    desktopSelectedPatientId: string | null;
    setDesktopSelectedPatientId: (id: string | null) => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const useDashboard = () => {
    const context = useContext(DashboardContext);
    if (!context) {
        throw new Error("useDashboard must be used within a DashboardProvider");
    }
    return context;
};

interface DashboardProviderProps extends DashboardContextType {
    children: ReactNode;
}

export const DashboardProvider = ({ children, ...props }: DashboardProviderProps) => {
    return (
        <DashboardContext.Provider value={props}>
            {children}
        </DashboardContext.Provider>
    );
};
