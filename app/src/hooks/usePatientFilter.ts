import { useMemo, useState, useEffect } from 'react';
import type { Patient } from '@/types/patient';
import type { SortBy } from '@/contexts/SettingsContext';
import { PatientFilterType } from '@/constants/config';

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

// Re-export for convenience
export { PatientFilterType } from '@/constants/config';

interface UsePatientFilterOptions {
  patients: Patient[];
  sortBy: SortBy;
  currentUserId?: string;
}

export function usePatientFilter({ patients, sortBy, currentUserId }: UsePatientFilterOptions) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<PatientFilterType>(PatientFilterType.All);
  // Debounce search for filtering — keeps input responsive while coalescing
  // expensive filter+sort recomputations and roster re-renders on fast typing.
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 150);

  const filteredPatients = useMemo(() => {
    const searchLower = debouncedSearchQuery.toLowerCase();

    return patients
      .filter((patient) => {
        const searchableClinicalText = [
          patient.name,
          patient.mrn ?? '',
          patient.bed,
          patient.clinicalSummary,
          patient.intervalEvents,
          patient.imaging,
          patient.labs,
          ...Object.values(patient.systems),
          ...patient.medications.infusions,
          ...patient.medications.scheduled,
          ...patient.medications.prn,
        ].join(' ').toLowerCase();
        const matchesSearch =
          !debouncedSearchQuery ||
          searchableClinicalText.includes(searchLower);

        if (filter === PatientFilterType.Filled) {
          const hasSomeContent =
            patient.clinicalSummary ||
            patient.intervalEvents ||
            Object.values(patient.systems).some((v) => v);
          return matchesSearch && hasSomeContent;
        } else if (filter === PatientFilterType.Empty) {
          const isEmpty =
            !patient.clinicalSummary &&
            !patient.intervalEvents &&
            !Object.values(patient.systems).some((v) => v);
          return matchesSearch && isEmpty;
        } else if (filter === PatientFilterType.MyPatients) {
          const isAssignedToMe = currentUserId && patient.assignedTo === currentUserId;
          return matchesSearch && isAssignedToMe;
        }

        return matchesSearch;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case 'room':
            return a.bed.localeCompare(b.bed, undefined, { numeric: true, sensitivity: 'base' });
          case 'name':
            return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
          case 'number':
          default:
            return a.patientNumber - b.patientNumber;
        }
      });
  }, [patients, debouncedSearchQuery, filter, sortBy, currentUserId]);

  return {
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    filteredPatients,
  };
}
