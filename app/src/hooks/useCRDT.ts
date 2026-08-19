/**
 * CRDT-based local editing with Yjs, IndexedDB, and RLS-protected table sync.
 * Public Realtime broadcast is disabled until private topic authorization is
 * implemented.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface CRDTDoc {
  id: string;
  content: string;
  lastModified: Date;
  version: number;
}

export interface CRDTObserver {
  onSync: (content: string) => void;
  onConflict?: (localContent: string, remoteContent: string) => void;
  onError?: (error: Error) => void;
}

export interface UseCRDTOptions {
  tableName: string;
  idField: string;
  contentField: string;
  supabase: SupabaseClient;
  autoSync?: boolean;
  syncInterval?: number;
}

export interface UseCRDTReturn {
  content: string;
  isSyncing: boolean;
  isDirty: boolean;
  lastSynced: Date | null;
  version: number;
  update: (newContent: string) => void;
  sync: () => Promise<void>;
  reset: () => void;
  destroy: () => void;
}

export function useCRDT(
  docId: string,
  initialContent: string,
  options: CRDTObserver,
  crdtOptions: UseCRDTOptions
): UseCRDTReturn {
  const { onSync, onConflict, onError } = options;
  const { tableName, idField, contentField, supabase, autoSync = true, syncInterval = 5000 } = crdtOptions;

  // Store callbacks in refs so the effect doesn't re-subscribe when they change
  const onSyncRef = useRef(onSync);
  const onConflictRef = useRef(onConflict);
  const onErrorRef = useRef(onError);
  onSyncRef.current = onSync;
  onConflictRef.current = onConflict;
  onErrorRef.current = onError;

  const ydocRef = useRef<Y.Doc | null>(null);
  const ytextRef = useRef<Y.Text | null>(null);
  const persistenceRef = useRef<IndexeddbPersistence | null>(null);
  const isRemoteUpdate = useRef(false);
  const isDirtyRef = useRef(false);

  const [content, setContent] = useState(initialContent);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    ydocRef.current = new Y.Doc();
    ytextRef.current = ydocRef.current.getText('content');

    persistenceRef.current = new IndexeddbPersistence(`crdt-${tableName}-${docId}`, ydocRef.current);
    persistenceRef.current.on('synced', () => {
      setContent(ytextRef.current?.toString() || '');
      setIsDirty(false);
      isDirtyRef.current = false;
      if (autoSync) {
        void syncFromServer();
      }
    });

    const handleLocalChange = () => {
      if (!isRemoteUpdate.current && ytextRef.current) {
        const newContent = ytextRef.current.toString();
        setContent(newContent);
        setIsDirty(true);
        isDirtyRef.current = true;
        onSyncRef.current(newContent);
      }
    };

    ytextRef.current.observe(handleLocalChange);

    const syncIntervalId = autoSync
      ? setInterval(() => {
          if (isDirtyRef.current) {
            void syncToServer();
          }
        }, syncInterval)
      : null;

    return () => {
      if (syncIntervalId) clearInterval(syncIntervalId);
      ytextRef.current?.unobserve(handleLocalChange);
      persistenceRef.current?.destroy();
      ydocRef.current?.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- sync callbacks use the same lifecycle keys listed here
  }, [docId, tableName, idField, contentField, autoSync, syncInterval, supabase]);

  const syncFromServer = useCallback(async () => {
    if (!docId || !supabase) return;

    setIsSyncing(true);
    try {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .eq(idField, docId)
        .single();

      if (error) throw error;

      if (data && ydocRef.current && ytextRef.current) {
        const remoteContent = (data as unknown as Record<string, unknown>)[contentField];
        const localContent = ytextRef.current.toString();

        if (typeof remoteContent !== 'string') {
          throw new Error(`Expected ${contentField} to contain text`);
        }

        if (remoteContent !== localContent) {
          if (onConflictRef.current && remoteContent) {
            onConflictRef.current(localContent, remoteContent);
          }

          isRemoteUpdate.current = true;
          try {
            ydocRef.current.transact(() => {
              ytextRef.current?.delete(0, ytextRef.current.length);
              ytextRef.current?.insert(0, remoteContent);
            });
          } finally {
            isRemoteUpdate.current = false;
          }

          setContent(remoteContent);
          setVersion((v) => v + 1);
        }

        setLastSynced(new Date());
      }
    } catch (err) {
      onErrorRef.current?.(err as Error);
    } finally {
      setIsSyncing(false);
    }
  }, [docId, tableName, idField, contentField, supabase]);

  const syncToServer = useCallback(async () => {
    if (!docId || !supabase || !isDirtyRef.current) return;

    setIsSyncing(true);
    try {
      const currentContent = ytextRef.current?.toString() || '';

      const { error } = await supabase
        .from(tableName)
        .update({
          [contentField]: currentContent,
          updated_at: new Date().toISOString(),
        })
        .eq(idField, docId);

      if (error) throw error;

      setIsDirty(false);
      isDirtyRef.current = false;
      setLastSynced(new Date());
    } catch (err) {
      onErrorRef.current?.(err as Error);
    } finally {
      setIsSyncing(false);
    }
  }, [docId, tableName, idField, contentField, supabase]);

  const update = useCallback(
    (newContent: string) => {
      if (ytextRef.current && ydocRef.current && !isRemoteUpdate.current) {
        ydocRef.current.transact(() => {
          ytextRef.current?.delete(0, ytextRef.current.length);
          ytextRef.current?.insert(0, newContent);
        });
        setContent(newContent);
        setIsDirty(true);
        isDirtyRef.current = true;
        setVersion((v) => v + 1);
      }
    },
    []
  );

  const sync = useCallback(async () => {
    await syncToServer();
    await syncFromServer();
  }, [syncToServer, syncFromServer]);

  const reset = useCallback(() => {
    if (ytextRef.current && ydocRef.current) {
      ydocRef.current.transact(() => {
        ytextRef.current?.delete(0, ytextRef.current.length);
        ytextRef.current?.insert(0, initialContent);
      });
      setContent(initialContent);
      setIsDirty(false);
      isDirtyRef.current = false;
    }
  }, [initialContent]);

  const destroy = useCallback(() => {
    persistenceRef.current?.destroy();
    ydocRef.current?.destroy();
  }, []);

  return {
    content,
    isSyncing,
    isDirty,
    lastSynced,
    version,
    update,
    sync,
    reset,
    destroy,
  };
}
