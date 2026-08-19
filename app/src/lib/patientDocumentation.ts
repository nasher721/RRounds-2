import type { Patient } from "@/types/patient";

export type DocumentationSectionId =
  | "summary"
  | "events"
  | "systems"
  | "results"
  | "medications";

export type DocumentationStatus = "not-started" | "in-progress" | "ready";

export type DocumentationPatient = Pick<
  Patient,
  "clinicalSummary" | "intervalEvents" | "systems" | "imaging" | "labs" | "medications"
>;

export interface DocumentationSectionMetadata {
  id: DocumentationSectionId;
  label: string;
  /** Stable DOM id used by desktop and mobile section navigators. */
  focusTarget: string;
  isComplete: (patient: DocumentationPatient) => boolean;
}

export interface DocumentationSectionState
  extends Omit<DocumentationSectionMetadata, "isComplete"> {
  complete: boolean;
}

export interface DocumentationProgress {
  completed: number;
  total: number;
  percentage: number;
  status: DocumentationStatus;
  sections: DocumentationSectionState[];
}

const hasDocumentedText = (value: string | undefined): boolean => {
  if (!value) return false;

  // Rich-text editors can leave empty markup behind after their contents are cleared.
  // Images are documentation even when the surrounding HTML contains no text.
  if (/<(?:img|video|audio)\b/i.test(value)) return true;

  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&(?:nbsp|#160);/gi, " ")
    .trim().length > 0;
};

export const DOCUMENTATION_SECTIONS: readonly DocumentationSectionMetadata[] = [
  {
    id: "summary",
    label: "Summary",
    focusTarget: "documentation-section-summary",
    isComplete: (patient) => hasDocumentedText(patient.clinicalSummary),
  },
  {
    id: "events",
    label: "Events",
    focusTarget: "documentation-section-events",
    isComplete: (patient) => hasDocumentedText(patient.intervalEvents),
  },
  {
    id: "systems",
    label: "Systems",
    focusTarget: "documentation-section-systems",
    isComplete: (patient) => Object.values(patient.systems).some(hasDocumentedText),
  },
  {
    id: "results",
    label: "Results",
    focusTarget: "documentation-section-results",
    isComplete: (patient) =>
      hasDocumentedText(patient.imaging) || hasDocumentedText(patient.labs),
  },
  {
    id: "medications",
    label: "Medications",
    focusTarget: "documentation-section-medications",
    isComplete: (patient) =>
      patient.medications.infusions.some(hasDocumentedText) ||
      patient.medications.scheduled.some(hasDocumentedText) ||
      patient.medications.prn.some(hasDocumentedText) ||
      hasDocumentedText(patient.medications.rawText),
  },
] as const;

export const DOCUMENTATION_STATUS_LABELS: Readonly<Record<DocumentationStatus, string>> = {
  "not-started": "Not started",
  "in-progress": "In progress",
  ready: "Ready",
};

export function getPatientDocumentationSummary(patient: DocumentationPatient): DocumentationProgress {
  const sections = DOCUMENTATION_SECTIONS.map(({ isComplete, ...section }) => ({
    ...section,
    complete: isComplete(patient),
  }));
  const completed = sections.filter((section) => section.complete).length;
  const total = sections.length;

  return {
    completed,
    total,
    percentage: total === 0 ? 0 : Math.round((completed / total) * 100),
    status: completed === 0 ? "not-started" : completed === total ? "ready" : "in-progress",
    sections,
  };
}

/** @deprecated Use getPatientDocumentationSummary for patient-list and workspace UI. */
export const getDocumentationProgress = getPatientDocumentationSummary;

export interface SystemsDocumentationCount {
  filled: number;
  total: number;
}

/**
 * Count documented systems for a patient. `systemKeys` lets callers scope the
 * count to their enabled systems config; defaults to the keys present on the
 * patient object (the 10 built-in systems).
 */
export function getSystemsDocumentationCount(
  patient: DocumentationPatient,
  systemKeys?: readonly string[],
): SystemsDocumentationCount {
  const keys =
    systemKeys && systemKeys.length > 0
      ? systemKeys
      : Object.keys(patient.systems);
  const values = patient.systems as unknown as Record<string, string>;
  const filled = keys.filter((key) => hasDocumentedText(values[key])).length;
  return { filled, total: keys.length };
}

/**
 * Per-section 3-state status for workspace tabs, roster segments and sign-off
 * chips. Blob sections (summary/events/results/medications) are binary:
 * content ⇔ ready. Systems is graded: all enabled systems documented → ready,
 * some → in-progress, none → not-started. The aggregate model from
 * getPatientDocumentationSummary is unchanged; this is an additive refinement.
 */
export function getDocumentationSectionStatus(
  patient: DocumentationPatient,
  sectionId: DocumentationSectionId,
  systemKeys?: readonly string[],
): DocumentationStatus {
  if (sectionId === "systems") {
    const { filled, total } = getSystemsDocumentationCount(patient, systemKeys);
    if (total > 0 && filled === total) return "ready";
    if (filled > 0) return "in-progress";
    return "not-started";
  }
  const section = DOCUMENTATION_SECTIONS.find((s) => s.id === sectionId);
  if (!section) return "not-started";
  return section.isComplete(patient) ? "ready" : "not-started";
}
