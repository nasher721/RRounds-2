// Autotext shortcuts and boilerplate templates for medical documentation

// Re-export types from centralized location
export type { AutoText, Template } from "@/types/autotext";
import type { AutoText, Template } from "@/types/autotext";

// Common medical abbreviation expansions (type shortcut, get expansion)
export const defaultAutotexts: AutoText[] = [
  // Vital signs & Status
  { shortcut: "vss", expansion: "Vital signs stable", category: "Status" },
  { shortcut: "afvss", expansion: "Afebrile, vital signs stable", category: "Status" },
  { shortcut: "nad", expansion: "No acute distress", category: "Status" },
  { shortcut: "wdwn", expansion: "Well-developed, well-nourished", category: "Status" },
  { shortcut: "aaox3", expansion: "Alert and oriented x3", category: "Neuro" },
  { shortcut: "aaox4", expansion: "Alert and oriented x4", category: "Neuro" },
  
  // Cardiovascular
  { shortcut: "rrr", expansion: "Regular rate and rhythm", category: "CV" },
  { shortcut: "s1s2", expansion: "S1, S2 normal, no murmurs, rubs, or gallops", category: "CV" },
  { shortcut: "nsr", expansion: "Normal sinus rhythm", category: "CV" },
  { shortcut: "jvd", expansion: "No jugular venous distension", category: "CV" },
  { shortcut: "2ppe", expansion: "2+ peripheral pulses equal bilaterally", category: "CV" },
  
  // Respiratory
  { shortcut: "ctab", expansion: "Clear to auscultation bilaterally", category: "Resp" },
  { shortcut: "ctabl", expansion: "Lungs clear to auscultation bilaterally, no wheezes, rales, or rhonchi", category: "Resp" },
  { shortcut: "nrd", expansion: "No respiratory distress", category: "Resp" },
  { shortcut: "ra", expansion: "Room air", category: "Resp" },
  { shortcut: "nc", expansion: "Nasal cannula", category: "Resp" },
  
  // GI
  { shortcut: "ntnd", expansion: "Non-tender, non-distended", category: "GI" },
  { shortcut: "nabs", expansion: "Normoactive bowel sounds", category: "GI" },
  { shortcut: "bsx4", expansion: "Bowel sounds present in all four quadrants", category: "GI" },
  { shortcut: "nrg", expansion: "No rebound or guarding", category: "GI" },
  
  // Neuro
  { shortcut: "cnii", expansion: "Cranial nerves II-XII intact", category: "Neuro" },
  { shortcut: "mae", expansion: "Moves all extremities", category: "Neuro" },
  { shortcut: "5/5", expansion: "5/5 strength in all extremities", category: "Neuro" },
  { shortcut: "dtrs", expansion: "Deep tendon reflexes 2+ bilaterally", category: "Neuro" },
  { shortcut: "perl", expansion: "Pupils equal, round, reactive to light", category: "Neuro" },
  { shortcut: "perrla", expansion: "Pupils equal, round, reactive to light and accommodation", category: "Neuro" },
  
  // Skin/Lines
  { shortcut: "wwp", expansion: "Warm, well-perfused", category: "Skin" },
  { shortcut: "wwpnd", expansion: "Warm, well-perfused, no edema", category: "Skin" },
  { shortcut: "pivint", expansion: "PIV intact, no signs of infection", category: "Lines" },
  { shortcut: "cvlint", expansion: "Central line intact, no erythema or drainage", category: "Lines" },
  
  // Medications
  { shortcut: "prn", expansion: "As needed", category: "Meds" },
  { shortcut: "bid", expansion: "Twice daily", category: "Meds" },
  { shortcut: "tid", expansion: "Three times daily", category: "Meds" },
  { shortcut: "qid", expansion: "Four times daily", category: "Meds" },
  { shortcut: "qhs", expansion: "At bedtime", category: "Meds" },
  { shortcut: "po", expansion: "By mouth", category: "Meds" },
  { shortcut: "iv", expansion: "Intravenous", category: "Meds" },
  { shortcut: "im", expansion: "Intramuscular", category: "Meds" },
  { shortcut: "sq", expansion: "Subcutaneous", category: "Meds" },
  
  // Plans
  { shortcut: "cmp", expansion: "Continue current management plan", category: "Plan" },
  { shortcut: "fbs", expansion: "Follow blood sugars", category: "Plan" },
  { shortcut: "daw", expansion: "Discuss at rounds", category: "Plan" },
  { shortcut: "tta", expansion: "Trending towards acceptable", category: "Plan" },
  { shortcut: "wddc", expansion: "Will discuss with consulting team", category: "Plan" },
  { shortcut: "pddc", expansion: "Pending discharge criteria", category: "Plan" },
];

// Boilerplate templates for common documentation scenarios
export const defaultTemplates: Template[] = [
  {
    id: "admit-summary",
    name: "Admission Summary",
    category: "Admission",
    content: `<b>Chief Complaint:</b> 
<b>HPI:</b> 
<b>PMH:</b> 
<b>PSH:</b> 
<b>Medications:</b> 
<b>Allergies:</b> 
<b>Social Hx:</b> 
<b>Family Hx:</b> 
<b>ROS:</b> Otherwise negative
<b>Vitals:</b> T: , HR: , BP: , RR: , SpO2: 
<b>Physical Exam:</b>
- General: Alert, no acute distress
- HEENT: Normocephalic, PERRLA, MMM
- Neck: Supple, no lymphadenopathy
- CV: RRR, S1/S2 normal
- Lungs: CTAB
- Abd: Soft, NTND, +BS
- Ext: No edema, 2+ pulses
- Neuro: A&Ox3, CN II-XII intact`
  },
  {
    id: "progress-note",
    name: "Daily Progress Note",
    category: "Progress",
    content: `<b>Subjective:</b> Patient reports 
<b>Overnight Events:</b> 
<b>Vitals:</b> Tmax: , HR: , BP: , RR: , SpO2: 
<b>I/O:</b> 
<b>Labs:</b> 
<b>Objective:</b>
- General: AAOx3, NAD
- CV: RRR, no murmurs
- Lungs: CTAB
- Abd: Soft, NTND
<b>Assessment/Plan:</b>
1. 
2. 
3. `
  },
  {
    id: "neuro-exam",
    name: "Neuro Exam",
    category: "Systems",
    content: `<b>Mental Status:</b> Alert and oriented x4, appropriate affect
<b>Cranial Nerves:</b> II-XII intact
<b>Motor:</b> 5/5 strength in all extremities, normal tone
<b>Sensory:</b> Intact to light touch bilaterally
<b>Reflexes:</b> 2+ and symmetric
<b>Coordination:</b> Finger-to-nose intact, no dysmetria
<b>Gait:</b> Normal, steady`
  },
  {
    id: "cv-exam",
    name: "Cardiovascular Exam",
    category: "Systems",
    content: `<b>Inspection:</b> No JVD, no visible pulsations
<b>Palpation:</b> PMI non-displaced, no heaves or thrills
<b>Auscultation:</b> Regular rate and rhythm, S1/S2 normal, no murmurs, rubs, or gallops
<b>Extremities:</b> Warm, well-perfused, 2+ pulses bilaterally, no peripheral edema
<b>Capillary refill:</b> <2 seconds`
  },
  {
    id: "resp-exam",
    name: "Respiratory Exam",
    category: "Systems",
    content: `<b>Inspection:</b> No respiratory distress, no accessory muscle use
<b>Palpation:</b> Normal chest expansion, no tenderness
<b>Percussion:</b> Resonant bilaterally
<b>Auscultation:</b> Clear to auscultation bilaterally, no wheezes, rales, or rhonchi
<b>O2 requirement:</b> Room air / Nasal cannula L/min`
  },
  {
    id: "gi-exam",
    name: "GI Exam",
    category: "Systems",
    content: `<b>Inspection:</b> Abdomen soft, non-distended, no scars
<b>Auscultation:</b> Normoactive bowel sounds in all quadrants
<b>Palpation:</b> Soft, non-tender, no masses, no hepatosplenomegaly
<b>Special tests:</b> No rebound tenderness, no guarding, negative Murphy's sign`
  },
  {
    id: "discharge-summary",
    name: "Discharge Summary",
    category: "Discharge",
    content: `<b>Admission Date:</b> 
<b>Discharge Date:</b> 
<b>Admission Diagnosis:</b> 
<b>Discharge Diagnosis:</b> 
<b>Hospital Course:</b> 
<b>Procedures:</b> 
<b>Discharge Medications:</b> 
<b>Discharge Instructions:</b>
- Activity: 
- Diet: 
- Wound care: 
- Follow-up: 
<b>Pending Results:</b> 
<b>Condition at Discharge:</b> Stable`
  },
  {
    id: "stable-patient",
    name: "Stable Patient One-Liner",
    category: "Quick",
    content: `Patient stable overnight. VSS. No acute concerns. Continue current plan.`
  },
  {
    id: "systems-template",
    name: "Systems Review Template",
    category: "Systems",
    content: `<b>Neuro:</b> AAOx3, moves all extremities
<b>CV:</b> RRR, no murmurs, 2+ pulses
<b>Resp:</b> CTAB, no respiratory distress
<b>GI:</b> Soft, NTND, +BS, tolerating diet
<b>Renal:</b> Adequate UOP, Cr stable
<b>Heme:</b> No active bleeding, stable H/H
<b>ID:</b> Afebrile, WBC stable
<b>Endo:</b> Blood sugars controlled
<b>Skin:</b> Warm, dry, intact
<b>Dispo:</b> Pending [criteria]`
  }
];

// Common medical spelling dictionary for autocorrect
export const medicalDictionary: Record<string, string> = {
  // Common misspellings -> correct spelling
  "tachycarida": "tachycardia",
  "bradycarida": "bradycardia",
  "arrythmia": "arrhythmia",
  "rythm": "rhythm",
  "rythym": "rhythm",
  "pneumonia": "pneumonia",
  "pnuemonia": "pneumonia",
  "pnemonia": "pneumonia",
  "diarreah": "diarrhea",
  "diarrea": "diarrhea",
  "diarhea": "diarrhea",
  "nausea": "nausea",
  "nasuea": "nausea",
  "hemorrhage": "hemorrhage",
  "hemorhage": "hemorrhage",
  "hemmorhage": "hemorrhage",
  "hemorrhagic": "hemorrhagic",
  "hemodynamic": "hemodynamic",
  "hemodynamically": "hemodynamically",
  "hypertention": "hypertension",
  "hypotention": "hypotension",
  "acsculatation": "auscultation",
  "auscultaion": "auscultation",
  "bilateraly": "bilaterally",
  "bilaterall": "bilaterally",
  "extrimities": "extremities",
  "extremeties": "extremities",
  "extremeity": "extremity",
  "abdominal": "abdominal",
  "abdomnial": "abdominal",
  "abdomen": "abdomen",
  "abdoman": "abdomen",
  "thoracic": "thoracic",
  "thorasic": "thoracic",
  "cervial": "cervical",
  "cervicle": "cervical",
  "lumbar": "lumbar",
  "lumbur": "lumbar",
  "sacral": "sacral",
  "sacrel": "sacral",
  "palpable": "palpable",
  "palpaple": "palpable",
  "tenderness": "tenderness",
  "tendernes": "tenderness",
  "guarding": "guarding",
  "gaurdng": "guarding",
  "rebound": "rebound",
  "reboud": "rebound",
  "distension": "distension",
  "distention": "distension",
  "distened": "distended",
  "edema": "edema",
  "oedema": "edema",
  "cyanosis": "cyanosis",
  "cyanotic": "cyanotic",
  "cynotic": "cyanotic",
  "jaundice": "jaundice",
  "jaudice": "jaundice",
  "jaudince": "jaundice",
  "icterus": "icterus",
  "icteric": "icteric",
  "orientated": "oriented",
  "lethargic": "lethargic",
  "lethragic": "lethargic",
  "obtunded": "obtunded",
  "obtunted": "obtunded",
  "somnolent": "somnolent",
  "sommolent": "somnolent",
  "responsive": "responsive",
  "responsve": "responsive",
  "unresponsive": "unresponsive",
  "pupil": "pupil",
  "puplis": "pupils",
  "reactive": "reactive",
  "reactve": "reactive",
  "accommodation": "accommodation",
  "accomodation": "accommodation",
  "pharynx": "pharynx",
  "pharanx": "pharynx",
  "tonsils": "tonsils",
  "tonsills": "tonsils",
  "lymphadenopathy": "lymphadenopathy",
  "lymphadenopthy": "lymphadenopathy",
  "hepatomegaly": "hepatomegaly",
  "hepatomegally": "hepatomegaly",
  "splenomegaly": "splenomegaly",
  "splenomegally": "splenomegaly",
  "hepatosplenomegaly": "hepatosplenomegaly",
  "creatinine": "creatinine",
  "creatanine": "creatinine",
  "potassium": "potassium",
  "potasium": "potassium",
  "magnesium": "magnesium",
  "magneisum": "magnesium",
  "phosphorus": "phosphorus",
  "phospherous": "phosphorus",
  "hemoglobin": "hemoglobin",
  "hemogloben": "hemoglobin",
  "hematocrit": "hematocrit",
  "hematocrt": "hematocrit",
  "leukocytosis": "leukocytosis",
  "leukocytoses": "leukocytosis",
  "thrombocytopenia": "thrombocytopenia",
  "thrombocytopnia": "thrombocytopenia",
  "coagulopathy": "coagulopathy",
  "coagulpathy": "coagulopathy",
  "anticoagulation": "anticoagulation",
  "anticoagulaton": "anticoagulation",
  "prophylaxis": "prophylaxis",
  "prophlyaxis": "prophylaxis",
  "prophylatic": "prophylactic",
  "thromboembolic": "thromboembolic",
  "thromboembolism": "thromboembolism",
  "embolism": "embolism",
  "embolsim": "embolism",
  "infarction": "infarction",
  "infaction": "infarction",
  "ischaemia": "ischemia",
  "ischemic": "ischemic",
  "symptomatic": "symptomatic",
  "symptomtic": "symptomatic",
  "asymptomatic": "asymptomatic",
  "asymtomatic": "asymptomatic",
  "diagnosis": "diagnosis",
  "diagnoses": "diagnoses",
  "diagnossis": "diagnosis",
  "differential": "differential",
  "differntial": "differential",
  "differentials": "differentials",
  "prognosis": "prognosis",
  "prognsois": "prognosis",
  "therapeutic": "therapeutic",
  "therapuetic": "therapeutic",
  "palliative": "palliative",
  "paliative": "palliative",
  "assessment": "assessment",
  "assesment": "assessment",
  "assesement": "assessment",
};
