/**
 * Protocol Checklist Types
 * Evidence-based bundles and clinical protocols
 */

export type ProtocolCategory =
  | 'sepsis'
  | 'respiratory'
  | 'cardiac'
  | 'neuro'
  | 'gi'
  | 'renal'
  | 'heme'
  | 'endo'
  | 'prophylaxis'
  | 'admission'
  | 'discharge'
  | 'procedure';

export interface ProtocolItem {
  id: string;
  text: string;
  details?: string;
  required: boolean;
  timeframe?: string; // e.g., "within 1 hour", "daily"
  order?: number;
}

export interface Protocol {
  id: string;
  name: string;
  shortName: string;
  category: ProtocolCategory;
  description: string;
  items: ProtocolItem[];
  source?: string;
  lastUpdated: string;
  enabled: boolean;
}

export interface PatientProtocol {
  id: string;
  patientId: string;
  protocolId: string;
  protocolName: string;
  startedAt: string;
  startedBy: string;
  completedItems: string[]; // item IDs
  completionTimes: Record<string, string>; // itemId -> timestamp
  completedBy: Record<string, string>; // itemId -> user
  notes: Record<string, string>; // itemId -> note
  status: 'active' | 'completed' | 'discontinued';
  completedAt?: string;
  discontinuedAt?: string;
  discontinuedReason?: string;
}

// Built-in clinical protocols
export const DEFAULT_PROTOCOLS: Protocol[] = [
  {
    id: 'sepsis-3hr',
    name: 'Sepsis 3-Hour Bundle',
    shortName: 'SEP-3',
    category: 'sepsis',
    description: 'Initial resuscitation bundle for severe sepsis/septic shock',
    items: [
      { id: 'sep3-lactate', text: 'Measure lactate level', required: true, timeframe: 'within 3 hours', order: 1 },
      { id: 'sep3-cultures', text: 'Obtain blood cultures before antibiotics', required: true, timeframe: 'within 3 hours', order: 2 },
      { id: 'sep3-abx', text: 'Administer broad-spectrum antibiotics', required: true, timeframe: 'within 3 hours', order: 3 },
      { id: 'sep3-fluids', text: 'Administer 30 mL/kg crystalloid for hypotension or lactate >= 4', required: true, timeframe: 'within 3 hours', order: 4 },
    ],
    source: 'Surviving Sepsis Campaign 2021',
    lastUpdated: '2024-01-01',
    enabled: true,
  },
  {
    id: 'sepsis-6hr',
    name: 'Sepsis 6-Hour Bundle',
    shortName: 'SEP-6',
    category: 'sepsis',
    description: 'Continued management for persistent hypotension/elevated lactate',
    items: [
      { id: 'sep6-vasopressors', text: 'Apply vasopressors for hypotension not responding to fluids (target MAP >= 65)', required: true, timeframe: 'within 6 hours', order: 1 },
      { id: 'sep6-cvp', text: 'Measure CVP if available', required: false, timeframe: 'within 6 hours', order: 2 },
      { id: 'sep6-scvo2', text: 'Measure ScvO2 if available', required: false, timeframe: 'within 6 hours', order: 3 },
      { id: 'sep6-relactate', text: 'Remeasure lactate if initial elevated', required: true, timeframe: 'within 6 hours', order: 4 },
    ],
    source: 'Surviving Sepsis Campaign 2021',
    lastUpdated: '2024-01-01',
    enabled: true,
  },
  {
    id: 'vap-prevention',
    name: 'VAP Prevention Bundle',
    shortName: 'VAP',
    category: 'respiratory',
    description: 'Ventilator-associated pneumonia prevention',
    items: [
      { id: 'vap-hob', text: 'Head of bed elevated 30-45 degrees', required: true, timeframe: 'continuous', order: 1 },
      { id: 'vap-sedation', text: 'Daily sedation vacation and assess readiness to extubate', required: true, timeframe: 'daily', order: 2 },
      { id: 'vap-dvt', text: 'DVT prophylaxis', required: true, timeframe: 'daily', order: 3 },
      { id: 'vap-peptic', text: 'Peptic ulcer disease prophylaxis', required: true, timeframe: 'daily', order: 4 },
      { id: 'vap-oral', text: 'Oral care with chlorhexidine', required: true, timeframe: 'every 6 hours', order: 5 },
      { id: 'vap-cuff', text: 'Endotracheal tube cuff pressure 20-30 cm H2O', required: true, timeframe: 'every 8 hours', order: 6 },
    ],
    source: 'IHI',
    lastUpdated: '2024-01-01',
    enabled: true,
  },
  {
    id: 'cauti-prevention',
    name: 'CAUTI Prevention Bundle',
    shortName: 'CAUTI',
    category: 'renal',
    description: 'Catheter-associated urinary tract infection prevention',
    items: [
      { id: 'cauti-indication', text: 'Daily assessment of catheter necessity', required: true, timeframe: 'daily', order: 1 },
      { id: 'cauti-aseptic', text: 'Aseptic insertion technique documented', required: true, timeframe: 'on insertion', order: 2 },
      { id: 'cauti-maintenance', text: 'Proper catheter maintenance and securement', required: true, timeframe: 'continuous', order: 3 },
      { id: 'cauti-drainage', text: 'Maintain unobstructed urine flow and closed system', required: true, timeframe: 'continuous', order: 4 },
      { id: 'cauti-remove', text: 'Remove catheter as soon as possible', required: true, timeframe: 'ongoing assessment', order: 5 },
    ],
    source: 'CDC/HICPAC',
    lastUpdated: '2024-01-01',
    enabled: true,
  },
  {
    id: 'clabsi-prevention',
    name: 'CLABSI Prevention Bundle',
    shortName: 'CLABSI',
    category: 'prophylaxis',
    description: 'Central line-associated bloodstream infection prevention',
    items: [
      { id: 'clabsi-hygiene', text: 'Hand hygiene observed', required: true, timeframe: 'continuous', order: 1 },
      { id: 'clabsi-barrier', text: 'Maximal barrier precautions on insertion', required: true, timeframe: 'on insertion', order: 2 },
      { id: 'clabsi-chg', text: 'Chlorhexidine skin antisepsis', required: true, timeframe: 'on insertion', order: 3 },
      { id: 'clabsi-site', text: 'Optimal catheter site selection (avoid femoral)', required: true, timeframe: 'on insertion', order: 4 },
      { id: 'clabsi-review', text: 'Daily review of line necessity', required: true, timeframe: 'daily', order: 5 },
      { id: 'clabsi-dressing', text: 'Dressing changed per protocol', required: true, timeframe: 'per protocol', order: 6 },
    ],
    source: 'CDC/HICPAC',
    lastUpdated: '2024-01-01',
    enabled: true,
  },
  {
    id: 'dvt-prophylaxis',
    name: 'DVT Prophylaxis Protocol',
    shortName: 'DVT',
    category: 'prophylaxis',
    description: 'Venous thromboembolism prevention',
    items: [
      { id: 'dvt-risk', text: 'VTE risk assessment completed', required: true, timeframe: 'on admission', order: 1 },
      { id: 'dvt-bleeding', text: 'Bleeding risk assessment completed', required: true, timeframe: 'on admission', order: 2 },
      { id: 'dvt-mechanical', text: 'Mechanical prophylaxis (SCDs) if indicated', required: true, timeframe: 'continuous', order: 3 },
      { id: 'dvt-pharmacologic', text: 'Pharmacologic prophylaxis if indicated', required: true, timeframe: 'daily', order: 4 },
      { id: 'dvt-mobility', text: 'Early mobilization when possible', required: false, timeframe: 'daily', order: 5 },
    ],
    source: 'CHEST Guidelines',
    lastUpdated: '2024-01-01',
    enabled: true,
  },
  {
    id: 'gi-bleed',
    name: 'GI Bleed Management',
    shortName: 'GIB',
    category: 'gi',
    description: 'Acute upper GI bleed initial management',
    items: [
      { id: 'gib-access', text: 'Two large-bore IV access', required: true, timeframe: 'immediate', order: 1 },
      { id: 'gib-labs', text: 'Type and screen, CBC, BMP, coags, LFTs', required: true, timeframe: 'immediate', order: 2 },
      { id: 'gib-resuscitation', text: 'Volume resuscitation started', required: true, timeframe: 'immediate', order: 3 },
      { id: 'gib-ppi', text: 'IV PPI administered', required: true, timeframe: 'within 1 hour', order: 4 },
      { id: 'gib-transfusion', text: 'Blood products ordered if indicated (Hgb < 7)', required: false, timeframe: 'as needed', order: 5 },
      { id: 'gib-gi', text: 'GI consulted for endoscopy', required: true, timeframe: 'within 24 hours', order: 6 },
      { id: 'gib-anticoag', text: 'Anticoagulation held/reversed if applicable', required: false, timeframe: 'immediate', order: 7 },
    ],
    source: 'ACG Guidelines',
    lastUpdated: '2024-01-01',
    enabled: true,
  },
  {
    id: 'stroke-acute',
    name: 'Acute Stroke Protocol',
    shortName: 'STROKE',
    category: 'neuro',
    description: 'Acute ischemic stroke initial management',
    items: [
      { id: 'stroke-nihss', text: 'NIHSS documented', required: true, timeframe: 'immediate', order: 1 },
      { id: 'stroke-ct', text: 'Non-contrast CT head completed', required: true, timeframe: 'within 25 min', order: 2 },
      { id: 'stroke-glucose', text: 'Blood glucose checked', required: true, timeframe: 'immediate', order: 3 },
      { id: 'stroke-tpa', text: 'tPA eligibility assessed', required: true, timeframe: 'within 45 min', order: 4 },
      { id: 'stroke-bp', text: 'Blood pressure management per protocol', required: true, timeframe: 'continuous', order: 5 },
      { id: 'stroke-swallow', text: 'NPO until swallow evaluation', required: true, timeframe: 'continuous', order: 6 },
      { id: 'stroke-neuro', text: 'Neuro checks q1h for 24 hours', required: true, timeframe: 'every 1 hour', order: 7 },
    ],
    source: 'AHA/ASA Guidelines',
    lastUpdated: '2024-01-01',
    enabled: true,
  },
  {
    id: 'acs-nstemi',
    name: 'NSTEMI/UA Protocol',
    shortName: 'ACS',
    category: 'cardiac',
    description: 'Non-ST elevation ACS initial management',
    items: [
      { id: 'acs-ecg', text: 'ECG within 10 minutes', required: true, timeframe: 'within 10 min', order: 1 },
      { id: 'acs-troponin', text: 'Serial troponins ordered', required: true, timeframe: 'immediate', order: 2 },
      { id: 'acs-aspirin', text: 'Aspirin 325mg given (if no contraindication)', required: true, timeframe: 'immediate', order: 3 },
      { id: 'acs-anticoag', text: 'Anticoagulation initiated', required: true, timeframe: 'immediate', order: 4 },
      { id: 'acs-nitro', text: 'Nitroglycerin for ongoing chest pain', required: false, timeframe: 'as needed', order: 5 },
      { id: 'acs-beta', text: 'Beta-blocker if no contraindication', required: true, timeframe: 'within 24 hours', order: 6 },
      { id: 'acs-statin', text: 'High-intensity statin initiated', required: true, timeframe: 'within 24 hours', order: 7 },
      { id: 'acs-cards', text: 'Cardiology consulted', required: true, timeframe: 'immediate', order: 8 },
    ],
    source: 'ACC/AHA Guidelines',
    lastUpdated: '2024-01-01',
    enabled: true,
  },
  {
    id: 'dka-management',
    name: 'DKA Management Protocol',
    shortName: 'DKA',
    category: 'endo',
    description: 'Diabetic ketoacidosis treatment protocol',
    items: [
      { id: 'dka-fluids', text: 'IV NS bolus 1-2L then 250-500 mL/hr', required: true, timeframe: 'immediate', order: 1 },
      { id: 'dka-insulin', text: 'Insulin drip at 0.1 units/kg/hr', required: true, timeframe: 'after K+ confirmed > 3.3', order: 2 },
      { id: 'dka-k', text: 'Potassium replacement protocol', required: true, timeframe: 'continuous', order: 3 },
      { id: 'dka-glucose', text: 'Hourly glucose monitoring', required: true, timeframe: 'every 1 hour', order: 4 },
      { id: 'dka-bmp', text: 'BMP every 2-4 hours', required: true, timeframe: 'every 2-4 hours', order: 5 },
      { id: 'dka-gap', text: 'Monitor anion gap closure', required: true, timeframe: 'continuous', order: 6 },
      { id: 'dka-bicarb', text: 'Bicarbonate if pH < 6.9', required: false, timeframe: 'as needed', order: 7 },
      { id: 'dka-dextrose', text: 'Add D5 when glucose < 200', required: true, timeframe: 'when indicated', order: 8 },
    ],
    source: 'ADA Guidelines',
    lastUpdated: '2024-01-01',
    enabled: true,
  },
  {
    id: 'icu-admission',
    name: 'ICU Admission Checklist',
    shortName: 'ICU-ADM',
    category: 'admission',
    description: 'Standard ICU admission orders and assessments',
    items: [
      { id: 'icu-code', text: 'Code status confirmed', required: true, timeframe: 'on admission', order: 1 },
      { id: 'icu-allergies', text: 'Allergies verified', required: true, timeframe: 'on admission', order: 2 },
      { id: 'icu-weight', text: 'Admission weight obtained', required: true, timeframe: 'on admission', order: 3 },
      { id: 'icu-diet', text: 'Diet/nutrition plan ordered', required: true, timeframe: 'on admission', order: 4 },
      { id: 'icu-vte', text: 'VTE prophylaxis ordered', required: true, timeframe: 'on admission', order: 5 },
      { id: 'icu-stress', text: 'Stress ulcer prophylaxis ordered', required: true, timeframe: 'on admission', order: 6 },
      { id: 'icu-glycemic', text: 'Glycemic management plan', required: true, timeframe: 'on admission', order: 7 },
      { id: 'icu-access', text: 'IV access adequate', required: true, timeframe: 'on admission', order: 8 },
      { id: 'icu-foley', text: 'Foley catheter indication documented', required: false, timeframe: 'on admission', order: 9 },
      { id: 'icu-lines', text: 'Central line indication documented', required: false, timeframe: 'on admission', order: 10 },
    ],
    source: 'Local Protocol',
    lastUpdated: '2024-01-01',
    enabled: true,
  },
  {
    id: 'extubation',
    name: 'Extubation Readiness',
    shortName: 'EXTUB',
    category: 'respiratory',
    description: 'Criteria for extubation assessment',
    items: [
      { id: 'extub-resolve', text: 'Underlying cause resolved/improving', required: true, timeframe: 'assessment', order: 1 },
      { id: 'extub-neuro', text: 'Adequate mental status (GCS >= 8, follows commands)', required: true, timeframe: 'assessment', order: 2 },
      { id: 'extub-cough', text: 'Adequate cough and gag reflex', required: true, timeframe: 'assessment', order: 3 },
      { id: 'extub-secretions', text: 'Manageable secretions', required: true, timeframe: 'assessment', order: 4 },
      { id: 'extub-rsbi', text: 'RSBI < 105', required: true, timeframe: 'assessment', order: 5 },
      { id: 'extub-nif', text: 'NIF < -20 cm H2O', required: false, timeframe: 'assessment', order: 6 },
      { id: 'extub-sbt', text: 'Passed SBT (30-120 min)', required: true, timeframe: 'assessment', order: 7 },
      { id: 'extub-cuff', text: 'Cuff leak present', required: false, timeframe: 'assessment', order: 8 },
    ],
    source: 'ATS Guidelines',
    lastUpdated: '2024-01-01',
    enabled: true,
  },
];

// Helper functions
export const getProtocolsByCategory = (category: ProtocolCategory): Protocol[] => {
  return DEFAULT_PROTOCOLS.filter(p => p.category === category && p.enabled);
};

export const getProtocolById = (id: string): Protocol | undefined => {
  return DEFAULT_PROTOCOLS.find(p => p.id === id);
};

export const calculateProtocolCompletion = (protocol: PatientProtocol, protocolDef: Protocol): number => {
  const requiredItems = protocolDef.items.filter(i => i.required);
  const completedRequired = requiredItems.filter(i => protocol.completedItems.includes(i.id));
  return requiredItems.length > 0 ? (completedRequired.length / requiredItems.length) * 100 : 0;
};
