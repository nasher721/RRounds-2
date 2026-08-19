import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { PatientTodo, TodoSection } from '@/types/todo';
import { Patient } from '@/types/patient';
import { QUERY_KEYS } from '@/lib/cache/cacheConfig';
import type { PatientTodosMap } from '@/hooks/useAllPatientTodos';
import { retainMemory, recallMemories } from '@/lib/hindsightClient';
import { withCategoryTimeout } from '@/lib/requestTimeout';
import { getUserFacingErrorMessage } from '@/lib/userFacingErrors';
import {
  indexedDBQueue,
  type QueuedMutation,
} from '@/lib/offline/indexedDBQueue';
import { CircuitOpenError } from '@/lib/circuitBreaker';
import { isBrowserKnownOffline } from '@/lib/networkConnectivity';

export interface UsePatientTodosOptions {
  /** When provided, use as initial state and skip the initial fetch (avoids duplicate fetches when parent already has todos, e.g. from todosMap). */
  initialTodos?: PatientTodo[];
}

type TodoListUpdater = (todos: PatientTodo[]) => PatientTodo[];

interface OwnedTodoState {
  ownerId: string | null;
  patientId: string | null;
  todos: PatientTodo[];
}

interface OwnedBusyState {
  ownerId: string | null;
  patientId: string | null;
  active: boolean;
}

function mapTodoRecord(
  todo: Record<string, unknown>,
  fallback: {
    patientId: string;
    userId: string;
    section: string | null;
    content: string;
    completed?: boolean;
  },
): PatientTodo {
  const createdAt = String(todo.created_at ?? new Date().toISOString());
  return {
    id: String(todo.id),
    patientId: String(todo.patient_id ?? fallback.patientId),
    userId: String(todo.user_id ?? fallback.userId),
    section: (todo.section as string | null | undefined) ?? fallback.section,
    content: String(todo.content ?? fallback.content),
    completed: Boolean(todo.completed ?? fallback.completed ?? false),
    createdAt,
    updatedAt: String(todo.updated_at ?? createdAt),
  };
}

export function updateTodosMapForPatient(
  currentMap: PatientTodosMap | undefined,
  patientId: string,
  updater: TodoListUpdater,
): PatientTodosMap | undefined {
  if (!currentMap || !Object.prototype.hasOwnProperty.call(currentMap, patientId)) {
    return currentMap;
  }

  return {
    ...currentMap,
    [patientId]: updater(currentMap[patientId] ?? []),
  };
}

function writePatientTodosCache(
  queryClient: QueryClient,
  ownerId: string,
  patientId: string,
  updater: TodoListUpdater,
) {
  const updateOwnedTodos = (currentTodos: PatientTodo[]) => (
    updater(currentTodos.filter((todo) => todo.userId === ownerId && todo.patientId === patientId))
  );
  queryClient.setQueryData<PatientTodo[]>(QUERY_KEYS.patientTodosForOwner(ownerId, patientId), (currentTodos) =>
    updateOwnedTodos(currentTodos ?? []),
  );
  queryClient.setQueriesData<PatientTodosMap>(
    { queryKey: [...QUERY_KEYS.allTodos, ownerId] },
    (currentMap) => updateTodosMapForPatient(currentMap, patientId, updateOwnedTodos),
  );
}

function prependTodos(newTodos: PatientTodo[]): TodoListUpdater {
  return (currentTodos) => {
    const newTodoIds = new Set(newTodos.map((todo) => todo.id));
    return [...newTodos, ...currentTodos.filter((todo) => !newTodoIds.has(todo.id))];
  };
}

const createTodoId = (): string => (
  globalThis.crypto?.randomUUID?.()
  ?? `todo_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
);

function isRetryableTodoWriteError(error: unknown): boolean {
  const candidate = error as {
    status?: number;
    message?: string;
    cause?: unknown;
  } | null;
  const status = candidate?.status;
  if (status === 408 || status === 429 || (typeof status === 'number' && status >= 500)) {
    return true;
  }
  const message = candidate?.message?.toLowerCase() ?? '';
  if (error instanceof TypeError || /network|fetch|timeout|connection|temporar/.test(message)) {
    return true;
  }
  if (error instanceof CircuitOpenError || candidate?.cause instanceof CircuitOpenError) {
    return true;
  }
  return isBrowserKnownOffline() && typeof status !== 'number';
}

const queuedTodoStatus = (mutation: QueuedMutation): PatientTodo['syncStatus'] => {
  if (mutation.status === 'failed') return 'sync_failed';
  if (mutation.status === 'conflict') return 'conflict';
  return 'queued';
};

function isMutationForPatient(
  mutation: QueuedMutation,
  ownerId: string,
  patientId: string,
): boolean {
  if (mutation.type !== 'todo' || mutation.table !== 'patient_todos') return false;
  const payloadOwner = mutation.payload.user_id;
  return (payloadOwner === undefined || payloadOwner === ownerId)
    && mutation.payload.patient_id === patientId;
}

/** Overlay durable todo mutations so reloads never hide unsynced bedside work. */
export function applyQueuedTodoMutations(
  todos: PatientTodo[],
  mutations: readonly QueuedMutation[],
  ownerId: string,
  patientId: string,
): PatientTodo[] {
  let next: PatientTodo[] = todos
    .filter((todo) => !todo.localOnly)
    .map(({ syncStatus: _syncStatus, localOnly: _localOnly, ...todo }) => todo as PatientTodo);
  const relevant = mutations
    .filter((mutation) => isMutationForPatient(mutation, ownerId, patientId))
    .sort((left, right) => left.timestamp - right.timestamp);

  for (const mutation of relevant) {
    const todoId = mutation.entityId
      ?? (typeof mutation.payload.id === 'string' ? mutation.payload.id : null);
    if (!todoId) continue;

    if (mutation.operation === 'delete') {
      next = next.filter((todo) => todo.id !== todoId);
      continue;
    }

    const status = queuedTodoStatus(mutation);
    const existingIndex = next.findIndex((todo) => todo.id === todoId);
    if (mutation.operation === 'create') {
      const queuedTodo = {
        ...mapTodoRecord(mutation.payload, {
          patientId,
          userId: ownerId,
          section: typeof mutation.payload.section === 'string'
            ? mutation.payload.section
            : null,
          content: typeof mutation.payload.content === 'string'
            ? mutation.payload.content
            : '',
          completed: Boolean(mutation.payload.completed),
        }),
        syncStatus: status,
        localOnly: existingIndex === -1,
      } satisfies PatientTodo;
      if (existingIndex === -1) next = [queuedTodo, ...next];
      else next[existingIndex] = { ...next[existingIndex], ...queuedTodo, localOnly: false };
      continue;
    }

    if (existingIndex !== -1) {
      const existing = next[existingIndex];
      next[existingIndex] = {
        ...existing,
        ...(typeof mutation.payload.content === 'string'
          ? { content: mutation.payload.content }
          : {}),
        ...(typeof mutation.payload.completed === 'boolean'
          ? { completed: mutation.payload.completed }
          : {}),
        ...(mutation.payload.section === null || typeof mutation.payload.section === 'string'
          ? { section: mutation.payload.section }
          : {}),
        syncStatus: status,
        localOnly: false,
      };
    }
  }

  return next;
}

export function usePatientTodos(patientId: string | null, options?: UsePatientTodosOptions) {
  const initialTodos = options?.initialTodos;
  const { user } = useAuth();
  const ownerId = user?.id ?? null;
  const [todoState, setTodoState] = useState<OwnedTodoState>(() => ({
    ownerId,
    patientId,
    todos: ownerId && patientId
      ? (initialTodos ?? []).filter((todo) => todo.userId === ownerId && todo.patientId === patientId)
      : [],
  }));
  const [loadingState, setLoadingState] = useState<OwnedBusyState>({
    ownerId: null,
    patientId: null,
    active: false,
  });
  const [generatingState, setGeneratingState] = useState<OwnedBusyState>({
    ownerId: null,
    patientId: null,
    active: false,
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const mountedRef = useRef(true);
  const activeIdentityRef = useRef({ ownerId, patientId });
  activeIdentityRef.current = { ownerId, patientId };
  const latestInitialTodos = useRef(initialTodos);
  const previousQueuedMutationIdsRef = useRef<Set<string>>(new Set());
  const initialTodosKey = useMemo(() => {
    if (initialTodos === undefined) return null;
    const todoKey = initialTodos
      .map((todo) => `${todo.id}:${todo.updatedAt}:${todo.completed}:${todo.content}`)
      .join('|');
    return `${ownerId ?? ''}:${patientId ?? ''}:${todoKey}`;
  }, [initialTodos, ownerId, patientId]);

  const isActiveRequest = useCallback((requestOwnerId: string, requestPatientId: string) => {
    const activeIdentity = activeIdentityRef.current;
    return mountedRef.current
      && activeIdentity.ownerId === requestOwnerId
      && activeIdentity.patientId === requestPatientId;
  }, []);

  const commitTodos = useCallback((
    requestOwnerId: string,
    requestPatientId: string,
    updater: TodoListUpdater,
  ) => {
    if (!isActiveRequest(requestOwnerId, requestPatientId)) return false;

    setTodoState((currentState) => {
      if (!isActiveRequest(requestOwnerId, requestPatientId)) return currentState;
      const currentTodos = currentState.ownerId === requestOwnerId
        && currentState.patientId === requestPatientId
        ? currentState.todos
        : [];
      return {
        ownerId: requestOwnerId,
        patientId: requestPatientId,
        todos: updater(currentTodos),
      };
    });
    return true;
  }, [isActiveRequest]);

  const todos = useMemo(
    () => todoState.ownerId === ownerId && todoState.patientId === patientId
      ? todoState.todos
      : [],
    [ownerId, patientId, todoState],
  );
  const loading = loadingState.ownerId === ownerId
    && loadingState.patientId === patientId
    && loadingState.active;
  const generating = generatingState.ownerId === ownerId
    && generatingState.patientId === patientId
    && generatingState.active;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    latestInitialTodos.current = initialTodos;
  }, [initialTodos]);

  const fetchTodos = useCallback(async () => {
    if (!patientId || !ownerId) return;
    const requestOwnerId = ownerId;
    const requestPatientId = patientId;
    if (!isActiveRequest(requestOwnerId, requestPatientId)) return;

    setLoadingState({
      ownerId: requestOwnerId,
      patientId: requestPatientId,
      active: true,
    });
    try {
      const { data, error } = await supabase
        .from('patient_todos')
        .select('*')
        .eq('patient_id', requestPatientId)
        .eq('user_id', requestOwnerId)
        .order('created_at', { ascending: false });

      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      if (error) throw error;

      const serverTodos = data?.map(todo => mapTodoRecord(todo, {
        patientId: requestPatientId,
        userId: requestOwnerId,
        section: null,
        content: '',
      })).filter((todo) => (
        todo.userId === requestOwnerId && todo.patientId === requestPatientId
      )) || [];
      const queue = await indexedDBQueue.getQueue();
      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      const nextTodos = applyQueuedTodoMutations(
        serverTodos,
        queue,
        requestOwnerId,
        requestPatientId,
      );
      if (!commitTodos(requestOwnerId, requestPatientId, () => nextTodos)) return;
      writePatientTodosCache(queryClient, requestOwnerId, requestPatientId, () => nextTodos);
    } catch {
      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      console.error('Error fetching patient todos');
    } finally {
      if (isActiveRequest(requestOwnerId, requestPatientId)) {
        setLoadingState({
          ownerId: requestOwnerId,
          patientId: requestPatientId,
          active: false,
        });
      }
    }
  }, [commitTodos, isActiveRequest, ownerId, patientId, queryClient]);

  useEffect(() => {
    if (initialTodos !== undefined) return;
    fetchTodos();
  }, [fetchTodos, initialTodos]);

  useEffect(() => {
    if (initialTodosKey === null) return;
    if (!ownerId || !patientId || !isActiveRequest(ownerId, patientId)) return;
    let cancelled = false;

    void indexedDBQueue.getQueue().then((queue) => {
      if (cancelled || !isActiveRequest(ownerId, patientId)) return;
      const safeInitialTodos = (latestInitialTodos.current ?? []).filter((todo) => (
        todo.userId === ownerId && todo.patientId === patientId
      ));
      const nextTodos = applyQueuedTodoMutations(
        safeInitialTodos,
        queue,
        ownerId,
        patientId,
      );
      commitTodos(ownerId, patientId, () => nextTodos);
      setLoadingState({ ownerId, patientId, active: false });
    }).catch(() => {
      // Keep the current optimistic state if IndexedDB is temporarily unavailable.
    });

    return () => {
      cancelled = true;
    };
  }, [commitTodos, initialTodosKey, isActiveRequest, ownerId, patientId]);

  useEffect(() => {
    previousQueuedMutationIdsRef.current = new Set();
    if (!ownerId || !patientId) return;

    return indexedDBQueue.subscribe((queue) => {
      if (!isActiveRequest(ownerId, patientId)) return;
      const relevant = queue.filter((mutation) => (
        isMutationForPatient(mutation, ownerId, patientId)
      ));
      const currentIds = new Set(relevant.map((mutation) => mutation.id));
      const removed = [...previousQueuedMutationIdsRef.current]
        .some((mutationId) => !currentIds.has(mutationId));
      previousQueuedMutationIdsRef.current = currentIds;

      if (removed) {
        // Reconcile a replayed or cancelled optimistic row with Postgres.
        void fetchTodos();
        return;
      }
      commitTodos(ownerId, patientId, (currentTodos) => (
        applyQueuedTodoMutations(currentTodos, relevant, ownerId, patientId)
      ));
    });
  }, [commitTodos, fetchTodos, isActiveRequest, ownerId, patientId]);

  const addTodo = useCallback(async (content: string, section: string | null = null) => {
    if (!patientId || !ownerId) return;
    const requestOwnerId = ownerId;
    const requestPatientId = patientId;
    if (!isActiveRequest(requestOwnerId, requestPatientId)) return;

    const now = new Date().toISOString();
    const todoId = createTodoId();
    const insertPayload = {
      id: todoId,
      patient_id: requestPatientId,
      user_id: requestOwnerId,
      section,
      content,
      completed: false,
      created_at: now,
      updated_at: now,
    };
    const queuedTodo: PatientTodo = {
      id: todoId,
      patientId: requestPatientId,
      userId: requestOwnerId,
      section,
      content,
      completed: false,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'queued',
      localOnly: true,
    };
    const queueCreate = async (): Promise<PatientTodo> => {
      await indexedDBQueue.enqueue({
        type: 'todo',
        operation: 'create',
        table: 'patient_todos',
        entityId: todoId,
        payload: insertPayload,
      });
      if (!isActiveRequest(requestOwnerId, requestPatientId)) return queuedTodo;
      const applyAddedTodo = prependTodos([queuedTodo]);
      commitTodos(requestOwnerId, requestPatientId, applyAddedTodo);
      writePatientTodosCache(queryClient, requestOwnerId, requestPatientId, applyAddedTodo);
      toast({
        title: 'Offline — todo queued',
        description: 'The task is stored on this device and will sync when connection recovers.',
      });
      return queuedTodo;
    };

    if (isBrowserKnownOffline()) {
      try {
        return await queueCreate();
      } catch {
        toast({
          title: 'Todo not saved',
          description: 'The task could not be stored. Keep the text and retry.',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      const { data, error } = await supabase
        .from('patient_todos')
        .insert(insertPayload)
        .select()
        .single();

      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      if (error) throw error;
      if (data == null) {
        toast({ title: "Error", description: "No data returned from insert", variant: "destructive" });
        return;
      }

      const newTodo = mapTodoRecord(data, {
        patientId: requestPatientId,
        userId: requestOwnerId,
        section,
        content,
      });
      if (newTodo.userId !== requestOwnerId || newTodo.patientId !== requestPatientId) {
        throw new Error('Todo insert returned data for a different owner');
      }

      const applyAddedTodo = prependTodos([newTodo]);
      if (!commitTodos(requestOwnerId, requestPatientId, applyAddedTodo)) return;
      writePatientTodosCache(queryClient, requestOwnerId, requestPatientId, applyAddedTodo);
      return newTodo;
    } catch (error) {
      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      if (isRetryableTodoWriteError(error)) {
        try {
          return await queueCreate();
        } catch {
          // Fall through; the input remains populated for manual recovery.
        }
      }
      console.error('Error adding patient todo');
      toast({
        title: 'Todo not saved',
        description: 'The task could not be saved or queued. Keep the text and retry.',
        variant: "destructive",
      });
    }
  }, [commitTodos, isActiveRequest, ownerId, patientId, queryClient, toast]);

  const toggleTodo = useCallback(async (todoId: string) => {
    if (!ownerId || !patientId) return;
    const requestOwnerId = ownerId;
    const requestPatientId = patientId;
    if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
    const todo = todos.find(t => t.id === todoId);
    if (!todo || todo.userId !== requestOwnerId || todo.patientId !== requestPatientId) return;
    const nextCompleted = !todo.completed;

    const queueToggle = async (): Promise<void> => {
      await indexedDBQueue.enqueue({
        type: 'todo',
        operation: 'update',
        table: 'patient_todos',
        entityId: todoId,
        payload: {
          patient_id: requestPatientId,
          user_id: requestOwnerId,
          completed: nextCompleted,
        },
        conflictData: {
          patient_id: requestPatientId,
          user_id: requestOwnerId,
          updated_at: todo.updatedAt,
        },
      });
      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      const applyToggle = (currentTodos: PatientTodo[]) => currentTodos.map((item) => (
        item.id === todoId
          ? { ...item, completed: nextCompleted, syncStatus: 'queued' as const }
          : item
      ));
      commitTodos(requestOwnerId, requestPatientId, applyToggle);
      writePatientTodosCache(queryClient, requestOwnerId, requestPatientId, applyToggle);
    };

    if (todo.syncStatus || isBrowserKnownOffline()) {
      try {
        await queueToggle();
      } catch {
        toast({
          title: 'Todo not updated',
          description: 'The change could not be stored.',
          variant: 'destructive',
        });
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('patient_todos')
        .update({ completed: nextCompleted })
        .eq('id', todoId);

      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      if (error) throw error;

      const applyToggle = (currentTodos: PatientTodo[]) => currentTodos.map(t =>
        t.id === todoId ? { ...t, completed: nextCompleted } : t
      );

      if (!commitTodos(requestOwnerId, requestPatientId, applyToggle)) return;
      writePatientTodosCache(queryClient, requestOwnerId, requestPatientId, applyToggle);
    } catch (error) {
      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      if (isRetryableTodoWriteError(error)) {
        try {
          await queueToggle();
          return;
        } catch {
          // Fall through; the server value remains visible.
        }
      }
      console.error('Error toggling patient todo');
      toast({
        title: "Error",
        description: "Failed to update todo",
        variant: "destructive",
      });
    }
  }, [commitTodos, isActiveRequest, ownerId, patientId, queryClient, todos, toast]);

  const deleteTodo = useCallback(async (todoId: string) => {
    if (!ownerId || !patientId) return;
    const requestOwnerId = ownerId;
    const requestPatientId = patientId;
    if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
    const todo = todos.find(t => t.id === todoId);
    if (todo && (todo.userId !== requestOwnerId || todo.patientId !== requestPatientId)) return;

    const queueDelete = async (): Promise<void> => {
      await indexedDBQueue.enqueue({
        type: 'todo',
        operation: 'delete',
        table: 'patient_todos',
        entityId: todoId,
        payload: {
          patient_id: requestPatientId,
          user_id: requestOwnerId,
        },
        conflictData: todo ? {
          patient_id: requestPatientId,
          user_id: requestOwnerId,
          updated_at: todo.updatedAt,
        } : undefined,
      });
      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      const applyDelete = (currentTodos: PatientTodo[]) => currentTodos.filter((item) => item.id !== todoId);
      commitTodos(requestOwnerId, requestPatientId, applyDelete);
      writePatientTodosCache(queryClient, requestOwnerId, requestPatientId, applyDelete);
    };

    if (todo?.syncStatus || isBrowserKnownOffline()) {
      try {
        await queueDelete();
      } catch {
        toast({
          title: 'Todo not deleted',
          description: 'The change could not be stored.',
          variant: 'destructive',
        });
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('patient_todos')
        .delete()
        .eq('id', todoId);

      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      if (error) throw error;

      const applyDelete = (currentTodos: PatientTodo[]) => currentTodos.filter(t => t.id !== todoId);
      if (!commitTodos(requestOwnerId, requestPatientId, applyDelete)) return;
      writePatientTodosCache(queryClient, requestOwnerId, requestPatientId, applyDelete);
    } catch (error) {
      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      if (isRetryableTodoWriteError(error)) {
        try {
          await queueDelete();
          return;
        } catch {
          // Fall through; the task remains visible.
        }
      }
      console.error('Error deleting patient todo');
      toast({
        title: "Error",
        description: "Failed to delete todo",
        variant: "destructive",
      });
    }
  }, [commitTodos, isActiveRequest, ownerId, patientId, queryClient, todos, toast]);

  const generateTodos = useCallback(async (patient: Patient, section: TodoSection) => {
    if (!patientId || !ownerId) return;
    const requestOwnerId = ownerId;
    const requestPatientId = patientId;
    if (!isActiveRequest(requestOwnerId, requestPatientId)) return;

    setGeneratingState({
      ownerId: requestOwnerId,
      patientId: requestPatientId,
      active: true,
    });
    try {
      const bankId = `clinician:${requestOwnerId}`;

      const recalled = await recallMemories({
        bankId,
        query: 'todo preferences and style',
        filters: {
          feature: 'todos',
          section,
        },
        limit: 6,
      });
      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;

      const styleSummary = recalled?.memories
        ?.map((memory) => memory.content)
        .filter(Boolean)
        .join('\n---\n');

      const { data, error } = await withCategoryTimeout(
        supabase.functions.invoke('generate-todos', {
          body: {
            patientData: {
              name: patient.name,
              bed: patient.bed,
              clinicalSummary: patient.clinicalSummary,
              intervalEvents: patient.intervalEvents,
              imaging: patient.imaging,
              labs: patient.labs,
              systems: patient.systems,
            },
            section,
            styleSummary,
          },
        }),
        'aiEdgeFunction',
        'generate-todos',
      );

      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      const generatedTodos: string[] = data.todos || [];

      if (generatedTodos.length === 0) {
        toast({
          title: "No todos generated",
          description: "Add more content to generate relevant todos.",
        });
        return;
      }

      // Batch insert all generated todos for better performance
      const sectionValue = section === 'all' ? null : section;

      const todosToInsert = generatedTodos.map(content => ({
        patient_id: requestPatientId,
        user_id: requestOwnerId,
        section: sectionValue,
        content,
        completed: false,
      }));

      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      const { data: insertedData, error: insertError } = await supabase
        .from('patient_todos')
        .insert(todosToInsert)
        .select();

      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      if (insertError) throw insertError;

      // Map inserted data to PatientTodo format and add to state
      const newTodos: PatientTodo[] = (insertedData || []).map((todo, index) => mapTodoRecord(todo, {
        patientId: requestPatientId,
        userId: requestOwnerId,
        section: sectionValue,
        content: generatedTodos[index] ?? '',
      })).filter((todo) => (
        todo.userId === requestOwnerId && todo.patientId === requestPatientId
      ));
      const orderedNewTodos = [...newTodos].reverse();
      const applyGeneratedTodos = prependTodos(orderedNewTodos);

      if (!commitTodos(requestOwnerId, requestPatientId, applyGeneratedTodos)) return;
      writePatientTodosCache(queryClient, requestOwnerId, requestPatientId, applyGeneratedTodos);

      toast({
        title: "Todos generated",
        description: `Added ${newTodos.length} new todo items.`,
      });

      if (newTodos.length > 0) {
        const content = [
          `Patient: ${patient.name || `Bed ${patient.bed}`}`,
          `Section: ${section}`,
          `Generated todos:\n${newTodos.map((t) => `- ${t.content}`).join('\n')}`,
        ].join('\n\n');

        void retainMemory({
          bankId,
          content,
          metadata: {
            feature: 'todos',
            section,
            source: 'generate-todos',
          },
        });
      }
    } catch (error) {
      if (!isActiveRequest(requestOwnerId, requestPatientId)) return;
      console.error('Error generating patient todos');
      toast({
        title: "Error",
        description: getUserFacingErrorMessage(error, 'Failed to generate todos'),
        variant: "destructive",
      });
    } finally {
      if (isActiveRequest(requestOwnerId, requestPatientId)) {
        setGeneratingState({
          ownerId: requestOwnerId,
          patientId: requestPatientId,
          active: false,
        });
      }
    }
  }, [commitTodos, isActiveRequest, ownerId, patientId, queryClient, toast]);

  const getTodosBySection = useCallback((section: string | null) => {
    return todos.filter(t => t.section === section);
  }, [todos]);

  const getPatientWideTodos = useCallback(() => {
    return todos.filter(t => t.section === null);
  }, [todos]);

  return {
    todos,
    loading,
    generating,
    addTodo,
    toggleTodo,
    deleteTodo,
    generateTodos,
    getTodosBySection,
    getPatientWideTodos,
    refetch: fetchTodos,
  };
}

/** Lifted state shape for desktop tasks rail + PatientCard sharing one todo source. */
export type PatientTodosApi = ReturnType<typeof usePatientTodos>;
