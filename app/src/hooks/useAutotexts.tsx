import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useToast } from "./use-toast";
import { defaultAutotexts, defaultTemplates } from "@/data/autotexts";
import type { AutoText, Template } from "@/types/autotext";

interface AutotextState {
  ownerId: string | null;
  autotexts: AutoText[];
  templates: Template[];
  loading: boolean;
}

function defaultState(ownerId: string | null, loading: boolean): AutotextState {
  return {
    ownerId,
    autotexts: defaultAutotexts,
    templates: defaultTemplates,
    loading,
  };
}

export const useCloudAutotexts = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const ownerId = user?.id ?? null;
  const ownerIdRef = React.useRef(ownerId);
  ownerIdRef.current = ownerId;

  const [state, setState] = React.useState<AutotextState>(() => defaultState(null, true));
  const stateBelongsToOwner = state.ownerId === ownerId;
  const autotexts = stateBelongsToOwner ? state.autotexts : defaultAutotexts;
  const templates = stateBelongsToOwner ? state.templates : defaultTemplates;
  const loading = stateBelongsToOwner ? state.loading : true;

  const isCurrentOwner = React.useCallback(
    (operationOwnerId: string | null) => ownerIdRef.current === operationOwnerId,
    [],
  );

  // Fetch custom autotexts and templates from the database. The owner captured
  // for this request must still be current before any response reaches state.
  const fetchData = React.useCallback(async (): Promise<boolean> => {
    const operationOwnerId = ownerId;
    if (!isCurrentOwner(operationOwnerId)) return false;

    if (!operationOwnerId) {
      setState(defaultState(null, false));
      return true;
    }

    setState((previous) => (
      previous.ownerId === operationOwnerId
        ? { ...previous, loading: true }
        : defaultState(operationOwnerId, true)
    ));

    try {
      const [autotextsRes, templatesRes] = await Promise.all([
        supabase.from("autotexts").select("*"),
        supabase.from("templates").select("*"),
      ]);
      if (!isCurrentOwner(operationOwnerId)) return false;

      if (autotextsRes.error) throw autotextsRes.error;
      if (templatesRes.error) throw templatesRes.error;

      const customAutotexts: AutoText[] = (autotextsRes.data || []).map((autotext) => ({
        shortcut: autotext.shortcut,
        expansion: autotext.expansion,
        category: autotext.category,
      }));

      const customShortcuts = new Set(customAutotexts.map((autotext) => autotext.shortcut.toLowerCase()));
      const filteredDefaults = defaultAutotexts.filter(
        (autotext) => !customShortcuts.has(autotext.shortcut.toLowerCase()),
      );

      const customTemplates: Template[] = (templatesRes.data || []).map((template) => ({
        id: template.id,
        name: template.name,
        category: template.category,
        content: template.content,
      }));

      setState((previous) => {
        if (!isCurrentOwner(operationOwnerId) || previous.ownerId !== operationOwnerId) return previous;
        return {
          ownerId: operationOwnerId,
          autotexts: [...filteredDefaults, ...customAutotexts],
          templates: [...defaultTemplates, ...customTemplates],
          loading: false,
        };
      });
      return true;
    } catch (error) {
      if (!isCurrentOwner(operationOwnerId)) return false;
      console.error("Error fetching autotexts:", error);
      return false;
    } finally {
      if (isCurrentOwner(operationOwnerId)) {
        setState((previous) => (
          previous.ownerId === operationOwnerId ? { ...previous, loading: false } : previous
        ));
      }
    }
  }, [isCurrentOwner, ownerId]);

  React.useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const addAutotext = React.useCallback(async (
    shortcut: string,
    expansion: string,
    category: string,
  ): Promise<boolean> => {
    const operationOwnerId = ownerId;
    if (!operationOwnerId || !isCurrentOwner(operationOwnerId)) return false;

    const normalizedShortcut = shortcut.toLowerCase();
    const exists = autotexts.some((autotext) => autotext.shortcut.toLowerCase() === normalizedShortcut);
    if (exists) {
      toast({
        title: "Shortcut exists",
        description: "This shortcut already exists.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const { error } = await supabase.from("autotexts").insert({
        user_id: operationOwnerId,
        shortcut: normalizedShortcut,
        expansion,
        category,
      });
      if (!isCurrentOwner(operationOwnerId)) return false;
      if (error) throw error;

      setState((previous) => {
        if (!isCurrentOwner(operationOwnerId) || previous.ownerId !== operationOwnerId) return previous;
        return {
          ...previous,
          autotexts: [...previous.autotexts, { shortcut: normalizedShortcut, expansion, category }],
        };
      });
      if (!isCurrentOwner(operationOwnerId)) return false;
      toast({ title: "Autotext added" });
      return true;
    } catch (error) {
      if (!isCurrentOwner(operationOwnerId)) return false;
      console.error("Error adding autotext:", error);
      toast({
        title: "Error",
        description: "Failed to add autotext.",
        variant: "destructive",
      });
      return false;
    }
  }, [autotexts, isCurrentOwner, ownerId, toast]);

  const removeAutotext = React.useCallback(async (shortcut: string): Promise<void> => {
    const operationOwnerId = ownerId;
    if (!operationOwnerId || !isCurrentOwner(operationOwnerId)) return;
    const normalizedShortcut = shortcut.toLowerCase();

    try {
      const { error } = await supabase
        .from("autotexts")
        .delete()
        .eq("shortcut", normalizedShortcut)
        .eq("user_id", operationOwnerId);
      if (!isCurrentOwner(operationOwnerId)) return;
      if (error) throw error;

      setState((previous) => {
        if (!isCurrentOwner(operationOwnerId) || previous.ownerId !== operationOwnerId) return previous;
        const defaultAutotext = defaultAutotexts.find(
          (autotext) => autotext.shortcut.toLowerCase() === normalizedShortcut,
        );
        return {
          ...previous,
          autotexts: defaultAutotext
            ? previous.autotexts.map((autotext) => (
                autotext.shortcut.toLowerCase() === normalizedShortcut ? defaultAutotext : autotext
              ))
            : previous.autotexts.filter(
                (autotext) => autotext.shortcut.toLowerCase() !== normalizedShortcut,
              ),
        };
      });
      if (!isCurrentOwner(operationOwnerId)) return;
      toast({ title: "Autotext removed" });
    } catch (error) {
      if (!isCurrentOwner(operationOwnerId)) return;
      console.error("Error removing autotext:", error);
    }
  }, [isCurrentOwner, ownerId, toast]);

  const addTemplate = React.useCallback(async (
    name: string,
    content: string,
    category: string,
  ): Promise<boolean> => {
    const operationOwnerId = ownerId;
    if (!operationOwnerId || !isCurrentOwner(operationOwnerId)) return false;

    try {
      const { data, error } = await supabase
        .from("templates")
        .insert({
          user_id: operationOwnerId,
          name,
          content,
          category,
        })
        .select()
        .single();
      if (!isCurrentOwner(operationOwnerId)) return false;
      if (error) throw error;

      setState((previous) => {
        if (!isCurrentOwner(operationOwnerId) || previous.ownerId !== operationOwnerId) return previous;
        return {
          ...previous,
          templates: [...previous.templates, { id: data.id, name, content, category }],
        };
      });
      if (!isCurrentOwner(operationOwnerId)) return false;
      toast({ title: "Template added" });
      return true;
    } catch (error) {
      if (!isCurrentOwner(operationOwnerId)) return false;
      console.error("Error adding template:", error);
      toast({
        title: "Error",
        description: "Failed to add template.",
        variant: "destructive",
      });
      return false;
    }
  }, [isCurrentOwner, ownerId, toast]);

  const removeTemplate = React.useCallback(async (id: string): Promise<void> => {
    const operationOwnerId = ownerId;
    if (!operationOwnerId || !isCurrentOwner(operationOwnerId)) return;

    if (defaultTemplates.some((template) => template.id === id)) {
      toast({
        title: "Cannot remove",
        description: "Default templates cannot be removed.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("templates")
        .delete()
        .eq("id", id)
        .eq("user_id", operationOwnerId);
      if (!isCurrentOwner(operationOwnerId)) return;
      if (error) throw error;

      setState((previous) => {
        if (!isCurrentOwner(operationOwnerId) || previous.ownerId !== operationOwnerId) return previous;
        return { ...previous, templates: previous.templates.filter((template) => template.id !== id) };
      });
      if (!isCurrentOwner(operationOwnerId)) return;
      toast({ title: "Template removed" });
    } catch (error) {
      if (!isCurrentOwner(operationOwnerId)) return;
      console.error("Error removing template:", error);
    }
  }, [isCurrentOwner, ownerId, toast]);

  const getExpansion = React.useCallback((shortcut: string): string | null => {
    const normalizedShortcut = shortcut.toLowerCase();
    const autotext = autotexts.find((entry) => entry.shortcut.toLowerCase() === normalizedShortcut);
    return autotext?.expansion || null;
  }, [autotexts]);

  return {
    autotexts,
    templates,
    loading,
    addAutotext,
    removeAutotext,
    addTemplate,
    removeTemplate,
    getExpansion,
    refetch: fetchData,
  };
};
