/**
 * IBCC Content Data
 * Curated content from the Internet Book of Critical Care (EMCrit)
 * https://emcrit.org/ibcc/
 */

import type { IBCCChapter, IBCCCategory, ClinicalCalculator, ProtocolChecklist, MedicalSystem } from '@/types/ibcc';

export const IBCC_BASE_URL = 'https://emcrit.org/ibcc';

export const IBCC_CATEGORIES: IBCCCategory[] = [
  { id: 'resuscitation', name: 'Resuscitation', icon: '🫀', color: 'hsl(0 84% 60%)' },
  { id: 'cardiology', name: 'Cardiology', icon: '❤️', color: 'hsl(0 84% 50%)' },
  { id: 'pulmonology', name: 'Pulmonology', icon: '🫁', color: 'hsl(200 80% 50%)' },
  { id: 'nephrology', name: 'Nephrology', icon: '💧', color: 'hsl(210 80% 50%)' },
  { id: 'neurology', name: 'Neurology', icon: '🧠', color: 'hsl(280 60% 50%)' },
  { id: 'infectious', name: 'Infectious Disease', icon: '🦠', color: 'hsl(120 60% 40%)' },
  { id: 'endocrine', name: 'Endocrine', icon: '⚡', color: 'hsl(45 90% 50%)' },
  { id: 'hematology', name: 'Hematology', icon: '🩸', color: 'hsl(350 80% 45%)' },
  { id: 'gi', name: 'GI/Hepatology', icon: '🍽️', color: 'hsl(30 70% 50%)' },
  { id: 'toxicology', name: 'Toxicology', icon: '☠️', color: 'hsl(270 50% 40%)' },
  { id: 'procedures', name: 'Procedures', icon: '💉', color: 'hsl(180 50% 45%)' },
  { id: 'general', name: 'General Critical Care', icon: '🏥', color: 'hsl(220 60% 50%)' },
];

export const MEDICAL_SYSTEM_MAP: Record<MedicalSystem, { label: string; icon: string }> = {
  cardiology: { label: 'Cardiology', icon: '❤️' },
  pulmonology: { label: 'Pulmonology', icon: '🫁' },
  nephrology: { label: 'Nephrology', icon: '💧' },
  neurology: { label: 'Neurology', icon: '🧠' },
  infectious: { label: 'Infectious Disease', icon: '🦠' },
  endocrine: { label: 'Endocrine', icon: '⚡' },
  hematology: { label: 'Hematology', icon: '🩸' },
  gi: { label: 'GI/Hepatology', icon: '🍽️' },
  toxicology: { label: 'Toxicology', icon: '☠️' },
  resuscitation: { label: 'Resuscitation', icon: '🫀' },
  procedures: { label: 'Procedures', icon: '💉' },
  general: { label: 'General', icon: '🏥' },
};

export const IBCC_CHAPTERS: IBCCChapter[] = [
  // Resuscitation & Shock
  {
    id: 'shock',
    title: 'Approach to Shock',
    slug: 'shock',
    url: `${IBCC_BASE_URL}/shock/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'resuscitation')!,
    system: 'resuscitation',
    keywords: ['shock', 'hypotension', 'vasopressor', 'septic shock', 'cardiogenic shock', 'hypovolemic', 'distributive', 'MAP', 'lactate'],
    summary: 'Comprehensive approach to evaluating and managing shock states including distributive, cardiogenic, hypovolemic, and obstructive shock.',
  },
  {
    id: 'cardiac-arrest',
    title: 'Cardiac Arrest',
    slug: 'cardiac-arrest',
    url: `${IBCC_BASE_URL}/cardiac-arrest/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'resuscitation')!,
    system: 'resuscitation',
    keywords: ['cardiac arrest', 'ACLS', 'CPR', 'ROSC', 'PEA', 'asystole', 'VF', 'VT', 'epinephrine', 'defibrillation'],
    summary: 'Evidence-based approach to cardiac arrest including ACLS algorithms, medication timing, and post-resuscitation care.',
  },
  {
    id: 'vasopressors',
    title: 'Vasopressors & Inotropes',
    slug: 'vasopressors',
    url: `${IBCC_BASE_URL}/pressors/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'resuscitation')!,
    system: 'resuscitation',
    keywords: ['norepinephrine', 'vasopressin', 'epinephrine', 'dobutamine', 'dopamine', 'phenylephrine', 'inotrope', 'vasopressor'],
    summary: 'Selection and dosing of vasopressors and inotropes for various shock states.',
  },

  // Cardiology
  {
    id: 'afib',
    title: 'Atrial Fibrillation',
    slug: 'afib',
    url: `${IBCC_BASE_URL}/afib/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'cardiology')!,
    system: 'cardiology',
    keywords: ['atrial fibrillation', 'AF', 'AFib', 'rate control', 'rhythm control', 'anticoagulation', 'diltiazem', 'amiodarone', 'CHADS2'],
    summary: 'Management of atrial fibrillation including rate vs rhythm control and anticoagulation decisions.',
  },
  {
    id: 'stemi',
    title: 'STEMI',
    slug: 'stemi',
    url: `${IBCC_BASE_URL}/stemi/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'cardiology')!,
    system: 'cardiology',
    keywords: ['STEMI', 'myocardial infarction', 'MI', 'ACS', 'troponin', 'PCI', 'thrombolytics', 'chest pain', 'ECG', 'ST elevation'],
    summary: 'Diagnosis and management of ST-elevation myocardial infarction.',
  },
  {
    id: 'heart-failure',
    title: 'Acute Heart Failure',
    slug: 'chf',
    url: `${IBCC_BASE_URL}/chf/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'cardiology')!,
    system: 'cardiology',
    keywords: ['heart failure', 'CHF', 'pulmonary edema', 'cardiogenic shock', 'BNP', 'diuretics', 'furosemide', 'GDMT', 'EF'],
    summary: 'Approach to acute decompensated heart failure and cardiogenic pulmonary edema.',
  },
  {
    id: 'hypertensive-emergency',
    title: 'Hypertensive Emergency',
    slug: 'hypertensive-emergency',
    url: `${IBCC_BASE_URL}/hypertensive-emergency/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'cardiology')!,
    system: 'cardiology',
    keywords: ['hypertensive emergency', 'hypertensive urgency', 'blood pressure', 'nicardipine', 'labetalol', 'clevidipine', 'end organ damage'],
    summary: 'Identification and treatment of hypertensive emergencies with end-organ damage.',
  },

  // Pulmonology
  {
    id: 'ards',
    title: 'ARDS',
    slug: 'ards',
    url: `${IBCC_BASE_URL}/ards/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'pulmonology')!,
    system: 'pulmonology',
    keywords: ['ARDS', 'acute respiratory distress syndrome', 'lung protective ventilation', 'PEEP', 'prone positioning', 'P/F ratio', 'hypoxemia'],
    summary: 'Diagnosis and lung-protective management of ARDS including proning and PEEP strategies.',
  },
  {
    id: 'mechanical-ventilation',
    title: 'Mechanical Ventilation',
    slug: 'vent',
    url: `${IBCC_BASE_URL}/vent/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'pulmonology')!,
    system: 'pulmonology',
    keywords: ['mechanical ventilation', 'ventilator', 'tidal volume', 'PEEP', 'FiO2', 'sedation', 'weaning', 'extubation', 'respiratory failure'],
    summary: 'Comprehensive guide to mechanical ventilation modes, settings, and weaning.',
  },
  {
    id: 'copd',
    title: 'COPD Exacerbation',
    slug: 'copd',
    url: `${IBCC_BASE_URL}/copd/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'pulmonology')!,
    system: 'pulmonology',
    keywords: ['COPD', 'chronic obstructive pulmonary disease', 'bronchodilators', 'steroids', 'BiPAP', 'NIPPV', 'exacerbation'],
    summary: 'Management of acute COPD exacerbation including bronchodilators and ventilatory support.',
  },
  {
    id: 'asthma',
    title: 'Severe Asthma',
    slug: 'asthma',
    url: `${IBCC_BASE_URL}/asthma/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'pulmonology')!,
    system: 'pulmonology',
    keywords: ['asthma', 'status asthmaticus', 'bronchospasm', 'albuterol', 'magnesium', 'ketamine', 'intubation'],
    summary: 'Critical care approach to severe asthma exacerbation and status asthmaticus.',
  },
  {
    id: 'pulmonary-embolism',
    title: 'Pulmonary Embolism',
    slug: 'pe',
    url: `${IBCC_BASE_URL}/pe/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'pulmonology')!,
    system: 'pulmonology',
    keywords: ['pulmonary embolism', 'PE', 'DVT', 'VTE', 'anticoagulation', 'heparin', 'thrombolysis', 'D-dimer', 'CTA', 'right heart strain'],
    summary: 'Diagnosis and risk-stratified treatment of pulmonary embolism.',
  },

  // Nephrology
  {
    id: 'aki',
    title: 'Acute Kidney Injury',
    slug: 'aki',
    url: `${IBCC_BASE_URL}/aki/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'nephrology')!,
    system: 'nephrology',
    keywords: ['AKI', 'acute kidney injury', 'creatinine', 'renal failure', 'oliguria', 'dialysis', 'CRRT', 'uremia'],
    summary: 'Evaluation and management of acute kidney injury including dialysis indications.',
  },
  {
    id: 'hyperkalemia',
    title: 'Hyperkalemia',
    slug: 'hyperkalemia',
    url: `${IBCC_BASE_URL}/hyperkalemia/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'nephrology')!,
    system: 'nephrology',
    keywords: ['hyperkalemia', 'potassium', 'calcium gluconate', 'insulin', 'kayexalate', 'dialysis', 'ECG changes', 'peaked T waves'],
    summary: 'Emergent treatment of hyperkalemia and prevention of cardiac arrhythmias.',
  },
  {
    id: 'hyponatremia',
    title: 'Hyponatremia',
    slug: 'hyponatremia',
    url: `${IBCC_BASE_URL}/hyponatremia/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'nephrology')!,
    system: 'nephrology',
    keywords: ['hyponatremia', 'sodium', 'SIADH', 'hypertonic saline', 'fluid restriction', 'osmotic demyelination', 'cerebral edema'],
    summary: 'Safe correction of hyponatremia while avoiding osmotic demyelination syndrome.',
  },
  {
    id: 'acid-base',
    title: 'Acid-Base Disorders',
    slug: 'acid-base',
    url: `${IBCC_BASE_URL}/acid-base/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'nephrology')!,
    system: 'nephrology',
    keywords: ['acid-base', 'metabolic acidosis', 'metabolic alkalosis', 'respiratory acidosis', 'pH', 'bicarbonate', 'anion gap', 'lactate'],
    summary: 'Systematic approach to acid-base disorders including anion gap and compensation.',
  },

  // Endocrine
  {
    id: 'dka',
    title: 'Diabetic Ketoacidosis (DKA)',
    slug: 'dka',
    url: `${IBCC_BASE_URL}/dka/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'endocrine')!,
    system: 'endocrine',
    keywords: ['DKA', 'diabetic ketoacidosis', 'insulin', 'glucose', 'ketones', 'anion gap', 'potassium', 'bicarbonate', 'diabetes'],
    summary: 'Protocol-driven management of DKA including fluid resuscitation and insulin therapy.',
  },
  {
    id: 'hhs',
    title: 'Hyperosmolar Hyperglycemic State',
    slug: 'hhs',
    url: `${IBCC_BASE_URL}/hhs/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'endocrine')!,
    system: 'endocrine',
    keywords: ['HHS', 'hyperosmolar', 'hyperglycemia', 'dehydration', 'osmolality', 'altered mental status'],
    summary: 'Management of HHS with focus on gradual rehydration and glucose correction.',
  },
  {
    id: 'hypoglycemia',
    title: 'Hypoglycemia',
    slug: 'hypoglycemia',
    url: `${IBCC_BASE_URL}/hypoglycemia/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'endocrine')!,
    system: 'endocrine',
    keywords: ['hypoglycemia', 'low glucose', 'dextrose', 'glucagon', 'insulin overdose', 'altered mental status'],
    summary: 'Rapid recognition and treatment of hypoglycemia.',
  },
  {
    id: 'adrenal-crisis',
    title: 'Adrenal Crisis',
    slug: 'adrenal-crisis',
    url: `${IBCC_BASE_URL}/adrenal/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'endocrine')!,
    system: 'endocrine',
    keywords: ['adrenal crisis', 'adrenal insufficiency', 'cortisol', 'hydrocortisone', 'stress dose steroids', 'hypotension'],
    summary: 'Recognition and emergency treatment of adrenal crisis.',
  },
  {
    id: 'thyroid-storm',
    title: 'Thyroid Storm',
    slug: 'thyroid-storm',
    url: `${IBCC_BASE_URL}/thyroid-storm/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'endocrine')!,
    system: 'endocrine',
    keywords: ['thyroid storm', 'thyrotoxicosis', 'hyperthyroidism', 'PTU', 'methimazole', 'beta blocker', 'tachycardia', 'fever'],
    summary: 'Emergency management of thyroid storm with multi-drug therapy.',
  },

  // Neurology
  {
    id: 'stroke',
    title: 'Acute Ischemic Stroke',
    slug: 'stroke',
    url: `${IBCC_BASE_URL}/stroke/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'neurology')!,
    system: 'neurology',
    keywords: ['stroke', 'ischemic stroke', 'tPA', 'thrombectomy', 'NIHSS', 'blood pressure', 'CT', 'MRI'],
    summary: 'Time-critical management of acute ischemic stroke including reperfusion therapy.',
  },
  {
    id: 'status-epilepticus',
    title: 'Status Epilepticus',
    slug: 'status-epilepticus',
    url: `${IBCC_BASE_URL}/status-epilepticus/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'neurology')!,
    system: 'neurology',
    keywords: ['status epilepticus', 'seizure', 'benzodiazepine', 'lorazepam', 'levetiracetam', 'phenytoin', 'refractory'],
    summary: 'Tiered approach to status epilepticus from first-line to refractory treatment.',
  },
  {
    id: 'intracranial-hemorrhage',
    title: 'Intracranial Hemorrhage',
    slug: 'ich',
    url: `${IBCC_BASE_URL}/ich/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'neurology')!,
    system: 'neurology',
    keywords: ['ICH', 'intracranial hemorrhage', 'blood pressure', 'reversal', 'anticoagulation', 'ICP', 'herniation', 'neurosurgery'],
    summary: 'Critical care management of spontaneous intracranial hemorrhage.',
  },
  {
    id: 'meningitis',
    title: 'Meningitis',
    slug: 'meningitis',
    url: `${IBCC_BASE_URL}/meningitis/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'neurology')!,
    system: 'neurology',
    keywords: ['meningitis', 'CSF', 'lumbar puncture', 'antibiotics', 'dexamethasone', 'neck stiffness', 'encephalitis'],
    summary: 'Rapid diagnosis and empiric treatment of bacterial meningitis.',
  },

  // Infectious Disease
  {
    id: 'sepsis',
    title: 'Sepsis',
    slug: 'sepsis',
    url: `${IBCC_BASE_URL}/sepsis/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'infectious')!,
    system: 'infectious',
    keywords: ['sepsis', 'septic shock', 'SIRS', 'qSOFA', 'lactate', 'antibiotics', 'source control', 'fluid resuscitation'],
    summary: 'Evidence-based approach to sepsis and septic shock management.',
  },
  {
    id: 'pneumonia',
    title: 'Pneumonia',
    slug: 'pneumonia',
    url: `${IBCC_BASE_URL}/pna/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'infectious')!,
    system: 'infectious',
    keywords: ['pneumonia', 'CAP', 'HAP', 'VAP', 'antibiotics', 'respiratory failure', 'procalcitonin'],
    summary: 'Management of community-acquired and hospital-acquired pneumonia.',
  },
  {
    id: 'uti',
    title: 'Urinary Tract Infection',
    slug: 'uti',
    url: `${IBCC_BASE_URL}/uti/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'infectious')!,
    system: 'infectious',
    keywords: ['UTI', 'urinary tract infection', 'pyelonephritis', 'urosepsis', 'antibiotics', 'catheter'],
    summary: 'Approach to complicated UTI and urosepsis in critical care.',
  },
  {
    id: 'cdiff',
    title: 'C. difficile Infection',
    slug: 'cdiff',
    url: `${IBCC_BASE_URL}/cdiff/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'infectious')!,
    system: 'infectious',
    keywords: ['C. difficile', 'CDI', 'Clostridioides difficile', 'vancomycin', 'fidaxomicin', 'toxic megacolon', 'diarrhea'],
    summary: 'Severity-stratified treatment of C. difficile infection.',
  },

  // Hematology
  {
    id: 'anticoagulation-reversal',
    title: 'Anticoagulation Reversal',
    slug: 'anticoagulation-reversal',
    url: `${IBCC_BASE_URL}/anticoagulation-reversal/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'hematology')!,
    system: 'hematology',
    keywords: ['anticoagulation', 'reversal', 'warfarin', 'heparin', 'DOAC', 'vitamin K', 'PCC', 'FFP', 'bleeding'],
    summary: 'Rapid reversal of anticoagulation in life-threatening bleeding.',
  },
  {
    id: 'transfusion',
    title: 'Blood Transfusion',
    slug: 'transfusion',
    url: `${IBCC_BASE_URL}/transfusion/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'hematology')!,
    system: 'hematology',
    keywords: ['transfusion', 'PRBC', 'platelets', 'FFP', 'massive transfusion', 'hemoglobin', 'bleeding'],
    summary: 'Indications and approach to blood product transfusion.',
  },
  {
    id: 'dic',
    title: 'DIC',
    slug: 'dic',
    url: `${IBCC_BASE_URL}/dic/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'hematology')!,
    system: 'hematology',
    keywords: ['DIC', 'disseminated intravascular coagulation', 'coagulopathy', 'fibrinogen', 'D-dimer', 'platelets'],
    summary: 'Diagnosis and management of DIC with focus on treating underlying cause.',
  },

  // GI/Hepatology
  {
    id: 'gi-bleeding',
    title: 'GI Bleeding',
    slug: 'gib',
    url: `${IBCC_BASE_URL}/gib/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'gi')!,
    system: 'gi',
    keywords: ['GI bleeding', 'upper GI bleed', 'lower GI bleed', 'melena', 'hematemesis', 'endoscopy', 'PPI', 'transfusion'],
    summary: 'Risk stratification and management of acute GI hemorrhage.',
  },
  {
    id: 'hepatic-encephalopathy',
    title: 'Hepatic Encephalopathy',
    slug: 'hepatic-encephalopathy',
    url: `${IBCC_BASE_URL}/hepatic-encephalopathy/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'gi')!,
    system: 'gi',
    keywords: ['hepatic encephalopathy', 'cirrhosis', 'ammonia', 'lactulose', 'rifaximin', 'altered mental status', 'liver failure'],
    summary: 'Recognition and treatment of hepatic encephalopathy in liver disease.',
  },
  {
    id: 'acute-liver-failure',
    title: 'Acute Liver Failure',
    slug: 'alf',
    url: `${IBCC_BASE_URL}/alf/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'gi')!,
    system: 'gi',
    keywords: ['acute liver failure', 'ALF', 'INR', 'encephalopathy', 'acetaminophen', 'NAC', 'transplant'],
    summary: 'Critical care management of acute liver failure.',
  },
  {
    id: 'pancreatitis',
    title: 'Acute Pancreatitis',
    slug: 'pancreatitis',
    url: `${IBCC_BASE_URL}/pancreatitis/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'gi')!,
    system: 'gi',
    keywords: ['pancreatitis', 'lipase', 'amylase', 'fluid resuscitation', 'necrotizing pancreatitis', 'nutrition'],
    summary: 'Severity assessment and supportive care for acute pancreatitis.',
  },

  // Toxicology
  {
    id: 'acetaminophen',
    title: 'Acetaminophen Toxicity',
    slug: 'acetaminophen',
    url: `${IBCC_BASE_URL}/acetaminophen/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'toxicology')!,
    system: 'toxicology',
    keywords: ['acetaminophen', 'tylenol', 'NAC', 'N-acetylcysteine', 'liver failure', 'Rumack-Matthew nomogram', 'overdose'],
    summary: 'Risk stratification and NAC protocol for acetaminophen overdose.',
  },
  {
    id: 'opioid-overdose',
    title: 'Opioid Overdose',
    slug: 'opioid',
    url: `${IBCC_BASE_URL}/opioid/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'toxicology')!,
    system: 'toxicology',
    keywords: ['opioid', 'overdose', 'naloxone', 'narcan', 'respiratory depression', 'fentanyl', 'heroin'],
    summary: 'Naloxone dosing and supportive care for opioid toxicity.',
  },
  {
    id: 'alcohol-withdrawal',
    title: 'Alcohol Withdrawal',
    slug: 'alcohol-withdrawal',
    url: `${IBCC_BASE_URL}/alcohol-withdrawal/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'toxicology')!,
    system: 'toxicology',
    keywords: ['alcohol withdrawal', 'delirium tremens', 'DTs', 'benzodiazepine', 'phenobarbital', 'seizure', 'CIWA'],
    summary: 'Symptom-triggered and front-loading approaches to alcohol withdrawal.',
  },

  // Procedures
  {
    id: 'intubation',
    title: 'Airway Management',
    slug: 'airway',
    url: `${IBCC_BASE_URL}/airway/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'procedures')!,
    system: 'procedures',
    keywords: ['intubation', 'RSI', 'airway', 'laryngoscopy', 'video laryngoscopy', 'cricothyrotomy', 'difficult airway'],
    summary: 'Approach to emergency airway management and RSI.',
  },
  {
    id: 'central-line',
    title: 'Central Line Placement',
    slug: 'central-line',
    url: `${IBCC_BASE_URL}/central-line/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'procedures')!,
    system: 'procedures',
    keywords: ['central line', 'central venous catheter', 'IJ', 'subclavian', 'femoral', 'ultrasound', 'CVP'],
    summary: 'Ultrasound-guided central venous catheter placement technique.',
  },
  {
    id: 'lumbar-puncture',
    title: 'Lumbar Puncture',
    slug: 'lumbar-puncture',
    url: `${IBCC_BASE_URL}/lp/`,
    category: IBCC_CATEGORIES.find(c => c.id === 'procedures')!,
    system: 'procedures',
    keywords: ['lumbar puncture', 'LP', 'CSF', 'spinal tap', 'meningitis', 'opening pressure'],
    summary: 'Indications, technique, and CSF interpretation for LP.',
  },
];

// Clinical Calculators
export const CLINICAL_CALCULATORS: ClinicalCalculator[] = [
  // ============================================
  // Stroke & Atrial Fibrillation
  // ============================================
  {
    id: 'chads2vasc',
    name: 'CHA₂DS₂-VASc Score',
    description: 'Stroke risk in atrial fibrillation',
    chapterId: 'afib',
    inputs: [
      { id: 'chf', label: 'CHF History', type: 'boolean' },
      { id: 'htn', label: 'Hypertension', type: 'boolean' },
      { id: 'age75', label: 'Age ≥75', type: 'boolean' },
      { id: 'diabetes', label: 'Diabetes', type: 'boolean' },
      { id: 'stroke', label: 'Stroke/TIA/TE', type: 'boolean' },
      { id: 'vascular', label: 'Vascular Disease', type: 'boolean' },
      { id: 'age65', label: 'Age 65-74', type: 'boolean' },
      { id: 'female', label: 'Female Sex', type: 'boolean' },
    ],
    formula: (inputs) => {
      let score = 0;
      if (inputs.chf) score += 1;
      if (inputs.htn) score += 1;
      if (inputs.age75) score += 2;
      if (inputs.diabetes) score += 1;
      if (inputs.stroke) score += 2;
      if (inputs.vascular) score += 1;
      if (inputs.age65) score += 1;
      if (inputs.female) score += 1;
      
      const risk = score === 0 ? 'low' : score === 1 ? 'moderate' : 'high';
      const interpretation = score === 0 
        ? 'Low risk - anticoagulation generally not recommended'
        : score === 1 
        ? 'Moderate risk - consider anticoagulation'
        : 'High risk - anticoagulation recommended';
      
      return { value: score, interpretation, risk };
    },
  },
  {
    id: 'nihss',
    name: 'NIH Stroke Scale (NIHSS)',
    description: 'Quantifies stroke severity',
    chapterId: 'stroke',
    inputs: [
      { id: 'loc', label: 'Level of Consciousness', type: 'select', options: [
        { value: 0, label: 'Alert' },
        { value: 1, label: 'Drowsy' },
        { value: 2, label: 'Stuporous' },
        { value: 3, label: 'Coma' },
      ]},
      { id: 'locQuestions', label: 'LOC Questions (month, age)', type: 'select', options: [
        { value: 0, label: 'Both correct' },
        { value: 1, label: 'One correct' },
        { value: 2, label: 'Neither correct' },
      ]},
      { id: 'locCommands', label: 'LOC Commands (open/close eyes, grip)', type: 'select', options: [
        { value: 0, label: 'Both correct' },
        { value: 1, label: 'One correct' },
        { value: 2, label: 'Neither correct' },
      ]},
      { id: 'gaze', label: 'Best Gaze', type: 'select', options: [
        { value: 0, label: 'Normal' },
        { value: 1, label: 'Partial gaze palsy' },
        { value: 2, label: 'Forced deviation' },
      ]},
      { id: 'visual', label: 'Visual Fields', type: 'select', options: [
        { value: 0, label: 'No visual loss' },
        { value: 1, label: 'Partial hemianopia' },
        { value: 2, label: 'Complete hemianopia' },
        { value: 3, label: 'Bilateral hemianopia' },
      ]},
      { id: 'facial', label: 'Facial Palsy', type: 'select', options: [
        { value: 0, label: 'Normal' },
        { value: 1, label: 'Minor' },
        { value: 2, label: 'Partial' },
        { value: 3, label: 'Complete' },
      ]},
      { id: 'motorArm', label: 'Motor Arm (worst side)', type: 'select', options: [
        { value: 0, label: 'No drift' },
        { value: 1, label: 'Drift' },
        { value: 2, label: 'Some effort against gravity' },
        { value: 3, label: 'No effort against gravity' },
        { value: 4, label: 'No movement' },
      ]},
      { id: 'motorLeg', label: 'Motor Leg (worst side)', type: 'select', options: [
        { value: 0, label: 'No drift' },
        { value: 1, label: 'Drift' },
        { value: 2, label: 'Some effort against gravity' },
        { value: 3, label: 'No effort against gravity' },
        { value: 4, label: 'No movement' },
      ]},
      { id: 'ataxia', label: 'Limb Ataxia', type: 'select', options: [
        { value: 0, label: 'Absent' },
        { value: 1, label: 'Present in one limb' },
        { value: 2, label: 'Present in two limbs' },
      ]},
      { id: 'sensory', label: 'Sensory', type: 'select', options: [
        { value: 0, label: 'Normal' },
        { value: 1, label: 'Mild-moderate loss' },
        { value: 2, label: 'Severe or total loss' },
      ]},
      { id: 'language', label: 'Best Language', type: 'select', options: [
        { value: 0, label: 'No aphasia' },
        { value: 1, label: 'Mild-moderate aphasia' },
        { value: 2, label: 'Severe aphasia' },
        { value: 3, label: 'Mute/global aphasia' },
      ]},
      { id: 'dysarthria', label: 'Dysarthria', type: 'select', options: [
        { value: 0, label: 'Normal' },
        { value: 1, label: 'Mild-moderate' },
        { value: 2, label: 'Severe/mute' },
      ]},
      { id: 'neglect', label: 'Extinction/Inattention', type: 'select', options: [
        { value: 0, label: 'No abnormality' },
        { value: 1, label: 'Partial neglect' },
        { value: 2, label: 'Profound neglect' },
      ]},
    ],
    formula: (inputs) => {
      const score = Object.values(inputs).reduce((sum: number, val) => sum + (Number(val) || 0), 0) as number;
      
      let severity: string;
      let risk: 'low' | 'moderate' | 'high' | 'critical';
      if (score === 0) { severity = 'No stroke symptoms'; risk = 'low'; }
      else if (score <= 4) { severity = 'Minor stroke'; risk = 'low'; }
      else if (score <= 15) { severity = 'Moderate stroke'; risk = 'moderate'; }
      else if (score <= 20) { severity = 'Moderate-severe stroke'; risk = 'high'; }
      else { severity = 'Severe stroke'; risk = 'critical'; }
      
      return { value: score, interpretation: severity, risk };
    },
  },

  // ============================================
  // Pulmonary Embolism & DVT
  // ============================================
  {
    id: 'wells-pe',
    name: 'Wells Score for PE',
    description: 'Probability of pulmonary embolism',
    chapterId: 'pulmonary-embolism',
    inputs: [
      { id: 'dvt', label: 'Clinical signs of DVT', type: 'boolean' },
      { id: 'alternative', label: 'PE is #1 diagnosis or equally likely', type: 'boolean' },
      { id: 'hr100', label: 'Heart rate >100', type: 'boolean' },
      { id: 'immobile', label: 'Immobilization/surgery in past 4 weeks', type: 'boolean' },
      { id: 'prior', label: 'Previous PE or DVT', type: 'boolean' },
      { id: 'hemoptysis', label: 'Hemoptysis', type: 'boolean' },
      { id: 'cancer', label: 'Malignancy', type: 'boolean' },
    ],
    formula: (inputs) => {
      let score = 0;
      if (inputs.dvt) score += 3;
      if (inputs.alternative) score += 3;
      if (inputs.hr100) score += 1.5;
      if (inputs.immobile) score += 1.5;
      if (inputs.prior) score += 1.5;
      if (inputs.hemoptysis) score += 1;
      if (inputs.cancer) score += 1;
      
      const risk = score <= 4 ? 'low' : score <= 6 ? 'moderate' : 'high';
      const interpretation = score <= 4 
        ? 'PE unlikely - consider D-dimer'
        : 'PE likely - consider imaging';
      
      return { value: score, interpretation, risk };
    },
  },
  {
    id: 'wells-dvt',
    name: 'Wells Score for DVT',
    description: 'Probability of deep vein thrombosis',
    chapterId: 'pulmonary-embolism',
    inputs: [
      { id: 'cancer', label: 'Active cancer', type: 'boolean' },
      { id: 'paralysis', label: 'Paralysis/paresis/immobilization of lower extremity', type: 'boolean' },
      { id: 'bedridden', label: 'Bedridden >3 days or major surgery within 12 weeks', type: 'boolean' },
      { id: 'tenderness', label: 'Localized tenderness along deep venous system', type: 'boolean' },
      { id: 'swelling', label: 'Entire leg swollen', type: 'boolean' },
      { id: 'calf', label: 'Calf swelling >3cm vs. asymptomatic side', type: 'boolean' },
      { id: 'pitting', label: 'Pitting edema (symptomatic leg only)', type: 'boolean' },
      { id: 'collateral', label: 'Collateral superficial veins (non-varicose)', type: 'boolean' },
      { id: 'alternative', label: 'Alternative diagnosis as likely or more likely', type: 'boolean' },
    ],
    formula: (inputs) => {
      let score = 0;
      if (inputs.cancer) score += 1;
      if (inputs.paralysis) score += 1;
      if (inputs.bedridden) score += 1;
      if (inputs.tenderness) score += 1;
      if (inputs.swelling) score += 1;
      if (inputs.calf) score += 1;
      if (inputs.pitting) score += 1;
      if (inputs.collateral) score += 1;
      if (inputs.alternative) score -= 2;
      
      const risk = score <= 0 ? 'low' : score <= 2 ? 'moderate' : 'high';
      const interpretation = score <= 0 
        ? 'DVT unlikely (5% probability) - consider D-dimer'
        : score <= 2 
        ? 'Moderate probability (17%) - D-dimer or ultrasound'
        : 'DVT likely (53% probability) - ultrasound recommended';
      
      return { value: score, interpretation, risk };
    },
  },
  {
    id: 'perc',
    name: 'PERC Rule',
    description: 'Pulmonary Embolism Rule-out Criteria',
    chapterId: 'pulmonary-embolism',
    inputs: [
      { id: 'age50', label: 'Age ≥50', type: 'boolean' },
      { id: 'hr100', label: 'HR ≥100', type: 'boolean' },
      { id: 'spo2low', label: 'SpO₂ <95%', type: 'boolean' },
      { id: 'hemoptysis', label: 'Hemoptysis', type: 'boolean' },
      { id: 'estrogen', label: 'Estrogen use', type: 'boolean' },
      { id: 'prior', label: 'Prior PE or DVT', type: 'boolean' },
      { id: 'surgery', label: 'Surgery/trauma requiring hospitalization within 4 weeks', type: 'boolean' },
      { id: 'legswelling', label: 'Unilateral leg swelling', type: 'boolean' },
    ],
    formula: (inputs) => {
      const anyPositive = Object.values(inputs).some(v => v);
      return {
        value: anyPositive ? 'Positive' : 'Negative',
        interpretation: anyPositive 
          ? 'PERC positive - cannot rule out PE by clinical criteria alone'
          : 'PERC negative - PE effectively ruled out (if low pretest probability)',
        risk: anyPositive ? 'moderate' : 'low',
      };
    },
  },

  // ============================================
  // Sepsis & Organ Dysfunction
  // ============================================
  {
    id: 'sofa',
    name: 'SOFA Score',
    description: 'Sequential Organ Failure Assessment',
    chapterId: 'sepsis',
    inputs: [
      { id: 'pf', label: 'PaO₂/FiO₂ ratio', type: 'select', options: [
        { value: 0, label: '≥400' },
        { value: 1, label: '<400' },
        { value: 2, label: '<300' },
        { value: 3, label: '<200 with respiratory support' },
        { value: 4, label: '<100 with respiratory support' },
      ]},
      { id: 'platelets', label: 'Platelets (×10³/µL)', type: 'select', options: [
        { value: 0, label: '≥150' },
        { value: 1, label: '<150' },
        { value: 2, label: '<100' },
        { value: 3, label: '<50' },
        { value: 4, label: '<20' },
      ]},
      { id: 'bilirubin', label: 'Bilirubin (mg/dL)', type: 'select', options: [
        { value: 0, label: '<1.2' },
        { value: 1, label: '1.2-1.9' },
        { value: 2, label: '2.0-5.9' },
        { value: 3, label: '6.0-11.9' },
        { value: 4, label: '≥12' },
      ]},
      { id: 'map', label: 'Cardiovascular', type: 'select', options: [
        { value: 0, label: 'MAP ≥70 mmHg' },
        { value: 1, label: 'MAP <70 mmHg' },
        { value: 2, label: 'Dopamine ≤5 or dobutamine any dose' },
        { value: 3, label: 'Dopamine >5 OR epi/norepi ≤0.1' },
        { value: 4, label: 'Dopamine >15 OR epi/norepi >0.1' },
      ]},
      { id: 'gcs', label: 'Glasgow Coma Scale', type: 'select', options: [
        { value: 0, label: '15' },
        { value: 1, label: '13-14' },
        { value: 2, label: '10-12' },
        { value: 3, label: '6-9' },
        { value: 4, label: '<6' },
      ]},
      { id: 'creatinine', label: 'Creatinine/Urine output', type: 'select', options: [
        { value: 0, label: 'Cr <1.2' },
        { value: 1, label: 'Cr 1.2-1.9' },
        { value: 2, label: 'Cr 2.0-3.4' },
        { value: 3, label: 'Cr 3.5-4.9 OR UO <500 mL/day' },
        { value: 4, label: 'Cr ≥5 OR UO <200 mL/day' },
      ]},
    ],
    formula: (inputs) => {
      const score = Object.values(inputs).reduce((sum: number, val) => sum + (Number(val) || 0), 0) as number;
      
      let mortality: string;
      let risk: 'low' | 'moderate' | 'high' | 'critical';
      if (score <= 6) { mortality = '<10% mortality'; risk = 'low'; }
      else if (score <= 9) { mortality = '15-20% mortality'; risk = 'moderate'; }
      else if (score <= 12) { mortality = '40-50% mortality'; risk = 'high'; }
      else { mortality = '>80% mortality'; risk = 'critical'; }
      
      return { value: score, interpretation: mortality, risk };
    },
  },
  {
    id: 'qsofa',
    name: 'qSOFA Score',
    description: 'Quick sepsis screening',
    chapterId: 'sepsis',
    inputs: [
      { id: 'rr', label: 'Respiratory rate ≥22', type: 'boolean' },
      { id: 'mentation', label: 'Altered mentation', type: 'boolean' },
      { id: 'sbp', label: 'Systolic BP ≤100 mmHg', type: 'boolean' },
    ],
    formula: (inputs) => {
      let score = 0;
      if (inputs.rr) score += 1;
      if (inputs.mentation) score += 1;
      if (inputs.sbp) score += 1;
      
      return {
        value: score,
        interpretation: score >= 2 
          ? 'High risk of poor outcomes - consider sepsis workup'
          : 'Lower risk - reassess if clinical concern',
        risk: score >= 2 ? 'high' : 'low',
      };
    },
  },

  // ============================================
  // ICU Severity Scores
  // ============================================
  {
    id: 'apache2',
    name: 'APACHE II Score',
    description: 'ICU mortality prediction',
    chapterId: 'shock',
    inputs: [
      { id: 'temp', label: 'Temperature (°C)', type: 'select', options: [
        { value: 4, label: '≥41 or ≤29.9' },
        { value: 3, label: '39-40.9 or 30-31.9' },
        { value: 2, label: '32-33.9' },
        { value: 1, label: '38.5-38.9 or 34-35.9' },
        { value: 0, label: '36-38.4' },
      ]},
      { id: 'map', label: 'Mean Arterial Pressure', type: 'select', options: [
        { value: 4, label: '≥160 or ≤49' },
        { value: 3, label: '130-159 or 50-69' },
        { value: 2, label: '110-129' },
        { value: 0, label: '70-109' },
      ]},
      { id: 'hr', label: 'Heart Rate', type: 'select', options: [
        { value: 4, label: '≥180 or ≤39' },
        { value: 3, label: '140-179 or 40-54' },
        { value: 2, label: '110-139 or 55-69' },
        { value: 0, label: '70-109' },
      ]},
      { id: 'rr', label: 'Respiratory Rate', type: 'select', options: [
        { value: 4, label: '≥50 or ≤5' },
        { value: 3, label: '35-49' },
        { value: 2, label: '6-9' },
        { value: 1, label: '25-34 or 10-11' },
        { value: 0, label: '12-24' },
      ]},
      { id: 'oxygenation', label: 'Oxygenation (A-aDO₂ if FiO₂≥0.5, or PaO₂ if <0.5)', type: 'select', options: [
        { value: 4, label: 'A-a ≥500 or PaO₂ <55' },
        { value: 3, label: 'A-a 350-499 or PaO₂ 55-60' },
        { value: 2, label: 'A-a 200-349 or PaO₂ 61-70' },
        { value: 0, label: 'A-a <200 or PaO₂ >70' },
      ]},
      { id: 'ph', label: 'Arterial pH', type: 'select', options: [
        { value: 4, label: '≥7.7 or <7.15' },
        { value: 3, label: '7.6-7.69 or 7.15-7.24' },
        { value: 2, label: '7.25-7.32' },
        { value: 1, label: '7.5-7.59 or 7.33-7.49' },
        { value: 0, label: '7.33-7.49' },
      ]},
      { id: 'sodium', label: 'Serum Sodium', type: 'select', options: [
        { value: 4, label: '≥180 or ≤110' },
        { value: 3, label: '160-179 or 111-119' },
        { value: 2, label: '155-159 or 120-129' },
        { value: 1, label: '150-154' },
        { value: 0, label: '130-149' },
      ]},
      { id: 'potassium', label: 'Serum Potassium', type: 'select', options: [
        { value: 4, label: '≥7 or <2.5' },
        { value: 3, label: '6-6.9' },
        { value: 2, label: '2.5-2.9' },
        { value: 1, label: '5.5-5.9 or 3-3.4' },
        { value: 0, label: '3.5-5.4' },
      ]},
      { id: 'creatinine', label: 'Serum Creatinine', type: 'select', options: [
        { value: 4, label: '≥3.5 (ARF)' },
        { value: 3, label: '2-3.4 (ARF)' },
        { value: 2, label: '1.5-1.9 or ≥3.5 (CKD)' },
        { value: 0, label: '0.6-1.4' },
      ]},
      { id: 'hct', label: 'Hematocrit (%)', type: 'select', options: [
        { value: 4, label: '≥60 or <20' },
        { value: 2, label: '50-59.9 or 20-29.9' },
        { value: 1, label: '46-49.9' },
        { value: 0, label: '30-45.9' },
      ]},
      { id: 'wbc', label: 'WBC (×1000)', type: 'select', options: [
        { value: 4, label: '≥40 or <1' },
        { value: 2, label: '20-39.9 or 1-2.9' },
        { value: 1, label: '15-19.9' },
        { value: 0, label: '3-14.9' },
      ]},
      { id: 'gcs', label: 'Glasgow Coma Scale (15 - GCS)', type: 'number', min: 0, max: 12 },
      { id: 'age', label: 'Age Points', type: 'select', options: [
        { value: 0, label: '<45' },
        { value: 2, label: '45-54' },
        { value: 3, label: '55-64' },
        { value: 5, label: '65-74' },
        { value: 6, label: '≥75' },
      ]},
      { id: 'chronic', label: 'Chronic Health Points', type: 'select', options: [
        { value: 0, label: 'None' },
        { value: 2, label: 'Elective surgery with chronic condition' },
        { value: 5, label: 'Emergency surgery or non-operative with chronic condition' },
      ]},
    ],
    formula: (inputs) => {
      const score = Object.values(inputs).reduce((sum: number, val) => sum + (Number(val) || 0), 0) as number;
      
      let mortality: string;
      let risk: 'low' | 'moderate' | 'high' | 'critical';
      if (score <= 4) { mortality = '~4% mortality'; risk = 'low'; }
      else if (score <= 9) { mortality = '~8% mortality'; risk = 'low'; }
      else if (score <= 14) { mortality = '~15% mortality'; risk = 'moderate'; }
      else if (score <= 19) { mortality = '~25% mortality'; risk = 'moderate'; }
      else if (score <= 24) { mortality = '~40% mortality'; risk = 'high'; }
      else if (score <= 29) { mortality = '~55% mortality'; risk = 'high'; }
      else if (score <= 34) { mortality = '~75% mortality'; risk = 'critical'; }
      else { mortality = '>85% mortality'; risk = 'critical'; }
      
      return { value: score, interpretation: mortality, risk };
    },
  },
  {
    id: 'gcs',
    name: 'Glasgow Coma Scale',
    description: 'Level of consciousness assessment',
    chapterId: 'status-epilepticus',
    inputs: [
      { id: 'eye', label: 'Eye Opening', type: 'select', options: [
        { value: 4, label: 'Spontaneous' },
        { value: 3, label: 'To verbal command' },
        { value: 2, label: 'To pain' },
        { value: 1, label: 'None' },
      ]},
      { id: 'verbal', label: 'Verbal Response', type: 'select', options: [
        { value: 5, label: 'Oriented' },
        { value: 4, label: 'Confused' },
        { value: 3, label: 'Inappropriate words' },
        { value: 2, label: 'Incomprehensible sounds' },
        { value: 1, label: 'None' },
      ]},
      { id: 'motor', label: 'Motor Response', type: 'select', options: [
        { value: 6, label: 'Obeys commands' },
        { value: 5, label: 'Localizes pain' },
        { value: 4, label: 'Withdraws from pain' },
        { value: 3, label: 'Flexion to pain (decorticate)' },
        { value: 2, label: 'Extension to pain (decerebrate)' },
        { value: 1, label: 'None' },
      ]},
    ],
    formula: (inputs) => {
      const score = (Number(inputs.eye) || 1) + (Number(inputs.verbal) || 1) + (Number(inputs.motor) || 1);
      
      let severity: string;
      let risk: 'low' | 'moderate' | 'high' | 'critical';
      if (score >= 13) { severity = 'Minor (GCS 13-15)'; risk = 'low'; }
      else if (score >= 9) { severity = 'Moderate (GCS 9-12)'; risk = 'moderate'; }
      else if (score >= 6) { severity = 'Severe (GCS 6-8)'; risk = 'high'; }
      else { severity = 'Critical (GCS 3-5) - consider intubation'; risk = 'critical'; }
      
      return { value: score, interpretation: severity, risk };
    },
  },

  // ============================================
  // Metabolic & Electrolyte Calculators
  // ============================================
  {
    id: 'anion-gap',
    name: 'Anion Gap',
    description: 'Calculate serum anion gap',
    chapterId: 'dka',
    inputs: [
      { id: 'sodium', label: 'Sodium', type: 'number', unit: 'mEq/L', min: 100, max: 180, defaultValue: 140 },
      { id: 'chloride', label: 'Chloride', type: 'number', unit: 'mEq/L', min: 70, max: 130, defaultValue: 100 },
      { id: 'bicarb', label: 'Bicarbonate', type: 'number', unit: 'mEq/L', min: 5, max: 40, defaultValue: 24 },
      { id: 'albumin', label: 'Albumin (optional)', type: 'number', unit: 'g/dL', min: 0, max: 6, defaultValue: 4 },
    ],
    formula: (inputs) => {
      const na = Number(inputs.sodium) || 140;
      const cl = Number(inputs.chloride) || 100;
      const hco3 = Number(inputs.bicarb) || 24;
      const alb = Number(inputs.albumin) || 4;
      
      const rawGap = na - cl - hco3;
      // Corrected for albumin: AG increases by 2.5 for each 1 g/dL decrease in albumin below 4
      const correctedGap = rawGap + (2.5 * (4 - alb));
      
      const risk = correctedGap <= 12 ? 'low' : correctedGap <= 16 ? 'moderate' : 'high';
      
      return {
        value: Math.round(correctedGap * 10) / 10,
        interpretation: correctedGap <= 12 
          ? 'Normal anion gap (8-12 mEq/L)'
          : correctedGap <= 20
          ? 'Elevated - consider HAGMA (DKA, lactic acidosis, toxins)'
          : 'Significantly elevated - high likelihood of HAGMA',
        risk,
      };
    },
  },
  {
    id: 'corrected-sodium',
    name: 'Corrected Sodium',
    description: 'Sodium corrected for hyperglycemia',
    chapterId: 'dka',
    inputs: [
      { id: 'sodium', label: 'Measured Sodium', type: 'number', unit: 'mEq/L', min: 100, max: 180 },
      { id: 'glucose', label: 'Glucose', type: 'number', unit: 'mg/dL', min: 50, max: 2000 },
    ],
    formula: (inputs) => {
      const na = Number(inputs.sodium) || 140;
      const glucose = Number(inputs.glucose) || 100;
      
      // Katz formula: Na + 1.6 × (glucose - 100) / 100
      const corrected = na + (1.6 * (glucose - 100) / 100);
      
      return {
        value: Math.round(corrected * 10) / 10,
        interpretation: `True sodium is ~${Math.round(corrected)} mEq/L when glucose normalizes`,
        risk: corrected > 145 ? 'high' : corrected < 135 ? 'moderate' : 'low',
      };
    },
  },
  {
    id: 'osmolar-gap',
    name: 'Osmolar Gap',
    description: 'Detect unmeasured osmoles (toxic alcohols)',
    chapterId: 'toxicology',
    inputs: [
      { id: 'measuredOsm', label: 'Measured Osmolality', type: 'number', unit: 'mOsm/kg', min: 200, max: 400 },
      { id: 'sodium', label: 'Sodium', type: 'number', unit: 'mEq/L', min: 100, max: 180 },
      { id: 'glucose', label: 'Glucose', type: 'number', unit: 'mg/dL', min: 50, max: 2000 },
      { id: 'bun', label: 'BUN', type: 'number', unit: 'mg/dL', min: 5, max: 200 },
    ],
    formula: (inputs) => {
      const measured = Number(inputs.measuredOsm) || 290;
      const na = Number(inputs.sodium) || 140;
      const glucose = Number(inputs.glucose) || 100;
      const bun = Number(inputs.bun) || 15;
      
      // Calculated osmolality = 2(Na) + glucose/18 + BUN/2.8
      const calculated = (2 * na) + (glucose / 18) + (bun / 2.8);
      const gap = measured - calculated;
      
      return {
        value: Math.round(gap * 10) / 10,
        interpretation: gap > 10 
          ? 'Elevated - consider toxic alcohols (methanol, ethylene glycol, isopropanol)'
          : 'Normal osmolar gap (<10)',
        risk: gap > 10 ? 'high' : 'low',
      };
    },
  },

  // ============================================
  // Renal & Hepatic Function
  // ============================================
  {
    id: 'creatinine-clearance',
    name: 'Creatinine Clearance (Cockcroft-Gault)',
    description: 'Estimate GFR for drug dosing',
    chapterId: 'acute-kidney-injury',
    inputs: [
      { id: 'age', label: 'Age', type: 'number', unit: 'years', min: 18, max: 120 },
      { id: 'weight', label: 'Weight', type: 'number', unit: 'kg', min: 30, max: 300 },
      { id: 'creatinine', label: 'Serum Creatinine', type: 'number', unit: 'mg/dL', min: 0.3, max: 20 },
      { id: 'female', label: 'Female sex', type: 'boolean' },
    ],
    formula: (inputs) => {
      const age = Number(inputs.age) || 50;
      const weight = Number(inputs.weight) || 70;
      const cr = Number(inputs.creatinine) || 1;
      const female = inputs.female;
      
      // CrCl = [(140 - age) × weight] / (72 × Cr) × 0.85 if female
      let crcl = ((140 - age) * weight) / (72 * cr);
      if (female) crcl *= 0.85;
      
      let stage: string;
      let risk: 'low' | 'moderate' | 'high' | 'critical';
      if (crcl >= 90) { stage = 'Normal kidney function'; risk = 'low'; }
      else if (crcl >= 60) { stage = 'Mild reduction (CKD Stage 2)'; risk = 'low'; }
      else if (crcl >= 45) { stage = 'Mild-moderate (CKD Stage 3a)'; risk = 'moderate'; }
      else if (crcl >= 30) { stage = 'Moderate-severe (CKD Stage 3b)'; risk = 'moderate'; }
      else if (crcl >= 15) { stage = 'Severe (CKD Stage 4) - renal dose adjust'; risk = 'high'; }
      else { stage = 'Kidney failure (CKD Stage 5)'; risk = 'critical'; }
      
      return { value: Math.round(crcl), interpretation: stage, risk };
    },
  },
  {
    id: 'meld',
    name: 'MELD Score',
    description: 'Liver disease severity',
    chapterId: 'acute-liver-failure',
    inputs: [
      { id: 'creatinine', label: 'Creatinine', type: 'number', unit: 'mg/dL', min: 0.1, max: 15 },
      { id: 'bilirubin', label: 'Bilirubin', type: 'number', unit: 'mg/dL', min: 0.1, max: 50 },
      { id: 'inr', label: 'INR', type: 'number', min: 0.8, max: 10 },
      { id: 'dialysis', label: 'Dialysis 2x in past week', type: 'boolean' },
    ],
    formula: (inputs) => {
      let cr = Number(inputs.creatinine) || 1;
      let bili = Number(inputs.bilirubin) || 1;
      let inr = Number(inputs.inr) || 1;
      
      if (cr < 1) cr = 1;
      if (cr > 4 || inputs.dialysis) cr = 4;
      if (bili < 1) bili = 1;
      if (inr < 1) inr = 1;
      
      const score = Math.round(
        10 * (0.957 * Math.log(cr) + 0.378 * Math.log(bili) + 1.120 * Math.log(inr) + 0.643)
      );
      
      const risk = score < 10 ? 'low' : score < 20 ? 'moderate' : score < 30 ? 'high' : 'critical';
      const mortality = score < 10 ? '1.9%' : score < 20 ? '6%' : score < 30 ? '19.6%' : '>50%';
      
      return { 
        value: score, 
        interpretation: `3-month mortality: ${mortality}`,
        risk 
      };
    },
  },
  {
    id: 'meld-na',
    name: 'MELD-Na Score',
    description: 'MELD with sodium correction',
    chapterId: 'acute-liver-failure',
    inputs: [
      { id: 'creatinine', label: 'Creatinine', type: 'number', unit: 'mg/dL', min: 0.1, max: 15 },
      { id: 'bilirubin', label: 'Bilirubin', type: 'number', unit: 'mg/dL', min: 0.1, max: 50 },
      { id: 'inr', label: 'INR', type: 'number', min: 0.8, max: 10 },
      { id: 'sodium', label: 'Sodium', type: 'number', unit: 'mEq/L', min: 100, max: 160 },
      { id: 'dialysis', label: 'Dialysis 2x in past week', type: 'boolean' },
    ],
    formula: (inputs) => {
      let cr = Number(inputs.creatinine) || 1;
      let bili = Number(inputs.bilirubin) || 1;
      let inr = Number(inputs.inr) || 1;
      let na = Number(inputs.sodium) || 140;
      
      if (cr < 1) cr = 1;
      if (cr > 4 || inputs.dialysis) cr = 4;
      if (bili < 1) bili = 1;
      if (inr < 1) inr = 1;
      if (na < 125) na = 125;
      if (na > 137) na = 137;
      
      const meld = 10 * (0.957 * Math.log(cr) + 0.378 * Math.log(bili) + 1.120 * Math.log(inr) + 0.643);
      const meldNa = Math.round(meld + 1.32 * (137 - na) - 0.033 * meld * (137 - na));
      
      const risk = meldNa < 10 ? 'low' : meldNa < 20 ? 'moderate' : meldNa < 30 ? 'high' : 'critical';
      
      return { 
        value: meldNa, 
        interpretation: `Higher priority for transplant if MELD-Na ≥15`,
        risk 
      };
    },
  },

  // ============================================
  // Respiratory Calculators
  // ============================================
  {
    id: 'aa-gradient',
    name: 'A-a Gradient',
    description: 'Alveolar-arterial oxygen gradient',
    chapterId: 'ards',
    inputs: [
      { id: 'age', label: 'Age', type: 'number', unit: 'years', min: 18, max: 120, defaultValue: 50 },
      { id: 'fio2', label: 'FiO₂', type: 'number', unit: '%', min: 21, max: 100, defaultValue: 21 },
      { id: 'pao2', label: 'PaO₂', type: 'number', unit: 'mmHg', min: 20, max: 600 },
      { id: 'paco2', label: 'PaCO₂', type: 'number', unit: 'mmHg', min: 10, max: 120 },
      { id: 'patm', label: 'Atmospheric Pressure', type: 'number', unit: 'mmHg', min: 600, max: 800, defaultValue: 760 },
    ],
    formula: (inputs) => {
      const age = Number(inputs.age) || 50;
      const fio2 = (Number(inputs.fio2) || 21) / 100;
      const pao2 = Number(inputs.pao2) || 80;
      const paco2 = Number(inputs.paco2) || 40;
      const patm = Number(inputs.patm) || 760;
      
      // PAO2 = FiO2 × (Patm - 47) - (PaCO2 / 0.8)
      const pao2Alveolar = fio2 * (patm - 47) - (paco2 / 0.8);
      const aaGradient = pao2Alveolar - pao2;
      
      // Expected A-a gradient = (Age/4) + 4
      const expected = (age / 4) + 4;
      
      const elevated = aaGradient > expected;
      
      return {
        value: Math.round(aaGradient),
        interpretation: elevated 
          ? `Elevated (expected <${Math.round(expected)} for age) - suggests V/Q mismatch, shunt, or diffusion impairment`
          : `Normal for age (expected <${Math.round(expected)})`,
        risk: aaGradient > 30 ? 'high' : aaGradient > expected ? 'moderate' : 'low',
      };
    },
  },
  {
    id: 'pf-ratio',
    name: 'P/F Ratio',
    description: 'PaO₂/FiO₂ ratio for ARDS severity',
    chapterId: 'ards',
    inputs: [
      { id: 'pao2', label: 'PaO₂', type: 'number', unit: 'mmHg', min: 20, max: 600 },
      { id: 'fio2', label: 'FiO₂', type: 'number', unit: '%', min: 21, max: 100 },
    ],
    formula: (inputs) => {
      const pao2 = Number(inputs.pao2) || 80;
      const fio2 = (Number(inputs.fio2) || 21) / 100;
      
      const ratio = pao2 / fio2;
      
      let severity: string;
      let risk: 'low' | 'moderate' | 'high' | 'critical';
      if (ratio >= 400) { severity = 'Normal'; risk = 'low'; }
      else if (ratio >= 300) { severity = 'Mild hypoxemia'; risk = 'low'; }
      else if (ratio >= 200) { severity = 'Mild ARDS (P/F 200-300)'; risk = 'moderate'; }
      else if (ratio >= 100) { severity = 'Moderate ARDS (P/F 100-200)'; risk = 'high'; }
      else { severity = 'Severe ARDS (P/F <100)'; risk = 'critical'; }
      
      return { value: Math.round(ratio), interpretation: severity, risk };
    },
  },

  // ============================================
  // Cardiac Arrest & Resuscitation
  // ============================================
  {
    id: 'rosc-probability',
    name: 'Cardiac Arrest Survival Score',
    description: 'Estimate probability of ROSC',
    chapterId: 'cardiac-arrest',
    inputs: [
      { id: 'witnessed', label: 'Witnessed arrest', type: 'boolean' },
      { id: 'bystander', label: 'Bystander CPR', type: 'boolean' },
      { id: 'shockable', label: 'Initial shockable rhythm (VF/pVT)', type: 'boolean' },
      { id: 'downtime', label: 'Estimated downtime', type: 'select', options: [
        { value: 0, label: '<5 minutes' },
        { value: -5, label: '5-10 minutes' },
        { value: -10, label: '10-20 minutes' },
        { value: -20, label: '>20 minutes' },
      ]},
      { id: 'location', label: 'Location', type: 'select', options: [
        { value: 5, label: 'In-hospital' },
        { value: 0, label: 'Out-of-hospital' },
      ]},
    ],
    formula: (inputs) => {
      let score = 50; // baseline
      if (inputs.witnessed) score += 15;
      if (inputs.bystander) score += 10;
      if (inputs.shockable) score += 20;
      score += Number(inputs.downtime) || 0;
      score += Number(inputs.location) || 0;
      
      if (score > 100) score = 100;
      if (score < 0) score = 0;
      
      let prognosis: string;
      let risk: 'low' | 'moderate' | 'high' | 'critical';
      if (score >= 70) { prognosis = 'Favorable factors - continue aggressive resuscitation'; risk = 'moderate'; }
      else if (score >= 40) { prognosis = 'Moderate probability - assess for reversible causes'; risk = 'high'; }
      else { prognosis = 'Poor prognostic factors - consider termination criteria'; risk = 'critical'; }
      
      return { value: `${score}%`, interpretation: prognosis, risk };
    },
  },
];

// Protocol Checklists
export const PROTOCOL_CHECKLISTS: ProtocolChecklist[] = [
  {
    id: 'sepsis-bundle',
    name: 'Sepsis Hour-1 Bundle',
    chapterId: 'sepsis',
    items: [
      { id: 's1', text: 'Measure lactate level', category: 'Labs', timeframe: '1 hour' },
      { id: 's2', text: 'Obtain blood cultures before antibiotics', category: 'Labs', timeframe: '1 hour' },
      { id: 's3', text: 'Administer broad-spectrum antibiotics', category: 'Treatment', timeframe: '1 hour' },
      { id: 's4', text: 'Begin rapid fluid resuscitation (30 mL/kg crystalloid)', category: 'Resuscitation', timeframe: '1 hour' },
      { id: 's5', text: 'Apply vasopressors if hypotensive after fluid bolus', category: 'Resuscitation', timeframe: '1 hour' },
      { id: 's6', text: 'Re-measure lactate if initial lactate elevated', category: 'Labs', timeframe: '6 hours' },
    ],
  },
  {
    id: 'dka-protocol',
    name: 'DKA Management Protocol',
    chapterId: 'dka',
    items: [
      { id: 'd1', text: 'Initial labs: BMP, VBG, ketones, CBC', category: 'Diagnosis' },
      { id: 'd2', text: 'Start IV fluids: NS 1-2L bolus then 250-500 mL/hr', category: 'Fluids' },
      { id: 'd3', text: 'Check potassium before starting insulin', category: 'Labs' },
      { id: 'd4', text: 'Start insulin drip: 0.1 units/kg/hr (if K+ >3.3)', category: 'Insulin' },
      { id: 'd5', text: 'Add potassium to fluids (goal K+ 4-5)', category: 'Electrolytes' },
      { id: 'd6', text: 'Add dextrose when glucose <250', category: 'Fluids' },
      { id: 'd7', text: 'Check BMP and glucose q1-2h', category: 'Monitoring' },
      { id: 'd8', text: 'Transition to subQ insulin when gap closes', category: 'Transition' },
    ],
  },
  {
    id: 'intubation-checklist',
    name: 'RSI Intubation Checklist',
    chapterId: 'intubation',
    items: [
      { id: 'i1', text: 'Prepare equipment: ETT, stylet, laryngoscope, bougie', category: 'Preparation' },
      { id: 'i2', text: 'Attach monitors: SpO2, ETCO2, ECG', category: 'Monitoring' },
      { id: 'i3', text: 'Position patient (sniffing position)', category: 'Positioning' },
      { id: 'i4', text: 'Preoxygenate: 100% FiO2 for 3+ minutes', category: 'Preoxygenation' },
      { id: 'i5', text: 'Draw up medications: induction + paralytic', category: 'Medications' },
      { id: 'i6', text: 'Administer induction agent', category: 'Induction' },
      { id: 'i7', text: 'Administer paralytic', category: 'Paralysis' },
      { id: 'i8', text: 'Wait for paralysis (60-90 seconds)', category: 'Paralysis' },
      { id: 'i9', text: 'Laryngoscopy and intubation', category: 'Intubation' },
      { id: 'i10', text: 'Confirm placement: ETCO2, bilateral breath sounds, CXR', category: 'Confirmation' },
    ],
  },
];

// Keyword mapping for context detection
export const KEYWORD_PATTERNS: Record<string, string[]> = {
  'shock': ['hypotension', 'low bp', 'vasopressor', 'septic shock', 'cardiogenic shock', 'MAP <65'],
  'dka': ['diabetic ketoacidosis', 'DKA', 'anion gap', 'ketones', 'high glucose', 'type 1 diabetes'],
  'sepsis': ['infection', 'fever', 'SIRS', 'leukocytosis', 'lactate elevated', 'qSOFA'],
  'ards': ['respiratory failure', 'hypoxemia', 'bilateral infiltrates', 'P/F ratio', 'PEEP'],
  'afib': ['atrial fibrillation', 'irregular rhythm', 'rapid ventricular response', 'RVR'],
  'aki': ['acute kidney injury', 'rising creatinine', 'oliguria', 'renal failure'],
  'hyperkalemia': ['high potassium', 'K+ elevated', 'peaked T waves', 'EKG changes'],
  'stroke': ['CVA', 'hemiparesis', 'facial droop', 'slurred speech', 'NIH stroke scale'],
  'pulmonary-embolism': ['PE', 'DVT', 'chest pain', 'tachycardia', 'hypoxia', 'D-dimer elevated'],
  'gi-bleeding': ['melena', 'hematemesis', 'hematochezia', 'dropping hemoglobin', 'GI bleed'],
};
