#!/usr/bin/env node
/**
 * Live verification of Round Robin Notes AI edge functions.
 * Signs in with the E2E test user (credentials in .env.local) and invokes
 * every LLM-backed edge function with small synthetic (non-PHI) payloads.
 * Prints one PASS/FAIL line per function. Never prints secrets.
 */
import { readFileSync } from "node:fs";

function loadEnvFile(path) {
  try {
    const out = {};
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
    return out;
  } catch {
    return {};
  }
}

const env = { ...loadEnvFile(".env"), ...loadEnvFile(".env.local") };
const SUPABASE_URL = env.VITE_SUPABASE_URL?.replace(/\/$/, "");
const ANON_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const EMAIL = env.E2E_TEST_EMAIL;
const PASSWORD = env.E2E_TEST_PASSWORD;

if (!SUPABASE_URL || !ANON_KEY || !EMAIL || !PASSWORD) {
  console.error("Missing env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, E2E_TEST_EMAIL, E2E_TEST_PASSWORD");
  process.exit(2);
}

const only = process.argv.slice(2); // optional function name filter

async function signIn() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`Sign-in failed: HTTP ${res.status}`);
  const data = await res.json();
  if (!data.access_token) throw new Error("Sign-in returned no access token");
  return data.access_token;
}

const SYNTHETIC_SYSTEMS = {
  neuro: "Alert and oriented x3, moves all extremities",
  cv: "On norepinephrine 8 mcg/min, MAP goal >65",
  resp: "Intubated, AC/VC, FiO2 50%, PEEP 8",
};

const SYNTHETIC_PATIENT = {
  name: "Synthetic Test Patient",
  bed: "12A",
  clinicalSummary:
    "65 y/o synthetic patient admitted with septic shock secondary to pneumonia, intubated on ICU day 2.",
  intervalEvents: "Overnight: febrile to 38.5, cultures drawn, antibiotics broadened.",
  imaging: "CXR: right lower lobe infiltrate.",
  labs: "WBC 14.2, lactate 2.8 down from 4.1, creatinine 1.1.",
  systems: SYNTHETIC_SYSTEMS,
  medications: "norepinephrine 8 mcg/min IV, vancomycin 1g IV q12h, cefepime 2g IV q8h",
};

const TESTS = [
  {
    name: "healthcheck",
    method: "GET",
  },
  {
    name: "transform-text",
    body: {
      text: "cefepime two grams every eight hours, vancomycin one gram every twelve hours",
      transformType: "comma-list",
    },
  },
  {
    name: "format-medications",
    body: {
      medications:
        "norepinephrine 8 mcg/min IV continuous\nvancomycin 1g IV q12h\ncefepime 2g IV q8h",
    },
  },
  {
    name: "check-drug-interactions",
    body: { medications: ["warfarin", "aspirin"] },
  },
  {
    name: "generate-interval-events",
    body: { systems: SYNTHETIC_SYSTEMS },
  },
  {
    name: "generate-todos",
    body: { patientData: SYNTHETIC_PATIENT },
  },
  {
    name: "generate-patient-course",
    body: { patientData: SYNTHETIC_PATIENT },
  },
  {
    name: "generate-daily-summary",
    body: {
      patientName: "Synthetic Test Patient",
      clinicalSummary: SYNTHETIC_PATIENT.clinicalSummary,
      imaging: SYNTHETIC_PATIENT.imaging,
      labs: SYNTHETIC_PATIENT.labs,
      systems: SYNTHETIC_SYSTEMS,
      medications: {
        infusions: ["norepinephrine 8 mcg/min IV"],
        scheduled: ["vancomycin 1g IV q12h", "cefepime 2g IV q8h"],
      },
      todos: [
        { content: "Follow up blood cultures today", completed: false },
        { content: "Wean sedation in the morning", completed: false },
      ],
    },
  },
  {
    name: "ai-clinical-assistant",
    body: {
      feature: "smart_expand",
      text: "pt on norepi, febrile overnight",
      context: { clinicalSummary: SYNTHETIC_PATIENT.clinicalSummary },
    },
  },
  {
    name: "parse-single-patient",
    body: {
      content:
        "Bed 12A - Synthetic Test Patient, 65 y/o. Dx: septic shock from pneumonia. " +
        "Meds: norepinephrine 8, vancomycin, cefepime. Plan: continue antibiotics, wean pressors.",
    },
  },
  {
    name: "parse-handoff",
    body: {
      pdfContent:
        "ICU Rounding List (synthetic test data)\n" +
        "Bed 12A - Synthetic Test Patient, 65 y/o, septic shock from pneumonia, on norepinephrine.\n" +
        "Bed 12B - Second Synthetic Patient, 72 y/o, CHF exacerbation, on diuresis.",
    },
    timeoutMs: 170_000,
  },
];

function summarize(text) {
  if (text == null) return "";
  const s = String(text).replace(/\s+/g, " ").trim();
  return s.length > 120 ? s.slice(0, 117) + "..." : s;
}

async function callFunction(token, t) {
  const timeoutMs = t.timeoutMs ?? 90_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${t.name}`, {
      method: t.method ?? "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: ANON_KEY,
        "Content-Type": "application/json",
      },
      body: t.body ? JSON.stringify(t.body) : undefined,
      signal: controller.signal,
    });
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    const raw = await res.text();
    let parsed;
    try { parsed = JSON.parse(raw); } catch { parsed = raw; }
    return { status: res.status, elapsed, parsed };
  } catch (err) {
    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    return { status: 0, elapsed, parsed: `FETCH ERROR: ${err.name} ${err.message}` };
  } finally {
    clearTimeout(timer);
  }
}

function extractEvidence(name, parsed) {
  if (typeof parsed === "string") return summarize(parsed);
  if (!parsed || typeof parsed !== "object") return "";
  for (const key of ["summary", "todos", "events", "text", "result", "content", "transcript",
    "formatted", "patient", "patients", "course", "interactions", "status", "message"]) {
    if (parsed[key] !== undefined) return `${key}: ${summarize(JSON.stringify(parsed[key]))}`;
  }
  return summarize(JSON.stringify(parsed));
}

const token = await signIn();
console.log("Signed in as E2E test user (token acquired).");

let failures = 0;
for (const t of TESTS) {
  if (only.length && !only.includes(t.name)) continue;
  const { status, elapsed, parsed } = await callFunction(token, t);
  const ok = status >= 200 && status < 300 &&
    !(parsed && typeof parsed === "object" && parsed.success === false);
  if (!ok) failures++;
  console.log(
    `${ok ? "PASS" : "FAIL"} ${t.name} [HTTP ${status}, ${elapsed}s] ${extractEvidence(t.name, parsed)}`,
  );
}

console.log(failures === 0 ? "\nALL AI FUNCTIONS PASS" : `\n${failures} FUNCTION(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
