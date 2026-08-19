import { useMemo, useState, useCallback } from "react";
import type { Patient, PatientSystems, PatientMedications } from "@/types/patient";

export interface PatientFilter {
  searchTerm: string;
  status: "all" | "active" | "stable" | "critical";
  hasNotes: boolean;
  systemFilter: keyof PatientSystems | "all";
  hasMedications: boolean;
  medicationType: "infusions" | "scheduled" | "prn" | "all";
}

const defaultFilter: PatientFilter = {
  searchTerm: "",
  status: "all",
  hasNotes: false,
  systemFilter: "all",
  hasMedications: false,
  medicationType: "all",
};

export function usePatientSearch(patients: Patient[]) {
  const [filter, setFilter] = useState<PatientFilter>(defaultFilter);
  const [sortBy, setSortBy] = useState<"name" | "bed" | "lastModified" | "number">("number");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const filteredPatients = useMemo(() => {
    let result = [...patients];

    if (filter.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      result = result.filter(
        (p) =>
          p.name?.toLowerCase().includes(term) ||
          p.mrn?.toLowerCase().includes(term) ||
          p.bed?.toLowerCase().includes(term) ||
          p.clinicalSummary?.toLowerCase().includes(term)
      );
    }

    if (filter.status !== "all") {
      result = result.filter((p) => {
        const summary = p.clinicalSummary?.toLowerCase() || "";
        switch (filter.status) {
          case "critical":
            return (
              summary.includes("critical") ||
              summary.includes("unstable") ||
              summary.includes("deteriorating")
            );
          case "stable":
            return (
              summary.includes("stable") ||
              summary.includes("improving") ||
              summary.includes("good")
            );
          case "active":
            return p.lastModified && Date.now() - new Date(p.lastModified).getTime() < 3600000;
          default:
            return true;
        }
      });
    }

    if (filter.hasNotes) {
      result = result.filter((p) => p.clinicalSummary && p.clinicalSummary.length > 0);
    }

    if (filter.systemFilter !== "all") {
      const systemFilter = filter.systemFilter;
      result = result.filter((p) => {
        const systems = p.systems as PatientSystems | undefined;
        return Boolean(systems?.[systemFilter]?.length);
      });
    }

    if (filter.hasMedications) {
      result = result.filter((p) => {
        const meds = p.medications as PatientMedications | undefined;
        if (!meds) return false;
        const totalMeds = (meds.infusions?.length || 0) + (meds.scheduled?.length || 0) + (meds.prn?.length || 0);
        return totalMeds > 0;
      });
    }

    if (filter.medicationType !== "all") {
      const medicationType = filter.medicationType;
      result = result.filter((p) => {
        const meds = p.medications as PatientMedications | undefined;
        if (!meds) return false;
        return meds[medicationType].length > 0;
      });
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "name":
          comparison = (a.name || "").localeCompare(b.name || "");
          break;
        case "bed":
          comparison = (a.bed || "").localeCompare(b.bed || "");
          break;
        case "lastModified":
          comparison = new Date(a.lastModified || 0).getTime() - new Date(b.lastModified || 0).getTime();
          break;
        case "number":
        default:
          comparison = (a.patientNumber || 0) - (b.patientNumber || 0);
          break;
      }
      return sortOrder === "asc" ? comparison : -comparison;
    });

    return result;
  }, [patients, filter, sortBy, sortOrder]);

  const clearFilters = useCallback(() => {
    setFilter(defaultFilter);
  }, []);

  const updateSearchTerm = useCallback((term: string) => {
    setFilter((prev) => ({ ...prev, searchTerm: term }));
  }, []);

  const updateStatus = useCallback((status: PatientFilter["status"]) => {
    setFilter((prev) => ({ ...prev, status }));
  }, []);

  const toggleSort = useCallback((field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  }, [sortBy]);

  return {
    filter,
    setFilter,
    filteredPatients,
    sortBy,
    sortOrder,
    clearFilters,
    updateSearchTerm,
    updateStatus,
    toggleSort,
    resultCount: filteredPatients.length,
    totalCount: patients.length,
  };
}
