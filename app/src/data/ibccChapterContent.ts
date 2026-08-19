/**
 * IBCC Chapter Content Data
 * Comprehensive clinical content for embedded reference
 */

import type { IBCCChapterContent } from '@/types/ibcc';

/**
 * Content lookup by chapter ID
 */
export const CHAPTER_CONTENT: Record<string, IBCCChapterContent> = {
  // ============================================
  // SEPSIS - Comprehensive Content
  // ============================================
  sepsis: {
    keyPearls: [
      {
        id: 'sepsis-pearl-1',
        text: 'Early antibiotics save lives. Every hour of delay in antibiotics increases mortality by 7.6% in septic shock.',
        importance: 'critical',
        category: 'Antibiotics',
      },
      {
        id: 'sepsis-pearl-2',
        text: 'Lactate clearance is more important than absolute lactate value. Target >10% clearance every 2 hours.',
        importance: 'critical',
        category: 'Resuscitation',
      },
      {
        id: 'sepsis-pearl-3',
        text: 'Norepinephrine is the first-line vasopressor. Start early - do not delay for fluid resuscitation.',
        importance: 'high',
        category: 'Vasopressors',
      },
      {
        id: 'sepsis-pearl-4',
        text: 'Source control within 6-12 hours is essential. Undrained abscesses = ongoing sepsis.',
        importance: 'high',
        category: 'Source Control',
      },
      {
        id: 'sepsis-pearl-5',
        text: 'Avoid excessive fluid resuscitation. After initial 30 mL/kg, reassess before giving more.',
        importance: 'high',
        category: 'Fluids',
      },
      {
        id: 'sepsis-pearl-6',
        text: 'qSOFA (≥2 of: RR≥22, AMS, SBP≤100) identifies patients at risk - but sensitivity is low for screening.',
        importance: 'moderate',
        category: 'Diagnosis',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'sepsis-dx-1',
        title: 'Sepsis-3 Definition',
        criteria: [
          { id: 'dx-1-1', text: 'Suspected or documented infection', required: true },
          { id: 'dx-1-2', text: 'SOFA score increase ≥2 from baseline', required: true, value: 'SOFA ≥2' },
          { id: 'dx-1-3', text: 'Organ dysfunction present', required: true },
        ],
        notes: 'Sepsis = life-threatening organ dysfunction caused by dysregulated host response to infection',
      },
      {
        id: 'sepsis-dx-2',
        title: 'Septic Shock Criteria',
        criteria: [
          { id: 'dx-2-1', text: 'Sepsis present', required: true },
          { id: 'dx-2-2', text: 'Vasopressor required to maintain MAP ≥65 mmHg', required: true, value: 'MAP ≥65' },
          { id: 'dx-2-3', text: 'Lactate >2 mmol/L despite adequate fluid resuscitation', required: true, value: '>2 mmol/L' },
        ],
        notes: 'Septic shock has ~40% hospital mortality',
      },
      {
        id: 'sepsis-dx-3',
        title: 'qSOFA (Quick SOFA)',
        criteria: [
          { id: 'dx-3-1', text: 'Respiratory rate ≥22/min', value: 'RR ≥22' },
          { id: 'dx-3-2', text: 'Altered mental status (GCS <15)', value: 'GCS <15' },
          { id: 'dx-3-3', text: 'Systolic blood pressure ≤100 mmHg', value: 'SBP ≤100' },
        ],
        notes: 'qSOFA ≥2 suggests high risk, but low sensitivity - use clinical judgment',
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'sepsis-tx-1',
        phase: 'Hour 1',
        title: 'Immediate Resuscitation',
        timing: '0-60 minutes',
        actions: [
          { id: 'tx-1-1', text: 'Obtain blood cultures (2 sets) before antibiotics', priority: 'immediate', details: 'Do not delay antibiotics if cultures will take >45 min' },
          { id: 'tx-1-2', text: 'Administer broad-spectrum antibiotics', priority: 'immediate', details: 'Within 1 hour of recognition' },
          { id: 'tx-1-3', text: 'Measure lactate level', priority: 'immediate' },
          { id: 'tx-1-4', text: 'Begin crystalloid 30 mL/kg for hypotension or lactate ≥4', priority: 'immediate' },
        ],
        notes: 'Sepsis Hour-1 Bundle - these 4 interventions must all begin within 1 hour',
      },
      {
        id: 'sepsis-tx-2',
        phase: 'Hours 1-6',
        title: 'Hemodynamic Optimization',
        timing: '1-6 hours',
        actions: [
          { id: 'tx-2-1', text: 'Start norepinephrine if MAP <65 despite fluids', priority: 'urgent', details: 'Target MAP 65-70 mmHg' },
          { id: 'tx-2-2', text: 'Repeat lactate if initial was elevated', priority: 'urgent' },
          { id: 'tx-2-3', text: 'Assess fluid responsiveness before additional boluses', priority: 'urgent', details: 'Passive leg raise, pulse pressure variation' },
          { id: 'tx-2-4', text: 'Central venous access for vasopressors', priority: 'routine' },
          { id: 'tx-2-5', text: 'Consider arterial line for hemodynamic monitoring', priority: 'routine' },
        ],
      },
      {
        id: 'sepsis-tx-3',
        phase: 'Hours 6-24',
        title: 'Source Control & De-escalation',
        timing: '6-24 hours',
        actions: [
          { id: 'tx-3-1', text: 'Identify and control source of infection', priority: 'urgent', details: 'Imaging, drainage, debridement as needed' },
          { id: 'tx-3-2', text: 'Narrow antibiotics based on culture results', priority: 'routine' },
          { id: 'tx-3-3', text: 'Wean vasopressors if stable', priority: 'routine' },
          { id: 'tx-3-4', text: 'Reassess need for stress-dose steroids', priority: 'routine', details: 'If refractory shock despite vasopressors' },
        ],
      },
    ],
    medications: [
      {
        id: 'sepsis-med-1',
        name: 'Norepinephrine',
        genericName: 'norepinephrine bitartrate',
        category: 'first-line',
        indication: 'First-line vasopressor for septic shock',
        dosing: [
          { route: 'IV', dose: '0.01-0.5 mcg/kg/min', notes: 'Start at 5-10 mcg/min, titrate to MAP' },
        ],
        contraindications: ['Hypovolemia (relative)'],
        sideEffects: ['Tissue necrosis with extravasation', 'Arrhythmias', 'Peripheral ischemia'],
        monitoringParameters: ['MAP', 'Heart rate', 'Lactate', 'Urine output'],
        pearls: [
          'Can run peripherally short-term (dilute, large vein, above antecubital fossa)',
          'No maximum dose - titrate to effect',
        ],
      },
      {
        id: 'sepsis-med-2',
        name: 'Vasopressin',
        genericName: 'arginine vasopressin',
        category: 'second-line',
        indication: 'Add to norepinephrine in refractory septic shock',
        dosing: [
          { route: 'IV', dose: '0.03-0.04 units/min', notes: 'Fixed dose, not titrated' },
        ],
        contraindications: ['Mesenteric ischemia (relative)'],
        sideEffects: ['Digital ischemia', 'Hyponatremia', 'Cardiac ischemia'],
        monitoringParameters: ['Sodium', 'Peripheral perfusion', 'MAP'],
        pearls: [
          'Add when norepinephrine dose is 0.25-0.5 mcg/kg/min',
          'Allows norepinephrine dose reduction',
        ],
      },
      {
        id: 'sepsis-med-3',
        name: 'Hydrocortisone',
        genericName: 'hydrocortisone sodium succinate',
        category: 'adjunct',
        indication: 'Refractory septic shock despite vasopressors',
        dosing: [
          { route: 'IV', dose: '50 mg q6h or 200 mg/day continuous', notes: 'Continue for ~7 days, then taper' },
        ],
        contraindications: ['Active fungal infection (relative)'],
        sideEffects: ['Hyperglycemia', 'Immunosuppression', 'Sodium retention'],
        monitoringParameters: ['Blood glucose', 'Sodium'],
        pearls: [
          'Start if still requiring high-dose vasopressor >4-6 hours',
          'No ACTH stim test needed before starting',
        ],
      },
    ],
    pitfalls: [
      {
        id: 'sepsis-pitfall-1',
        title: 'Delayed antibiotics',
        description: 'Waiting for cultures, imaging, or "complete workup" before starting antibiotics',
        consequence: '7.6% increased mortality per hour of delay in septic shock',
        prevention: 'Start empiric broad-spectrum antibiotics within 1 hour of sepsis recognition',
        severity: 'critical',
      },
      {
        id: 'sepsis-pitfall-2',
        title: 'Excessive crystalloid resuscitation',
        description: 'Giving >30 mL/kg without reassessing fluid responsiveness',
        consequence: 'Pulmonary edema, increased ventilator days, worse outcomes',
        prevention: 'After initial 30 mL/kg, assess fluid responsiveness before additional boluses',
        severity: 'major',
      },
      {
        id: 'sepsis-pitfall-3',
        title: 'Delayed vasopressors',
        description: 'Waiting to "finish fluids" before starting vasopressors',
        consequence: 'Prolonged hypotension, tissue hypoperfusion, organ failure',
        prevention: 'Start norepinephrine early if MAP <65 despite initial fluids',
        severity: 'major',
      },
      {
        id: 'sepsis-pitfall-4',
        title: 'Ignoring source control',
        description: 'Focusing only on antibiotics without addressing drainable collections',
        consequence: 'Ongoing sepsis despite appropriate antibiotics',
        prevention: 'Early imaging, drainage of abscesses within 6-12 hours',
        severity: 'major',
      },
    ],
    differentialDiagnosis: [
      'Cardiogenic shock (check echo)',
      'Hypovolemic shock (bleeding, GI losses)',
      'Anaphylaxis',
      'Adrenal crisis',
      'Drug overdose/toxin',
      'Severe pancreatitis',
    ],
  },


  // ============================================
  // DKA - Comprehensive Content
  // ============================================
  dka: {
    keyPearls: [
      {
        id: 'dka-pearl-1',
        text: 'Potassium before insulin! Check K+ before starting insulin. If K+ <3.3, replete K+ first.',
        importance: 'critical',
        category: 'Electrolytes',
      },
      {
        id: 'dka-pearl-2',
        text: 'Fluid resuscitation is the most important initial therapy. Start with 1-2L NS in first hour.',
        importance: 'critical',
        category: 'Fluids',
      },
      {
        id: 'dka-pearl-3',
        text: 'Add dextrose when glucose <250 mg/dL. Do not stop insulin - continue until anion gap closes.',
        importance: 'high',
        category: 'Insulin',
      },
      {
        id: 'dka-pearl-4',
        text: 'Cerebral edema risk: Avoid rapid glucose drops >100 mg/dL/hr, especially in pediatrics.',
        importance: 'high',
        category: 'Complications',
      },
      {
        id: 'dka-pearl-5',
        text: 'Transition to SC insulin when: eating, anion gap closed, glucose <200, bicarb >15.',
        importance: 'moderate',
        category: 'Transition',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'dka-dx-1',
        title: 'DKA Diagnostic Criteria',
        criteria: [
          { id: 'dx-1-1', text: 'Blood glucose >250 mg/dL', required: true, value: '>250 mg/dL' },
          { id: 'dx-1-2', text: 'Arterial pH <7.3 or serum bicarbonate <18 mEq/L', required: true },
          { id: 'dx-1-3', text: 'Elevated anion gap (>12)', required: true, value: 'AG >12' },
          { id: 'dx-1-4', text: 'Ketonemia or ketonuria', required: true },
        ],
      },
      {
        id: 'dka-dx-2',
        title: 'Severity Classification',
        criteria: [
          { id: 'dx-2-1', text: 'Mild: pH 7.25-7.30, Bicarb 15-18, Alert', value: 'Mild' },
          { id: 'dx-2-2', text: 'Moderate: pH 7.00-7.24, Bicarb 10-14, Drowsy', value: 'Moderate' },
          { id: 'dx-2-3', text: 'Severe: pH <7.00, Bicarb <10, Stupor/Coma', value: 'Severe' },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'dka-tx-1',
        phase: 'Hour 0-1',
        title: 'Initial Resuscitation',
        timing: '0-60 minutes',
        actions: [
          { id: 'tx-1-1', text: 'NS 1-2 L IV bolus (15-20 mL/kg)', priority: 'immediate' },
          { id: 'tx-1-2', text: 'Check BMP, VBG, beta-hydroxybutyrate', priority: 'immediate' },
          { id: 'tx-1-3', text: 'Check potassium level', priority: 'immediate', details: 'Do NOT start insulin if K <3.3' },
          { id: 'tx-1-4', text: 'Search for precipitating cause', priority: 'urgent', details: 'Infection, MI, medication noncompliance' },
        ],
      },
      {
        id: 'dka-tx-2',
        phase: 'Hours 1-12',
        title: 'Insulin & Electrolyte Management',
        timing: '1-12 hours',
        actions: [
          { id: 'tx-2-1', text: 'Start insulin infusion 0.1 units/kg/hr', priority: 'urgent', details: 'After confirming K ≥3.3' },
          { id: 'tx-2-2', text: 'Continue IV fluids 250-500 mL/hr', priority: 'urgent' },
          { id: 'tx-2-3', text: 'Add K+ 20-40 mEq/L to fluids if K <5.2', priority: 'urgent' },
          { id: 'tx-2-4', text: 'Check glucose q1h, BMP q2-4h', priority: 'routine' },
          { id: 'tx-2-5', text: 'Add D5 when glucose <250 mg/dL', priority: 'routine' },
        ],
      },
      {
        id: 'dka-tx-3',
        phase: 'Resolution',
        title: 'Transition to Subcutaneous Insulin',
        timing: 'When AG closed',
        actions: [
          { id: 'tx-3-1', text: 'Confirm: AG closed, glucose <200, pH >7.3, bicarb >15', priority: 'routine' },
          { id: 'tx-3-2', text: 'Give SC long-acting insulin', priority: 'routine', details: 'Overlap with IV infusion by 2-4 hours' },
          { id: 'tx-3-3', text: 'Stop IV insulin 2-4 hours after SC dose', priority: 'routine' },
          { id: 'tx-3-4', text: 'Start oral intake when tolerating', priority: 'routine' },
        ],
      },
    ],
    medications: [
      {
        id: 'dka-med-1',
        name: 'Regular Insulin',
        genericName: 'insulin regular',
        category: 'first-line',
        indication: 'IV insulin infusion for DKA',
        dosing: [
          { route: 'IV', dose: '0.1 units/kg/hr continuous', notes: 'Target glucose drop 50-75 mg/dL/hr' },
        ],
        sideEffects: ['Hypoglycemia', 'Hypokalemia'],
        monitoringParameters: ['Blood glucose q1h', 'Potassium q2-4h'],
        pearls: [
          'Do not bolus insulin - go straight to infusion',
          'Continue until anion gap closes, not just glucose normalizes',
        ],
      },
      {
        id: 'dka-med-2',
        name: 'Potassium Chloride',
        genericName: 'KCl',
        category: 'first-line',
        indication: 'Potassium replacement in DKA',
        dosing: [
          { route: 'IV', dose: '20-40 mEq/L in IV fluids', notes: 'Add to fluids if K <5.2' },
        ],
        contraindications: ['K >5.2 mEq/L', 'Severe renal failure'],
        monitoringParameters: ['Potassium q2-4h', 'EKG if K <3 or >6'],
        pearls: [
          'If K <3.3, hold insulin and replete K first',
          'Total body K is depleted even if serum K is normal',
        ],
      },
    ],
    pitfalls: [
      {
        id: 'dka-pitfall-1',
        title: 'Starting insulin before checking potassium',
        description: 'Giving insulin when K+ is critically low',
        consequence: 'Life-threatening hypokalemia, cardiac arrhythmias',
        prevention: 'Always check K+ first. If K <3.3, replete K before starting insulin',
        severity: 'critical',
      },
      {
        id: 'dka-pitfall-2',
        title: 'Stopping insulin when glucose normalizes',
        description: 'Discontinuing insulin based on glucose alone',
        consequence: 'Persistent ketoacidosis, DKA recurrence',
        prevention: 'Continue insulin until anion gap closes, add dextrose to maintain glucose 150-200',
        severity: 'critical',
      },
      {
        id: 'dka-pitfall-3',
        title: 'Missing the precipitant',
        description: 'Treating DKA without identifying underlying cause',
        consequence: 'Recurrent DKA, missed serious diagnosis (MI, infection)',
        prevention: 'Always search for precipitating cause - infection, MI, medication noncompliance',
        severity: 'major',
      },
    ],
    differentialDiagnosis: [
      'Alcoholic ketoacidosis',
      'Starvation ketosis',
      'Hyperosmolar hyperglycemic state (HHS)',
      'Lactic acidosis',
      'Toxic ingestion (methanol, ethylene glycol)',
    ],
  },

  // ============================================
  // SHOCK - Comprehensive Content
  // ============================================
  shock: {
    keyPearls: [
      {
        id: 'shock-pearl-1',
        text: 'Think in categories: Distributive, Cardiogenic, Hypovolemic, Obstructive. Each has different treatment.',
        importance: 'critical',
        category: 'Classification',
      },
      {
        id: 'shock-pearl-2',
        text: 'Bedside echo is essential. 5-view cardiac exam can rapidly identify cardiogenic vs non-cardiogenic shock.',
        importance: 'critical',
        category: 'Diagnosis',
      },
      {
        id: 'shock-pearl-3',
        text: 'MAP ≥65 is the target, but some patients need higher. Use end-organ perfusion markers.',
        importance: 'high',
        category: 'Targets',
      },
      {
        id: 'shock-pearl-4',
        text: 'Lactate clearance >10% every 2 hours indicates adequate resuscitation.',
        importance: 'high',
        category: 'Monitoring',
      },
      {
        id: 'shock-pearl-5',
        text: 'Cold extremities with low SvO2 = cardiogenic. Warm extremities with high SvO2 = distributive.',
        importance: 'moderate',
        category: 'Diagnosis',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'shock-dx-1',
        title: 'Shock Definition',
        criteria: [
          { id: 'dx-1-1', text: 'Systolic BP <90 mmHg or MAP <65 mmHg', required: true },
          { id: 'dx-1-2', text: 'Evidence of tissue hypoperfusion', required: true },
          { id: 'dx-1-3', text: 'Elevated lactate (>2 mmol/L)', value: '>2 mmol/L' },
          { id: 'dx-1-4', text: 'Oliguria (<0.5 mL/kg/hr)', value: '<0.5 mL/kg/hr' },
          { id: 'dx-1-5', text: 'Altered mental status' },
          { id: 'dx-1-6', text: 'Mottled skin/delayed cap refill' },
        ],
      },
      {
        id: 'shock-dx-2',
        title: 'Shock Classification',
        criteria: [
          { id: 'dx-2-1', text: 'Distributive: Warm, vasodilated, high CO, low SVR (sepsis, anaphylaxis)' },
          { id: 'dx-2-2', text: 'Cardiogenic: Cold, low CO, high SVR, elevated filling pressures' },
          { id: 'dx-2-3', text: 'Hypovolemic: Cold, low CO, low filling pressures (hemorrhage, dehydration)' },
          { id: 'dx-2-4', text: 'Obstructive: PE, tamponade, tension pneumothorax' },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'shock-tx-1',
        phase: 'Immediate',
        title: 'Rapid Assessment',
        timing: '0-15 minutes',
        actions: [
          { id: 'tx-1-1', text: 'Obtain IV access (2 large-bore IVs or central line)', priority: 'immediate' },
          { id: 'tx-1-2', text: 'Bedside echo to classify shock type', priority: 'immediate', details: 'LV function, RV strain, IVC, pericardial effusion' },
          { id: 'tx-1-3', text: 'Labs: Lactate, BMP, CBC, troponin, VBG', priority: 'immediate' },
          { id: 'tx-1-4', text: 'EKG - rule out STEMI', priority: 'immediate' },
        ],
      },
      {
        id: 'shock-tx-2',
        phase: 'Resuscitation',
        title: 'Type-Specific Treatment',
        timing: '15-60 minutes',
        actions: [
          { id: 'tx-2-1', text: 'Distributive: Fluids + early vasopressors (norepinephrine)', priority: 'urgent' },
          { id: 'tx-2-2', text: 'Cardiogenic: Cautious fluids, inotropes (dobutamine), consider mechanical support', priority: 'urgent' },
          { id: 'tx-2-3', text: 'Hypovolemic: Aggressive fluid/blood resuscitation, identify source', priority: 'urgent' },
          { id: 'tx-2-4', text: 'Obstructive: Treat underlying cause (tPA for PE, pericardiocentesis, needle decompression)', priority: 'immediate' },
        ],
      },
    ],
    medications: [
      {
        id: 'shock-med-1',
        name: 'Norepinephrine',
        category: 'first-line',
        indication: 'First-line vasopressor for most shock states',
        dosing: [
          { route: 'IV', dose: '0.01-0.5 mcg/kg/min', notes: 'Start 5-10 mcg/min, titrate to MAP' },
        ],
        pearls: ['Preferred in distributive shock', 'Also reasonable in cardiogenic shock'],
      },
      {
        id: 'shock-med-2',
        name: 'Dobutamine',
        category: 'first-line',
        indication: 'Inotrope for cardiogenic shock',
        dosing: [
          { route: 'IV', dose: '2.5-20 mcg/kg/min', notes: 'Titrate to cardiac output' },
        ],
        sideEffects: ['Tachycardia', 'Hypotension', 'Arrhythmias'],
        pearls: ['May need to combine with norepinephrine', 'Avoid in hypovolemia'],
      },
      {
        id: 'shock-med-3',
        name: 'Epinephrine',
        category: 'rescue',
        indication: 'Anaphylaxis, refractory cardiogenic shock',
        dosing: [
          { route: 'IM', dose: '0.3-0.5 mg (1:1000)', notes: 'For anaphylaxis' },
          { route: 'IV', dose: '0.01-0.5 mcg/kg/min', notes: 'For shock' },
        ],
        pearls: ['First-line in anaphylaxis', 'Increases myocardial O2 demand'],
      },
    ],
    pitfalls: [
      {
        id: 'shock-pitfall-1',
        title: 'Not classifying shock type',
        description: 'Treating all shock the same way',
        consequence: 'Wrong treatment - fluids harm cardiogenic shock, vasopressors alone fail in hypovolemia',
        prevention: 'Bedside echo within 15 minutes to classify shock',
        severity: 'critical',
      },
      {
        id: 'shock-pitfall-2',
        title: 'Fixating on blood pressure alone',
        description: 'Achieving target MAP without assessing perfusion',
        consequence: 'Missed tissue hypoperfusion, ongoing shock despite "normal" BP',
        prevention: 'Follow lactate clearance, urine output, mental status, skin perfusion',
        severity: 'major',
      },
    ],
  },

  // ============================================
  // ARDS - Comprehensive Content
  // ============================================
  ards: {
    keyPearls: [
      {
        id: 'ards-pearl-1',
        text: 'Low tidal volume ventilation (6 mL/kg IBW) is the ONLY proven intervention to reduce ARDS mortality.',
        importance: 'critical',
        category: 'Ventilation',
      },
      {
        id: 'ards-pearl-2',
        text: 'Use IDEAL body weight, not actual weight, for tidal volume calculations. Obese patients get the same Vt as lean patients of same height.',
        importance: 'critical',
        category: 'Ventilation',
      },
      {
        id: 'ards-pearl-3',
        text: 'Prone positioning for 16+ hours/day reduces mortality in moderate-severe ARDS (P/F <150).',
        importance: 'critical',
        category: 'Positioning',
      },
      {
        id: 'ards-pearl-4',
        text: 'Plateau pressure <30 cm H2O and driving pressure <15 cm H2O are key ventilator targets.',
        importance: 'high',
        category: 'Ventilation',
      },
      {
        id: 'ards-pearl-5',
        text: 'Conservative fluid strategy improves oxygenation and reduces ventilator days in ARDS.',
        importance: 'high',
        category: 'Fluids',
      },
      {
        id: 'ards-pearl-6',
        text: 'PEEP improves oxygenation but optimal PEEP strategy remains debated. Use ARDSNet tables or driving pressure-guided approach.',
        importance: 'moderate',
        category: 'Ventilation',
      },
      {
        id: 'ards-pearl-7',
        text: 'Short-course neuromuscular blockade (≤48h) may improve ventilator synchrony in severe ARDS with deep sedation.',
        importance: 'moderate',
        category: 'Ventilation',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'ards-dx-1',
        title: 'Berlin Definition of ARDS',
        criteria: [
          { id: 'dx-1-1', text: 'Acute onset within 1 week of clinical insult or new/worsening respiratory symptoms', required: true },
          { id: 'dx-1-2', text: 'Bilateral opacities on chest imaging not fully explained by effusions, collapse, or nodules', required: true },
          { id: 'dx-1-3', text: 'Respiratory failure not fully explained by cardiac failure or fluid overload', required: true },
          { id: 'dx-1-4', text: 'Impaired oxygenation with PEEP ≥5 cm H2O', required: true },
        ],
        notes: 'Objective assessment (echo) needed to exclude hydrostatic edema if no risk factor present',
      },
      {
        id: 'ards-dx-2',
        title: 'ARDS Severity Classification',
        criteria: [
          { id: 'dx-2-1', text: 'Mild: P/F 200-300 mmHg', value: 'P/F 200-300' },
          { id: 'dx-2-2', text: 'Moderate: P/F 100-200 mmHg', value: 'P/F 100-200' },
          { id: 'dx-2-3', text: 'Severe: P/F <100 mmHg', value: 'P/F <100' },
        ],
        notes: 'All with PEEP ≥5 cm H2O. Mortality increases with severity.',
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'ards-tx-1',
        phase: 'Initial',
        title: 'Lung-Protective Ventilation',
        timing: 'Immediate',
        actions: [
          { id: 'tx-1-1', text: 'Calculate ideal body weight: Male = 50 + 2.3(height in inches - 60); Female = 45.5 + 2.3(height in inches - 60)', priority: 'immediate' },
          { id: 'tx-1-2', text: 'Set tidal volume 6 mL/kg IBW (range 4-8 mL/kg)', priority: 'immediate', details: 'Start at 6, may reduce to 4 if plateau pressure high' },
          { id: 'tx-1-3', text: 'Set initial PEEP using ARDSNet Low PEEP/High FiO2 table', priority: 'immediate' },
          { id: 'tx-1-4', text: 'Target plateau pressure ≤30 cm H2O', priority: 'immediate' },
          { id: 'tx-1-5', text: 'Target pH 7.25-7.45, allow permissive hypercapnia', priority: 'urgent' },
        ],
        notes: 'ARDSNet protocol: target Vt 6 mL/kg IBW, Pplat ≤30, SpO2 88-95%',
      },
      {
        id: 'ards-tx-2',
        phase: 'Moderate-Severe',
        title: 'Adjunctive Therapies',
        timing: 'If P/F <150',
        actions: [
          { id: 'tx-2-1', text: 'Initiate prone positioning 16+ hours/day', priority: 'urgent', details: 'PROSEVA trial: mortality benefit in moderate-severe ARDS' },
          { id: 'tx-2-2', text: 'Consider neuromuscular blockade for first 48 hours', priority: 'routine', details: 'Cisatracurium - may improve oxygenation' },
          { id: 'tx-2-3', text: 'Conservative fluid strategy once hemodynamically stable', priority: 'routine' },
          { id: 'tx-2-4', text: 'Optimize PEEP using driving pressure (Pplat - PEEP) <15 cm H2O', priority: 'routine' },
        ],
      },
      {
        id: 'ards-tx-3',
        phase: 'Refractory',
        title: 'Rescue Therapies',
        timing: 'If failing conventional therapy',
        actions: [
          { id: 'tx-3-1', text: 'Consider inhaled pulmonary vasodilators (iNO, epoprostenol)', priority: 'routine', details: 'Improve oxygenation but no mortality benefit' },
          { id: 'tx-3-2', text: 'Consider ECMO referral for refractory hypoxemia', priority: 'routine', details: 'P/F <80 for >6 hours or pH <7.25 with PaCO2 ≥60' },
          { id: 'tx-3-3', text: 'Recruitment maneuvers with caution', priority: 'routine', details: 'May cause hemodynamic instability' },
        ],
      },
    ],
    medications: [
      {
        id: 'ards-med-1',
        name: 'Cisatracurium',
        genericName: 'cisatracurium besylate',
        category: 'adjunct',
        indication: 'Neuromuscular blockade for severe ARDS',
        dosing: [
          { route: 'IV', dose: '0.1-0.2 mg/kg bolus, then 1-3 mcg/kg/min infusion', notes: 'Train-of-four monitoring' },
        ],
        contraindications: ['Myasthenia gravis'],
        sideEffects: ['ICU-acquired weakness with prolonged use', 'Requires deep sedation'],
        monitoringParameters: ['Train-of-four', 'Sedation depth'],
        pearls: [
          'Consider for first 48 hours in severe ARDS',
          'Reduces oxygen consumption, prevents ventilator dyssynchrony',
        ],
      },
      {
        id: 'ards-med-2',
        name: 'Inhaled Epoprostenol',
        genericName: 'epoprostenol sodium',
        category: 'rescue',
        indication: 'Refractory hypoxemia in ARDS',
        dosing: [
          { route: 'INH', dose: '10-50 ng/kg/min via ventilator circuit', notes: 'Titrate to oxygenation' },
        ],
        sideEffects: ['Systemic hypotension if absorbed', 'Rebound hypoxemia if stopped abruptly'],
        monitoringParameters: ['SpO2', 'Blood pressure'],
        pearls: [
          'Improves V/Q matching by dilating vessels in ventilated lung units',
          'No mortality benefit but may buy time',
        ],
      },
    ],
    pitfalls: [
      {
        id: 'ards-pitfall-1',
        title: 'Using actual body weight for tidal volume',
        description: 'Calculating Vt based on actual weight instead of ideal body weight',
        consequence: 'Obese patients receive dangerously high tidal volumes causing VILI',
        prevention: 'Always use IBW formula based on HEIGHT, not weight',
        severity: 'critical',
      },
      {
        id: 'ards-pitfall-2',
        title: 'Not proning early enough',
        description: 'Delaying prone positioning until patient is moribund',
        consequence: 'Missing window of mortality benefit',
        prevention: 'Initiate proning when P/F <150 with FiO2 ≥0.6, not as last resort',
        severity: 'major',
      },
      {
        id: 'ards-pitfall-3',
        title: 'Ignoring driving pressure',
        description: 'Focusing only on plateau pressure without calculating driving pressure',
        consequence: 'Suboptimal PEEP settings, ongoing lung injury',
        prevention: 'Target driving pressure (Pplat - PEEP) <15 cm H2O',
        severity: 'major',
      },
    ],
    differentialDiagnosis: [
      'Cardiogenic pulmonary edema',
      'Diffuse alveolar hemorrhage',
      'Acute eosinophilic pneumonia',
      'Acute interstitial pneumonia (AIP)',
      'Drug-induced lung injury',
      'Pulmonary vasculitis',
    ],
    tables: [
      {
        id: 'ards-table-1',
        title: 'ARDSNet Low PEEP/FiO2 Table',
        headers: ['FiO2', 'PEEP (cm H2O)'],
        rows: [
          ['0.3', '5'],
          ['0.4', '5-8'],
          ['0.5', '8-10'],
          ['0.6', '10'],
          ['0.7', '10-14'],
          ['0.8', '14'],
          ['0.9', '14-18'],
          ['1.0', '18-24'],
        ],
      },
    ],
  },

  // ============================================
  // PULMONARY EMBOLISM - Comprehensive Content
  // ============================================
  'pulmonary-embolism': {
    keyPearls: [
      {
        id: 'pe-pearl-1',
        text: 'Risk stratify ALL PEs. Massive (hypotensive), submassive (RV strain, elevated biomarkers), low-risk. Treatment differs dramatically.',
        importance: 'critical',
        category: 'Risk Stratification',
      },
      {
        id: 'pe-pearl-2',
        text: 'Hypotensive PE (massive) = systemic thrombolysis or catheter-directed therapy. Do not delay for testing.',
        importance: 'critical',
        category: 'Treatment',
      },
      {
        id: 'pe-pearl-3',
        text: 'RV strain on echo + elevated troponin = submassive PE. Consider advanced therapies if clinical deterioration.',
        importance: 'high',
        category: 'Risk Stratification',
      },
      {
        id: 'pe-pearl-4',
        text: 'PERC rule: If ALL 8 criteria negative, no D-dimer needed. Low pretest probability + negative D-dimer = PE ruled out.',
        importance: 'high',
        category: 'Diagnosis',
      },
      {
        id: 'pe-pearl-5',
        text: 'Avoid aggressive fluid resuscitation in PE. RV is preload-sensitive. Small boluses (250-500 mL) if needed.',
        importance: 'high',
        category: 'Resuscitation',
      },
      {
        id: 'pe-pearl-6',
        text: 'Thrombolysis window is longer than stroke - can consider up to 14 days after symptom onset.',
        importance: 'moderate',
        category: 'Treatment',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'pe-dx-1',
        title: 'PERC Rule (PE Ruled Out if ALL negative)',
        criteria: [
          { id: 'dx-1-1', text: 'Age <50 years' },
          { id: 'dx-1-2', text: 'Heart rate <100 bpm' },
          { id: 'dx-1-3', text: 'SpO2 ≥95% on room air' },
          { id: 'dx-1-4', text: 'No hemoptysis' },
          { id: 'dx-1-5', text: 'No estrogen use' },
          { id: 'dx-1-6', text: 'No prior DVT/PE' },
          { id: 'dx-1-7', text: 'No unilateral leg swelling' },
          { id: 'dx-1-8', text: 'No surgery/trauma requiring hospitalization in past 4 weeks' },
        ],
        notes: 'Only apply PERC if clinical gestalt is LOW probability',
      },
      {
        id: 'pe-dx-2',
        title: 'PE Severity Classification',
        criteria: [
          { id: 'dx-2-1', text: 'Massive (High-risk): Hypotension (SBP <90 or drop >40 for 15+ min), obstructive shock, cardiac arrest', value: 'High-risk' },
          { id: 'dx-2-2', text: 'Submassive (Intermediate-risk): RV dysfunction AND/OR elevated biomarkers (troponin, BNP)', value: 'Intermediate-risk' },
          { id: 'dx-2-3', text: 'Low-risk: No hemodynamic compromise, no RV dysfunction, normal biomarkers', value: 'Low-risk' },
        ],
      },
      {
        id: 'pe-dx-3',
        title: 'Signs of RV Strain (Echo)',
        criteria: [
          { id: 'dx-3-1', text: 'RV dilation (RV:LV ratio >0.9 or >1.0)', value: 'RV dilated' },
          { id: 'dx-3-2', text: 'RV hypokinesis with apical sparing (McConnell sign)' },
          { id: 'dx-3-3', text: 'Septal flattening or bowing into LV (D-sign)' },
          { id: 'dx-3-4', text: 'TAPSE <16 mm (tricuspid annular plane systolic excursion)' },
          { id: 'dx-3-5', text: 'Elevated PA pressure (TR jet velocity)' },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'pe-tx-1',
        phase: 'Initial',
        title: 'Immediate Stabilization',
        timing: '0-30 minutes',
        actions: [
          { id: 'tx-1-1', text: 'Assess hemodynamic stability (BP, HR, perfusion)', priority: 'immediate' },
          { id: 'tx-1-2', text: 'Supplemental O2 to maintain SpO2 >90%', priority: 'immediate' },
          { id: 'tx-1-3', text: 'Obtain EKG, troponin, BNP', priority: 'immediate' },
          { id: 'tx-1-4', text: 'Bedside echo if hemodynamically unstable', priority: 'immediate', details: 'Look for RV strain, McConnell sign' },
          { id: 'tx-1-5', text: 'Start anticoagulation unless contraindicated', priority: 'immediate' },
        ],
      },
      {
        id: 'pe-tx-2',
        phase: 'Risk-Stratified',
        title: 'Definitive Treatment',
        timing: '30-60 minutes',
        actions: [
          { id: 'tx-2-1', text: 'MASSIVE PE: Systemic thrombolysis (tPA) or catheter-directed therapy', priority: 'immediate', details: 'Alteplase 100 mg over 2 hours' },
          { id: 'tx-2-2', text: 'SUBMASSIVE PE: Close monitoring, consider thrombolysis if deterioration', priority: 'urgent', details: 'Half-dose tPA may have better safety profile' },
          { id: 'tx-2-3', text: 'LOW-RISK PE: Anticoagulation alone, consider early discharge', priority: 'routine' },
          { id: 'tx-2-4', text: 'Vasopressors if hypotensive (norepinephrine preferred)', priority: 'urgent' },
        ],
      },
      {
        id: 'pe-tx-3',
        phase: 'Refractory',
        title: 'Rescue Therapies',
        timing: 'If failing initial treatment',
        actions: [
          { id: 'tx-3-1', text: 'Catheter-directed thrombolysis or thrombectomy', priority: 'urgent' },
          { id: 'tx-3-2', text: 'Surgical embolectomy for contraindication to thrombolysis', priority: 'urgent' },
          { id: 'tx-3-3', text: 'VA-ECMO as bridge in refractory obstructive shock', priority: 'routine' },
        ],
      },
    ],
    medications: [
      {
        id: 'pe-med-1',
        name: 'Alteplase (tPA)',
        genericName: 'alteplase',
        category: 'first-line',
        indication: 'Systemic thrombolysis for massive PE',
        dosing: [
          { route: 'IV', dose: '100 mg over 2 hours', notes: 'Standard dose for PE' },
          { route: 'IV', dose: '50 mg bolus over 15 min', notes: 'Half-dose option for submassive PE' },
          { route: 'IV', dose: '50 mg bolus', notes: 'Cardiac arrest dose' },
        ],
        contraindications: ['Active bleeding', 'Recent stroke (<3 months)', 'Intracranial neoplasm', 'Recent major surgery (<3 weeks)'],
        sideEffects: ['Major bleeding (6-13%)', 'Intracranial hemorrhage (1-3%)'],
        monitoringParameters: ['Bleeding', 'Neurologic status'],
        pearls: [
          'Half-dose may be as effective with less bleeding',
          'Do not delay for labs in cardiac arrest',
        ],
      },
      {
        id: 'pe-med-2',
        name: 'Unfractionated Heparin',
        genericName: 'heparin sodium',
        category: 'first-line',
        indication: 'Anticoagulation for PE',
        dosing: [
          { route: 'IV', dose: '80 units/kg bolus, then 18 units/kg/hr infusion', notes: 'Target aPTT 1.5-2.5x control' },
        ],
        contraindications: ['Active major bleeding', 'Severe thrombocytopenia', 'HIT'],
        sideEffects: ['Bleeding', 'HIT', 'Osteoporosis (long-term)'],
        monitoringParameters: ['aPTT q6h until stable', 'Platelets', 'Hemoglobin'],
        pearls: [
          'Preferred if thrombolysis anticipated (shorter half-life, reversible)',
          'Can continue through thrombolysis',
        ],
      },
      {
        id: 'pe-med-3',
        name: 'Enoxaparin',
        genericName: 'enoxaparin sodium',
        category: 'first-line',
        indication: 'Anticoagulation for low-intermediate risk PE',
        dosing: [
          { route: 'SC', dose: '1 mg/kg q12h or 1.5 mg/kg daily', renalAdjustment: 'CrCl <30: 1 mg/kg daily' },
        ],
        contraindications: ['CrCl <15', 'Active major bleeding'],
        monitoringParameters: ['Anti-Xa levels if renal impairment', 'Platelets'],
        pearls: [
          'No monitoring needed in most patients',
          'Avoid if thrombolysis may be needed',
        ],
      },
    ],
    pitfalls: [
      {
        id: 'pe-pitfall-1',
        title: 'Not risk stratifying PE',
        description: 'Treating all PEs with anticoagulation alone',
        consequence: 'Missed opportunity for thrombolysis in massive PE, death from RV failure',
        prevention: 'Assess hemodynamics, get echo and biomarkers in all intermediate-high probability cases',
        severity: 'critical',
      },
      {
        id: 'pe-pitfall-2',
        title: 'Aggressive fluid resuscitation',
        description: 'Giving large fluid boluses to hypotensive PE patient',
        consequence: 'RV overload, worsening septal bowing, LV failure',
        prevention: 'Small boluses only (250-500 mL), prefer vasopressors',
        severity: 'critical',
      },
      {
        id: 'pe-pitfall-3',
        title: 'Over-relying on D-dimer',
        description: 'Ordering D-dimer in high-probability patients or ruling out PE based on D-dimer',
        consequence: 'Missed PE due to false interpretation',
        prevention: 'D-dimer only useful in LOW pretest probability. High probability → go straight to CTA.',
        severity: 'major',
      },
    ],
    differentialDiagnosis: [
      'Acute coronary syndrome',
      'Aortic dissection',
      'Pneumothorax',
      'Pneumonia',
      'Pericarditis/tamponade',
      'Musculoskeletal pain',
    ],
  },

  // ============================================
  // ACUTE KIDNEY INJURY - Comprehensive Content
  // ============================================
  aki: {
    keyPearls: [
      {
        id: 'aki-pearl-1',
        text: 'Classify AKI as prerenal, intrinsic, or postrenal. History and FENa can differentiate, but FENa is unreliable with diuretics.',
        importance: 'critical',
        category: 'Classification',
      },
      {
        id: 'aki-pearl-2',
        text: 'Stop all nephrotoxins immediately: NSAIDs, aminoglycosides, contrast, ACE-I/ARBs in hypovolemia.',
        importance: 'critical',
        category: 'Prevention',
      },
      {
        id: 'aki-pearl-3',
        text: 'Emergent dialysis indications: Acidosis (refractory), Electrolytes (hyperK), Ingestion (toxic), Overload (fluid), Uremia (symptoms). AEIOU.',
        importance: 'critical',
        category: 'Dialysis',
      },
      {
        id: 'aki-pearl-4',
        text: 'Renal ultrasound for ALL new AKI to rule out obstruction. Hydronephrosis = urgent urology consult.',
        importance: 'high',
        category: 'Diagnosis',
      },
      {
        id: 'aki-pearl-5',
        text: 'ATN takes 7-21 days to recover. Prerenal AKI improves within 24-48 hours of volume correction.',
        importance: 'moderate',
        category: 'Prognosis',
      },
      {
        id: 'aki-pearl-6',
        text: 'Urine output <0.5 mL/kg/hr for 6 hours is AKI by KDIGO criteria, even with normal creatinine.',
        importance: 'moderate',
        category: 'Diagnosis',
      },
      {
        id: 'aki-pearl-7',
        text: 'Renally dose all medications daily (especially antimicrobials and anticoagulants) to prevent AKI progression.',
        importance: 'moderate',
        category: 'Medication Safety',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'aki-dx-1',
        title: 'KDIGO AKI Definition (any of)',
        criteria: [
          { id: 'dx-1-1', text: 'Increase in SCr ≥0.3 mg/dL within 48 hours', required: true, value: '≥0.3 mg/dL rise' },
          { id: 'dx-1-2', text: 'Increase in SCr ≥1.5x baseline within 7 days', required: true, value: '≥1.5x baseline' },
          { id: 'dx-1-3', text: 'Urine output <0.5 mL/kg/hr for 6 hours', required: true, value: '<0.5 mL/kg/hr' },
        ],
        notes: 'Only one criterion needed for diagnosis',
      },
      {
        id: 'aki-dx-2',
        title: 'KDIGO AKI Staging',
        criteria: [
          { id: 'dx-2-1', text: 'Stage 1: SCr 1.5-1.9x baseline OR ≥0.3 mg/dL increase OR UOP <0.5 mL/kg/hr for 6-12 hrs', value: 'Stage 1' },
          { id: 'dx-2-2', text: 'Stage 2: SCr 2.0-2.9x baseline OR UOP <0.5 mL/kg/hr for ≥12 hrs', value: 'Stage 2' },
          { id: 'dx-2-3', text: 'Stage 3: SCr ≥3x baseline OR SCr ≥4.0 OR RRT OR UOP <0.3 mL/kg/hr for ≥24 hrs OR anuria ≥12 hrs', value: 'Stage 3' },
        ],
      },
      {
        id: 'aki-dx-3',
        title: 'Prerenal vs ATN (Urine Indices)',
        criteria: [
          { id: 'dx-3-1', text: 'FENa <1% suggests prerenal', value: 'FENa <1%' },
          { id: 'dx-3-2', text: 'FENa >2% suggests ATN', value: 'FENa >2%' },
          { id: 'dx-3-3', text: 'FEUrea <35% suggests prerenal (use if on diuretics)', value: 'FEUrea <35%' },
          { id: 'dx-3-4', text: 'Urine Na <20 suggests prerenal', value: 'UNa <20' },
        ],
        notes: 'FENa unreliable with diuretics, contrast, sepsis. Use FEUrea instead.',
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'aki-tx-1',
        phase: 'Immediate',
        title: 'Initial Assessment',
        timing: '0-2 hours',
        actions: [
          { id: 'tx-1-1', text: 'Review medications - stop all nephrotoxins', priority: 'immediate', details: 'NSAIDs, aminoglycosides, ACE-I/ARBs, contrast' },
          { id: 'tx-1-2', text: 'Check potassium - treat if >5.5 mEq/L', priority: 'immediate' },
          { id: 'tx-1-3', text: 'Order renal ultrasound to rule out obstruction', priority: 'immediate' },
          { id: 'tx-1-4', text: 'Assess volume status (JVP, edema, orthostatics)', priority: 'immediate' },
          { id: 'tx-1-5', text: 'Urinalysis with microscopy - look for muddy brown casts (ATN), RBC casts (GN)', priority: 'urgent' },
        ],
      },
      {
        id: 'aki-tx-2',
        phase: 'Etiology-Specific',
        title: 'Targeted Treatment',
        timing: '2-24 hours',
        actions: [
          { id: 'tx-2-1', text: 'PRERENAL: IV fluid resuscitation with crystalloids', priority: 'urgent', details: 'Target MAP >65, urine output >0.5 mL/kg/hr' },
          { id: 'tx-2-2', text: 'OBSTRUCTIVE: Urgent Foley catheter, urology consult for stent/nephrostomy', priority: 'immediate' },
          { id: 'tx-2-3', text: 'INTRINSIC: Supportive care, avoid further nephrotoxins', priority: 'routine' },
          { id: 'tx-2-4', text: 'Consider nephrology consult for suspected glomerulonephritis or unclear etiology', priority: 'routine' },
        ],
      },
      {
        id: 'aki-tx-3',
        phase: 'Dialysis',
        title: 'Renal Replacement Therapy',
        timing: 'When indicated',
        actions: [
          { id: 'tx-3-1', text: 'Emergent dialysis for: Refractory hyperkalemia, severe acidosis, uremic symptoms, refractory fluid overload', priority: 'immediate' },
          { id: 'tx-3-2', text: 'Place dialysis catheter (IJ or femoral)', priority: 'urgent' },
          { id: 'tx-3-3', text: 'Choose modality: CRRT if hemodynamically unstable, IHD if stable', priority: 'routine' },
        ],
        notes: 'Remember AEIOU: Acidosis, Electrolytes, Ingestion, Overload, Uremia',
      },
    ],
    medications: [
      {
        id: 'aki-med-1',
        name: 'Furosemide',
        genericName: 'furosemide',
        category: 'adjunct',
        indication: 'Volume overload in AKI',
        dosing: [
          { route: 'IV', dose: '40-80 mg bolus or infusion 5-20 mg/hr', notes: 'Double dose if no response' },
        ],
        contraindications: ['Anuria', 'Severe hypovolemia'],
        sideEffects: ['Hypokalemia', 'Hyponatremia', 'Ototoxicity (high doses)'],
        monitoringParameters: ['Urine output', 'Potassium', 'Creatinine'],
        pearls: [
          'Does NOT improve renal outcomes or mortality',
          'Use for volume management, not to "make kidneys work"',
        ],
      },
      {
        id: 'aki-med-2',
        name: 'Calcium Gluconate',
        genericName: 'calcium gluconate',
        category: 'first-line',
        indication: 'Cardiac membrane stabilization in hyperkalemia',
        dosing: [
          { route: 'IV', dose: '1-2 grams over 5-10 minutes', notes: 'Can repeat if EKG changes persist' },
        ],
        monitoringParameters: ['EKG', 'Potassium'],
        pearls: [
          'First step in hyperkalemia with EKG changes',
          'Does NOT lower potassium - stabilizes the heart',
        ],
      },
      {
        id: 'aki-med-3',
        name: 'Sodium Bicarbonate',
        genericName: 'sodium bicarbonate',
        category: 'adjunct',
        indication: 'Severe metabolic acidosis in AKI',
        dosing: [
          { route: 'IV', dose: '150 mEq in 1L D5W or 50-100 mEq bolus', notes: 'Target pH >7.20' },
        ],
        contraindications: ['Severe fluid overload'],
        sideEffects: ['Volume overload', 'Hypokalemia', 'Hypernatremia'],
        pearls: [
          'May worsen intracellular acidosis in some settings',
          'Consider if pH <7.1-7.2 and bridge to dialysis',
        ],
      },
    ],
    pitfalls: [
      {
        id: 'aki-pitfall-1',
        title: 'Missing urinary obstruction',
        description: 'Not obtaining renal ultrasound in new AKI',
        consequence: 'Delayed decompression of obstructed kidney, irreversible damage',
        prevention: 'Renal ultrasound for ALL new AKI within first 24 hours',
        severity: 'critical',
      },
      {
        id: 'aki-pitfall-2',
        title: 'Continuing nephrotoxins',
        description: 'Not reviewing medication list for nephrotoxic drugs',
        consequence: 'Ongoing renal injury, prolonged AKI, need for dialysis',
        prevention: 'Stop NSAIDs, aminoglycosides, ACE-I/ARBs immediately in AKI',
        severity: 'critical',
      },
      {
        id: 'aki-pitfall-3',
        title: 'Using diuretics to treat AKI',
        description: 'Giving furosemide believing it will improve renal function',
        consequence: 'False reassurance from urine output, delayed dialysis, worse outcomes',
        prevention: 'Diuretics only for VOLUME management, not to treat AKI',
        severity: 'major',
      },
    ],
    differentialDiagnosis: [
      'Prerenal azotemia (hypovolemia, CHF, cirrhosis)',
      'Acute tubular necrosis',
      'Interstitial nephritis (drug-induced)',
      'Glomerulonephritis',
      'Obstructive uropathy',
      'Atheroembolic disease',
      'Contrast nephropathy',
      'Hepatorenal syndrome',
    ],
  },

  // ============================================
  // STATUS EPILEPTICUS - Comprehensive Content
  // ============================================
  'status-epilepticus': {
    keyPearls: [
      {
        id: 'se-pearl-1',
        text: 'Definition: Seizure >5 minutes OR ≥2 seizures without return to baseline. Do not wait 30 minutes to treat.',
        importance: 'critical',
        category: 'Definition',
      },
      {
        id: 'se-pearl-2',
        text: 'Benzodiazepines are FIRST-LINE. Give immediately. IM midazolam is as effective as IV lorazepam.',
        importance: 'critical',
        category: 'Treatment',
      },
      {
        id: 'se-pearl-3',
        text: 'Check glucose immediately - hypoglycemia is reversible cause. Give D50 if glucose <60 or unknown.',
        importance: 'critical',
        category: 'Workup',
      },
      {
        id: 'se-pearl-4',
        text: 'Phenytoin/fosphenytoin requires 20 minutes to infuse. Start it early, do not wait for benzo failure.',
        importance: 'high',
        category: 'Treatment',
      },
      {
        id: 'se-pearl-5',
        text: 'Nonconvulsive status epilepticus: If patient does not wake up after seizure control, get STAT EEG.',
        importance: 'high',
        category: 'Diagnosis',
      },
      {
        id: 'se-pearl-6',
        text: 'Levetiracetam has fewer drug interactions and no cardiac effects. Consider as second-line agent.',
        importance: 'moderate',
        category: 'Treatment',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'se-dx-1',
        title: 'Status Epilepticus Definition',
        criteria: [
          { id: 'dx-1-1', text: 'Continuous seizure activity lasting >5 minutes', required: true },
          { id: 'dx-1-2', text: 'OR ≥2 discrete seizures without return to baseline consciousness', required: true },
        ],
        notes: 'Older definition of 30 minutes is outdated - treatment should begin at 5 minutes',
      },
      {
        id: 'se-dx-2',
        title: 'Stages of Status Epilepticus',
        criteria: [
          { id: 'dx-2-1', text: 'Early SE: 5-10 minutes', value: 'Early' },
          { id: 'dx-2-2', text: 'Established SE: 10-30 minutes', value: 'Established' },
          { id: 'dx-2-3', text: 'Refractory SE: Continues despite 2 appropriate AED trials', value: 'Refractory' },
          { id: 'dx-2-4', text: 'Super-refractory SE: Continues >24 hours despite anesthesia', value: 'Super-refractory' },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'se-tx-1',
        phase: 'Stabilization',
        title: 'Immediate (0-5 min)',
        timing: '0-5 minutes',
        actions: [
          { id: 'tx-1-1', text: 'Protect airway, position patient safely', priority: 'immediate' },
          { id: 'tx-1-2', text: 'Check fingerstick glucose', priority: 'immediate' },
          { id: 'tx-1-3', text: 'Give D50 25-50 mL IV if glucose <60 or unknown', priority: 'immediate' },
          { id: 'tx-1-4', text: 'Establish IV access', priority: 'immediate' },
          { id: 'tx-1-5', text: 'Give thiamine 100 mg IV if alcohol/malnutrition suspected', priority: 'urgent' },
        ],
      },
      {
        id: 'se-tx-2',
        phase: 'First-Line',
        title: 'Benzodiazepines (5-10 min)',
        timing: '5-10 minutes',
        actions: [
          { id: 'tx-2-1', text: 'Lorazepam 4 mg IV (may repeat x1 in 5 min)', priority: 'immediate', details: 'Total max 8 mg' },
          { id: 'tx-2-2', text: 'OR Midazolam 10 mg IM if no IV access', priority: 'immediate', details: 'IM midazolam = IV lorazepam efficacy' },
          { id: 'tx-2-3', text: 'OR Diazepam 10 mg IV (may repeat x1)', priority: 'immediate' },
          { id: 'tx-2-4', text: 'Prepare second-line agent while giving benzo', priority: 'urgent' },
        ],
        notes: 'Do NOT wait for benzo to fail before ordering second-line agent',
      },
      {
        id: 'se-tx-3',
        phase: 'Second-Line',
        title: 'AED Loading (10-30 min)',
        timing: '10-30 minutes',
        actions: [
          { id: 'tx-3-1', text: 'Fosphenytoin 20 mg PE/kg IV at 150 mg PE/min', priority: 'urgent', details: 'Monitor for hypotension, arrhythmia' },
          { id: 'tx-3-2', text: 'OR Levetiracetam 60 mg/kg IV (max 4500 mg) over 15 min', priority: 'urgent', details: 'Fewer drug interactions, no cardiac effects' },
          { id: 'tx-3-3', text: 'OR Valproate 40 mg/kg IV over 10 min', priority: 'urgent', details: 'Avoid in liver disease, pregnancy' },
          { id: 'tx-3-4', text: 'If seizures continue, prepare for third-line treatment', priority: 'routine' },
        ],
      },
      {
        id: 'se-tx-4',
        phase: 'Third-Line (Refractory)',
        title: 'Anesthetic Agents (>30 min)',
        timing: '>30 minutes',
        actions: [
          { id: 'tx-4-1', text: 'Intubate for airway protection', priority: 'immediate' },
          { id: 'tx-4-2', text: 'Start continuous EEG monitoring', priority: 'immediate' },
          { id: 'tx-4-3', text: 'Propofol: 2 mg/kg bolus, then 20-200 mcg/kg/min', priority: 'urgent' },
          { id: 'tx-4-4', text: 'OR Midazolam: 0.2 mg/kg bolus, then 0.05-2 mg/kg/hr', priority: 'urgent' },
          { id: 'tx-4-5', text: 'OR Pentobarbital: 5 mg/kg bolus, then 1-5 mg/kg/hr', priority: 'urgent', details: 'For super-refractory cases' },
        ],
        notes: 'Target burst suppression on EEG for 24-48 hours, then slow wean',
      },
    ],
    medications: [
      {
        id: 'se-med-1',
        name: 'Lorazepam',
        genericName: 'lorazepam',
        category: 'first-line',
        indication: 'First-line treatment for status epilepticus',
        dosing: [
          { route: 'IV', dose: '4 mg over 2 minutes, may repeat x1 in 5 min', maxDose: '8 mg total' },
        ],
        sideEffects: ['Respiratory depression', 'Hypotension', 'Sedation'],
        monitoringParameters: ['Respiratory status', 'Blood pressure', 'Mental status'],
        pearls: [
          'Longer duration of action than diazepam',
          'Requires refrigeration for stability',
        ],
      },
      {
        id: 'se-med-2',
        name: 'Midazolam',
        genericName: 'midazolam',
        category: 'first-line',
        indication: 'First-line when IV access not available',
        dosing: [
          { route: 'IM', dose: '10 mg (5 mg if <40 kg)', notes: 'RAMPART trial: IM midazolam = IV lorazepam' },
          { route: 'IV', dose: '0.2 mg/kg bolus for refractory SE', notes: 'Then 0.05-2 mg/kg/hr infusion' },
        ],
        sideEffects: ['Respiratory depression', 'Hypotension'],
        pearls: [
          'IM route is rapid and effective',
          'Room temperature stable - ideal for EMS',
        ],
      },
      {
        id: 'se-med-3',
        name: 'Fosphenytoin',
        genericName: 'fosphenytoin sodium',
        category: 'second-line',
        indication: 'Second-line AED for status epilepticus',
        dosing: [
          { route: 'IV', dose: '20 mg PE/kg at 150 mg PE/min', maxDose: '30 mg PE/kg if needed' },
        ],
        contraindications: ['Sinus bradycardia', 'SA block', 'Second/third degree AV block'],
        sideEffects: ['Hypotension', 'Arrhythmias', 'Purple glove syndrome (phenytoin only)'],
        monitoringParameters: ['Blood pressure', 'EKG during infusion', 'Phenytoin levels'],
        pearls: [
          'Fosphenytoin can be given faster and IM; phenytoin is IV only',
          'Requires ~20 min to infuse - start early',
        ],
      },
      {
        id: 'se-med-4',
        name: 'Levetiracetam',
        genericName: 'levetiracetam',
        category: 'second-line',
        indication: 'Alternative second-line AED',
        dosing: [
          { route: 'IV', dose: '60 mg/kg over 15 minutes', maxDose: '4500 mg' },
        ],
        sideEffects: ['Agitation', 'Somnolence'],
        pearls: [
          'No drug interactions - ideal for polypharmacy patients',
          'No cardiac effects - safe in cardiac disease',
          'Renal dosing required',
        ],
      },
    ],
    pitfalls: [
      {
        id: 'se-pitfall-1',
        title: 'Waiting too long to treat',
        description: 'Observing seizure without treatment, waiting for spontaneous termination',
        consequence: 'Seizures become harder to treat over time, neuronal injury accumulates',
        prevention: 'Treat as status epilepticus at 5 minutes. Give benzos IMMEDIATELY.',
        severity: 'critical',
      },
      {
        id: 'se-pitfall-2',
        title: 'Not checking glucose',
        description: 'Treating seizure without checking fingerstick glucose',
        consequence: 'Missed hypoglycemia - easily reversible cause',
        prevention: 'Fingerstick glucose is part of initial assessment',
        severity: 'critical',
      },
      {
        id: 'se-pitfall-3',
        title: 'Underdosing benzodiazepines',
        description: 'Giving inadequate benzo doses due to fear of respiratory depression',
        consequence: 'Seizure continues, need for more aggressive treatment',
        prevention: 'Use full doses: Lorazepam 4 mg, Midazolam 10 mg. Be prepared to manage airway.',
        severity: 'major',
      },
      {
        id: 'se-pitfall-4',
        title: 'Missing nonconvulsive status',
        description: 'Patient stops convulsing but remains altered - assuming seizure resolved',
        consequence: 'Ongoing subclinical seizures causing brain injury',
        prevention: 'If patient does not wake up after treatment, get STAT EEG',
        severity: 'major',
      },
    ],
    differentialDiagnosis: [
      'Psychogenic nonepileptic seizures (PNES)',
      'Convulsive syncope',
      'Movement disorders (dystonia, chorea)',
      'Rigors/shivering',
      'Decerebrate/decorticate posturing',
    ],
  },

  // ============================================
  // CARDIAC ARREST - Comprehensive Content
  // ============================================
  'cardiac-arrest': {
    keyPearls: [
      {
        id: 'ca-pearl-1',
        text: 'High-quality CPR is the most important intervention. Push hard (2+ inches), fast (100-120/min), allow full recoil, minimize interruptions.',
        importance: 'critical',
        category: 'CPR',
      },
      {
        id: 'ca-pearl-2',
        text: 'Shockable rhythms (VF/pVT): Defibrillate immediately. Every minute of delay reduces survival by 7-10%.',
        importance: 'critical',
        category: 'Defibrillation',
      },
      {
        id: 'ca-pearl-3',
        text: 'Think Hs and Ts for reversible causes: Hypovolemia, Hypoxia, H+, Hypo/HyperK, Hypothermia, Tension PTX, Tamponade, Toxins, Thrombosis (PE/MI).',
        importance: 'critical',
        category: 'Reversible Causes',
      },
      {
        id: 'ca-pearl-4',
        text: 'Epinephrine timing: Give every 3-5 minutes. For shockable rhythms, give after 2nd shock.',
        importance: 'high',
        category: 'Medications',
      },
      {
        id: 'ca-pearl-5',
        text: 'ETCO2 <10 mmHg after 20 min of CPR predicts non-survival. Consider termination if no ROSC and ETCO2 persistently low.',
        importance: 'high',
        category: 'Prognosis',
      },
      {
        id: 'ca-pearl-6',
        text: 'Post-ROSC: Avoid hyperoxia (target SpO2 94-98%), maintain normothermia or targeted temperature management, emergent cath for STEMI.',
        importance: 'high',
        category: 'Post-Arrest',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'ca-dx-1',
        title: 'Cardiac Arrest Recognition',
        criteria: [
          { id: 'dx-1-1', text: 'Unresponsive patient', required: true },
          { id: 'dx-1-2', text: 'No normal breathing (agonal gasps do not count)', required: true },
          { id: 'dx-1-3', text: 'No pulse (check <10 seconds)', required: true },
        ],
        notes: 'Do not delay CPR to confirm - start immediately if unresponsive and not breathing normally',
      },
      {
        id: 'ca-dx-2',
        title: 'Arrest Rhythms',
        criteria: [
          { id: 'dx-2-1', text: 'VF: Chaotic, irregular waveforms, no organized QRS', value: 'Shockable' },
          { id: 'dx-2-2', text: 'pVT: Wide-complex regular rhythm, no pulse', value: 'Shockable' },
          { id: 'dx-2-3', text: 'Asystole: Flatline, no electrical activity', value: 'Non-shockable' },
          { id: 'dx-2-4', text: 'PEA: Organized rhythm but no pulse', value: 'Non-shockable' },
        ],
      },
      {
        id: 'ca-dx-3',
        title: 'Hs and Ts (Reversible Causes)',
        criteria: [
          { id: 'dx-3-1', text: 'Hypovolemia', value: 'H' },
          { id: 'dx-3-2', text: 'Hypoxia', value: 'H' },
          { id: 'dx-3-3', text: 'Hydrogen ion (acidosis)', value: 'H' },
          { id: 'dx-3-4', text: 'Hypo/Hyperkalemia', value: 'H' },
          { id: 'dx-3-5', text: 'Hypothermia', value: 'H' },
          { id: 'dx-3-6', text: 'Tension pneumothorax', value: 'T' },
          { id: 'dx-3-7', text: 'Tamponade (cardiac)', value: 'T' },
          { id: 'dx-3-8', text: 'Toxins', value: 'T' },
          { id: 'dx-3-9', text: 'Thrombosis (PE)', value: 'T' },
          { id: 'dx-3-10', text: 'Thrombosis (coronary/MI)', value: 'T' },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'ca-tx-1',
        phase: 'Immediate',
        title: 'BLS Response',
        timing: '0-2 minutes',
        actions: [
          { id: 'tx-1-1', text: 'Confirm unresponsive, not breathing normally, no pulse', priority: 'immediate' },
          { id: 'tx-1-2', text: 'Call for help, get AED/defibrillator', priority: 'immediate' },
          { id: 'tx-1-3', text: 'Start CPR: 30 compressions : 2 breaths (or continuous compressions with advanced airway)', priority: 'immediate' },
          { id: 'tx-1-4', text: 'Compression rate 100-120/min, depth ≥2 inches (5 cm)', priority: 'immediate' },
        ],
      },
      {
        id: 'ca-tx-2',
        phase: 'Shockable Rhythm',
        title: 'VF/pVT Algorithm',
        timing: 'When rhythm identified',
        actions: [
          { id: 'tx-2-1', text: 'Defibrillate immediately (biphasic 120-200J)', priority: 'immediate' },
          { id: 'tx-2-2', text: 'Resume CPR immediately for 2 minutes', priority: 'immediate' },
          { id: 'tx-2-3', text: 'Establish IV/IO access', priority: 'urgent' },
          { id: 'tx-2-4', text: 'Epinephrine 1 mg IV after 2nd shock, then q3-5 min', priority: 'urgent' },
          { id: 'tx-2-5', text: 'Amiodarone 300 mg IV after 3rd shock', priority: 'urgent' },
          { id: 'tx-2-6', text: 'Continue cycles: CPR → Rhythm check → Shock if indicated', priority: 'routine' },
        ],
      },
      {
        id: 'ca-tx-3',
        phase: 'Non-Shockable Rhythm',
        title: 'Asystole/PEA Algorithm',
        timing: 'When rhythm identified',
        actions: [
          { id: 'tx-3-1', text: 'Continue high-quality CPR', priority: 'immediate' },
          { id: 'tx-3-2', text: 'Epinephrine 1 mg IV as soon as possible, then q3-5 min', priority: 'immediate' },
          { id: 'tx-3-3', text: 'Search for and treat reversible causes (Hs and Ts)', priority: 'urgent' },
          { id: 'tx-3-4', text: 'Consider: Ultrasound to assess cardiac activity and reversible causes', priority: 'routine' },
          { id: 'tx-3-5', text: 'PEA with narrow QRS: Consider PE - give tPA', priority: 'routine' },
        ],
        notes: 'PEA often has an underlying reversible cause - focus on Hs and Ts',
      },
      {
        id: 'ca-tx-4',
        phase: 'ROSC',
        title: 'Post-Arrest Care',
        timing: 'After ROSC achieved',
        actions: [
          { id: 'tx-4-1', text: 'Optimize ventilation: Target SpO2 94-98%, avoid hyperoxia', priority: 'immediate' },
          { id: 'tx-4-2', text: 'Maintain MAP ≥65 mmHg (vasopressors if needed)', priority: 'immediate' },
          { id: 'tx-4-3', text: 'Obtain 12-lead EKG - emergent cath if STEMI', priority: 'immediate' },
          { id: 'tx-4-4', text: 'Targeted temperature management 32-36°C for 24 hours', priority: 'urgent', details: 'For comatose patients' },
          { id: 'tx-4-5', text: 'ICU admission, continuous monitoring', priority: 'urgent' },
          { id: 'tx-4-6', text: 'Treat underlying cause identified during arrest', priority: 'routine' },
        ],
      },
    ],
    medications: [
      {
        id: 'ca-med-1',
        name: 'Epinephrine',
        genericName: 'epinephrine',
        category: 'first-line',
        indication: 'Vasopressor in cardiac arrest',
        dosing: [
          { route: 'IV', dose: '1 mg every 3-5 minutes', notes: 'Give as soon as possible in non-shockable rhythms' },
          { route: 'IV', dose: '1 mg after 2nd shock', notes: 'For shockable rhythms' },
        ],
        sideEffects: ['Post-ROSC hypertension', 'Tachyarrhythmias'],
        pearls: [
          'Alpha effect (vasoconstriction) is key - increases coronary perfusion pressure',
          'Push dose: 10-20 mcg boluses for post-ROSC hypotension',
        ],
      },
      {
        id: 'ca-med-2',
        name: 'Amiodarone',
        genericName: 'amiodarone',
        category: 'first-line',
        indication: 'Refractory VF/pVT',
        dosing: [
          { route: 'IV', dose: '300 mg after 3rd shock', notes: 'First dose' },
          { route: 'IV', dose: '150 mg for subsequent dose', notes: 'If VF/pVT recurs' },
        ],
        sideEffects: ['Hypotension', 'Bradycardia (post-ROSC)'],
        pearls: [
          'Give after 3rd shock if VF/pVT persists',
          'Alternative: Lidocaine 1-1.5 mg/kg',
        ],
      },
      {
        id: 'ca-med-3',
        name: 'Sodium Bicarbonate',
        genericName: 'sodium bicarbonate',
        category: 'adjunct',
        indication: 'Known or suspected hyperkalemia or TCA overdose',
        dosing: [
          { route: 'IV', dose: '50-100 mEq bolus', notes: 'Do not give routinely' },
        ],
        pearls: [
          'Not recommended for routine use in arrest',
          'Give for hyperkalemia, TCA overdose, prolonged arrest with known acidosis',
        ],
      },
      {
        id: 'ca-med-4',
        name: 'Calcium Chloride',
        genericName: 'calcium chloride',
        category: 'adjunct',
        indication: 'Hyperkalemia, hypocalcemia, calcium channel blocker overdose',
        dosing: [
          { route: 'IV', dose: '1-2 grams (10% solution) slow push', notes: 'Via central line preferred' },
        ],
        pearls: [
          'Calcium chloride has 3x the elemental calcium of calcium gluconate',
          'Give for known hyperkalemia or CCB toxicity',
        ],
      },
    ],
    pitfalls: [
      {
        id: 'ca-pitfall-1',
        title: 'Poor quality CPR',
        description: 'Shallow compressions, slow rate, incomplete recoil, excessive pauses',
        consequence: 'Inadequate coronary and cerebral perfusion, reduced survival',
        prevention: 'Push hard (≥2 in), fast (100-120/min), full recoil, minimize interruptions <10 sec',
        severity: 'critical',
      },
      {
        id: 'ca-pitfall-2',
        title: 'Delayed defibrillation',
        description: 'Continuing CPR without checking rhythm or delaying shock for VF/pVT',
        consequence: 'VF degrades to asystole over time. Every minute without shock reduces survival 7-10%.',
        prevention: 'Early rhythm check, immediate defibrillation for shockable rhythms',
        severity: 'critical',
      },
      {
        id: 'ca-pitfall-3',
        title: 'Not addressing reversible causes',
        description: 'Running ACLS algorithm without considering Hs and Ts',
        consequence: 'Treatable cause (hyperK, PE, tamponade, tension PTX) not addressed',
        prevention: 'Actively think through Hs and Ts during every arrest. Use bedside ultrasound.',
        severity: 'critical',
      },
      {
        id: 'ca-pitfall-4',
        title: 'Hyperoxia post-ROSC',
        description: 'Leaving FiO2 at 100% after ROSC',
        consequence: 'Increased oxidative stress, worse neurologic outcomes',
        prevention: 'Target SpO2 94-98%, wean FiO2 as soon as ROSC achieved',
        severity: 'major',
      },
    ],
    differentialDiagnosis: [
      'Ventricular fibrillation (primary cardiac)',
      'Pulseless ventricular tachycardia',
      'Asystole',
      'Pulseless electrical activity (with underlying cause)',
      'Respiratory arrest leading to cardiac arrest',
    ],
    tables: [
      {
        id: 'ca-table-1',
        title: 'ACLS Drug Dosing Quick Reference',
        headers: ['Drug', 'Dose', 'Timing'],
        rows: [
          ['Epinephrine', '1 mg IV/IO', 'q3-5 min'],
          ['Amiodarone', '300 mg, then 150 mg', 'After 3rd shock'],
          ['Lidocaine', '1-1.5 mg/kg, then 0.5-0.75 mg/kg', 'Alternative to amiodarone'],
          ['Sodium bicarb', '50-100 mEq', 'HyperK, TCA OD only'],
          ['Calcium chloride', '1-2 g', 'HyperK, CCB OD'],
          ['Magnesium', '1-2 g', 'Torsades de pointes'],
        ],
      },
    ],
  },

  // ============================================
  // ATRIAL FIBRILLATION - Comprehensive Content
  // ============================================
  afib: {
    keyPearls: [
      {
        id: 'afib-pearl-1',
        text: 'First question: stable or unstable? If hypotension, ischemia, pulmonary edema, or shock → synchronized cardioversion now.',
        importance: 'critical',
        category: 'Stability',
      },
      {
        id: 'afib-pearl-2',
        text: 'AFib <48 hours can be cardioverted without anticoagulation if no high-risk features; >48 hours needs anticoagulation or TEE-guided approach.',
        importance: 'critical',
        category: 'Anticoagulation',
      },
      {
        id: 'afib-pearl-3',
        text: 'Rate control goal: HR <110 bpm (lenient) for most patients unless symptomatic.',
        importance: 'high',
        category: 'Rate Control',
      },
      {
        id: 'afib-pearl-4',
        text: 'Avoid diltiazem/verapamil in decompensated HFrEF; use amiodarone or digoxin instead.',
        importance: 'high',
        category: 'Contraindications',
      },
      {
        id: 'afib-pearl-5',
        text: 'CHA2DS2-VASc drives stroke risk; HAS-BLED identifies bleeding risk but does NOT preclude anticoagulation.',
        importance: 'high',
        category: 'Risk Stratification',
      },
      {
        id: 'afib-pearl-6',
        text: 'Always search for triggers in ICU AFib (sepsis, hypoxia, PE, pain, alcohol withdrawal, thyroid). Treating the cause improves control.',
        importance: 'high',
        category: 'Etiology',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'afib-dx-1',
        title: 'AFib Definition (ECG)',
        criteria: [
          { id: 'dx-1-1', text: 'Irregularly irregular rhythm', required: true },
          { id: 'dx-1-2', text: 'No distinct P waves', required: true },
          { id: 'dx-1-3', text: 'Variable R-R intervals', required: true },
        ],
      },
      {
        id: 'afib-dx-2',
        title: 'Unstable AFib Features',
        criteria: [
          { id: 'dx-2-1', text: 'Hypotension or shock', value: 'Unstable' },
          { id: 'dx-2-2', text: 'Ongoing ischemic chest pain', value: 'Unstable' },
          { id: 'dx-2-3', text: 'Acute heart failure/pulmonary edema', value: 'Unstable' },
          { id: 'dx-2-4', text: 'Altered mental status or syncope', value: 'Unstable' },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'afib-tx-1',
        phase: 'Immediate',
        title: 'Assess Stability',
        timing: '0-10 minutes',
        actions: [
          { id: 'tx-1-1', text: 'Assess for instability (BP, ischemia, pulmonary edema, AMS)', priority: 'immediate' },
          { id: 'tx-1-2', text: 'If unstable → synchronized cardioversion (100-200J biphasic)', priority: 'immediate' },
          { id: 'tx-1-3', text: 'Provide analgesia/sedation if time permits', priority: 'urgent' },
        ],
      },
      {
        id: 'afib-tx-2',
        phase: 'Stable',
        title: 'Rate vs Rhythm Strategy',
        timing: '10-60 minutes',
        actions: [
          { id: 'tx-2-1', text: 'Rate control: IV diltiazem or metoprolol (target HR <110)', priority: 'urgent' },
          { id: 'tx-2-2', text: 'Rhythm control if symptomatic, first episode, or <48 hours duration', priority: 'routine', details: 'Electrical or pharmacologic cardioversion' },
          { id: 'tx-2-3', text: 'Anticoagulation decision using CHA2DS2-VASc', priority: 'routine' },
        ],
      },
      {
        id: 'afib-tx-3',
        phase: 'Disposition',
        title: 'Ongoing Management',
        timing: 'After stabilization',
        actions: [
          { id: 'tx-3-1', text: 'Start anticoagulation if indicated', priority: 'routine' },
          { id: 'tx-3-2', text: 'Identify triggers: infection, thyrotoxicosis, PE, alcohol', priority: 'routine' },
          { id: 'tx-3-3', text: 'Cardiology follow-up for rhythm strategy', priority: 'routine' },
        ],
      },
    ],
    medications: [
      {
        id: 'afib-med-1',
        name: 'Diltiazem',
        genericName: 'diltiazem',
        category: 'first-line',
        indication: 'Rate control in stable AFib with preserved EF',
        dosing: [
          { route: 'IV', dose: '0.25 mg/kg bolus, then 5-15 mg/hr infusion', notes: 'May repeat bolus 0.35 mg/kg' },
        ],
        contraindications: ['Decompensated HFrEF', 'WPW with AFib'],
        sideEffects: ['Hypotension', 'Bradycardia'],
        monitoringParameters: ['BP', 'HR', 'Rhythm'],
      },
      {
        id: 'afib-med-2',
        name: 'Metoprolol',
        genericName: 'metoprolol tartrate',
        category: 'first-line',
        indication: 'Rate control in AFib',
        dosing: [
          { route: 'IV', dose: '5 mg q5 min x3', notes: 'Transition to PO after control' },
        ],
        contraindications: ['Acute decompensated HF', 'Severe asthma/bronchospasm'],
        sideEffects: ['Bradycardia', 'Hypotension'],
        monitoringParameters: ['BP', 'HR'],
      },
      {
        id: 'afib-med-3',
        name: 'Amiodarone',
        genericName: 'amiodarone',
        category: 'second-line',
        indication: 'Rate or rhythm control in HFrEF or refractory AFib',
        dosing: [
          { route: 'IV', dose: '150 mg bolus over 10 min, then 1 mg/min x6h', notes: 'Then 0.5 mg/min' },
        ],
        sideEffects: ['Hypotension', 'Bradycardia'],
        monitoringParameters: ['BP', 'QTc'],
        pearls: ['Avoid in WPW with AFib'],
      },
    ],
    pitfalls: [
      {
        id: 'afib-pitfall-1',
        title: 'Delaying cardioversion in unstable AFib',
        description: 'Attempting prolonged rate control in unstable patient',
        consequence: 'Worsening shock, ischemia, pulmonary edema',
        prevention: 'Unstable AFib requires immediate synchronized cardioversion',
        severity: 'critical',
      },
      {
        id: 'afib-pitfall-2',
        title: 'Rate control with calcium channel blockers in HFrEF',
        description: 'Using diltiazem/verapamil in decompensated systolic HF',
        consequence: 'Worsening cardiac output, hypotension',
        prevention: 'Use amiodarone or digoxin in HFrEF',
        severity: 'major',
      },
      {
        id: 'afib-pitfall-3',
        title: 'Skipping anticoagulation assessment',
        description: 'Not calculating CHA2DS2-VASc before discharge',
        consequence: 'Preventable stroke risk',
        prevention: 'Assess stroke risk and start anticoagulation when indicated',
        severity: 'major',
      },
    ],
    differentialDiagnosis: [
      'Atrial flutter with variable block',
      'Multifocal atrial tachycardia',
      'Frequent PACs',
      'SVT with irregular conduction',
    ],
  },

  // ============================================
  // STEMI - Comprehensive Content
  // ============================================
  stemi: {
    keyPearls: [
      {
        id: 'stemi-pearl-1',
        text: 'Time is myocardium. Door-to-balloon goal <90 minutes; door-to-needle (fibrinolysis) <30 minutes if PCI unavailable.',
        importance: 'critical',
        category: 'Timing',
      },
      {
        id: 'stemi-pearl-2',
        text: 'Do NOT delay reperfusion for troponin. Diagnosis is ECG-based.',
        importance: 'critical',
        category: 'Diagnosis',
      },
      {
        id: 'stemi-pearl-3',
        text: 'Activate cath lab immediately for new ST elevations in contiguous leads or posterior STEMI equivalents.',
        importance: 'critical',
        category: 'Activation',
      },
      {
        id: 'stemi-pearl-4',
        text: 'Give aspirin + P2Y12 + anticoagulation early. Avoid nitrates in RV infarction or hypotension.',
        importance: 'high',
        category: 'Medications',
      },
      {
        id: 'stemi-pearl-5',
        text: 'Obtain right-sided and posterior leads when inferior STEMI suspected or posterior MI symptoms.',
        importance: 'high',
        category: 'Diagnosis',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'stemi-dx-1',
        title: 'STEMI ECG Criteria',
        criteria: [
          { id: 'dx-1-1', text: 'ST elevation ≥1 mm in ≥2 contiguous leads (except V2-V3)', required: true },
          { id: 'dx-1-2', text: 'V2-V3: Men ≥2 mm, Women ≥1.5 mm', required: true },
        ],
        notes: 'Consider STEMI equivalents: posterior MI (ST depression V1-V3), new LBBB with Sgarbossa criteria',
      },
      {
        id: 'stemi-dx-2',
        title: 'Contraindications to Fibrinolysis',
        criteria: [
          { id: 'dx-2-1', text: 'Any prior intracranial hemorrhage', value: 'Absolute' },
          { id: 'dx-2-2', text: 'Known intracranial neoplasm/AVM', value: 'Absolute' },
          { id: 'dx-2-3', text: 'Ischemic stroke <3 months', value: 'Absolute' },
          { id: 'dx-2-4', text: 'Active bleeding or bleeding diathesis', value: 'Absolute' },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'stemi-tx-1',
        phase: 'Immediate',
        title: 'Initial STEMI Bundle',
        timing: '0-10 minutes',
        actions: [
          { id: 'tx-1-1', text: 'Activate cath lab, call interventional cardiology', priority: 'immediate' },
          { id: 'tx-1-2', text: 'Aspirin 325 mg chew', priority: 'immediate' },
          { id: 'tx-1-3', text: 'P2Y12 inhibitor load (ticagrelor 180 mg or clopidogrel 600 mg)', priority: 'urgent' },
          { id: 'tx-1-4', text: 'Anticoagulation (heparin bolus/infusion) per protocol', priority: 'urgent' },
          { id: 'tx-1-5', text: 'High-intensity statin (atorvastatin 80 mg)', priority: 'routine' },
        ],
      },
      {
        id: 'stemi-tx-2',
        phase: 'Reperfusion',
        title: 'PCI vs Fibrinolysis',
        timing: 'Within 90 minutes',
        actions: [
          { id: 'tx-2-1', text: 'Primary PCI if door-to-balloon <90 min (or <120 min from first medical contact)', priority: 'immediate' },
          { id: 'tx-2-2', text: 'If PCI delay >120 min and symptom onset <12 hours → fibrinolysis', priority: 'urgent', details: 'Assess contraindications' },
          { id: 'tx-2-3', text: 'Transfer for rescue PCI if failed fibrinolysis', priority: 'urgent' },
        ],
      },
      {
        id: 'stemi-tx-3',
        phase: 'Complications',
        title: 'Early Complication Management',
        timing: 'First 24 hours',
        actions: [
          { id: 'tx-3-1', text: 'Treat RV infarct: fluids, avoid nitrates', priority: 'urgent' },
          { id: 'tx-3-2', text: 'Manage arrhythmias (VT/VF) with ACLS protocols', priority: 'urgent' },
          { id: 'tx-3-3', text: 'Start beta-blocker if no contraindications', priority: 'routine' },
        ],
      },
    ],
    medications: [
      {
        id: 'stemi-med-1',
        name: 'Aspirin',
        genericName: 'acetylsalicylic acid',
        category: 'first-line',
        indication: 'Antiplatelet therapy for STEMI',
        dosing: [
          { route: 'PO', dose: '325 mg chew', notes: 'Then 81 mg daily' },
        ],
        contraindications: ['Active bleeding', 'Severe allergy'],
        monitoringParameters: ['Bleeding'],
        pearls: ['Give immediately unless true anaphylaxis'],
      },
      {
        id: 'stemi-med-2',
        name: 'Ticagrelor',
        genericName: 'ticagrelor',
        category: 'first-line',
        indication: 'P2Y12 inhibition for STEMI',
        dosing: [
          { route: 'PO', dose: '180 mg loading dose', notes: 'Then 90 mg BID' },
        ],
        sideEffects: ['Dyspnea', 'Bleeding'],
        monitoringParameters: ['Bleeding'],
        pearls: ['Avoid with strong CYP3A inhibitors'],
      },
      {
        id: 'stemi-med-3',
        name: 'Heparin',
        genericName: 'unfractionated heparin',
        category: 'first-line',
        indication: 'Anticoagulation during PCI or fibrinolysis',
        dosing: [
          { route: 'IV', dose: '60 units/kg bolus (max 4000), then 12 units/kg/hr', notes: 'Target aPTT per protocol' },
        ],
        contraindications: ['Active bleeding', 'HIT'],
        monitoringParameters: ['aPTT', 'Platelets'],
      },
    ],
    pitfalls: [
      {
        id: 'stemi-pitfall-1',
        title: 'Waiting for troponin to activate cath lab',
        description: 'Delaying reperfusion while waiting for biomarkers',
        consequence: 'Larger infarct size, worse outcomes',
        prevention: 'STEMI is an ECG diagnosis - activate immediately',
        severity: 'critical',
      },
      {
        id: 'stemi-pitfall-2',
        title: 'Giving nitrates in RV infarct or hypotension',
        description: 'Administering nitrates without assessing RV involvement',
        consequence: 'Severe hypotension, shock',
        prevention: 'Check right-sided leads in inferior STEMI; avoid nitrates if RV infarct suspected',
        severity: 'critical',
      },
      {
        id: 'stemi-pitfall-3',
        title: 'Missing posterior MI',
        description: 'Interpreting ST depression in V1-V3 as ischemia only',
        consequence: 'Delayed reperfusion for posterior STEMI',
        prevention: 'Obtain posterior leads (V7-V9) with ST depression in V1-V3',
        severity: 'major',
      },
    ],
    differentialDiagnosis: [
      'Pericarditis',
      'Early repolarization',
      'Left ventricular aneurysm',
      'Hyperkalemia',
      'Brugada pattern',
    ],
  },

  // ============================================
  // COPD EXACERBATION - Comprehensive Content
  // ============================================
  copd: {
    keyPearls: [
      {
        id: 'copd-pearl-1',
        text: 'Treat with bronchodilators, systemic steroids, and antibiotics when indicated. Early NIV reduces intubation and mortality.',
        importance: 'critical',
        category: 'Treatment',
      },
      {
        id: 'copd-pearl-2',
        text: 'Target oxygen saturation 88-92%. Avoid over-oxygenation which can worsen hypercapnia.',
        importance: 'critical',
        category: 'Oxygen',
      },
      {
        id: 'copd-pearl-3',
        text: 'NIV indications: pH 7.25-7.35 and PaCO2 >45 with dyspnea; contraindications include AMS, vomiting, or inability to protect airway.',
        importance: 'high',
        category: 'Ventilation',
      },
      {
        id: 'copd-pearl-4',
        text: 'Think about pneumonia, PE, CHF, and pneumothorax as triggers for exacerbation.',
        importance: 'high',
        category: 'Etiology',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'copd-dx-1',
        title: 'Acute COPD Exacerbation',
        criteria: [
          { id: 'dx-1-1', text: 'Increased dyspnea', required: true },
          { id: 'dx-1-2', text: 'Increased sputum volume', required: true },
          { id: 'dx-1-3', text: 'Increased sputum purulence', required: false },
        ],
        notes: 'Presence of 2/3 symptoms supports diagnosis; consider infectious or environmental triggers',
      },
      {
        id: 'copd-dx-2',
        title: 'Indications for Hospitalization',
        criteria: [
          { id: 'dx-2-1', text: 'Severe dyspnea or accessory muscle use', value: 'Admit' },
          { id: 'dx-2-2', text: 'Failure of outpatient management', value: 'Admit' },
          { id: 'dx-2-3', text: 'Altered mental status or hypoxemia', value: 'Admit' },
          { id: 'dx-2-4', text: 'Significant comorbidities (CHF, pneumonia)', value: 'Admit' },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'copd-tx-1',
        phase: 'Initial',
        title: 'Immediate Management',
        timing: '0-30 minutes',
        actions: [
          { id: 'tx-1-1', text: 'Supplemental O2 to target SpO2 88-92%', priority: 'immediate' },
          { id: 'tx-1-2', text: 'Short-acting bronchodilators: albuterol + ipratropium nebs', priority: 'immediate' },
          { id: 'tx-1-3', text: 'Systemic steroids: prednisone 40 mg PO or methylpred 40 mg IV', priority: 'urgent' },
          { id: 'tx-1-4', text: 'Assess for NIV (BiPAP) if hypercapnic respiratory acidosis', priority: 'urgent' },
        ],
      },
      {
        id: 'copd-tx-2',
        phase: 'Ongoing',
        title: 'Escalation and Workup',
        timing: '30-120 minutes',
        actions: [
          { id: 'tx-2-1', text: 'Start antibiotics if sputum purulence + dyspnea or need for ventilation', priority: 'routine' },
          { id: 'tx-2-2', text: 'Obtain CXR and ABG/VBG', priority: 'routine' },
          { id: 'tx-2-3', text: 'Consider alternative causes (PE, CHF, pneumonia, pneumothorax)', priority: 'routine' },
        ],
      },
      {
        id: 'copd-tx-3',
        phase: 'Failure',
        title: 'Intubation Criteria',
        timing: 'If deteriorating',
        actions: [
          { id: 'tx-3-1', text: 'Progressive acidosis or hypercapnia despite NIV', priority: 'urgent' },
          { id: 'tx-3-2', text: 'Worsening hypoxemia or inability to protect airway', priority: 'urgent' },
          { id: 'tx-3-3', text: 'Prepare for intubation with ventilator settings to avoid auto-PEEP', priority: 'routine' },
        ],
      },
    ],
    medications: [
      {
        id: 'copd-med-1',
        name: 'Albuterol',
        genericName: 'albuterol',
        category: 'first-line',
        indication: 'Bronchodilation in COPD exacerbation',
        dosing: [
          { route: 'INH', dose: '2.5 mg nebulized q20 min x3, then q1-4h', notes: 'Continuous neb if severe' },
        ],
        sideEffects: ['Tachycardia', 'Tremor'],
        monitoringParameters: ['HR', 'Work of breathing'],
      },
      {
        id: 'copd-med-2',
        name: 'Ipratropium',
        genericName: 'ipratropium bromide',
        category: 'first-line',
        indication: 'Adjunct bronchodilator',
        dosing: [
          { route: 'INH', dose: '0.5 mg nebulized q6h', notes: 'Combine with albuterol' },
        ],
        sideEffects: ['Dry mouth'],
        monitoringParameters: ['Symptoms'],
      },
      {
        id: 'copd-med-3',
        name: 'Prednisone',
        genericName: 'prednisone',
        category: 'first-line',
        indication: 'Reduce inflammation and shorten recovery',
        dosing: [
          { route: 'PO', dose: '40 mg daily x5 days', notes: 'No taper needed for short course' },
        ],
        sideEffects: ['Hyperglycemia', 'Mood changes'],
        monitoringParameters: ['Glucose'],
      },
    ],
    pitfalls: [
      {
        id: 'copd-pitfall-1',
        title: 'Over-oxygenation',
        description: 'Giving high-flow oxygen without titration',
        consequence: 'Worsening hypercapnia and acidosis',
        prevention: 'Target SpO2 88-92% and monitor ABG/VBG',
        severity: 'critical',
      },
      {
        id: 'copd-pitfall-2',
        title: 'Delaying NIV',
        description: 'Waiting until severe acidosis to start BiPAP',
        consequence: 'Higher intubation rates and mortality',
        prevention: 'Initiate NIV early in hypercapnic respiratory failure',
        severity: 'major',
      },
      {
        id: 'copd-pitfall-3',
        title: 'Missing alternative diagnosis',
        description: 'Assuming every dyspnea episode is COPD',
        consequence: 'Delayed treatment of PE, CHF, or pneumonia',
        prevention: 'Evaluate for triggers and alternate causes with CXR and labs',
        severity: 'major',
      },
    ],
    differentialDiagnosis: [
      'Asthma exacerbation',
      'CHF exacerbation',
      'Pulmonary embolism',
      'Pneumonia',
      'Pneumothorax',
    ],
  },

  // ============================================
  // TOXICOLOGY - ACETAMINOPHEN TOXICITY
  // ============================================
  acetaminophen: {
    keyPearls: [
      {
        id: 'cmin-pearl-1',
        text: 'Calculate time since ingestion. The Rumack-Matthew nomogram is only valid for acute, single ingestions between 4 and 24 hours.',
        importance: 'critical',
        category: 'Assessment',
      },
      {
        id: 'cmin-pearl-2',
        text: 'Do not delay N-acetylcysteine (NAC) while waiting for levels if suspicion is high or ingestion was >8 hours ago.',
        importance: 'critical',
        category: 'Treatment',
      },
      {
        id: 'cmin-pearl-3',
        text: 'Massive ingestions (>30-40g) or co-ingestions with anticholinergics may require altered NAC protocols or hemodialysis.',
        importance: 'high',
        category: 'Treatment',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'cmin-dx-1',
        title: 'Toxic Dose Thresholds',
        criteria: [
          { id: 'dx-1-1', text: 'Acute: >150 mg/kg or ~7.5g in adults', required: true },
          { id: 'dx-1-2', text: 'Chronic: >4 g/day for >2 days in healthy adults', required: true },
        ],
      },
      {
        id: 'cmin-dx-2',
        title: 'Rumack-Matthew Nomogram Use',
        criteria: [
          { id: 'dx-2-1', text: 'Single acute ingestion', value: 'Required' },
          { id: 'dx-2-2', text: 'Level drawn at least 4 hours post-ingestion', value: 'Required' },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'cmin-tx-1',
        phase: 'Immediate',
        title: 'Initial Assessment',
        timing: '0-2 hours',
        actions: [
          { id: 'tx-1-1', text: 'Obtain acetaminophen level, AST/ALT, bilirubin, PT/INR, BMP', priority: 'immediate' },
          { id: 'tx-1-2', text: 'Determine exact time and formulation (extended release?) of ingestion', priority: 'immediate' },
        ],
      },
      {
        id: 'cmin-tx-2',
        phase: 'Antidote Therapy',
        title: 'N-Acetylcysteine Administration',
        timing: 'Based on nomogram',
        actions: [
          { id: 'tx-2-1', text: 'If level above treatment line: Start IV NAC (21-hr protocol)', priority: 'immediate' },
          { id: 'tx-2-2', text: 'If unknown time or high suspicion: Start NAC empirically', priority: 'immediate' },
        ],
      },
    ],
    medications: [
      {
        id: 'cmin-med-1',
        name: 'N-Acetylcysteine (IV)',
        genericName: 'acetylcysteine',
        category: 'first-line',
        indication: 'Acetaminophen overdose',
        dosing: [
          { route: 'IV', dose: '150 mg/kg over 1h, then 50 mg/kg over 4h, then 100 mg/kg over 16h', notes: 'Consider simplified 2-bag protocol if available' },
        ],
        sideEffects: ['Anaphylactoid reaction (treat with antihistamines)'],
      },
    ],
    pitfalls: [
      {
        id: 'cmin-pit-1',
        title: 'Improper Nomogram Use',
        description: 'Using the nomogram for chronic ingestions or <4 hours post-ingestion.',
        consequence: 'False reassurance and missed toxicity.',
        prevention: 'Apply nomogram strictly to acute ingestions starting at hour 4.',
        severity: 'critical',
      },
    ],
  },

  // ============================================
  // TOXICOLOGY - OPIOID OVERDOSE
  // ============================================
  'opioid-overdose': {
    keyPearls: [
      {
        id: 'opioid-pearl-1',
        text: 'Naloxone goal is spontaneous respirations, NOT full awakening. Given the short half-life of naloxone, watch for resedation.',
        importance: 'critical',
        category: 'Treatment',
      },
      {
        id: 'opioid-pearl-2',
        text: 'Fentanyl and synthetic analogs may require significantly larger doses of naloxone.',
        importance: 'critical',
        category: 'Treatment',
      },
      {
        id: 'opioid-pearl-3',
        text: 'Prepare for acute withdrawal and agitation upon reversal. Do not fully restrain before giving naloxone if possible to avoid rhabdomyolysis.',
        importance: 'high',
        category: 'Complications',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'opioid-dx-1',
        title: 'Opioid Toxidrome',
        criteria: [
          { id: 'dx-1-1', text: 'Respiratory depression (RR <12)', required: true, value: 'RR <12' },
          { id: 'dx-1-2', text: 'Miosis (pinpoint pupils)', required: true },
          { id: 'dx-1-3', text: 'Altered mental status/CNS depression', required: true },
        ],
        notes: 'Note: Meperidine, propoxyphene, and tramadol may not cause miosis. Co-ingestions may alter toxidrome.',
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'opioid-tx-1',
        phase: 'Immediate',
        title: 'Resuscitation',
        timing: '0-5 minutes',
        actions: [
          { id: 'tx-1-1', text: 'Assess airway and breathing; bag-valve-mask ventilate if apneic', priority: 'immediate' },
          { id: 'tx-1-2', text: 'Administer Naloxone 0.4mg IV or 2mg IN', priority: 'immediate' },
        ],
      },
      {
        id: 'opioid-tx-2',
        phase: 'Stabilization',
        title: 'Observation & Re-dosing',
        timing: '5-60 minutes',
        actions: [
          { id: 'tx-2-1', text: 'Observe for return of respiratory drive; titrate naloxone up to 2-10mg for methadone/fentanyl', priority: 'urgent' },
          { id: 'tx-2-2', text: 'If continuous naloxone needed, consider drip at 2/3 of total bolus dose per hour', priority: 'routine' },
        ],
      },
    ],
    medications: [
      {
        id: 'opioid-med-1',
        name: 'Naloxone',
        genericName: 'naloxone',
        category: 'first-line',
        indication: 'Opioid-induced respiratory depression',
        dosing: [
          { route: 'IV', dose: '0.4 - 2.0 mg every 2-3 minutes PRN', notes: 'Start low (0.04 mg) if known chronic user to avoid severe withdrawal' },
        ],
        sideEffects: ['Acute opioid withdrawal syndrome', 'Agitation', 'Pulmonary edema (rare)'],
      },
    ],
    pitfalls: [
      {
        id: 'opioid-pit-1',
        title: 'Targeting full alertness',
        description: 'Giving excessive naloxone to achieve GCS 15.',
        consequence: 'Precipitated severe withdrawal, vomiting, aspiration, and combative behavior.',
        prevention: 'Titrate naloxone strictly to respiratory drive (RR >12).',
        severity: 'major',
      },
    ],
  },

  // ============================================
  // TOXICOLOGY - ALCOHOL WITHDRAWAL
  // ============================================
  'alcohol-withdrawal': {
    keyPearls: [
      {
        id: 'etoh-pearl-1',
        text: 'Symptom-triggered therapy (CIWA-Ar) is standard for mild-moderate withdrawal, but front-loading with diazepam may be needed for severe cases.',
        importance: 'critical',
        category: 'Treatment',
      },
      {
        id: 'etoh-pearl-2',
        text: 'Always administer thiamine 100-500mg IV to prevent Wernicke encephalopathy before or concurrent with glucose.',
        importance: 'critical',
        category: 'Prophylaxis',
      },
      {
        id: 'etoh-pearl-3',
        text: 'Benzodiazepine refractory withdrawal may require phenobarbital or dexmedetomidine.',
        importance: 'high',
        category: 'Refractory',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'etoh-dx-1',
        title: 'Withdrawal Staging',
        criteria: [
          { id: 'dx-1-1', text: 'Minor (6-36h): Tremor, tachycardia, hypertension, diaphoresis', value: 'Minor' },
          { id: 'dx-1-2', text: 'Withdrawal Seizures (12-48h): Generalized tonic-clonic', value: 'Seizures' },
          { id: 'dx-1-3', text: 'Alcoholic Hallucinosis (12-48h): Visual/auditory with intact sensorium', value: 'Hallucinosis' },
          { id: 'dx-1-4', text: 'Delirium Tremens (48-96h): Autonomic instability, confusion, fever', value: 'DTs' },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'etoh-tx-1',
        phase: 'Initial',
        title: 'Prophylaxis & Assessment',
        timing: '0-2 hours',
        actions: [
          { id: 'tx-1-1', text: 'Assess CIWA-Ar score', priority: 'immediate' },
          { id: 'tx-1-2', text: 'Administer Thiamine, Folate, and Multivitamin IV', priority: 'urgent' },
          { id: 'tx-1-3', text: 'Correct magnesium and potassium deficits', priority: 'urgent' },
        ],
      },
      {
        id: 'etoh-tx-2',
        phase: 'Treatment',
        title: 'Symptom Management',
        timing: 'Ongoing',
        actions: [
          { id: 'tx-2-1', text: 'CIWA >8: Diazepam 5-10mg IV or Lorazepam 1-2mg IV', priority: 'urgent', details: 'Repeat based on protocol' },
          { id: 'tx-2-2', text: 'Severe/DTs: Front-load with Diazepam 10-20mg IV q10min until calm', priority: 'immediate' },
        ],
      },
    ],
    medications: [
      {
        id: 'etoh-med-1',
        name: 'Diazepam',
        genericName: 'diazepam',
        category: 'first-line',
        indication: 'Severe alcohol withdrawal',
        dosing: [
          { route: 'IV', dose: '10-20 mg q10-20min until symptoms controlled', notes: 'Long half-life provides auto-taper' },
        ],
        sideEffects: ['Sedation', 'Respiratory depression'],
        contraindications: ['Severe liver failure (use Lorazepam instead)'],
      },
      {
        id: 'etoh-med-2',
        name: 'Lorazepam',
        genericName: 'lorazepam',
        category: 'first-line',
        indication: 'Withdrawal in elderly or hepatic failure',
        dosing: [
          { route: 'IV', dose: '1-4 mg q10-20min until symptoms controlled', notes: 'No active metabolites' },
        ],
      },
      {
        id: 'etoh-med-3',
        name: 'Phenobarbital',
        genericName: 'phenobarbital',
        category: 'second-line',
        indication: 'Benzodiazepine-refractory withdrawal',
        dosing: [
          { route: 'IV', dose: '10 mg/kg lean body weight single dose', notes: 'Consider intubation' },
        ],
        sideEffects: ['Profound sedation', 'Respiratory failure', 'Hypotension'],
      },
    ],
    pitfalls: [
      {
        id: 'etoh-pit-1',
        title: 'Underdosing Benzodiazepines',
        description: 'Using small oral divided doses for patients in active DTs.',
        consequence: 'Progression to severe agitation, seizures, and death.',
        prevention: 'Use IV loading protocols for severe withdrawal.',
        severity: 'critical',
      },
    ],
  },

  // ============================================
  // NEPHROLOGY - HYPERKALEMIA
  // ============================================
  hyperkalemia: {
    keyPearls: [
      {
        id: 'hk-pearl-1',
        text: 'ECG changes dictate the need for calcium. If QRS is wide or sine wave pattern forms, give calcium immediately to stabilize myocardium.',
        importance: 'critical',
        category: 'Treatment',
      },
      {
        id: 'hk-pearl-2',
        text: 'Calcium does not lower potassium levels; it only protects the heart. You must follow up with shifting and eliminating agents.',
        importance: 'critical',
        category: 'Treatment',
      },
      {
        id: 'hk-pearl-3',
        text: 'Insulin + Dextrose is the most reliable rapid shifter. Albuterol and Bicarbonate are adjunctive.',
        importance: 'high',
        category: 'Treatment',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'hk-dx-1',
        title: 'Severity Based on Serum K+',
        criteria: [
          { id: 'dx-1-1', text: 'Mild: 5.5 - 5.9 mEq/L', value: 'Mild' },
          { id: 'dx-1-2', text: 'Moderate: 6.0 - 6.4 mEq/L', value: 'Moderate' },
          { id: 'dx-1-3', text: 'Severe: ≥ 6.5 mEq/L or ANY value with ECG changes', value: 'Severe' },
        ],
      },
      {
        id: 'hk-dx-2',
        title: 'ECG Changes Progression',
        criteria: [
          { id: 'dx-2-1', text: 'Peaked T waves (earliest sign)', value: 'ECG' },
          { id: 'dx-2-2', text: 'PR prolongation and loss of P waves', value: 'ECG' },
          { id: 'dx-2-3', text: 'QRS widening', value: 'ECG' },
          { id: 'dx-2-4', text: 'Sine wave pattern (pre-arrest)', value: 'ECG' },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'hk-tx-1',
        phase: 'Immediate',
        title: 'Stabilize Myocardium (if ECG changes)',
        timing: '0-5 minutes',
        actions: [
          { id: 'tx-1-1', text: 'Administer Calcium Gluconate (1-2 amps IV) or Calcium Chloride (1 amp via central line)', priority: 'immediate' },
        ],
      },
      {
        id: 'hk-tx-2',
        phase: 'Shift Potassium',
        title: 'Intracellular Shifting',
        timing: '10-30 minutes',
        actions: [
          { id: 'tx-2-1', text: 'Regular Insulin 10 units IV + 50mL D50 (if BG < 250)', priority: 'immediate', details: 'Dose reduce insulin to 5 units in severe renal failure to prevent late hypoglycemia' },
          { id: 'tx-2-2', text: 'Albuterol nebulized (10-20 mg) - high dose required', priority: 'urgent' },
          { id: 'tx-2-3', text: 'Sodium Bicarbonate (only effectively shifts if patient is significantly acidotic)', priority: 'routine' },
        ],
      },
      {
        id: 'hk-tx-3',
        phase: 'Elimination',
        title: 'Remove Potassium',
        timing: 'Ongoing',
        actions: [
          { id: 'tx-3-1', text: 'Loop diuretics (Furosemide) if patient makes urine', priority: 'routine' },
          { id: 'tx-3-2', text: 'GI binders (Lokelma or Veltassa) - slow onset', priority: 'routine' },
          { id: 'tx-3-3', text: 'Emergent Hemodialysis for refractory or severely symptomatic cases', priority: 'urgent' },
        ],
      },
    ],
    medications: [
      {
        id: 'hk-med-1',
        name: 'Calcium Gluconate',
        genericName: 'calcium gluconate',
        category: 'first-line',
        indication: 'Cardioprotection in hyperkalemia',
        dosing: [
          { route: 'IV', dose: '1-2 grams over 5-10 minutes', notes: 'Contains ~4.6mEq elemental calcium per gram. Can give peripherally.' },
        ],
        monitoringParameters: ['ECG', 'Resolution of peaked T/wide QRS'],
      },
      {
        id: 'hk-med-2',
        name: 'Calcium Chloride',
        genericName: 'calcium chloride',
        category: 'first-line',
        indication: 'Cardioprotection (severe/arrest)',
        dosing: [
          { route: 'IV', dose: '1 gram over 5-10 minutes', notes: 'Contains ~13.6mEq elemental calcium. Central access preferred due to tissue necrosis risk.' },
        ],
      },
      {
        id: 'hk-med-3',
        name: 'Regular Insulin + Dextrose',
        genericName: 'insulin regular',
        category: 'first-line',
        indication: 'Potassium shifting',
        dosing: [
          { route: 'IV', dose: '10 units IV regular insulin + 1 amp D50 (50mL)', notes: 'Use 5 units if renal failure or low body weight to avoid severe hypoglycemia' },
        ],
        sideEffects: ['Hypoglycemia (monitor closely for 6 hours)'],
      },
    ],
    pitfalls: [
      {
        id: 'hk-pit-1',
        title: 'Failure to Monitor Blood Glucose',
        description: 'Using 10 units of insulin without follow-up glucose checks.',
        consequence: 'Profound delayed hypoglycemia, especially in ESRD patients.',
        prevention: 'Check fingerstick glucose q1hr x6 hours after IV insulin. Consider 5 units for ESKD.',
        severity: 'major',
      },
      {
        id: 'hk-pit-2',
        title: 'Bicarbonate Monotherapy',
        description: 'Relying exclusively on sodium bicarbonate ampules to shift potassium.',
        consequence: 'Ineffective shifting. Bicarbonate alone is a very poor shifter unless the patient has severe metabolic acidosis.',
        prevention: 'Always use Insulin+Dextrose as the primary shifting mechanism.',
        severity: 'major',
      },
    ],
  },

  // ============================================
  // NEPHROLOGY - HYPONATREMIA
  // ============================================
  hyponatremia: {
    keyPearls: [
      {
        id: 'hyna-pearl-1',
        text: 'Symptomatic vs Asymptomatic: Seizures, coma, or severe confusion dictate emergency treatment with hypertonic saline (3%), regardless of volume status.',
        importance: 'critical',
        category: 'Assessment',
      },
      {
        id: 'hyna-pearl-2',
        text: 'Rate of Correction: Do not exceed 8 mEq/L per 24 hours to prevent Osmotic Demyelination Syndrome (ODS).',
        importance: 'critical',
        category: 'Treatment',
      },
      {
        id: 'hyna-pearl-3',
        text: 'Volume status (hypovolemic, euvolemic, hypervolemic) directs the long-term management strategy.',
        importance: 'high',
        category: 'Assessment',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'hyna-dx-1',
        title: 'Classification by Serum Osmolality',
        criteria: [
          { id: 'dx-1-1', text: 'Isotonic (Pseudohyponatremia): High lipids or proteins', value: 'Isotonic' },
          { id: 'dx-1-2', text: 'Hypertonic: Hyperglycemia or mannitol', value: 'Hypertonic' },
          { id: 'dx-1-3', text: 'Hypotonic: True hyponatremia. Proceeds to volume assessment.', value: 'Hypotonic' },
        ],
      },
      {
        id: 'hyna-dx-2',
        title: 'Classification by Volume Status',
        criteria: [
          { id: 'dx-2-1', text: 'Hypovolemic: Diuretics, GI losses, bleeding. High urine osmolality, low urine sodium.', value: 'Hypovolemic' },
          { id: 'dx-2-2', text: 'Euvolemic: SIADH, hypothyroidism, psychogenic polydipsia.', value: 'Euvolemic' },
          { id: 'dx-2-3', text: 'Hypervolemic: CHF, Cirrhosis, Nephrotic Syndrome.', value: 'Hypervolemic' },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'hyna-tx-1',
        phase: 'Severe Symptoms',
        title: 'Emergency Resuscitation',
        timing: '0-2 hours',
        actions: [
          { id: 'tx-1-1', text: 'Give 100-150 mL 3% NaCl IV bolus over 10-20 minutes', priority: 'immediate', details: 'Repeat x1 or x2 until symptoms stop (e.g. seizures)' },
          { id: 'tx-1-2', text: 'Goal is acute rise of only 4-6 mEq/L to arrest severe symptoms. Check sodium every 2 hours.', priority: 'immediate' },
        ],
      },
      {
        id: 'hyna-tx-2',
        phase: 'Definitive',
        title: 'Status-Specific Therapy',
        timing: 'Ongoing',
        actions: [
          { id: 'tx-2-1', text: 'Hypovolemic: Normal Saline (0.9% NaCl) to restore volume. Watch for rapid auto-correction once euvolemic.', priority: 'routine' },
          { id: 'tx-2-2', text: 'Euvolemic (SIADH): Fluid restriction (e.g. <1L/day), consider urea or loop diuretics + salt tabs.', priority: 'routine' },
          { id: 'tx-2-3', text: 'Hypervolemic: Fluid/salt restriction, optimize CHF/cirrhosis therapy (diuretics).', priority: 'routine' },
        ],
      },
      {
        id: 'hyna-tx-3',
        phase: 'Rescue',
        title: 'Overcorrection Rescue',
        timing: 'If Na rises > 8mEq/24hr',
        actions: [
          { id: 'tx-3-1', text: 'Start D5W infusion to lower sodium', priority: 'urgent' },
          { id: 'tx-3-2', text: 'Administer Desmopressin (DDAVP) 1-2 mcg IV/SC to halt free water clearance', priority: 'urgent' },
        ],
      },
    ],
    medications: [
      {
        id: 'hyna-med-1',
        name: '3% Sodium Chloride',
        genericName: 'hypertonic saline',
        category: 'first-line',
        indication: 'Severe symptomatic hyponatremia',
        dosing: [
          { route: 'IV', dose: '100-150 mL bolus', notes: 'Use peripheral or central line. Do NOT use as continuous maintenance drip without expert consultation.' },
        ],
        sideEffects: ['Osmotic demyelination (if overcorrected over 24-48h)'],
      },
      {
        id: 'hyna-med-2',
        name: 'Desmopressin (DDAVP)',
        genericName: 'desmopressin',
        category: 'rescue',
        indication: 'Prevention of overly rapid correction (overcorrection rescue or proactive clamp)',
        dosing: [
          { route: 'IV', dose: '1-2 mcg', notes: 'Clamps urine output. Requires matched fluid replacement.' },
        ],
      },
    ],
    pitfalls: [
      {
        id: 'hyna-pit-1',
        title: 'Rapid Auto-Correction',
        description: 'Normal Saline given to a hypovolemic patient turns off the ADH drive, causing massive free water diuresis.',
        consequence: 'Rapid rise in sodium exceeding safe limits, risking ODS.',
        prevention: 'Monitor urine output closely. If profound diuresis begins, check Na every 2 hours and prepare D5W / DDAVP.',
        severity: 'critical',
      },
    ],
  },

  // ============================================
  // NEUROLOGY - ISCHEMIC STROKE
  // ============================================
  'ischemic-stroke': {
    keyPearls: [
      {
        id: 'stroke-pearl-1',
        text: 'Time is brain. Rapid assessment, non-contrast CT head, and consideration for tPA/thrombectomy within minutes of arrival.',
        importance: 'critical',
        category: 'Assessment',
      },
      {
        id: 'stroke-pearl-2',
        text: 'Do not treat blood pressure unless >185/110 if giving tPA, or >220/120 if permissive hypertension strategy is used.',
        importance: 'critical',
        category: 'Treatment',
      },
      {
        id: 'stroke-pearl-3',
        text: 'Large Vessel Occlusion (LVO) needs rapid identification (CTA head/neck) for endovascular thrombectomy (EVT) window (up to 24 hours in some cases).',
        importance: 'high',
        category: 'Treatment',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'stroke-dx-1',
        title: 'Stroke Scales',
        criteria: [
          { id: 'dx-1-1', text: 'NIHSS: Quantifies severity (0-42)', value: 'NIHSS' },
          { id: 'dx-1-2', text: 'VAN or LAMS: Prehospital/ED screens for Large Vessel Occlusion', value: 'LVO Screen' },
        ],
      },
      {
        id: 'stroke-dx-2',
        title: 'Imaging Timelines',
        criteria: [
          { id: 'dx-2-1', text: 'Non-contrast CT Head: within 20-25 mins (rule out bleed)', value: 'Immediate' },
          { id: 'dx-2-2', text: 'CTA Head & Neck: if LVO suspected, immediately follows non-con CT', value: 'Immediate' },
          { id: 'dx-2-3', text: 'CT Perfusion: extended window EVT evaluation (6-24 hrs)', value: 'Advanced' },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'stroke-tx-1',
        phase: 'Immediate',
        title: 'Acute Evaluation',
        timing: '0-20 minutes',
        actions: [
          { id: 'tx-1-1', text: 'Assess ABCs, point-of-care glucose (rule out hypoglycemia)', priority: 'immediate' },
          { id: 'tx-1-2', text: 'Determine Last Known Well time precisely', priority: 'immediate' },
          { id: 'tx-1-3', text: 'Stat Non-Con CT Head + CTA Head/Neck', priority: 'immediate' },
        ],
      },
      {
        id: 'stroke-tx-2',
        phase: 'Reperfusion',
        title: 'Thrombolysis & Thrombectomy',
        timing: '0-4.5 hours (tPA) / up to 24h (EVT)',
        actions: [
          { id: 'tx-2-1', text: 'Alteplase or Tenecteplase if within 4.5h and no exclusions (BP <185/110)', priority: 'immediate' },
          { id: 'tx-2-2', text: 'Consult neuro-interventional for Mechanical Thrombectomy (EVT) if LVO identified', priority: 'immediate' },
        ],
      },
    ],
    medications: [
      {
        id: 'stroke-med-1',
        name: 'Alteplase (IV tPA)',
        genericName: 'alteplase',
        category: 'first-line',
        indication: 'Acute ischemic stroke <4.5 hours',
        dosing: [
          { route: 'IV', dose: '0.9 mg/kg (max 90mg). 10% as bolus, 90% over 1 hour.', notes: 'Strict BP control <180/105 during and after.' },
        ],
        sideEffects: ['Bleeding (symptomatic ICH risk ~6%)', 'Orolingual angioedema'],
        contraindications: ['Active bleeding', 'Recent neurosurgery', 'Severe head trauma <3mo', 'BP >185/110'],
      },
      {
        id: 'stroke-med-2',
        name: 'Tenecteplase',
        genericName: 'tenecteplase',
        category: 'first-line',
        indication: 'Acute ischemic stroke (increasingly favored alternative to Alteplase)',
        dosing: [
          { route: 'IV', dose: '0.25 mg/kg single bolus (max 25mg)', notes: 'Especially favored prior to EVT' },
        ],
      },
      {
        id: 'stroke-med-3',
        name: 'Labetalol / Nicardipine / Clevidipine',
        genericName: 'varies',
        category: 'adjunct',
        indication: 'BP management before/after tPA or for permissive hypertension (>220/120)',
        dosing: [
          { route: 'IV', dose: 'Titrated drops or IV push (e.g., Labetalol 10-20mg IV push)', notes: 'Smooth control preferred to avoid hypotension' },
        ],
      },
    ],
    pitfalls: [
      {
        id: 'stroke-pit-1',
        title: 'Over-treating Blood Pressure',
        description: 'Aggressively dropping blood pressure in a patient NOT receiving tPA.',
        consequence: 'Worsening of the ischemic penumbra, extending the stroke.',
        prevention: 'Allow permissive hypertension up to 220/120 unless there are other absolute indications to lower BP (e.g., aortic dissection, heart failure).',
        severity: 'critical',
      },
    ],
  },

  // ============================================
  // NEUROLOGY - INTRACEREBRAL HEMORRHAGE (ICH)
  // ============================================
  ich: {
    keyPearls: [
      {
        id: 'ich-pearl-1',
        text: 'Reversal of anticoagulants is the highest priority. Time is tissue; hematoma expansion occurs rapidly in the first few hours.',
        importance: 'critical',
        category: 'Reversal',
      },
      {
        id: 'ich-pearl-2',
        text: 'Maintain strict BP control (Target SBP < 140) to minimize hematoma expansion, smoothly and without large fluctuations.',
        importance: 'critical',
        category: 'Hemodynamics',
      },
      {
        id: 'ich-pearl-3',
        text: 'Elevate head of bed to 30 degrees, maintain normothermia, and manage ICP if signs of herniation appear.',
        importance: 'high',
        category: 'Neuro-ICU',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'ich-dx-1',
        title: 'Imaging',
        criteria: [
          { id: 'dx-1-1', text: 'Non-Con CT: hyperdense collection within brain parenchyma', value: 'Diagnostic' },
          { id: 'dx-1-2', text: 'CTA: "Spot sign" indicates active bleeding and high risk for expansion', value: 'Prognostic' },
        ],
      },
      {
        id: 'ich-dx-2',
        title: 'ICH Score (0-6)',
        criteria: [
          { id: 'dx-2-1', text: 'GCS (3-4 = 2 pts, 5-12 = 1 pt)', value: 'Clinical' },
          { id: 'dx-2-2', text: 'Volume > 30mL (1 pt)', value: 'Radiologic' },
          { id: 'dx-2-3', text: 'IVH present (1 pt)', value: 'Radiologic' },
          { id: 'dx-2-4', text: 'Infratentorial origin (1 pt)', value: 'Radiologic' },
          { id: 'dx-2-5', text: 'Age > 80 (1 pt)', value: 'Demographic' },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'ich-tx-1',
        phase: 'Immediate',
        title: 'Reversal & BP Control',
        timing: '0-30 minutes',
        actions: [
          { id: 'tx-1-1', text: 'Ascertain anticoagulant use immediately and give specific reversal agent (PCC, Andexanet alfa, Idarucizumab)', priority: 'immediate' },
          { id: 'tx-1-2', text: 'Start titratable IV antihypertensive (Nicardipine or Clevidipine infusion) to maintain SBP < 140', priority: 'immediate' },
          { id: 'tx-1-3', text: 'Consult Neurosurgery for possible EVD (if IVH/hydrocephalus) or evacuation (cerebellar)', priority: 'urgent' },
        ],
      },
    ],
    medications: [
      {
        id: 'ich-med-1',
        name: '4-Factor PCC (Kcentra)',
        genericName: 'prothrombin complex concentrate',
        category: 'first-line',
        indication: 'Warfarin reversal',
        dosing: [
          { route: 'IV', dose: 'Weight and INR-based dosing (e.g. 50 units/kg if INR >6)', notes: 'Administer with Vitamin K 10mg IV' },
        ],
      },
      {
        id: 'ich-med-2',
        name: 'Nicardipine',
        genericName: 'nicardipine',
        category: 'first-line',
        indication: 'BP control in ICH',
        dosing: [
          { route: 'IV', dose: '5 mg/hr, titrate by 2.5 mg/hr q5-15 min to goal, max 15 mg/hr', notes: 'Smooth onset/offset' },
        ],
      },
    ],
    pitfalls: [
      {
        id: 'ich-pit-1',
        title: 'Waiting for Coags',
        description: 'Delaying PCC while waiting for an INR to return in a reliable historian known to be on warfarin.',
        consequence: 'Hematoma expansion and irreversible neurological deficit.',
        prevention: 'Give PCC empirically if suspicion/history is strong and bleeding is life-threatening.',
        severity: 'critical',
      },
    ],
  },

  // ============================================
  // NEUROLOGY - SUBARACHNOID HEMORRHAGE (SAH)
  // ============================================
  sah: {
    keyPearls: [
      {
        id: 'sah-pearl-1',
        text: '"Worst headache of life" (thunderclap) is the hallmark. Protect the airway early if mental status declines.',
        importance: 'critical',
        category: 'Assessment',
      },
      {
        id: 'sah-pearl-2',
        text: 'The major threats: Rebleeding (first 24h), Hydrocephalus (early), and Vasospasm (days 3-14).',
        importance: 'critical',
        category: 'Complications',
      },
      {
        id: 'sah-pearl-3',
        text: 'Nimodipine neuroprotection should be started early once aneurysmal source is suspected to improve outcomes (doesn\'t prevent angiographic vasospasm, but improves clinical outcome).',
        importance: 'high',
        category: 'Treatment',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'sah-dx-1',
        title: 'Diagnosis',
        criteria: [
          { id: 'dx-1-1', text: 'Non-Con CT Head (highly sensitive < 6h)', value: 'CT' },
          { id: 'dx-1-2', text: 'Lumbar Puncture (Xanthochromia) if CT negative but high suspicion (typically > 12h from onset)', value: 'LP' },
          { id: 'dx-1-3', text: 'CTA Brain/Neck to identify aneurysm or source', value: 'CTA' },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'sah-tx-1',
        phase: 'Immediate',
        title: 'Prevent Rebleeding & Aneurysm Targeting',
        timing: '0-12 hours',
        actions: [
          { id: 'tx-1-1', text: 'Strict BP control (SBP < 160 or MAP < 110) prior to securing aneurysm', priority: 'immediate' },
          { id: 'tx-1-2', text: 'Consult neurosurgery / neuro-interventional for coiling or clipping', priority: 'immediate' },
          { id: 'tx-1-3', text: 'Pain control (fentanyl/morphine) to prevent BP spikes', priority: 'urgent' },
        ],
      },
      {
        id: 'sah-tx-2',
        phase: 'Neuro-ICU',
        title: 'Complication Management',
        timing: 'Days 1-14',
        actions: [
          { id: 'tx-2-1', text: 'Nimodipine 60mg Q4H for 21 days', priority: 'routine' },
          { id: 'tx-2-2', text: 'Watch for hyponatremia (cerebral salt wasting) and treat with isotonic or hypertonic fluids (AVOID restriction)', priority: 'urgent' },
          { id: 'tx-2-3', text: 'EVD for hydrocephalus if indicated', priority: 'urgent' },
        ],
      },
    ],
    medications: [
      {
        id: 'sah-med-1',
        name: 'Nimodipine',
        genericName: 'nimodipine',
        category: 'first-line',
        indication: 'Neuroprotection post-SAH',
        dosing: [
          { route: 'PO', dose: '60 mg PO/NG every 4 hours for 21 days', notes: 'Never give IV. Can cause hypotension.' },
        ],
      },
    ],
    pitfalls: [
      {
        id: 'sah-pit-1',
        title: 'Hyponatremia Fluid Restriction',
        description: 'Treating hyponatremia in SAH (cerebral salt wasting) with fluid restriction instead of volume repletion.',
        consequence: 'Hypovolemia precipitates delayed cerebral ischemia (DCI) / vasospasm.',
        prevention: 'Treat with euvolemia or hypervolemia using isotonic/hypertonic saline.',
        severity: 'critical',
      },
    ],
  },

  // ============================================
  // ENDOCRINE - THYROID STORM
  // ============================================
  'thyroid-storm': {
    keyPearls: [
      {
        id: 'storm-pearl-1',
        text: 'Thyroid storm is a clinical diagnosis (Burch-Wartofsky score), not a laboratory one. Do not wait for thyroid panel results to start treatment if suspicion is high.',
        importance: 'critical',
        category: 'Diagnosis',
      },
      {
        id: 'storm-pearl-2',
        text: 'Treatment order matters: 1. Beta blockade (Propranolol), 2. Thionamides (PTU or Methimazole), 3. Iodine (Wait 1 hr AFTER thionamide), 4. Steroids.',
        importance: 'critical',
        category: 'Treatment',
      },
      {
        id: 'storm-pearl-3',
        text: 'Avoid Aspirin for fever control, as it can displace thyroid hormone from binding proteins and worsen the storm. Use acetaminophen.',
        importance: 'high',
        category: 'Supportive',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'storm-dx-1',
        title: 'Burch-Wartofsky Point Scale (BWPS)',
        criteria: [
          { id: 'dx-1-1', text: 'Temperature (>99°F to >104°F; up to 30 pts)', value: 'Temp' },
          { id: 'dx-1-2', text: 'CNS Effects (Agitation to Coma; up to 30 pts)', value: 'CNS' },
          { id: 'dx-1-3', text: 'GI/Hepatic Dysfunction (Nausea to Jaundice; up to 20 pts)', value: 'GI' },
          { id: 'dx-1-4', text: 'Cardiovascular (Tachycardia, AFib, CHF; up to 25 pts)', value: 'CV' },
          { id: 'dx-1-5', text: 'Precipitant History (0 or 10 pts)', value: 'Trigger' },
        ],
        notes: 'Score ≥ 45: Highly suggestive of Storm. 25-44: Impending Storm. < 25: Unlikely.',
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'storm-tx-1',
        phase: 'Immediate',
        title: 'Adrenergic Blockade & Synthesis Blockade',
        timing: '0-1 hour',
        actions: [
          { id: 'tx-1-1', text: 'Propranolol 1-2 mg IV slowly or 60-80 mg PO (blocks T4->T3 conversion and sympathetic tone)', priority: 'immediate', details: 'Target HR < 90' },
          { id: 'tx-1-2', text: 'PTU 500-1000 mg PO/PR loading dose OR Methimazole 20-30 mg PO/PR', priority: 'immediate', details: 'Blocks new synthesis' },
        ],
      },
      {
        id: 'storm-tx-2',
        phase: 'Delayed',
        title: 'Release Blockade & Steroids',
        timing: '1-6 hours (Wait 1hr after PTU/MMI)',
        actions: [
          { id: 'tx-2-1', text: 'Lugol\'s Iodine (10 drops PO) OR SSKI (5 drops PO) to halt release of pre-formed hormone', priority: 'urgent', details: 'CRITICAL: Must give AFTER thionamide to avoid fueling storm (Jod-Basedow effect)' },
          { id: 'tx-2-2', text: 'Hydrocortisone 100 mg IV q8h (blocks T4->T3 conversion and treats relative adrenal insufficiency)', priority: 'urgent' },
        ],
      },
    ],
    medications: [
      {
        id: 'storm-med-1',
        name: 'Propranolol',
        genericName: 'propranolol',
        category: 'first-line',
        indication: 'Sympathetic hyperactivity and T4-T3 conversion block',
        dosing: [
          { route: 'PO', dose: '60-80 mg q4-6h', notes: 'Preferred route if patient can tolerate.' },
          { route: 'IV', dose: '1-2 mg slow push, repeated PRN', notes: 'Use with caution if patient is in decompensated heart failure.' },
        ],
      },
      {
        id: 'storm-med-2',
        name: 'Propylthiouracil (PTU)',
        genericName: 'propylthiouracil',
        category: 'first-line',
        indication: 'Thyroid storm (blocks synthesis and T4->T3 conversion) favored over methimazole in severe storm and 1st trimester pregnancy.',
        dosing: [
          { route: 'PO', dose: '500-1000 mg load, then 250 mg q4h', notes: 'BBW for severe hepatotoxicity.' },
        ],
      },
    ],
    pitfalls: [
      {
        id: 'storm-pit-1',
        title: 'Iodine First',
        description: 'Giving iodine before the thionamide (PTU/Methimazole).',
        consequence: 'Provides excess substrate for new thyroid hormone synthesis (Wolf-Chaikoff failure / Jod-Basedow), worsening storm.',
        prevention: 'Always wait 1 hour after the thionamide is given before administering Iodine.',
        severity: 'critical',
      },
    ],
  },

  // ============================================
  // ENDOCRINE - MYXEDEMA COMA
  // ============================================
  'myxedema-coma': {
    keyPearls: [
      {
        id: 'myx-pearl-1',
        text: 'True myxedema coma is often a presentation of severe untreated hypothyroidism plus a precipitating stressor (infection, cold, drugs, MI).',
        importance: 'critical',
        category: 'Assessment',
      },
      {
        id: 'myx-pearl-2',
        text: 'Always cover for adrenal insufficiency before or alongside giving thyroid hormone to prevent precipitating adrenal crisis.',
        importance: 'critical',
        category: 'Treatment',
      },
      {
        id: 'myx-pearl-3',
        text: 'Passive rewarming is safer than active rapid rewarming, which can cause severe vasodilation and shock in these volume-depleted patients.',
        importance: 'high',
        category: 'Supportive',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'myx-dx-1',
        title: 'Hallmarks of Myxedema',
        criteria: [
          { id: 'dx-1-1', text: 'Altered Mental Status (lethargy to coma)', value: 'CNS' },
          { id: 'dx-1-2', text: 'Hypothermia (core temp often < 35°C / 95°F)', value: 'Temp' },
          { id: 'dx-1-3', text: 'Bradycardia, Hypotension, Hypoventilation', value: 'Vitals' },
          { id: 'dx-1-4', text: 'Hyponatremia and Hypoglycemia', value: 'Labs' },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'myx-tx-1',
        phase: 'Immediate',
        title: 'Steroids & Hormone Replacement',
        timing: '0-2 hours',
        actions: [
          { id: 'tx-1-1', text: 'Hydrocortisone 100 mg IV (stress dose) to prevent adrenal crisis', priority: 'immediate' },
          { id: 'tx-1-2', text: 'Levothyroxine (T4) 200-400 mcg IV loading dose', priority: 'immediate' },
          { id: 'tx-1-3', text: 'Consider Liothyronine (T3) 5-20 mcg IV in severe or comatose cases', priority: 'urgent', details: 'Risk of arrhythmias/ischemia; use caution in elderly or CAD' },
        ],
      },
      {
        id: 'myx-tx-2',
        phase: 'Supportive',
        title: 'Identify Trigger & Support',
        timing: 'Ongoing',
        actions: [
          { id: 'tx-2-1', text: 'Broad-spectrum antibiotics after cultures (infection is most common trigger)', priority: 'urgent' },
          { id: 'tx-2-2', text: 'Passive rewarming (blankets) in a warm room', priority: 'routine' },
        ],
      },
    ],
    medications: [
      {
        id: 'myx-med-1',
        name: 'Levothyroxine (T4)',
        genericName: 'levothyroxine',
        category: 'first-line',
        indication: 'Severe Hypothyroidism / Myxedema',
        dosing: [
          { route: 'IV', dose: '200-400 mcg IV load', notes: 'Then 50-100 mcg daily IV until taking PO. IV dose is ~75% of PO.' },
        ],
      },
      {
        id: 'myx-med-2',
        name: 'Hydrocortisone',
        genericName: 'hydrocortisone sodium succinate',
        category: 'first-line',
        indication: 'Empiric coverage for adrenal insufficiency',
        dosing: [
          { route: 'IV', dose: '100 mg q8h', notes: 'Administer BEFORE or WITH thyroid hormone.' },
        ],
      },
    ],
    pitfalls: [
      {
        id: 'myx-pit-1',
        title: 'Thyroid Hormone Without Steroids',
        description: 'Giving IV levothyroxine to a patient with unrecognized concomitant adrenal insufficiency (e.g., panhypopituitarism or autoimmune polyendocrine syndrome).',
        consequence: 'Thyroid hormone increases metabolic rate and cortisol clearance, precipitating fulminant adrenal crisis and cardiovascular collapse.',
        prevention: 'Always administer stress-dose hydrocortisone before or immediately with thyroid replacement in myxedema coma.',
        severity: 'critical',
      },
    ],
  },

  // ============================================
  // RESUSCITATION - VASOPRESSORS & INOTROPES
  // ============================================
  vasopressors: {
    keyPearls: [
      {
        id: 'pressors-pearl-1',
        text: 'Norepinephrine is the default first-line vasopressor for undifferentiated shock while diagnostic clarification is ongoing.',
        importance: 'critical',
        category: 'First-line Choice',
      },
      {
        id: 'pressors-pearl-2',
        text: 'Do not delay vasopressor initiation waiting for central access; start peripherally through a proximal large-bore IV and transition when feasible.',
        importance: 'critical',
        category: 'Timing',
      },
      {
        id: 'pressors-pearl-3',
        text: 'Match pharmacology to physiology: inotropy (dobutamine) for low cardiac output, vasoconstriction (norepinephrine/vasopressin) for vasoplegia.',
        importance: 'high',
        category: 'Hemodynamics',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'pressors-dx-1',
        title: 'When to Start Vasopressors',
        criteria: [
          { id: 'pressors-dx-1-1', text: 'Persistent MAP <65 mmHg after initial fluid challenge', required: true, value: 'MAP <65' },
          { id: 'pressors-dx-1-2', text: 'Evidence of hypoperfusion (oliguria, altered mentation, rising lactate)', required: true },
          { id: 'pressors-dx-1-3', text: 'No rapidly reversible obstructive cause (tamponade, tension pneumothorax)', required: true },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'pressors-tx-1',
        phase: 'Initial Stabilization',
        title: 'Pressor Initiation',
        timing: '0-30 minutes',
        actions: [
          { id: 'pressors-tx-1-1', text: 'Start norepinephrine via peripheral or central IV', priority: 'immediate', details: 'Titrate every 2-3 minutes to MAP target.' },
          { id: 'pressors-tx-1-2', text: 'Set individualized perfusion goals', priority: 'urgent', details: 'MAP ≥65 is typical; consider higher target with chronic HTN.' },
          { id: 'pressors-tx-1-3', text: 'Obtain bedside echo to phenotype shock', priority: 'urgent' },
        ],
      },
      {
        id: 'pressors-tx-2',
        phase: 'Escalation',
        title: 'Second Agent Strategy',
        timing: '30-120 minutes',
        actions: [
          { id: 'pressors-tx-2-1', text: 'Add vasopressin 0.03 U/min if norepinephrine requirement is rising', priority: 'urgent' },
          { id: 'pressors-tx-2-2', text: 'Add dobutamine for persistent low output state', priority: 'urgent', details: 'Use echo and lactate trend to guide.' },
          { id: 'pressors-tx-2-3', text: 'Address reversible contributors: acidosis, hypocalcemia, ongoing bleeding', priority: 'routine' },
        ],
      },
    ],
    pitfalls: [
      {
        id: 'pressors-pit-1',
        title: 'Pressors before adequate preload assessment',
        description: 'Escalating vasoconstrictors without ensuring minimal preload in profoundly volume-depleted states.',
        consequence: 'Worsening tissue perfusion and ischemic complications.',
        prevention: 'Pair vasopressor use with dynamic fluid responsiveness assessment and serial perfusion endpoints.',
        severity: 'major',
      },
    ],
  },

  // ============================================
  // PULMONOLOGY - MECHANICAL VENTILATION
  // ============================================
  'mechanical-ventilation': {
    keyPearls: [
      {
        id: 'vent-pearl-1',
        text: 'Use lung-protective ventilation broadly in intubated adults: tidal volume 6-8 mL/kg predicted body weight and plateau pressure <30 cmH2O.',
        importance: 'critical',
        category: 'Ventilator Strategy',
      },
      {
        id: 'vent-pearl-2',
        text: 'Hypoxemia is primarily managed with PEEP and FiO2; hypercapnia is primarily managed with minute ventilation.',
        importance: 'high',
        category: 'Troubleshooting',
      },
      {
        id: 'vent-pearl-3',
        text: 'Daily awakening and spontaneous breathing trials shorten ventilation duration when no contraindications exist.',
        importance: 'high',
        category: 'Liberation',
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'vent-tx-1',
        phase: 'Post-intubation',
        title: 'Initial Setup',
        timing: 'First 15 minutes',
        actions: [
          { id: 'vent-tx-1-1', text: 'Set assist-control mode with VT 6-8 mL/kg PBW', priority: 'immediate' },
          { id: 'vent-tx-1-2', text: 'Start RR 16-24/min and titrate to pH goals', priority: 'urgent' },
          { id: 'vent-tx-1-3', text: 'Adjust PEEP/FiO2 using standardized table', priority: 'urgent' },
        ],
      },
      {
        id: 'vent-tx-2',
        phase: 'Daily Management',
        title: 'Monitoring & Liberation',
        timing: 'Q shift and daily',
        actions: [
          { id: 'vent-tx-2-1', text: 'Track plateau pressure, driving pressure, and auto-PEEP', priority: 'urgent' },
          { id: 'vent-tx-2-2', text: 'Perform sedation interruption and SBT if criteria met', priority: 'routine' },
          { id: 'vent-tx-2-3', text: 'Extubate when airway protection, oxygenation, and mental status are adequate', priority: 'routine' },
        ],
      },
    ],
    differentialDiagnosis: [
      'Tube malposition or right mainstem intubation',
      'Mucus plugging',
      'Pneumothorax',
      'Pulmonary edema or evolving ARDS',
      'Bronchospasm with air trapping',
    ],
  },

  // ============================================
  // NEUROLOGY - ACUTE ISCHEMIC STROKE
  // ============================================
  stroke: {
    keyPearls: [
      {
        id: 'stroke-pearl-1',
        text: 'Time-to-reperfusion is brain: parallelize CT imaging, last-known-well verification, and thrombolytic eligibility assessment.',
        importance: 'critical',
        category: 'Workflow',
      },
      {
        id: 'stroke-pearl-2',
        text: 'Large-vessel occlusion should trigger immediate thrombectomy pathway activation regardless of thrombolytic candidacy.',
        importance: 'critical',
        category: 'Reperfusion',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'stroke-dx-1',
        title: 'Hyperacute Evaluation Bundle',
        criteria: [
          { id: 'stroke-dx-1-1', text: 'Last-known-well time established', required: true },
          { id: 'stroke-dx-1-2', text: 'Non-contrast CT excludes hemorrhage', required: true },
          { id: 'stroke-dx-1-3', text: 'Disabling neurologic deficit present', required: true },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'stroke-tx-1',
        phase: 'Hyperacute',
        title: 'Reperfusion Decision',
        timing: '0-60 minutes',
        actions: [
          { id: 'stroke-tx-1-1', text: 'Control BP to thrombolysis-compatible range when needed', priority: 'immediate' },
          { id: 'stroke-tx-1-2', text: 'Administer IV thrombolytic within approved window if eligible', priority: 'immediate' },
          { id: 'stroke-tx-1-3', text: 'Consult neurointerventional team for EVT candidacy', priority: 'urgent' },
        ],
      },
    ],
    pitfalls: [
      {
        id: 'stroke-pit-1',
        title: 'Permissive delay for transfer discussions',
        description: 'Spending excessive time on non-essential deliberations before transfer to thrombectomy-capable center.',
        consequence: 'Lost salvageable penumbra and worse disability outcomes.',
        prevention: 'Activate transfer and reperfusion pathways immediately once LVO is suspected.',
        severity: 'critical',
      },
    ],
  },

  // ============================================
  // HEMATOLOGY - ANTICOAGULATION REVERSAL
  // ============================================
  'anticoagulation-reversal': {
    keyPearls: [
      {
        id: 'ac-rev-pearl-1',
        text: 'Life-threatening bleeding requires immediate empiric reversal based on likely agent; do not wait for complete lab confirmation.',
        importance: 'critical',
        category: 'Timing',
      },
      {
        id: 'ac-rev-pearl-2',
        text: '4-factor PCC is preferred over plasma for warfarin-associated major hemorrhage due to speed and lower volume burden.',
        importance: 'high',
        category: 'Product Selection',
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'ac-rev-tx-1',
        phase: 'Immediate',
        title: 'Agent-Specific Reversal',
        timing: '0-30 minutes',
        actions: [
          { id: 'ac-rev-tx-1-1', text: 'Warfarin: give 4-factor PCC + IV vitamin K', priority: 'immediate' },
          { id: 'ac-rev-tx-1-2', text: 'Dabigatran: give idarucizumab if available', priority: 'immediate' },
          { id: 'ac-rev-tx-1-3', text: 'Factor Xa inhibitors: use andexanet alfa or PCC per institutional protocol', priority: 'immediate' },
        ],
      },
    ],
    medications: [
      {
        id: 'ac-rev-med-1',
        name: '4-factor Prothrombin Complex Concentrate',
        genericName: 'PCC (factors II, VII, IX, X)',
        category: 'first-line',
        indication: 'Warfarin-associated life-threatening bleeding or urgent procedure',
        dosing: [
          { route: 'IV', dose: '25-50 units/kg', maxDose: '5000 units', notes: 'Dose by INR and institutional protocol.' },
        ],
        monitoringParameters: ['INR', 'Clinical hemostasis', 'Thrombotic events'],
      },
    ],
  },

  // ============================================
  // GI/HEPATOLOGY - ACUTE GI BLEEDING
  // ============================================
  'gi-bleeding': {
    keyPearls: [
      {
        id: 'gib-pearl-1',
        text: 'Hemodynamic stabilization, large-bore access, and blood preparation precede definitive localization in unstable patients.',
        importance: 'critical',
        category: 'Resuscitation',
      },
      {
        id: 'gib-pearl-2',
        text: 'Restrictive transfusion (typical Hgb threshold ~7 g/dL) is generally associated with improved outcomes in non-exsanguinating bleeds.',
        importance: 'high',
        category: 'Transfusion',
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'gib-tx-1',
        phase: 'Emergency',
        title: 'Stabilize and Risk Stratify',
        timing: '0-2 hours',
        actions: [
          { id: 'gib-tx-1-1', text: 'Establish two large-bore IVs, send type and screen/crossmatch', priority: 'immediate' },
          { id: 'gib-tx-1-2', text: 'Start IV PPI for suspected upper GI source', priority: 'urgent' },
          { id: 'gib-tx-1-3', text: 'Add octreotide and ceftriaxone when variceal bleed is possible', priority: 'urgent' },
        ],
      },
      {
        id: 'gib-tx-2',
        phase: 'Definitive',
        title: 'Procedure Planning',
        timing: 'Within 24 hours',
        actions: [
          { id: 'gib-tx-2-1', text: 'Coordinate urgent endoscopy once stabilized', priority: 'urgent' },
          { id: 'gib-tx-2-2', text: 'Escalate to IR/surgery if refractory hemorrhage persists', priority: 'urgent' },
        ],
      },
    ],
  },

  // ============================================
  // PROCEDURES - AIRWAY MANAGEMENT
  // ============================================
  intubation: {
    keyPearls: [
      {
        id: 'airway-pearl-1',
        text: 'Optimize physiology before laryngoscopy: preoxygenate thoroughly, treat hypotension, and plan backup airway strategies.',
        importance: 'critical',
        category: 'Preparation',
      },
      {
        id: 'airway-pearl-2',
        text: 'First-pass success is a major safety metric; use checklists, video laryngoscopy, and the most experienced operator available.',
        importance: 'high',
        category: 'Execution',
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'airway-tx-1',
        phase: 'Pre-intubation',
        title: 'Preparation & Positioning',
        timing: '0-10 minutes',
        actions: [
          { id: 'airway-tx-1-1', text: 'Perform airway assessment and assign Plan A/B/C', priority: 'immediate' },
          { id: 'airway-tx-1-2', text: 'Preoxygenate with NRB + nasal cannula or NIV in severe hypoxemia', priority: 'immediate' },
          { id: 'airway-tx-1-3', text: 'Prepare vasopressor push-dose or infusion for high-risk hypotension', priority: 'urgent' },
        ],
      },
      {
        id: 'airway-tx-2',
        phase: 'Peri-intubation',
        title: 'RSI and Confirmation',
        timing: 'Procedure time',
        actions: [
          { id: 'airway-tx-2-1', text: 'Administer induction and paralytic per hemodynamic profile', priority: 'immediate' },
          { id: 'airway-tx-2-2', text: 'Confirm tube with waveform capnography and bilateral chest rise', priority: 'immediate' },
          { id: 'airway-tx-2-3', text: 'Set post-intubation sedation and lung-protective ventilator settings', priority: 'urgent' },
        ],
      },
    ],
    pitfalls: [
      {
        id: 'airway-pit-1',
        title: 'No post-intubation sedation plan',
        description: 'Securing the tube but delaying analgesia/sedation orders.',
        consequence: 'Severe agitation, ventilator dyssynchrony, and self-extubation risk.',
        prevention: 'Prepare post-intubation analgesia and sedation infusions before laryngoscopy begins.',
        severity: 'major',
      },
    ],
  },

  // ============================================
  // CARDIOLOGY - ACUTE HEART FAILURE
  // ============================================
  'heart-failure': {
    keyPearls: [
      {
        id: 'hf-pearl-1',
        text: 'Phenotype first: warm/wet (hypertensive pulmonary edema) is managed differently from cold/wet (low-output cardiogenic shock).',
        importance: 'critical',
        category: 'Hemodynamic Classification',
      },
      {
        id: 'hf-pearl-2',
        text: 'Positive-pressure ventilation (NIV/CPAP) rapidly improves preload/afterload and oxygenation in acute cardiogenic pulmonary edema.',
        importance: 'high',
        category: 'Respiratory Support',
      },
      {
        id: 'hf-pearl-3',
        text: 'Early bedside echo and lung ultrasound outperform static exam alone for identifying congestion and low-output states.',
        importance: 'high',
        category: 'Diagnostics',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'hf-dx-1',
        title: 'High-Risk Acute Decompensated Heart Failure Features',
        criteria: [
          { id: 'hf-dx-1-1', text: 'Severe dyspnea or hypoxemia with pulmonary edema', required: true },
          { id: 'hf-dx-1-2', text: 'Objective congestion (B-lines, elevated JVP, edema, pleural effusions)', required: true },
          { id: 'hf-dx-1-3', text: 'Evidence of end-organ hypoperfusion in cold phenotype', value: 'lactate/AKI/AMS' },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'hf-tx-1',
        phase: 'Immediate Stabilization',
        title: 'Oxygenation and Afterload Reduction',
        timing: '0-60 minutes',
        actions: [
          { id: 'hf-tx-1-1', text: 'Start NIV for moderate-severe respiratory distress', priority: 'immediate' },
          { id: 'hf-tx-1-2', text: 'Use IV nitrates in hypertensive pulmonary edema', priority: 'immediate', details: 'Titrate to symptom relief and BP response.' },
          { id: 'hf-tx-1-3', text: 'Administer IV loop diuretic early when volume overload present', priority: 'urgent' },
        ],
      },
      {
        id: 'hf-tx-2',
        phase: 'Escalation',
        title: 'Low-Output/Cardiogenic Shock Pathway',
        timing: '1-6 hours',
        actions: [
          { id: 'hf-tx-2-1', text: 'Initiate norepinephrine for hypotension with shock', priority: 'urgent' },
          { id: 'hf-tx-2-2', text: 'Add inotrope if persistent low cardiac output', priority: 'urgent' },
          { id: 'hf-tx-2-3', text: 'Engage advanced HF/mechanical support team early', priority: 'routine' },
        ],
      },
    ],
    pitfalls: [
      {
        id: 'hf-pit-1',
        title: 'Single-pathway treatment for all ADHF',
        description: 'Using the same strategy for hypertensive flash edema and cardiogenic shock.',
        consequence: 'Delayed hemodynamic recovery and avoidable respiratory failure.',
        prevention: 'Classify patients by congestion and perfusion before selecting therapy.',
        severity: 'major',
      },
    ],
  },

  // ============================================
  // PULMONOLOGY - SEVERE ASTHMA
  // ============================================
  asthma: {
    keyPearls: [
      {
        id: 'asthma-pearl-1',
        text: 'Failure to improve after aggressive bronchodilator and steroid therapy should trigger immediate reassessment for alternative pathology (pneumothorax, mucus plugging, anaphylaxis).',
        importance: 'critical',
        category: 'Reassessment',
      },
      {
        id: 'asthma-pearl-2',
        text: 'In severe obstructive physiology, permissive hypercapnia with low respiratory rates helps prevent dynamic hyperinflation and arrest.',
        importance: 'critical',
        category: 'Ventilator Strategy',
      },
      {
        id: 'asthma-pearl-3',
        text: 'Magnesium sulfate and early noninvasive support can reduce intubation risk in selected patients.',
        importance: 'high',
        category: 'Adjuncts',
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'asthma-tx-1',
        phase: 'Emergency Department/ICU Arrival',
        title: 'Aggressive Bronchodilation',
        timing: '0-30 minutes',
        actions: [
          { id: 'asthma-tx-1-1', text: 'Continuous or stacked nebulized albuterol + ipratropium', priority: 'immediate' },
          { id: 'asthma-tx-1-2', text: 'Give systemic corticosteroid promptly', priority: 'immediate' },
          { id: 'asthma-tx-1-3', text: 'Administer IV magnesium sulfate for severe symptoms', priority: 'urgent' },
        ],
      },
      {
        id: 'asthma-tx-2',
        phase: 'Impending Respiratory Failure',
        title: 'Pre-intubation Rescue and Vent Strategy',
        timing: '30-120 minutes',
        actions: [
          { id: 'asthma-tx-2-1', text: 'Trial NIV or HFNC when appropriate and monitored closely', priority: 'urgent' },
          { id: 'asthma-tx-2-2', text: 'Use ketamine-facilitated intubation in crashing patients when needed', priority: 'urgent' },
          { id: 'asthma-tx-2-3', text: 'After intubation set low RR/high inspiratory flow with long expiratory time', priority: 'immediate' },
        ],
      },
    ],
    differentialDiagnosis: [
      'Anaphylaxis',
      'Vocal cord dysfunction',
      'Pulmonary edema (cardiac asthma)',
      'Foreign body aspiration',
      'Pneumothorax',
    ],
  },

  // ============================================
  // INFECTIOUS DISEASE - PNEUMONIA
  // ============================================
  pneumonia: {
    keyPearls: [
      {
        id: 'pna-pearl-1',
        text: 'Empiric therapy should be immediate in severe pneumonia and narrowed quickly using microbiology and clinical trajectory.',
        importance: 'critical',
        category: 'Antimicrobial Timing',
      },
      {
        id: 'pna-pearl-2',
        text: 'Assess aspiration risk, healthcare exposures, and local resistance to decide MRSA/Pseudomonas coverage upfront.',
        importance: 'high',
        category: 'Initial Regimen Design',
      },
      {
        id: 'pna-pearl-3',
        text: 'In ventilated patients, secretion burden and ventilator synchrony are as important as antimicrobial choice.',
        importance: 'high',
        category: 'ICU Supportive Care',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'pna-dx-1',
        title: 'Severe Pneumonia Syndrome',
        criteria: [
          { id: 'pna-dx-1-1', text: 'Compatible imaging infiltrate(s)', required: true },
          { id: 'pna-dx-1-2', text: 'Clinical inflammatory/infectious syndrome', required: true },
          { id: 'pna-dx-1-3', text: 'Organ support need (vasopressors or mechanical ventilation)', value: 'ICU-level severity' },
        ],
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'pna-tx-1',
        phase: 'Initial 6 hours',
        title: 'Early Diagnostics and Antimicrobials',
        timing: '0-6 hours',
        actions: [
          { id: 'pna-tx-1-1', text: 'Draw blood cultures and respiratory sample before first dose when feasible', priority: 'urgent' },
          { id: 'pna-tx-1-2', text: 'Start broad empiric antibiotics tailored to risk profile', priority: 'immediate' },
          { id: 'pna-tx-1-3', text: 'Evaluate for parapneumonic effusion/empyema requiring drainage', priority: 'urgent' },
        ],
      },
      {
        id: 'pna-tx-2',
        phase: '48-72 hours',
        title: 'De-escalation and Duration',
        timing: '2-3 days',
        actions: [
          { id: 'pna-tx-2-1', text: 'Narrow therapy to pathogen-directed regimen', priority: 'routine' },
          { id: 'pna-tx-2-2', text: 'Stop unnecessary anti-MRSA/anti-Pseudomonal coverage if unsupported', priority: 'routine' },
          { id: 'pna-tx-2-3', text: 'Set total course based on response and source control', priority: 'routine' },
        ],
      },
    ],
    pitfalls: [
      {
        id: 'pna-pit-1',
        title: 'Prolonged broad-spectrum therapy despite negative data',
        description: 'Continuing maximal coverage despite improving status and no supporting cultures.',
        consequence: 'Drug toxicity, C. difficile risk, and antimicrobial resistance.',
        prevention: 'Perform formal antibiotic timeout at 48-72 hours with de-escalation plan.',
        severity: 'major',
      },
    ],
  },

  // ============================================
  // HEMATOLOGY - TRANSFUSION
  // ============================================
  transfusion: {
    keyPearls: [
      {
        id: 'txf-pearl-1',
        text: 'Transfuse to physiology, not a single number; active ischemia, hemorrhage, and shock justify individualized thresholds.',
        importance: 'critical',
        category: 'Thresholds',
      },
      {
        id: 'txf-pearl-2',
        text: 'In massive hemorrhage, balanced component therapy and early fibrinogen replacement reduce coagulopathic spiral.',
        importance: 'high',
        category: 'Massive Transfusion',
      },
      {
        id: 'txf-pearl-3',
        text: 'Every transfusion order should include a post-transfusion reassessment target and stop point.',
        importance: 'high',
        category: 'Stewardship',
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'txf-tx-1',
        phase: 'Non-massive bleeding/anemia',
        title: 'Targeted Component Use',
        timing: 'Per episode',
        actions: [
          { id: 'txf-tx-1-1', text: 'PRBC transfusion with restrictive strategy unless specific indication for higher goal', priority: 'urgent' },
          { id: 'txf-tx-1-2', text: 'Platelet transfusion for severe thrombocytopenia or procedure-related threshold', priority: 'urgent' },
          { id: 'txf-tx-1-3', text: 'Use FFP/PCC/cryoprecipitate according to coagulation deficits', priority: 'routine' },
        ],
      },
      {
        id: 'txf-tx-2',
        phase: 'Massive hemorrhage',
        title: 'MTP Activation',
        timing: 'Immediate',
        actions: [
          { id: 'txf-tx-2-1', text: 'Activate MTP with balanced product delivery', priority: 'immediate' },
          { id: 'txf-tx-2-2', text: 'Monitor ionized calcium, temperature, and acid-base status', priority: 'urgent' },
          { id: 'txf-tx-2-3', text: 'Reassess every cycle with labs/viscoelastic testing if available', priority: 'urgent' },
        ],
      },
    ],
    pitfalls: [
      {
        id: 'txf-pit-1',
        title: 'Unstructured transfusion without reassessment',
        description: 'Ordering repeated blood products without explicit endpoint.',
        consequence: 'Volume overload, TRALI/TACO risk, and unnecessary exposure.',
        prevention: 'Define target hemoglobin/coagulation endpoint and reassess after each unit/cycle.',
        severity: 'major',
      },
    ],
  },

  // ============================================
  // GI/HEPATOLOGY - ACUTE PANCREATITIS
  // ============================================
  pancreatitis: {
    keyPearls: [
      {
        id: 'pan-pearl-1',
        text: 'Early balanced crystalloid resuscitation is beneficial, but over-resuscitation worsens pulmonary and abdominal complications.',
        importance: 'critical',
        category: 'Fluids',
      },
      {
        id: 'pan-pearl-2',
        text: 'Enteral nutrition should begin early when tolerated; prolonged NPO status increases infectious complications.',
        importance: 'high',
        category: 'Nutrition',
      },
      {
        id: 'pan-pearl-3',
        text: 'Antibiotics are not routine for sterile necrosis; reserve for proven or strongly suspected infected necrosis/extrapancreatic infection.',
        importance: 'high',
        category: 'Antibiotic Stewardship',
      },
    ],
    diagnosticCriteria: [
      {
        id: 'pan-dx-1',
        title: 'Diagnosis of Acute Pancreatitis (2 of 3)',
        criteria: [
          { id: 'pan-dx-1-1', text: 'Typical epigastric pain radiating to back', required: true },
          { id: 'pan-dx-1-2', text: 'Lipase or amylase >3x upper limit of normal', required: true },
          { id: 'pan-dx-1-3', text: 'Characteristic imaging findings', required: true },
        ],
        notes: 'Need any two criteria for diagnosis.',
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'pan-tx-1',
        phase: 'First 24 hours',
        title: 'Supportive Foundation',
        timing: '0-24 hours',
        actions: [
          { id: 'pan-tx-1-1', text: 'Provide balanced crystalloid with frequent hemodynamic reassessment', priority: 'immediate' },
          { id: 'pan-tx-1-2', text: 'Aggressive multimodal analgesia', priority: 'urgent' },
          { id: 'pan-tx-1-3', text: 'Screen for biliary obstruction/cholangitis requiring urgent ERCP', priority: 'urgent' },
        ],
      },
      {
        id: 'pan-tx-2',
        phase: 'Ongoing ICU care',
        title: 'Complication Surveillance',
        timing: 'Daily',
        actions: [
          { id: 'pan-tx-2-1', text: 'Start enteral feeding early if no contraindication', priority: 'routine' },
          { id: 'pan-tx-2-2', text: 'Monitor for necrosis, organ failure, abdominal compartment syndrome', priority: 'urgent' },
          { id: 'pan-tx-2-3', text: 'Coordinate delayed drainage/debridement strategy when indicated', priority: 'routine' },
        ],
      },
    ],
  },

  // ============================================
  // PROCEDURES - CENTRAL LINE PLACEMENT
  // ============================================
  'central-line': {
    keyPearls: [
      {
        id: 'cl-pearl-1',
        text: 'Ultrasound guidance is standard of care for internal jugular access and should be used whenever possible for real-time cannulation.',
        importance: 'critical',
        category: 'Technique',
      },
      {
        id: 'cl-pearl-2',
        text: 'Strict sterile barrier precautions and chlorhexidine prep reduce CLABSI and should never be abbreviated for convenience.',
        importance: 'critical',
        category: 'Infection Prevention',
      },
      {
        id: 'cl-pearl-3',
        text: 'Post-procedure confirmation should verify tip position and exclude immediate complications before use in high-risk cases.',
        importance: 'high',
        category: 'Safety',
      },
    ],
    treatmentAlgorithm: [
      {
        id: 'cl-tx-1',
        phase: 'Pre-procedure',
        title: 'Planning and Preparation',
        timing: 'Before needle insertion',
        actions: [
          { id: 'cl-tx-1-1', text: 'Confirm indication/site and assess coagulopathy risks', priority: 'urgent' },
          { id: 'cl-tx-1-2', text: 'Assemble full sterile kit and ultrasound setup', priority: 'immediate' },
          { id: 'cl-tx-1-3', text: 'Place patient in optimal position and perform timeout', priority: 'immediate' },
        ],
      },
      {
        id: 'cl-tx-2',
        phase: 'Insertion and verification',
        title: 'Cannulation and Post-placement Checks',
        timing: 'Procedure + immediate post',
        actions: [
          { id: 'cl-tx-2-1', text: 'Use real-time ultrasound vessel entry and wire confirmation', priority: 'immediate' },
          { id: 'cl-tx-2-2', text: 'Secure line, apply sterile dressing, document depth/lumen function', priority: 'urgent' },
          { id: 'cl-tx-2-3', text: 'Confirm placement with ultrasound/CXR per site and institutional policy', priority: 'urgent' },
        ],
      },
    ],
    pitfalls: [
      {
        id: 'cl-pit-1',
        title: 'Line left in place without daily necessity review',
        description: 'Failure to remove central access once no longer needed.',
        consequence: 'Increased CLABSI and thrombosis risk.',
        prevention: 'Embed daily line rounds and remove unnecessary catheters promptly.',
        severity: 'major',
      },
    ],
  },

};

/**
 * Get content for a chapter by ID
 */
export function getChapterContent(chapterId: string): IBCCChapterContent | undefined {
  return CHAPTER_CONTENT[chapterId];
}

/**
 * Check if a chapter has embedded content
 */
export function hasChapterContent(chapterId: string): boolean {
  return chapterId in CHAPTER_CONTENT;
}
