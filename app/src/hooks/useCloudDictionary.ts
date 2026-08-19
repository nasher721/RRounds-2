import { useCallback, useRef, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";

export type DictionaryEntry = {
  misspelling: string;
  correction: string;
};

interface DictionaryState {
  ownerId: string | null;
  entries: Record<string, string>;
  loading: boolean;
}

function emptyState(ownerId: string | null, loading: boolean): DictionaryState {
  return { ownerId, entries: {}, loading };
}

export const useCloudDictionary = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const ownerId = user?.id ?? null;
  const ownerIdRef = useRef(ownerId);
  ownerIdRef.current = ownerId;

  const [state, setState] = useState<DictionaryState>(() => emptyState(null, true));
  const stateBelongsToOwner = state.ownerId === ownerId;
  const customDictionary = stateBelongsToOwner ? state.entries : {};
  const loading = stateBelongsToOwner ? state.loading : true;

  const isCurrentOwner = useCallback(
    (operationOwnerId: string | null) => ownerIdRef.current === operationOwnerId,
    [],
  );

  const fetchDictionary = useCallback(async (): Promise<boolean> => {
    const operationOwnerId = ownerId;
    if (!isCurrentOwner(operationOwnerId)) return false;

    if (!operationOwnerId) {
      setState(emptyState(null, false));
      return true;
    }

    setState((previous) => (
      previous.ownerId === operationOwnerId
        ? { ...previous, loading: true }
        : emptyState(operationOwnerId, true)
    ));

    try {
      const { data, error } = await supabase
        .from("user_dictionary")
        .select("misspelling, correction");
      if (!isCurrentOwner(operationOwnerId)) return false;
      if (error) throw error;

      const entries: Record<string, string> = {};
      (data || []).forEach((entry) => {
        entries[entry.misspelling.toLowerCase()] = entry.correction;
      });
      setState((previous) => {
        if (!isCurrentOwner(operationOwnerId) || previous.ownerId !== operationOwnerId) return previous;
        return { ownerId: operationOwnerId, entries, loading: false };
      });
      return true;
    } catch (error) {
      if (!isCurrentOwner(operationOwnerId)) return false;
      console.error("Error fetching dictionary:", error);
      return false;
    } finally {
      if (isCurrentOwner(operationOwnerId)) {
        setState((previous) => (
          previous.ownerId === operationOwnerId ? { ...previous, loading: false } : previous
        ));
      }
    }
  }, [isCurrentOwner, ownerId]);

  useEffect(() => {
    void fetchDictionary();
  }, [fetchDictionary]);

  const addEntry = useCallback(async (misspelling: string, correction: string): Promise<boolean> => {
    const operationOwnerId = ownerId;
    if (!operationOwnerId || !isCurrentOwner(operationOwnerId)) return false;
    const key = misspelling.toLowerCase();

    try {
      const { error } = await supabase.from("user_dictionary").upsert({
        user_id: operationOwnerId,
        misspelling: key,
        correction,
      }, { onConflict: "user_id,misspelling" });
      if (!isCurrentOwner(operationOwnerId)) return false;
      if (error) throw error;

      setState((previous) => {
        if (!isCurrentOwner(operationOwnerId) || previous.ownerId !== operationOwnerId) return previous;
        return { ...previous, entries: { ...previous.entries, [key]: correction } };
      });
      return true;
    } catch (error) {
      if (!isCurrentOwner(operationOwnerId)) return false;
      console.error("Error adding dictionary entry:", error);
      toast({
        title: "Error",
        description: "Failed to save dictionary entry.",
        variant: "destructive",
      });
      return false;
    }
  }, [isCurrentOwner, ownerId, toast]);

  const removeEntry = useCallback(async (misspelling: string): Promise<void> => {
    const operationOwnerId = ownerId;
    if (!operationOwnerId || !isCurrentOwner(operationOwnerId)) return;
    const key = misspelling.toLowerCase();

    try {
      const { error } = await supabase
        .from("user_dictionary")
        .delete()
        .eq("misspelling", key)
        .eq("user_id", operationOwnerId);
      if (!isCurrentOwner(operationOwnerId)) return;
      if (error) throw error;

      setState((previous) => {
        if (!isCurrentOwner(operationOwnerId) || previous.ownerId !== operationOwnerId) return previous;
        const entries = { ...previous.entries };
        delete entries[key];
        return { ...previous, entries };
      });
    } catch (error) {
      if (!isCurrentOwner(operationOwnerId)) return;
      console.error("Error removing dictionary entry:", error);
    }
  }, [isCurrentOwner, ownerId]);

  const importDictionary = useCallback(async (entries: Record<string, string>): Promise<boolean> => {
    const operationOwnerId = ownerId;
    if (!operationOwnerId || !isCurrentOwner(operationOwnerId)) return false;

    try {
      const upsertData = Object.entries(entries).map(([misspelling, correction]) => ({
        user_id: operationOwnerId,
        misspelling: misspelling.toLowerCase(),
        correction,
      }));

      const chunkSize = 100;
      for (let index = 0; index < upsertData.length; index += chunkSize) {
        if (!isCurrentOwner(operationOwnerId)) return false;
        const chunk = upsertData.slice(index, index + chunkSize);
        const { error } = await supabase
          .from("user_dictionary")
          .upsert(chunk, { onConflict: "user_id,misspelling" });
        if (!isCurrentOwner(operationOwnerId)) return false;
        if (error) throw error;
      }

      if (!isCurrentOwner(operationOwnerId)) return false;
      const refreshed = await fetchDictionary();
      if (!isCurrentOwner(operationOwnerId) || !refreshed) return false;
      toast({ title: "Dictionary imported", description: `${upsertData.length} entries saved.` });
      return true;
    } catch (error) {
      if (!isCurrentOwner(operationOwnerId)) return false;
      console.error("Error importing dictionary:", error);
      toast({
        title: "Error",
        description: "Failed to import dictionary.",
        variant: "destructive",
      });
      return false;
    }
  }, [fetchDictionary, isCurrentOwner, ownerId, toast]);

  return {
    customDictionary,
    loading,
    addEntry,
    removeEntry,
    importDictionary,
    refetch: fetchDictionary,
  };
};
