import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { getUserFacingErrorMessage } from "@/lib/userFacingErrors";
import { logError } from "@/lib/observability/logger";

export type ActivityAction = 'created' | 'updated' | 'assigned' | 'exported' | 'ai_used';

interface PatientActivityRow {
  id: string;
  patient_id: string;
  user_id: string | null;
  action: string;
  field_name: string | null;
  summary: string | null;
  created_at: string;
}

export interface PatientActivityEntry {
  id: string;
  patientId: string;
  userId: string | null;
  action: ActivityAction;
  fieldName: string | null;
  summary: string | null;
  createdAt: string;
  userName?: string;
}

function getErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function isTransientActivityError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const code = getErrorCode(error);
  if (code === "57014" || code === "PGRST301") return true;
  return (
    message.includes("failed to fetch") ||
    message.includes("network") ||
    message.includes("timeout") ||
    message.includes("503") ||
    message.includes("502")
  );
}

export const usePatientActivity = (patientId: string) => {
  const [activities, setActivities] = React.useState<PatientActivityEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errorDetail, setErrorDetail] = React.useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = React.useState<number | null>(null);
  const lastLimitRef = React.useRef(10);
  const requestIdRef = React.useRef(0);
  const { user } = useAuth();

  const fetchActivities = React.useCallback(async (limit: number = 10, attempt = 0) => {
    if (!patientId) return;

    const requestId = ++requestIdRef.current;
    lastLimitRef.current = limit;
    setLoading(true);
    setError(null);
    setErrorDetail(null);
    try {
      const { data, error: queryError } = await supabase
        .from("patient_activity")
        .select("id, patient_id, user_id, action, field_name, summary, created_at")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (queryError) throw queryError;

      if (requestId !== requestIdRef.current) return;
      setActivities(
        ((data as PatientActivityRow[] | null) || []).map((entry) => ({
          id: entry.id,
          patientId: entry.patient_id,
          userId: entry.user_id,
          action: entry.action as ActivityAction,
          fieldName: entry.field_name,
          summary: entry.summary,
          createdAt: entry.created_at,
        }))
      );
      setLastFetchedAt(Date.now());
    } catch (fetchError) {
      if (requestId !== requestIdRef.current) return;

      if (attempt < 1 && isTransientActivityError(fetchError)) {
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
        if (requestId !== requestIdRef.current) return;
        await fetchActivities(limit, attempt + 1);
        return;
      }

      const detail =
        fetchError instanceof Error
          ? fetchError.message
          : typeof fetchError === "object" && fetchError !== null && "message" in fetchError
            ? String((fetchError as { message: unknown }).message)
            : String(fetchError);
      const code = getErrorCode(fetchError);
      const hasSession = Boolean(user);

      logError("patient.activity.fetch_failed", {
        patientId,
        attempt,
        code,
        message: detail,
        hasSession,
      });
      setErrorDetail(
        [
          !hasSession ? "No authenticated session" : null,
          code ? `code=${code}` : null,
          detail,
        ].filter(Boolean).join(" · "),
      );
      setError(getUserFacingErrorMessage(fetchError, "Patient activity could not be loaded. Please try again."));
      // Preserve previous activities and lastFetchedAt on refresh failure.
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [patientId, user]);

  const retry = React.useCallback(async () => {
    await fetchActivities(lastLimitRef.current);
  }, [fetchActivities]);

  React.useEffect(() => {
    requestIdRef.current += 1;
    setActivities([]);
    setError(null);
    setErrorDetail(null);
    setLastFetchedAt(null);
    setLoading(false);
  }, [patientId]);

  const addActivity = React.useCallback(async (
    action: ActivityAction,
    options?: {
      fieldName?: string;
      summary?: string;
    }
  ) => {
    if (!user || !patientId) return false;

    try {
      const { error: insertError } = await supabase.from("patient_activity").insert({
        patient_id: patientId,
        user_id: user.id,
        action,
        field_name: options?.fieldName || null,
        summary: options?.summary || null,
      });
      if (insertError) throw insertError;
      return true;
    } catch (insertError) {
      const detail =
        insertError instanceof Error
          ? insertError.message
          : typeof insertError === "object" && insertError !== null && "message" in insertError
            ? String((insertError as { message: unknown }).message)
            : String(insertError);
      logError("patient.activity.insert_failed", {
        patientId,
        action,
        message: detail,
        code: getErrorCode(insertError),
      });
      return false;
    }
  }, [user, patientId]);

  const recordPatientCreated = React.useCallback(async () => {
    await addActivity('created');
  }, [addActivity]);

  const recordFieldUpdate = React.useCallback(async (fieldName: string) => {
    await addActivity('updated', { fieldName });
  }, [addActivity]);

  const recordAssignment = React.useCallback(async (assignedTo: string) => {
    await addActivity('assigned', { summary: assignedTo });
  }, [addActivity]);

  const recordExport = React.useCallback(async (exportType: string) => {
    await addActivity('exported', { summary: exportType });
  }, [addActivity]);

  const recordAIUse = React.useCallback(async (action: string) => {
    await addActivity('ai_used', { summary: action });
  }, [addActivity]);

  return {
    activities,
    loading,
    error,
    errorDetail,
    lastFetchedAt,
    fetchActivities,
    retry,
    addActivity,
    recordPatientCreated,
    recordFieldUpdate,
    recordAssignment,
    recordExport,
    recordAIUse,
  };
};
