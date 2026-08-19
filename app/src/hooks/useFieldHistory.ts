import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { logError } from "@/lib/observability/logger";
export interface FieldHistoryEntry {
  id: string;
  patientId: string;
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
}

export const useFieldHistory = (patientId: string) => {
  const [history, setHistory] = React.useState<FieldHistoryEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const { user } = useAuth();

  const fetchHistory = React.useCallback(async (fieldName?: string) => {
    if (!user || !patientId) return;

    setLoading(true);
    try {
      let query = supabase
        .from("patient_field_history")
        .select("*")
        .eq("patient_id", patientId)
        .eq("user_id", user.id)
        .order("changed_at", { ascending: false })
        .limit(50);

      if (fieldName) {
        query = query.eq("field_name", fieldName);
      }

      const { data, error } = await query;

      if (error) throw error;

      setHistory(
        (data || []).map((entry) => ({
          id: entry.id,
          patientId: entry.patient_id,
          fieldName: entry.field_name,
          oldValue: entry.old_value,
          newValue: entry.new_value,
          changedAt: entry.changed_at,
        }))
      );
    } catch {
      logError("patient.field_history.fetch_failed");
    } finally {
      setLoading(false);
    }
  }, [user, patientId]);

  const addHistoryEntry = React.useCallback(async (
    fieldName: string,
    oldValue: string | null,
    newValue: string | null
  ) => {
    if (!user || !patientId) return false;

    // Don't record if values are the same
    if (oldValue === newValue) return true;

    try {
      const { error } = await supabase.from("patient_field_history").insert({
        patient_id: patientId,
        user_id: user.id,
        field_name: fieldName,
        old_value: oldValue,
        new_value: newValue,
      });
      if (error) throw error;
      return true;
    } catch {
      logError("patient.field_history.insert_failed");
      return false;
    }
  }, [user, patientId]);

  const clearHistory = React.useCallback(async (fieldName?: string) => {
    if (!user || !patientId) return false;

    try {
      let query = supabase
        .from("patient_field_history")
        .delete()
        .eq("patient_id", patientId)
        .eq("user_id", user.id);

      if (fieldName) {
        query = query.eq("field_name", fieldName);
      }

      const { error } = await query;
      if (error) throw error;
      setHistory((current) => fieldName
        ? current.filter((entry) => entry.fieldName !== fieldName)
        : []
      );
      return true;
    } catch {
      logError("patient.field_history.delete_failed");
      return false;
    }
  }, [user, patientId]);

  return {
    history,
    loading,
    fetchHistory,
    addHistoryEntry,
    clearHistory,
  };
};
