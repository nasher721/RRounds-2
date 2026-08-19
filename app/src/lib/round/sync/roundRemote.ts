/**
 * Supabase persistence for Round session state (`round_state`).
 * Soft-fails when the table is missing so local outbox still works.
 */

import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { Round } from "@/types/round";
import type { RoundContinuityMeta, RoundStateRemoteRow } from "./types";
import { normalizeContinuityMeta } from "./roundSessionCache";

export interface UpsertRoundStateInput {
  round: Round;
  continuity: RoundContinuityMeta;
}

const ROUND_STATE_SELECT_COLUMNS = [
  "id",
  "user_id",
  "status",
  "state",
  "position_updated_at",
  "expanded_updated_at",
  "device_id",
  "created_at",
  "updated_at",
].join(", ");

const isMissingTableError = (error: { code?: string; message?: string } | null): boolean => {
  if (!error) return false;
  const message = (error.message ?? "").toLowerCase();
  return (
    error.code === "42P01"
    || error.code === "PGRST205"
    || message.includes("round_state")
    || message.includes("upsert_owned_round_state")
    || message.includes("schema cache")
  );
};

export const roundToRemoteState = (
  round: Round,
  continuity: RoundContinuityMeta,
): Record<string, unknown> => ({
  id: round.id,
  userId: round.userId,
  status: round.status,
  patients: round.patients,
  currentIndex: round.currentIndex,
  filters: round.filters,
  activeSection: round.activeSection,
  expandedSystemId: round.expandedSystemId,
  createdAt: round.createdAt,
  updatedAt: round.updatedAt,
  continuity,
});

export const remoteStateToRoundParts = (
  row: RoundStateRemoteRow,
): { round: Round; continuity: RoundContinuityMeta } | null => {
  const state = row.state ?? {};
  const continuityFromState = (state.continuity ?? {}) as Partial<RoundContinuityMeta>;
  const patients = Array.isArray(state.patients) ? state.patients : [];
  if (typeof state.id !== "string" && !row.id) return null;

  const round: Round = {
    id: typeof state.id === "string" ? state.id : row.id,
    userId: typeof state.userId === "string" ? state.userId : row.user_id,
    status: state.status === "completed" ? "completed" : "active",
    patients: patients as Round["patients"],
    currentIndex: typeof state.currentIndex === "number" ? state.currentIndex : -1,
    filters: (state.filters as Round["filters"]) ?? {
      search: "",
      hideDone: false,
      hideSkipped: false,
    },
    activeSection:
      state.activeSection === "systems" || state.activeSection === "todos"
        ? state.activeSection
        : "clinicalSummary",
    expandedSystemId:
      typeof state.expandedSystemId === "string" ? state.expandedSystemId : null,
    syncStatus: "idle",
    createdAt: typeof state.createdAt === "string" ? state.createdAt : row.created_at,
    updatedAt: typeof state.updatedAt === "string" ? state.updatedAt : row.updated_at,
  };

  return {
    round,
    continuity: normalizeContinuityMeta(
      {
        positionUpdatedAt:
          row.position_updated_at
          || continuityFromState.positionUpdatedAt
          || round.updatedAt,
        expandedUpdatedAt:
          row.expanded_updated_at
          || continuityFromState.expandedUpdatedAt
          || round.updatedAt,
        filtersUpdatedAt: continuityFromState.filtersUpdatedAt,
        sectionUpdatedAt: continuityFromState.sectionUpdatedAt,
        deviceId: row.device_id || continuityFromState.deviceId || "remote",
      },
      round.updatedAt,
    ),
  };
};

const fetchRemoteRoundByStatus = async (
  userId: string,
  status: Round["status"],
): Promise<{ round: Round; continuity: RoundContinuityMeta } | null> => {
  const { data, error } = await supabase
    .from("round_state")
    .select(ROUND_STATE_SELECT_COLUMNS)
    .eq("user_id", userId)
    .eq("status", status)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) return null;
    throw error;
  }
  if (!data) return null;
  return remoteStateToRoundParts(data as unknown as RoundStateRemoteRow);
};

export async function fetchRemoteRoundState(
  userId: string,
): Promise<{ round: Round; continuity: RoundContinuityMeta } | null> {
  // Active is the current generation. Only restore the latest completed Round
  // when no explicit new active Round exists.
  return (
    (await fetchRemoteRoundByStatus(userId, "active"))
    ?? (await fetchRemoteRoundByStatus(userId, "completed"))
  );
}

export async function upsertRemoteRoundState(
  input: UpsertRoundStateInput,
): Promise<{ ok: boolean; missingTable: boolean; acceptedRoundId: string | null }> {
  const { data, error } = await supabase.rpc("upsert_owned_round_state", {
    p_round_id: input.round.id,
    p_status: input.round.status,
    p_state: roundToRemoteState(input.round, input.continuity) as Json,
    p_position_updated_at: input.continuity.positionUpdatedAt,
    p_expanded_updated_at: input.continuity.expandedUpdatedAt,
    p_device_id: input.continuity.deviceId,
    p_updated_at: input.round.updatedAt,
  });

  if (error) {
    if (isMissingTableError(error)) {
      return { ok: false, missingTable: true, acceptedRoundId: null };
    }
    throw error;
  }
  return {
    ok: true,
    missingTable: false,
    acceptedRoundId: data?.[0]?.id ?? null,
  };
}

/**
 * Push a single draft field patch onto the patient row.
 * Uses existing patients table (field path → column / JSON patch).
 */
export async function pushDraftFieldToPatient(input: {
  patientId: string;
  fieldKey: string;
  value: string;
  updatedAt: string;
  baseUpdatedAt: string | null;
}): Promise<
  | { status: "ok" }
  | { status: "conflict"; serverValue: string; serverUpdatedAt: string }
  | { status: "missing" }
> {
  const { data: server, error } = await supabase
    .from("patients")
    .select("id, clinical_summary, systems, field_timestamps, last_modified, revision")
    .eq("id", input.patientId)
    .maybeSingle();

  if (error) throw error;
  if (!server) return { status: "missing" };

  const timestamps = (server.field_timestamps ?? {}) as Record<string, string>;
  const serverUpdatedAt =
    timestamps[input.fieldKey]
    || (typeof server.last_modified === "string" ? server.last_modified : "");

  const serverValue = readPatientFieldValue(server, input.fieldKey);

  if (
    input.baseUpdatedAt
    && serverUpdatedAt
    && serverUpdatedAt !== input.baseUpdatedAt
    && serverValue !== input.value
  ) {
    return {
      status: "conflict",
      serverValue,
      serverUpdatedAt,
    };
  }

  const systems = (server.systems ?? {}) as Record<string, string>;
  const patch = buildPatientFieldPatch(
    input.fieldKey,
    input.value,
    input.updatedAt,
    timestamps,
    systems,
  );
  const { data: updated, error: updateError } = await supabase
    .from("patients")
    .update(patch as never)
    .eq("id", input.patientId)
    .eq("revision", server.revision)
    .select("id")
    .maybeSingle();

  if (updateError) throw updateError;
  if (!updated) {
    const { data: current, error: currentError } = await supabase
      .from("patients")
    .select("id, clinical_summary, systems, field_timestamps, last_modified, revision")
      .eq("id", input.patientId)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return { status: "missing" };
    const currentTimestamps = (current.field_timestamps ?? {}) as Record<string, string>;
    return {
      status: "conflict",
      serverValue: readPatientFieldValue(current, input.fieldKey),
      serverUpdatedAt:
        currentTimestamps[input.fieldKey]
        || (typeof current.last_modified === "string" ? current.last_modified : ""),
    };
  }
  return { status: "ok" };
}

const readPatientFieldValue = (
  server: {
    clinical_summary?: string | null;
    systems?: unknown;
  },
  fieldKey: string,
): string => {
  if (fieldKey === "clinicalSummary" || fieldKey === "clinical_summary") {
    return server.clinical_summary ?? "";
  }
  if (fieldKey.startsWith("systems.")) {
    const systemKey = fieldKey.slice("systems.".length);
    const systems = (server.systems ?? {}) as Record<string, string>;
    return systems[systemKey] ?? "";
  }
  return "";
};

const buildPatientFieldPatch = (
  fieldKey: string,
  value: string,
  updatedAt: string,
  timestamps: Record<string, string>,
  systems: Record<string, string>,
): Record<string, unknown> => {
  const nextTimestamps = { ...timestamps, [fieldKey]: updatedAt };
  if (fieldKey === "clinicalSummary" || fieldKey === "clinical_summary") {
    return {
      clinical_summary: value,
      field_timestamps: nextTimestamps,
      last_modified: updatedAt,
    };
  }
  if (fieldKey.startsWith("systems.")) {
    const systemKey = fieldKey.slice("systems.".length);
    return {
      systems: { ...systems, [systemKey]: value },
      field_timestamps: nextTimestamps,
      last_modified: updatedAt,
    };
  }
  return {
    [fieldKey]: value,
    field_timestamps: nextTimestamps,
    last_modified: updatedAt,
  };
};
