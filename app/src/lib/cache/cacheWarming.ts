import { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { QUERY_KEYS, CACHE_CONFIG } from './cacheConfig';
import { logInfo } from '@/lib/observability/logger';
import {
  getPatientRosterSelectColumns,
  markPatientRosterProjectionLegacy,
  mapPatientRecord,
  PATIENT_SELECT_COLUMNS_LEGACY,
  isMissingPatientContractColumnError,
  type PatientRecord,
} from '@/services/patientService';
import type { Patient } from '@/types/patient';
import type { PatientTodo } from '@/types/todo';
import type { FieldHistoryEntry } from '@/hooks/useFieldHistory';
import type { Database } from '@/integrations/supabase/types';

export interface WarmingProgress {
  total: number;
  completed: number;
  current: string;
  errors: string[];
}

type ProgressCallback = (progress: WarmingProgress) => void;
type OwnerFence = () => boolean;
type PatientTodoRow = Database['public']['Tables']['patient_todos']['Row'];
type FieldHistoryRow = Database['public']['Tables']['patient_field_history']['Row'];

function mapTodoRow(row: PatientTodoRow): PatientTodo {
  return {
    id: row.id,
    patientId: row.patient_id,
    userId: row.user_id,
    section: row.section,
    content: row.content,
    completed: row.completed,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapFieldHistoryRow(row: FieldHistoryRow): FieldHistoryEntry {
  return {
    id: row.id,
    patientId: row.patient_id,
    fieldName: row.field_name,
    oldValue: row.old_value,
    newValue: row.new_value,
    changedAt: row.changed_at,
  };
}

class CacheWarmingOwnerChangedError extends Error {
  constructor() {
    super('Cache warming owner changed');
    this.name = 'CacheWarmingOwnerChangedError';
  }
}

function assertOwnerCurrent(isOwnerCurrent: OwnerFence): void {
  if (!isOwnerCurrent()) {
    throw new CacheWarmingOwnerChangedError();
  }
}

function publishProgress(
  onProgress: ProgressCallback | undefined,
  progress: WarmingProgress,
): void {
  onProgress?.({ ...progress, errors: [...progress.errors] });
}

// Cache warming strategies
export const cacheWarming = {
  // Warm essential caches on app load
  async warmEssential(
    queryClient: QueryClient,
    userId: string,
    isOwnerCurrent: OwnerFence,
    onProgress?: ProgressCallback
  ): Promise<WarmingProgress | null> {
    const tasks = [
      { key: 'patients', fn: () => this.warmPatients(queryClient, userId, isOwnerCurrent) },
      { key: 'autotexts', fn: () => this.warmAutotexts(queryClient, userId, isOwnerCurrent) },
      {
        key: 'clinicalPhrases',
        fn: () => this.warmClinicalPhrases(queryClient, userId, isOwnerCurrent),
      },
      { key: 'templates', fn: () => this.warmTemplates(queryClient, userId, isOwnerCurrent) },
      {
        key: 'userDictionary',
        fn: () => this.warmUserDictionary(queryClient, userId, isOwnerCurrent),
      },
    ];
    
    const progress: WarmingProgress = {
      total: tasks.length,
      completed: 0,
      current: '',
      errors: [],
    };
    
    for (const task of tasks) {
      if (!isOwnerCurrent()) return null;
      progress.current = task.key;
      publishProgress(onProgress, progress);
      
      try {
        await task.fn();
        if (!isOwnerCurrent()) return null;
        progress.completed++;
      } catch (error) {
        if (error instanceof CacheWarmingOwnerChangedError || !isOwnerCurrent()) return null;
        progress.errors.push(`${task.key}: data could not be loaded`);
      }
      
      publishProgress(onProgress, progress);
    }

    return { ...progress, errors: [...progress.errors] };
  },
  
  // Warm patients data (same Patient[] shape as usePatientFetch for single source of truth)
  async warmPatients(
    queryClient: QueryClient,
    userId: string,
    isOwnerCurrent: OwnerFence = () => true,
  ): Promise<void> {
    assertOwnerCurrent(isOwnerCurrent);
    const selectedColumns = getPatientRosterSelectColumns();
    let { data, error } = await supabase
      .from('patients')
      .select(selectedColumns)
      .eq('user_id', userId)
      .order('patient_number');

    if (
      selectedColumns !== PATIENT_SELECT_COLUMNS_LEGACY
      && error
      && isMissingPatientContractColumnError(error)
    ) {
      markPatientRosterProjectionLegacy();
      ({ data, error } = await supabase
        .from('patients')
        .select(PATIENT_SELECT_COLUMNS_LEGACY)
        .eq('user_id', userId)
        .order('patient_number'));
    }

    assertOwnerCurrent(isOwnerCurrent);
    if (error) throw error;
    
    const patients: Patient[] = (data || []).map((record) => mapPatientRecord(record as unknown as PatientRecord));
    queryClient.setQueryData<Patient[]>(QUERY_KEYS.patientList(userId), patients, {
      updatedAt: Date.now(),
    });
    
    logInfo('cache.warming.completed', {
      entity: 'patients',
      count: patients.length,
    });
  },
  
  // Warm autotexts data
  async warmAutotexts(
    queryClient: QueryClient,
    userId: string,
    isOwnerCurrent: OwnerFence = () => true,
  ): Promise<void> {
    assertOwnerCurrent(isOwnerCurrent);
    const { data, error } = await supabase
      .from('autotexts')
      .select('*')
      .eq('user_id', userId);

    assertOwnerCurrent(isOwnerCurrent);
    if (error) throw error;
    
    queryClient.setQueryData(QUERY_KEYS.autotextList(userId), data || [], {
      updatedAt: Date.now(),
    });
    
    logInfo('cache.warming.completed', {
      entity: 'autotexts',
      count: data?.length || 0,
    });
  },
  
  // Warm clinical phrases data
  async warmClinicalPhrases(
    queryClient: QueryClient,
    userId: string,
    isOwnerCurrent: OwnerFence = () => true,
  ): Promise<void> {
    assertOwnerCurrent(isOwnerCurrent);
    const { data, error } = await supabase
      .from('clinical_phrases')
      .select('*')
      .eq('user_id', userId);

    assertOwnerCurrent(isOwnerCurrent);
    if (error) throw error;
    
    queryClient.setQueryData(QUERY_KEYS.clinicalPhraseList(userId), data || [], {
      updatedAt: Date.now(),
    });
    
    logInfo('cache.warming.completed', {
      entity: 'clinical_phrases',
      count: data?.length || 0,
    });
  },
  
  // Warm templates data
  async warmTemplates(
    queryClient: QueryClient,
    userId: string,
    isOwnerCurrent: OwnerFence = () => true,
  ): Promise<void> {
    assertOwnerCurrent(isOwnerCurrent);
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('user_id', userId);

    assertOwnerCurrent(isOwnerCurrent);
    if (error) throw error;
    
    queryClient.setQueryData(QUERY_KEYS.templateList(userId), data || [], {
      updatedAt: Date.now(),
    });
    
    logInfo('cache.warming.completed', {
      entity: 'templates',
      count: data?.length || 0,
    });
  },
  
  // Warm user dictionary
  async warmUserDictionary(
    queryClient: QueryClient,
    userId: string,
    isOwnerCurrent: OwnerFence = () => true,
  ): Promise<void> {
    assertOwnerCurrent(isOwnerCurrent);
    const { data, error } = await supabase
      .from('user_dictionary')
      .select('*')
      .eq('user_id', userId);

    assertOwnerCurrent(isOwnerCurrent);
    if (error) throw error;
    
    queryClient.setQueryData(QUERY_KEYS.userDictionaryList(userId), data || [], {
      updatedAt: Date.now(),
    });
    
    logInfo('cache.warming.completed', {
      entity: 'user_dictionary',
      count: data?.length || 0,
    });
  },
  
  // Prefetch related data on hover/focus
  async prefetchPatient(
    queryClient: QueryClient,
    userId: string,
    patientId: string,
    isOwnerCurrent: OwnerFence = () => true,
  ): Promise<void> {
    if (!CACHE_CONFIG.prefetch.enabled) return;
    if (!isOwnerCurrent()) return;

    const [todosResult, historyResult] = await Promise.all([
      supabase
        .from('patient_todos')
        .select('*')
        .eq('user_id', userId)
        .eq('patient_id', patientId),
      supabase
        .from('patient_field_history')
        .select('*')
        .eq('user_id', userId)
        .eq('patient_id', patientId)
        .order('changed_at', { ascending: false })
        .limit(50),
    ]);

    if (!isOwnerCurrent()) return;
    if (todosResult.error) throw todosResult.error;
    if (historyResult.error) throw historyResult.error;

    const updatedAt = Date.now();
    const todos = (todosResult.data || [])
      .filter((row) => row.user_id === userId && row.patient_id === patientId)
      .map(mapTodoRow);
    const history = (historyResult.data || [])
      .filter((row) => row.user_id === userId && row.patient_id === patientId)
      .map(mapFieldHistoryRow);
    queryClient.setQueryData<PatientTodo[]>(
      QUERY_KEYS.patientTodosForOwner(userId, patientId),
      todos,
      { updatedAt },
    );
    queryClient.setQueryData<FieldHistoryEntry[]>(
      QUERY_KEYS.fieldHistoryForOwner(userId, patientId),
      history,
      { updatedAt },
    );
  },
};

// Service worker cache warming
export async function warmServiceWorkerCache(urls: string[]): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }
  const controller = navigator.serviceWorker.controller;
  if (!controller) return false;
  
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    
    channel.port1.onmessage = (event) => {
      resolve(event.data?.success || false);
    };
    
    controller.postMessage(
      { type: 'PRECACHE_URLS', payload: { urls } },
      [channel.port2]
    );
    
    setTimeout(() => resolve(false), 5000);
  });
}
