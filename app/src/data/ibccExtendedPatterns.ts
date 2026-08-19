/**
 * IBCC Extended Keyword Patterns
 * Medication-based patterns for context-aware chapter suggestions
 * Import this and merge with KEYWORD_PATTERNS in useIBCCContext
 */

export const MEDICATION_KEYWORD_PATTERNS: Record<string, string[]> = {
  // Vasopressors/inotropes - suggests shock, septic shock, cardiogenic shock chapters
  'vasopressors': [
    'norepinephrine', 'epinephrine', 'phenylephrine', 'vasopressin', 
    'dobutamine', 'milrinone', 'dopamine', 'levophed'
  ],
  
  // Sedation/pain medications - suggests sedation, ventilation, delirium chapters
  'sedation': [
    'propofol', 'midazolam', 'fentanyl', 'morphine', 
    'dexmedetomidine', 'ketamine', 'hydromorphone', 'lorazepam'
  ],
  
  // Mechanical ventilation - suggests ARDS, ventilator chapters
  'mechanical-ventilation': [
    'ventilator', 'intubated', 'tidal volume', 'PEEP', 
    'FiO2', 'extubation', 'respirator'
  ],
  
  // Heart failure medications - suggests heart failure, cardiogenic shock
  'heart-failure': [
    'furosemide', 'bumetanide', 'metolazone', 'spironolactone', 
    'carvedilol', 'milrinone', 'digoxin', 'lisinopril'
  ],
  
  // Bleeding/transfusion - suggests GI bleeding, hemorrhagic shock
  'bleeding': [
    'transfusion', 'FFP', 'platelets', 'cryoprecipitate', 
    'tranexamic acid', 'PCC', 'blood products'
  ],
  
  // Renal replacement - suggests AKI, dialysis chapters
  'renal-replacement': [
    'dialysis', 'hemodialysis', 'CRRT', 'ultrafiltration', 
    'dialysate', 'renal replacement'
  ],
  
  // DKA protocols
  'dka': [
    'insulin drip', 'DKA protocol', 'bicarbonate', 'potassium'
  ],
  
  // Anticoagulation
  'anticoagulation': [
    'heparin', 'warfarin', 'lovenox', 'enoxaparin', 
    'apixaban', 'rivaroxaban', 'dabigatran', 'DOAC'
  ],
  
  // Broad spectrum antibiotics (sepsis)
  'sepsis': [
    'vancomycin', 'piperacillin', 'cefepime', 'meropenem', 
    'ceftriaxone', 'broad spectrum', 'Zosyn'
  ],
};

/**
 * Lab-based patterns for context detection
 * These will suggest chapters based on abnormal lab values
 */
export const LAB_KEYWORD_PATTERNS: Record<string, string[]> = {
  // Renal
  'aki': ['creatinine', 'BUN', 'kidney', 'renal', 'oliguria'],
  
  // Metabolic
  'hyperkalemia': ['potassium', 'K+', 'hyperkalemia'],
  'hyponatremia': ['sodium', 'Na+', 'hyponatremia'],
  'dka': ['glucose', 'ketones', 'anion gap', 'bicarbonate'],
  
  // Cardiac
  'afib': ['troponin', 'BNP', 'NT-proBNP'],
  
  // Hematologic
  'bleeding': ['hemoglobin', 'hematocrit', 'platelets', 'INR', 'PTT'],
  
  // Hepatic
  'liver': ['AST', 'ALT', 'bilirubin', 'liver', 'hepatitis'],
};

/**
 * System-based patterns for context detection
 * These match against the 10-system review
 */
export const SYSTEM_KEYWORD_PATTERNS: Record<string, string[]> = {
  // Neuro
  'stroke': ['stroke', 'CVA', 'hemiparesis', 'facial droop', 'aphasia', 'NIHSS'],
  'delirium': ['delirium', 'confused', 'altered mental status', 'encephalopathy'],
  'seizure': ['seizure', 'convulsion', 'epilepsy'],
  
  // Respiratory
  'ards': ['ards', 'bilateral infiltrates', 'acute lung injury'],
  'pulmonary-embolism': ['PE', 'DVT', 'pulmonary embolism', 'shortness of breath'],
  'copd': ['copd', 'exacerbation', 'chronic obstructive'],
  'asthma': ['asthma', 'wheezing', 'bronchospasm'],
  
  // Cardiovascular
  'afib': ['afib', 'atrial fibrillation', 'a-fib', 'arrhythmia'],
  'heart-failure': ['heart failure', 'CHF', 'pulmonary edema', 'LV failure'],
  'shock': ['shock', 'hypotension', 'MAP', 'hypoperfusion'],
  
  // Renal
  'aki': ['AKI', 'acute kidney injury', 'renal failure', 'creatinine'],
  
  // GI
  'gi-bleeding': ['GI bleed', 'melena', 'hematemesis', 'hematochezia'],
  'pancreatitis': ['pancreatitis', 'lipase', 'amylase'],
  
  // Infectious
  'sepsis': ['sepsis', 'septic', 'infection', 'SIRS'],
  'meningitis': ['meningitis', 'meningeal', 'neck stiffness'],
  
  // Endocrine
  'dka': ['DKA', 'ketoacidosis', 'diabetic'],
  'thyroid': ['thyroid', 'thyrotoxicosis', 'myxedema'],
};
