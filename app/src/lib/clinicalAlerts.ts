/**
 * Clinical Decision Support
 * Analyzes patient data and generates clinical alerts for potential concerns
 */

import type { Patient } from "@/types/patient";

export type AlertSeverity = "critical" | "warning" | "info" | "success";

export interface ClinicalAlert {
  id: string;
  patientId: string;
  patientName: string;
  title: string;
  message: string;
  severity: AlertSeverity;
  category: AlertCategory;
  field?: string;
  suggestedAction?: string;
  dismissed: boolean;
  createdAt: string;
  expiresAt?: string;
}

export type AlertCategory =
  | "medication"
  | "labs"
  | "vitals"
  | "neuro"
  | "respiratory"
  | "cardiac"
  | "infection"
  | "documentation"
  | "discharge"
  | "procedure";

const CRITICAL_KEYWORDS: Record<string, string[]> = {
  neuro: ["unresponsive", "seizure", "stroke", "hemorrhage", "herniation", "gcs 3", "gcs 4", "gcs 5"],
  respiratory: ["intubated", "ventilator", "ards", "respiratory failure", "hypoxia", "pneumothorax"],
  cardiac: ["arrest", "vfib", "vtach", "mi", "stemi", "nSTEMI", "cardiogenic shock", "pea"],
  infection: ["sepsis", "septic", "mrsa", "vRE", "covid +", "positive blood cx"],
  medication: ["pressor", "vasopressor", "levophed", "vasopressin", "epinephrine", "phenylephrine"],
};

const WARNING_KEYWORDS: Record<string, string[]> = {
  neuro: ["altered", "confusion", "agitation", "weakness", "numbness", "aphasia", "gcs 8", "gcs 9", "gcs 10"],
  respiratory: ["o2", "oxygen", "cpap", "bipap", "hfnc", "desat", "tachypnea"],
  cardiac: ["afib", "atrial fibrillation", "flutter", "svt", "bradycardia", "pacemaker"],
  renal: ["dialysis", "cr >3", "bun >50", "anuric", "aki"],
  labs: ["hgb <7", "plt <50", "k >6", "k <2.5", "na >160", "na <120", "glu >400", "lactate >4"],
};

const HIGH_RISK_MEDS = [
  "heparin", "warfarin", "insulin", "digoxin", "phenytoin",
  "lithium", "methotrexate", "amiodarone", "fentanyl", "midazolam",
];

const SEVERITY_ORDER: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2, success: 3 };

interface SearchableSystem {
  system: string;
  /** Keyword pairs: `label` is shown to the user, `search` is the pre-lowercased needle. */
  keywords: Array<{ label: string; search: string }>;
}

/** Pre-lowercases each keyword once at module load rather than on every patient. */
function toSearchableSystems(source: Record<string, string[]>): SearchableSystem[] {
  return Object.entries(source).map(([system, keywords]) => ({
    system,
    keywords: keywords.map((label) => ({ label, search: label.toLowerCase() })),
  }));
}

const CRITICAL_SYSTEMS = toSearchableSystems(CRITICAL_KEYWORDS);
const WARNING_SYSTEMS = toSearchableSystems(WARNING_KEYWORDS);

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

const DOCUMENTATION_ALERTS = {
  missingSummary: {
    title: "Missing Clinical Summary",
    message: "This patient has no clinical summary documented",
    severity: "info" as AlertSeverity,
    category: "documentation" as AlertCategory,
    suggestedAction: "Add a brief clinical summary",
  },
  missingPlan: {
    title: "Missing Disposition Plan",
    message: "No discharge or disposition plan documented",
    severity: "warning" as AlertSeverity,
    category: "discharge" as AlertCategory,
    suggestedAction: "Document disposition plan",
  },
  staleData: {
    title: "Stale Patient Data",
    message: "Last modified over 24 hours ago",
    severity: "info" as AlertSeverity,
    category: "documentation" as AlertCategory,
    suggestedAction: "Review and update patient information",
  },
};

/**
 * Analyzes patient data and generates clinical alerts
 */
export function analyzePatientForAlerts(patient: Patient): ClinicalAlert[] {
  const alerts: ClinicalAlert[] = [];
  const now = new Date().toISOString();

  CRITICAL_SYSTEMS.forEach(({ system, keywords }) => {
    const text = getSystemText(patient, system).toLowerCase();
    keywords.forEach(({ label, search }) => {
      if (!text.includes(search)) return;
      alerts.push({
        id: `${patient.id}-${system}-${label}-${Date.now()}`,
        patientId: patient.id,
        patientName: patient.name,
        title: `Critical ${capitalize(system)} Finding`,
        message: `Detected "${label}" in ${system} assessment`,
        severity: "critical",
        category: system as AlertCategory,
        field: `systems.${system}`,
        suggestedAction: "Review immediately and consider escalation",
        dismissed: false,
        createdAt: now,
      });
    });
  });

  WARNING_SYSTEMS.forEach(({ system, keywords }) => {
    const text = getSystemText(patient, system).toLowerCase();
    keywords.forEach(({ label, search }) => {
      if (!text.includes(search)) return;
      alerts.push({
        id: `${patient.id}-${system}-warning-${label}-${Date.now()}`,
        patientId: patient.id,
        patientName: patient.name,
        title: `${capitalize(system)} Alert`,
        message: `Detected "${label}" in ${system} assessment`,
        severity: "warning",
        category: system as AlertCategory,
        field: `systems.${system}`,
        suggestedAction: "Consider follow-up or monitoring",
        dismissed: false,
        createdAt: now,
      });
    });
  });

  if (!patient.clinicalSummary || patient.clinicalSummary.trim().length < 10) {
    alerts.push({
      id: `${patient.id}-missing-summary-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      ...DOCUMENTATION_ALERTS.missingSummary,
      dismissed: false,
      createdAt: now,
    });
  }

  if (!patient.systems.dispo || patient.systems.dispo.trim().length < 5) {
    alerts.push({
      id: `${patient.id}-missing-dispo-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      ...DOCUMENTATION_ALERTS.missingPlan,
      dismissed: false,
      createdAt: now,
    });
  }

  const lastModified = new Date(patient.lastModified);
  const hoursSinceUpdate = (Date.now() - lastModified.getTime()) / (1000 * 60 * 60);
  if (hoursSinceUpdate > 24) {
    alerts.push({
      id: `${patient.id}-stale-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      ...DOCUMENTATION_ALERTS.staleData,
      dismissed: false,
      createdAt: now,
    });
  }

  const allMeds = [
    ...patient.medications.infusions,
    ...patient.medications.scheduled,
    ...patient.medications.prn,
  ].join(" ").toLowerCase();

  HIGH_RISK_MEDS.forEach((med) => {
    if (!allMeds.includes(med)) return;
    alerts.push({
      id: `${patient.id}-highrisk-${med}-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      title: "High-Risk Medication",
      message: `Patient on ${capitalize(med)}`,
      severity: "warning",
      category: "medication",
      field: "medications",
      suggestedAction: "Verify dosing and monitoring parameters",
      dismissed: false,
      createdAt: now,
    });
  });

  return alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

/**
 * Gets text content for a specific system
 */
function getSystemText(patient: Patient, system: string): string {
  switch (system) {
    case "neuro":
      return patient.systems.neuro;
    case "respiratory":
      return patient.systems.resp;
    case "cardiac":
      return patient.systems.cv;
    case "infection":
      return patient.systems.infectious;
    case "medication":
      return [
        ...patient.medications.infusions,
        ...patient.medications.scheduled,
        ...patient.medications.prn,
      ].join(" ");
    default:
      return Object.values(patient.systems).join(" ");
  }
}

/**
 * Gets color classes for alert severity
 */
export function getAlertSeverityColor(severity: AlertSeverity): {
  bg: string;
  border: string;
  text: string;
  icon: string;
} {
  switch (severity) {
    case "critical":
      return {
        bg: "bg-red-50 dark:bg-red-950",
        border: "border-red-500",
        text: "text-red-900 dark:text-red-100",
        icon: "text-red-500",
      };
    case "warning":
      return {
        bg: "bg-amber-50 dark:bg-amber-950",
        border: "border-amber-500",
        text: "text-amber-900 dark:text-amber-100",
        icon: "text-amber-500",
      };
    case "success":
      return {
        bg: "bg-green-50 dark:bg-green-950",
        border: "border-green-500",
        text: "text-green-900 dark:text-green-100",
        icon: "text-green-500",
      };
    case "info":
    default:
      return {
        bg: "bg-blue-50 dark:bg-blue-950",
        border: "border-blue-500",
        text: "text-blue-900 dark:text-blue-100",
        icon: "text-blue-500",
      };
  }
}

/**
 * Gets alert icon name based on severity
 */
export function getAlertIcon(severity: AlertSeverity): string {
  switch (severity) {
    case "critical":
      return "AlertOctagon";
    case "warning":
      return "AlertTriangle";
    case "success":
      return "CheckCircle";
    case "info":
    default:
      return "Info";
  }
}
