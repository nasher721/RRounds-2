export interface ProtocolChecklist {
  id: string;
  name: string;
  description: string;
  category: 'sepsis' | 'prevention' | 'diagnostic' | 'treatment';
  priority: 'critical' | 'high' | 'moderate';
  items: ProtocolItem[];
  triggerKeywords: string[];
}

export interface ProtocolItem {
  id: string;
  text: string;
  completed: boolean;
  required: boolean;
}

export const PROTOCOLS: ProtocolChecklist[] = [
  {
    id: 'sepsis-3hour',
    name: 'Sepsis 3-Hour Bundle',
    description: 'Time-sensitive interventions for sepsis management (3-hour bundle)',
    category: 'sepsis',
    priority: 'critical',
    triggerKeywords: ['sepsis', 'infection', 'lactate', 'hypotension', 'suspicion of infection', 'septic'],
    items: [
      { id: 'lactate', text: 'Measure serum lactate', completed: false, required: true },
      { id: 'blood-culture', text: 'Obtain blood cultures before antibiotics', completed: false, required: true },
      { id: 'antibiotics', text: 'Administer broad-spectrum antibiotics', completed: false, required: true },
      { id: 'fluids', text: 'Begin fluid resuscitation', completed: false, required: true },
      { id: 'vasopressors', text: 'Start vasopressors if hypotensive', completed: false, required: false },
    ],
  },
  {
    id: 'vte-prophylaxis',
    name: 'VTE Prophylaxis',
    description: 'Prevention of venous thromboembolism',
    category: 'prevention',
    priority: 'high',
    triggerKeywords: ['immobile', 'bedridden', 'surgery', 'trauma', 'reduced mobility', 'surgery', 'orthopedic', 'hip fracture'],
    items: [
      { id: 'assessment', text: 'Assess VTE risk', completed: false, required: true },
      { id: 'compression', text: 'Apply sequential compression devices', completed: false, required: false },
      { id: 'anticoagulation', text: 'Start pharmacologic prophylaxis', completed: false, required: false },
      { id: 'early-mobilization', text: 'Early mobilization when appropriate', completed: false, required: false },
    ],
  },
  {
    id: 'vap-prevention',
    name: 'VAP Prevention Bundle',
    description: 'Prevention of ventilator-associated pneumonia',
    category: 'prevention',
    priority: 'high',
    triggerKeywords: ['ventilated', 'intubated', 'mechanical ventilation', 'ventilator', 'cpap', 'bi-pap'],
    items: [
      { id: 'head-elevation', text: 'Elevate head of bed 30-45°', completed: false, required: true },
      { id: 'sedation-holiday', text: 'Daily sedation interruption', completed: false, required: true },
      { id: 'oral-care', text: 'Perform oral care every 2-4 hours', completed: false, required: true },
      { id: 'assess-readiness', text: 'Assess readiness for extubation daily', completed: false, required: true },
    ],
  },
  {
    id: 'cauti-prevention',
    name: 'CAUTI Prevention Bundle',
    description: 'Prevention of catheter-associated urinary tract infection',
    category: 'prevention',
    priority: 'high',
    triggerKeywords: ['foley', 'catheter', 'urinary', 'indwelling catheter', 'catheter', 'urinary catheter'],
    items: [
      { id: 'indication', text: 'Document ongoing indication', completed: false, required: true },
      { id: 'maintain-closure', text: 'Keep system closed', completed: false, required: true },
      { id: 'assess-removal', text: 'Assess for catheter removal daily', completed: false, required: true },
      { id: 'maintain-closure', text: 'Maintain aseptic technique', completed: false, required: false },
    ],
  },
  {
    id: 'clabsi-prevention',
    name: 'CLABSI Prevention Bundle',
    description: 'Prevention of central line-associated bloodstream infection',
    category: 'prevention',
    priority: 'high',
    triggerKeywords: ['central line', 'picc', 'cvl', 'dialysis catheter', 'midline', 'central line', 'cvc', 'picc line'],
    items: [
      { id: 'dressing-intact', text: 'Verify dressing integrity', completed: false, required: true },
      { id: 'assess-need', text: 'Assess ongoing need daily', completed: false, required: true },
      { id: 'cap-change', text: 'Change needleless connector per protocol', completed: false, required: false },
      { id: 'bundle-compliance', text: 'Perform daily CHG bath', completed: false, required: false },
    ],
  },
  {
    id: 'delirium-prevention',
    name: 'Delirium Prevention',
    description: 'Prevention and management of ICU delirium',
    category: 'prevention',
    priority: 'moderate',
    triggerKeywords: ['delirium', 'confusion', 'icu', 'sedated', 'sedation', 'orientation', 'confused'],
    items: [
      { id: 'assess-cam', text: 'Assess with CAM-ICU daily', completed: false, required: true },
      { id: 'reorient', text: 'Reorient patient regularly', completed: false, required: false },
      { id: 'mobilize', text: 'Early mobilization when appropriate', completed: false, required: false },
      { id: 'limit-sedation', text: 'Minimize sedation', completed: false, required: false },
      { id: 'sleep-hygiene', text: 'Maintain circadian rhythm', completed: false, required: false },
    ],
  },
  {
    id: 'pain-management',
    name: 'Pain Management Bundle',
    description: 'Standard pain assessment and management protocol',
    category: 'diagnostic',
    priority: 'moderate',
    triggerKeywords: ['pain', 'analgesic', 'sedation', 'sedation sca', 'recovery', 'post-op', 'postoperative', 'pain score'],
    items: [
      { id: 'assess-pain', text: 'Assess pain using validated scale', completed: false, required: true },
      { id: 'treat-immediately', text: 'Treat pain immediately upon assessment', completed: false, required: true },
      { id: 're-assess', text: 'Re-assess pain response', completed: false, required: true },
      { id: 'doc-pain', text: 'Document pain score and treatment', completed: false, required: false },
    ],
  },
  {
    id: 'aspirin-thromboprophylaxis',
    name: 'Aspirin Thromboprophylaxis',
    description: 'Aspirin for VTE prophylaxis in medical patients',
    category: 'prevention',
    priority: 'high',
    triggerKeywords: ['medical', 'medical patient', 'orthopedic', 'hip', 'knee', 'surgery', 'fracture', 'trauma'],
    items: [
      { id: 'assess-indication', text: 'Assess for medical patient thromboprophylaxis indication', completed: false, required: true },
      { id: 'aspirin-dose', text: 'Start aspirin 81mg daily if indicated', completed: false, required: true },
      { id: 'monitor-bleeding', text: 'Monitor for bleeding risk', completed: false, required: false },
      { id: 'contraindication-check', text: 'Check contraindications to aspirin', completed: false, required: true },
    ],
  },
];

export function suggestProtocols(patient: { clinicalSummary?: string; intervalEvents?: string; labs?: string; imaging?: string; systems?: Record<string, string> }): ProtocolChecklist[] {
  const text = [
    patient.clinicalSummary || '',
    patient.intervalEvents || '',
    patient.labs || '',
    patient.imaging || '',
    Object.values(patient.systems || {}).join(' '),
  ].join(' ').toLowerCase();

  return PROTOCOLS.filter(protocol =>
    protocol.triggerKeywords.some(keyword => text.includes(keyword.toLowerCase()))
  );
}

export function getProtocolById(id: string): ProtocolChecklist | undefined {
  return PROTOCOLS.find(p => p.id === id);
}
