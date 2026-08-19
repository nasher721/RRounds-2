/**
 * Normalize AI/tabular parse results into chart-ready patient payloads.
 */

import type {
  CodeStatus,
  PatientGender,
  PatientMedications,
  PatientSystems,
} from "@/types/patient";
import { defaultMedications, defaultSystems } from "@/types/patient";

export interface ParsedImportPatient {
  bed?: string;
  room?: string;
  name?: string;
  mrn?: string;
  age?: string | number;
  sex?: string;
  gender?: string;
  dob?: string;
  dateOfBirth?: string;
  admissionDate?: string;
  attending?: string;
  attendingPhysician?: string;
  service?: string;
  serviceLine?: string;
  codeStatus?: string;
  isolation?: string;
  alerts?: string[];
  handoffSummary?: string;
  clinicalSummary?: string;
  intervalEvents?: string;
  imaging?: string;
  labs?: string;
  systems?: Partial<PatientSystems> | null;
  medications?: Partial<PatientMedications> | null;
  /** Extra labeled fragments from spreadsheets / exports */
  [extraField: string]: unknown;
}

export interface ChartReadyImportPatient {
  name: string;
  mrn: string;
  bed: string;
  clinicalSummary: string;
  intervalEvents: string;
  imaging: string;
  labs: string;
  systems: PatientSystems;
  medications: PatientMedications;
  age?: number;
  dateOfBirth?: string;
  gender?: PatientGender;
  admissionDate?: string;
  attendingPhysician?: string;
  serviceLine?: string;
  codeStatus?: CodeStatus;
  alerts?: string[];
}

const emptySystems = (): PatientSystems => ({ ...defaultSystems });

const emptyMedications = (): PatientMedications => ({
  infusions: [...defaultMedications.infusions],
  scheduled: [...defaultMedications.scheduled],
  prn: [...defaultMedications.prn],
  rawText: defaultMedications.rawText ?? "",
});

/**
 * Decide which chart section a free-text clinical fragment belongs in.
 *
 * Trade-off: putting imaging/labs into system sections keeps the ICU note
 * problem-oriented; keeping dedicated imaging/labs fields preserves Epic-like
 * layout. Your choice here shapes every imported chart.
 *
 * Return one of:
 * - "clinicalSummary" | "intervalEvents" | "imaging" | "labs"
 * - "systems.neuro" | "systems.cv" | "systems.resp" | "systems.renalGU"
 *   | "systems.gi" | "systems.endo" | "systems.heme" | "systems.infectious"
 *   | "systems.skinLines" | "systems.dispo"
 * - "skip" to ignore the fragment
 */
export const classifyClinicalFragmentToChartSection = (
  label: string,
  _value: string,
): keyof ChartReadyImportPatient | `systems.${keyof PatientSystems}` | "skip" => {
  const labelWords = label
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .filter(Boolean);
  const normalizedLabel = labelWords.join("");
  const words = new Set(labelWords);
  const hasWord = (...candidates: string[]): boolean => candidates.some((word) => words.has(word));
  const hasPhrase = (...phrases: string[]): boolean => (
    phrases.some((phrase) => normalizedLabel.includes(phrase))
  );

  if (!normalizedLabel) return "skip";

  if (
    /^(?:whatwedidonrounds|rounds?(?:update|events?|summary)|overnight(?:events?|updates?)|intervalevents?|dailyupdate|significant(?:events?|updates?))$/.test(normalizedLabel) ||
    hasWord("round", "rounds", "event", "events")
  ) {
    return "intervalEvents";
  }
  if (hasWord("med", "meds", "medication", "medications", "infusion", "infusions", "drip", "drips", "mar")) {
    return "medications";
  }
  if (hasWord("neuro", "neurologic", "neurological", "sedation", "delirium") || hasPhrase("mentalstatus")) {
    return "systems.neuro";
  }
  if (hasWord("cardiac", "cardiovascular", "hemodynamic", "hemodynamics", "pressor", "pressors", "circulation", "rhythm", "ekg", "ecg", "troponin", "bnp", "cv")) {
    return "systems.cv";
  }
  if (hasWord("resp", "respiratory", "pulm", "pulmonary", "vent", "ventilator", "ventilation", "airway", "oxygen", "breathing", "abg", "vbg")) {
    return "systems.resp";
  }
  if (hasWord("renal", "genitourinary", "electrolyte", "electrolytes", "kidney", "kidneys", "urine", "dialysis", "foley", "gu")) {
    return "systems.renalGU";
  }
  if (hasWord("gastrointestinal", "nutrition", "nutritional", "abdomen", "abdominal", "hepatic", "bowel", "liver", "gi")) {
    return "systems.gi";
  }
  if (hasWord("endo", "endocrine", "endocrinology", "glycemic", "glycaemic", "glucose", "diabetes", "thyroid", "a1c", "tsh")) {
    return "systems.endo";
  }
  if (hasWord("heme", "hematology", "hematologic", "coag", "coags", "coagulation", "transfusion", "transfusions", "bleeding")) {
    return "systems.heme";
  }
  if (hasWord("infectious", "infection", "infections", "microbiology", "culture", "cultures", "antibiotic", "antibiotics", "antimicrobial", "antimicrobials", "sepsis") || normalizedLabel === "id") {
    return "systems.infectious";
  }
  if (hasWord("wound", "wounds", "drain", "drains", "skin", "access", "line", "lines", "picc") || hasPhrase("pressureulcer", "centralvenous", "arterialline")) {
    return "systems.skinLines";
  }
  if (hasWord("dispo", "disposition", "discharge", "placement") || hasPhrase("goalsofcare", "familydiscussion", "socialwork")) {
    return "systems.dispo";
  }
  // Generic results retain the app's dedicated labs/imaging fields. When a
  // heading also names a system, the system checks above take precedence.
  if (hasWord("image", "images", "imaging", "radiology", "radiologic", "cxr", "xray", "ultrasound", "sonogram", "ct", "cth", "cta", "mri", "echo", "echocardiogram")) {
    return "imaging";
  }
  if (hasWord("lab", "labs", "laboratory", "laboratories", "bloodwork", "cbc", "cbcs", "bmp", "cmp", "lft", "lfts", "wbc", "hgb", "hct", "platelets", "chemistry", "bun", "cr", "creatinine")) {
    return "labs";
  }

  // Preserve unknown clinical fields rather than silently discarding data.
  return "clinicalSummary";
};

const appendSectionText = (current: string, next: string): string => {
  const incoming = next.trim();
  if (!incoming) return current;
  if (!current.trim()) return incoming;
  if (current.includes(incoming)) return current;
  return `${current.trim()}\n${incoming}`;
};

const stringifyImportFragment = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(stringifyImportFragment).filter(Boolean).join(", ");
  }
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, nestedValue]) => {
        const text = stringifyImportFragment(nestedValue);
        return text ? `${key}: ${text}` : "";
      })
      .filter(Boolean)
      .join(", ");
  }
  return "";
};

export const formatImportedPatientDisplayName = (patient: ParsedImportPatient): string =>
  (patient.name ?? "").trim() || "Unknown patient";

const normalizeAge = (value: unknown): number | undefined => {
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const match = String(value).match(/\d{1,3}/);
  if (!match) return undefined;
  const age = Number(match[0]);
  return Number.isInteger(age) && age >= 0 && age <= 150 ? age : undefined;
};

const normalizeDate = (value: unknown, dateOnly: boolean): string | undefined => {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  if (dateOnly && parsed.getTime() > Date.now()) return undefined;
  return dateOnly ? parsed.toISOString().slice(0, 10) : parsed.toISOString();
};

const normalizeGender = (value: unknown): PatientGender | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (["m", "male"].includes(normalized)) return "male";
  if (["f", "female"].includes(normalized)) return "female";
  if (["o", "other", "nonbinary", "non-binary"].includes(normalized)) return "other";
  if (["u", "unknown", "undifferentiated"].includes(normalized)) return "unknown";
  return undefined;
};

const normalizeCodeStatus = (value: unknown): CodeStatus | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.toLowerCase().replace(/[^a-z]/g, "");
  if (["full", "fullcode", "fullresuscitation"].includes(normalized)) return "full";
  if (["dnr", "donotresuscitate"].includes(normalized)) return "dnr";
  if (["dni", "donotintubate"].includes(normalized)) return "dni";
  if (["comfort", "comfortcare", "comfortfocused"].includes(normalized)) return "comfort";
  return undefined;
};

const normalizeImportAlerts = (alerts: unknown, isolation: unknown): string[] | undefined => {
  const values = Array.isArray(alerts) ? alerts : [];
  const normalized = values
    .map((value) => String(value).trim())
    .filter(Boolean);
  const isolationText = typeof isolation === "string" ? isolation.trim() : "";
  if (isolationText && isolationText.toLowerCase() !== "none") {
    normalized.push(`Isolation: ${isolationText}`);
  }
  const unique = [...new Map(normalized.map((value) => [value.toLowerCase(), value])).values()];
  return unique.length > 0 ? unique : undefined;
};

export const organizeImportedPatient = (
  patient: ParsedImportPatient,
): ChartReadyImportPatient => {
  const systems = emptySystems();
  const medications = emptyMedications();

  if (patient.systems) {
    for (const key of Object.keys(systems) as Array<keyof PatientSystems>) {
      systems[key] = String(patient.systems[key] ?? "").trim();
    }
  }

  if (patient.medications) {
    medications.infusions = Array.isArray(patient.medications.infusions)
      ? patient.medications.infusions.map(String).filter(Boolean)
      : [];
    medications.scheduled = Array.isArray(patient.medications.scheduled)
      ? patient.medications.scheduled.map(String).filter(Boolean)
      : [];
    medications.prn = Array.isArray(patient.medications.prn)
      ? patient.medications.prn.map(String).filter(Boolean)
      : [];
    medications.rawText = String(patient.medications.rawText ?? "");
  }

  const bed = String(patient.bed || patient.room || "").trim();
  let clinicalSummary = String(patient.clinicalSummary || patient.handoffSummary || "").trim();
  let intervalEvents = String(patient.intervalEvents || "").trim();
  let imaging = String(patient.imaging || "").trim();
  let labs = String(patient.labs || "").trim();

  // Apply label classification for any leftover free-form keys on the object.
  for (const [label, value] of Object.entries(patient)) {
    if (
      label === "bed" ||
      label === "room" ||
      label === "name" ||
      label === "mrn" ||
      label === "age" ||
      label === "sex" ||
      label === "gender" ||
      label === "dob" ||
      label === "dateOfBirth" ||
      label === "admissionDate" ||
      label === "attending" ||
      label === "attendingPhysician" ||
      label === "service" ||
      label === "serviceLine" ||
      label === "codeStatus" ||
      label === "isolation" ||
      label === "alerts" ||
      label === "handoffSummary" ||
      label === "clinicalSummary" ||
      label === "intervalEvents" ||
      label === "imaging" ||
      label === "labs" ||
      label === "systems" ||
      label === "medications"
    ) {
      continue;
    }
    const fragment = stringifyImportFragment(value);
    if (!fragment) continue;

    const target = classifyClinicalFragmentToChartSection(label, fragment);
    if (target === "skip") continue;
    if (target === "clinicalSummary") {
      clinicalSummary = appendSectionText(clinicalSummary, fragment);
      continue;
    }
    if (target === "intervalEvents") {
      intervalEvents = appendSectionText(intervalEvents, fragment);
      continue;
    }
    if (target === "imaging") {
      imaging = appendSectionText(imaging, fragment);
      continue;
    }
    if (target === "labs") {
      labs = appendSectionText(labs, fragment);
      continue;
    }
    if (target === "medications") {
      medications.rawText = appendSectionText(medications.rawText ?? "", fragment);
      continue;
    }
    if (target.startsWith("systems.")) {
      const systemKey = target.replace("systems.", "") as keyof PatientSystems;
      systems[systemKey] = appendSectionText(systems[systemKey], fragment);
    }
  }

  return {
    name: formatImportedPatientDisplayName(patient),
    mrn: String(patient.mrn ?? "").trim(),
    bed,
    clinicalSummary,
    intervalEvents,
    imaging,
    labs,
    systems,
    medications,
    age: normalizeAge(patient.age),
    dateOfBirth: normalizeDate(patient.dateOfBirth ?? patient.dob, true),
    gender: normalizeGender(patient.gender ?? patient.sex),
    admissionDate: normalizeDate(patient.admissionDate, false),
    attendingPhysician: String(patient.attendingPhysician ?? patient.attending ?? "").trim() || undefined,
    serviceLine: String(patient.serviceLine ?? patient.service ?? "").trim() || undefined,
    codeStatus: normalizeCodeStatus(patient.codeStatus),
    alerts: normalizeImportAlerts(patient.alerts, patient.isolation),
  };
};

/** Map one CSV wizard record without leaking structured identity/status into note prose. */
export const organizeCsvImportRecord = (
  record: Record<string, string>,
): ChartReadyImportPatient => {
  const {
    name,
    bed,
    room,
    mrn,
    diagnosis,
    clinicalSummary,
    intervalEvents,
    imaging,
    labs,
    neuro,
    cv,
    resp,
    pulm,
    renalGU,
    renal,
    gi,
    endo,
    heme,
    infectious,
    id,
    skinLines,
    access,
    dispo,
    medications,
    dob,
    gender,
    admissionDate,
    attending,
    service,
    codeStatus,
    isolation,
    ...extraFields
  } = record;

  return organizeImportedPatient({
    name: name ?? "",
    bed: bed || room || "",
    mrn,
    clinicalSummary: diagnosis ?? clinicalSummary ?? "",
    intervalEvents: intervalEvents ?? "",
    imaging,
    labs,
    dob,
    gender,
    admissionDate,
    attending,
    service,
    codeStatus,
    isolation,
    systems: {
      neuro: neuro ?? "",
      cv: cv ?? "",
      resp: resp ?? pulm ?? "",
      renalGU: renalGU ?? renal ?? "",
      gi: gi ?? "",
      endo: endo ?? "",
      heme: heme ?? "",
      infectious: infectious ?? id ?? "",
      skinLines: skinLines ?? access ?? "",
      dispo: dispo ?? "",
    },
    medications: {
      infusions: [],
      scheduled: [],
      prn: [],
      rawText: medications ?? "",
    },
    ...extraFields,
  });
};
