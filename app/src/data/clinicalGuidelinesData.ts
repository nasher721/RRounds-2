/**
 * Clinical Guidelines Data
 * Comprehensive collection of evidence-based clinical practice guidelines
 * Sources: AHA/ACC, ESC, IDSA, ATS, SCCM, ADA, KDIGO, GINA, GOLD, and more
 */

import type {
  ClinicalGuideline,
  GuidelineOrganization,
  GUIDELINE_ORGANIZATIONS
} from '@/types/clinicalGuidelines';

// Helper to get organization by ID
const getOrg = (id: string): GuidelineOrganization => {
  const orgs: Record<string, GuidelineOrganization> = {
    'aha-acc': {
      id: 'aha-acc',
      name: 'American Heart Association / American College of Cardiology',
      abbreviation: 'AHA/ACC',
      country: 'USA',
      website: 'https://www.heart.org'
    },
    'esc': {
      id: 'esc',
      name: 'European Society of Cardiology',
      abbreviation: 'ESC',
      country: 'Europe',
      website: 'https://www.escardio.org'
    },
    'ats-idsa': {
      id: 'ats-idsa',
      name: 'American Thoracic Society / Infectious Diseases Society of America',
      abbreviation: 'ATS/IDSA',
      country: 'USA',
      website: 'https://www.thoracic.org'
    },
    'idsa': {
      id: 'idsa',
      name: 'Infectious Diseases Society of America',
      abbreviation: 'IDSA',
      country: 'USA',
      website: 'https://www.idsociety.org'
    },
    'sccm': {
      id: 'sccm',
      name: 'Society of Critical Care Medicine',
      abbreviation: 'SCCM',
      country: 'USA',
      website: 'https://www.sccm.org'
    },
    'ada': {
      id: 'ada',
      name: 'American Diabetes Association',
      abbreviation: 'ADA',
      country: 'USA',
      website: 'https://www.diabetes.org'
    },
    'aasld': {
      id: 'aasld',
      name: 'American Association for the Study of Liver Diseases',
      abbreviation: 'AASLD',
      country: 'USA',
      website: 'https://www.aasld.org'
    },
    'kdigo': {
      id: 'kdigo',
      name: 'Kidney Disease: Improving Global Outcomes',
      abbreviation: 'KDIGO',
      country: 'International',
      website: 'https://kdigo.org'
    },
    'gina': {
      id: 'gina',
      name: 'Global Initiative for Asthma',
      abbreviation: 'GINA',
      country: 'International',
      website: 'https://ginasthma.org'
    },
    'gold': {
      id: 'gold',
      name: 'Global Initiative for Chronic Obstructive Lung Disease',
      abbreviation: 'GOLD',
      country: 'International',
      website: 'https://goldcopd.org'
    },
    'aan': {
      id: 'aan',
      name: 'American Academy of Neurology',
      abbreviation: 'AAN',
      country: 'USA',
      website: 'https://www.aan.com'
    },
    'acr': {
      id: 'acr',
      name: 'American College of Rheumatology',
      abbreviation: 'ACR',
      country: 'USA',
      website: 'https://www.rheumatology.org'
    },
    'asco': {
      id: 'asco',
      name: 'American Society of Clinical Oncology',
      abbreviation: 'ASCO',
      country: 'USA',
      website: 'https://www.asco.org'
    },
    'nice': {
      id: 'nice',
      name: 'National Institute for Health and Care Excellence',
      abbreviation: 'NICE',
      country: 'UK',
      website: 'https://www.nice.org.uk'
    },
    'ash': {
      id: 'ash',
      name: 'American Society of Hematology',
      abbreviation: 'ASH',
      country: 'USA',
      website: 'https://www.hematology.org'
    },
    'acg': {
      id: 'acg',
      name: 'American College of Gastroenterology',
      abbreviation: 'ACG',
      country: 'USA',
      website: 'https://gi.org'
    }
  };
  return orgs[id] || orgs['aha-acc'];
};

export const CLINICAL_GUIDELINES: ClinicalGuideline[] = [
  // ============================================
  // CARDIOLOGY GUIDELINES
  // ============================================
  {
    id: 'acc-aha-hf-2022',
    title: 'Guideline for the Management of Heart Failure',
    shortTitle: 'Heart Failure Guidelines',
    organization: getOrg('aha-acc'),
    specialty: 'cardiology',
    condition: 'Heart Failure',
    year: 2022,
    lastUpdated: '2022-04-01',
    url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000001063',
    keywords: ['heart failure', 'HFrEF', 'HFpEF', 'HFmrEF', 'cardiomyopathy', 'ejection fraction', 'GDMT', 'diuretics', 'ACE inhibitor', 'ARB', 'ARNI', 'beta blocker', 'MRA', 'SGLT2i'],
    summary: 'Comprehensive guideline for diagnosis and management of heart failure across the spectrum of ejection fraction, emphasizing guideline-directed medical therapy (GDMT) with the four pillars of therapy.',
    keyRecommendations: [
      {
        id: 'hf-1',
        text: 'For patients with HFrEF, GDMT includes ACEi/ARB/ARNI, evidence-based beta-blocker, MRA, and SGLT2i.',
        classOfRecommendation: 'I',
        levelOfEvidence: 'A',
        category: 'Treatment'
      },
      {
        id: 'hf-2',
        text: 'SGLT2 inhibitors are recommended for patients with HFrEF regardless of diabetes status.',
        classOfRecommendation: 'I',
        levelOfEvidence: 'A',
        category: 'Treatment'
      },
      {
        id: 'hf-3',
        text: 'In patients with HFrEF who tolerate ACEi/ARB, replacement with ARNI is recommended.',
        classOfRecommendation: 'I',
        levelOfEvidence: 'A',
        category: 'Treatment'
      },
      {
        id: 'hf-4',
        text: 'ICD therapy is recommended for primary prevention of SCD in patients with LVEF <= 35% despite >= 3 months of GDMT.',
        classOfRecommendation: 'I',
        levelOfEvidence: 'A',
        category: 'Device Therapy'
      },
      {
        id: 'hf-5',
        text: 'CRT is indicated for patients with LVEF <= 35%, sinus rhythm, LBBB with QRS >= 150 ms.',
        classOfRecommendation: 'I',
        levelOfEvidence: 'A',
        category: 'Device Therapy'
      }
    ],
    diagnosticCriteria: [
      {
        id: 'hf-stage',
        category: 'HF Staging',
        criteria: [
          'Stage A: At risk for HF (HTN, DM, CAD, family history)',
          'Stage B: Pre-HF (structural heart disease, elevated biomarkers)',
          'Stage C: Symptomatic HF',
          'Stage D: Advanced HF requiring specialized interventions'
        ]
      },
      {
        id: 'hf-class',
        category: 'EF Classification',
        criteria: [
          'HFrEF: LVEF <= 40%',
          'HFmrEF: LVEF 41-49%',
          'HFpEF: LVEF >= 50%',
          'HFimpEF: Previous HFrEF with improved EF > 40%'
        ]
      }
    ],
    treatmentAlgorithm: [
      {
        id: 'hf-tx-1',
        phase: 'Foundation',
        title: 'Four Pillars of GDMT',
        recommendations: [
          'ACEi/ARB/ARNI - titrate to target doses',
          'Beta-blocker (carvedilol, metoprolol succinate, bisoprolol)',
          'MRA (spironolactone or eplerenone)',
          'SGLT2i (dapagliflozin or empagliflozin)'
        ],
        medications: [
          { name: 'Sacubitril-Valsartan', dose: '49/51 mg to 97/103 mg', route: 'PO', frequency: 'BID' },
          { name: 'Carvedilol', dose: '3.125 mg to 25 mg', route: 'PO', frequency: 'BID' },
          { name: 'Spironolactone', dose: '12.5-50 mg', route: 'PO', frequency: 'Daily' },
          { name: 'Dapagliflozin', dose: '10 mg', route: 'PO', frequency: 'Daily' }
        ]
      },
      {
        id: 'hf-tx-2',
        phase: 'Symptom Management',
        title: 'Diuretics',
        recommendations: [
          'Loop diuretics for volume overload',
          'Thiazides for diuretic resistance',
          'Adjust based on weight and symptoms'
        ]
      }
    ]
  },
  {
    id: 'acc-aha-afib-2023',
    title: 'Guideline for Diagnosis and Management of Atrial Fibrillation',
    shortTitle: 'Atrial Fibrillation Guidelines',
    organization: getOrg('aha-acc'),
    specialty: 'cardiology',
    condition: 'Atrial Fibrillation',
    year: 2023,
    lastUpdated: '2023-11-30',
    url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000001193',
    keywords: ['atrial fibrillation', 'AFib', 'AF', 'anticoagulation', 'rate control', 'rhythm control', 'ablation', 'DOAC', 'CHA2DS2-VASc', 'cardioversion', 'stroke prevention'],
    summary: 'Updated guidelines for the comprehensive management of atrial fibrillation including stroke prevention, rate and rhythm control strategies, and catheter ablation.',
    keyRecommendations: [
      {
        id: 'afib-1',
        text: 'DOACs are recommended over warfarin for stroke prevention in eligible patients with AF.',
        classOfRecommendation: 'I',
        levelOfEvidence: 'A',
        category: 'Anticoagulation'
      },
      {
        id: 'afib-2',
        text: 'Anticoagulation is recommended for CHA2DS2-VASc score >= 2 in men and >= 3 in women.',
        classOfRecommendation: 'I',
        levelOfEvidence: 'A',
        category: 'Anticoagulation'
      },
      {
        id: 'afib-3',
        text: 'Catheter ablation is recommended as first-line therapy for symptomatic paroxysmal AF in suitable candidates.',
        classOfRecommendation: 'I',
        levelOfEvidence: 'A',
        category: 'Rhythm Control'
      },
      {
        id: 'afib-4',
        text: 'Beta-blockers or nondihydropyridine calcium channel blockers are recommended for rate control.',
        classOfRecommendation: 'I',
        levelOfEvidence: 'B-R',
        category: 'Rate Control'
      }
    ],
    diagnosticCriteria: [
      {
        id: 'afib-types',
        category: 'AF Classification',
        criteria: [
          'Paroxysmal: Self-terminating within 7 days',
          'Persistent: Sustained > 7 days',
          'Long-standing persistent: Continuous > 12 months',
          'Permanent: Accepted, no rhythm control attempted'
        ]
      }
    ]
  },
  {
    id: 'acc-aha-acs-2021',
    title: 'Guideline for the Management of Patients With Acute Coronary Syndromes',
    shortTitle: 'ACS Guidelines',
    organization: getOrg('aha-acc'),
    specialty: 'cardiology',
    condition: 'Acute Coronary Syndrome',
    year: 2021,
    lastUpdated: '2021-12-01',
    url: 'https://www.ahajournals.org/doi/10.1161/CIR.0000000000001029',
    keywords: ['ACS', 'STEMI', 'NSTEMI', 'unstable angina', 'myocardial infarction', 'PCI', 'revascularization', 'antiplatelet', 'troponin', 'chest pain'],
    summary: 'Guidelines for risk stratification and management of acute coronary syndromes including STEMI and NSTEMI, with emphasis on timely revascularization and dual antiplatelet therapy.',
    keyRecommendations: [
      {
        id: 'acs-1',
        text: 'Primary PCI is recommended for STEMI patients with symptom onset within 12 hours.',
        classOfRecommendation: 'I',
        levelOfEvidence: 'A',
        category: 'Revascularization'
      },
      {
        id: 'acs-2',
        text: 'Door-to-balloon time should be <= 90 minutes for STEMI.',
        classOfRecommendation: 'I',
        levelOfEvidence: 'A',
        category: 'Time to Treatment'
      },
      {
        id: 'acs-3',
        text: 'DAPT with aspirin and a P2Y12 inhibitor is recommended for 12 months after ACS.',
        classOfRecommendation: 'I',
        levelOfEvidence: 'A',
        category: 'Antiplatelet Therapy'
      },
      {
        id: 'acs-4',
        text: 'High-intensity statin therapy should be initiated or continued.',
        classOfRecommendation: 'I',
        levelOfEvidence: 'A',
        category: 'Secondary Prevention'
      }
    ]
  },

  // ============================================
  // PULMONOLOGY GUIDELINES
  // ============================================
  {
    id: 'gina-asthma-2024',
    title: 'Global Strategy for Asthma Management and Prevention',
    shortTitle: 'GINA Asthma Guidelines',
    organization: getOrg('gina'),
    specialty: 'pulmonology',
    condition: 'Asthma',
    year: 2024,
    lastUpdated: '2024-01-01',
    url: 'https://ginasthma.org/gina-reports/',
    keywords: ['asthma', 'bronchospasm', 'wheezing', 'inhaler', 'ICS', 'LABA', 'SABA', 'controller', 'reliever', 'exacerbation', 'peak flow'],
    summary: 'International consensus guidelines for asthma diagnosis, assessment, and stepwise management with focus on inhaled corticosteroids as foundation of treatment.',
    keyRecommendations: [
      {
        id: 'gina-1',
        text: 'ICS-containing controller therapy is recommended for all patients with asthma.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Controller Therapy'
      },
      {
        id: 'gina-2',
        text: 'As-needed ICS-formoterol is the preferred reliever for mild asthma.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Reliever Therapy'
      },
      {
        id: 'gina-3',
        text: 'SABA-only treatment is no longer recommended due to increased exacerbation risk.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Reliever Therapy'
      }
    ],
    treatmentAlgorithm: [
      {
        id: 'gina-step1',
        phase: 'Step 1',
        title: 'Mild Intermittent',
        recommendations: [
          'Preferred: As-needed low-dose ICS-formoterol',
          'Alternative: As-needed SABA + ICS whenever SABA used'
        ]
      },
      {
        id: 'gina-step2',
        phase: 'Step 2',
        title: 'Mild Persistent',
        recommendations: [
          'Preferred: Low-dose ICS daily',
          'Alternative: LTRA (less effective than ICS)'
        ]
      },
      {
        id: 'gina-step3',
        phase: 'Step 3',
        title: 'Moderate',
        recommendations: [
          'Preferred: Low-dose ICS-LABA',
          'Alternative: Medium-dose ICS'
        ]
      },
      {
        id: 'gina-step4',
        phase: 'Step 4',
        title: 'Moderate-Severe',
        recommendations: [
          'Medium-dose ICS-LABA',
          'Consider add-on tiotropium, LTRA'
        ]
      },
      {
        id: 'gina-step5',
        phase: 'Step 5',
        title: 'Severe',
        recommendations: [
          'High-dose ICS-LABA',
          'Add-on biologic therapy (anti-IgE, anti-IL5, anti-IL4R)',
          'Consider low-dose OCS'
        ]
      }
    ]
  },
  {
    id: 'gold-copd-2024',
    title: 'Global Strategy for Prevention, Diagnosis and Management of COPD',
    shortTitle: 'GOLD COPD Guidelines',
    organization: getOrg('gold'),
    specialty: 'pulmonology',
    condition: 'COPD',
    year: 2024,
    lastUpdated: '2024-01-01',
    url: 'https://goldcopd.org/gold-reports/',
    keywords: ['COPD', 'chronic obstructive pulmonary disease', 'emphysema', 'chronic bronchitis', 'FEV1', 'spirometry', 'bronchodilator', 'LAMA', 'LABA', 'exacerbation', 'smoking cessation'],
    summary: 'Evidence-based guidelines for COPD prevention, diagnosis, and management using the ABE assessment tool and pharmacologic step-up approach.',
    keyRecommendations: [
      {
        id: 'gold-1',
        text: 'Smoking cessation is the most effective intervention to reduce COPD progression.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Prevention'
      },
      {
        id: 'gold-2',
        text: 'LAMA or LABA monotherapy is recommended as initial pharmacological treatment.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Initial Therapy'
      },
      {
        id: 'gold-3',
        text: 'LAMA/LABA is preferred over ICS/LABA for patients without features of asthma.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Maintenance Therapy'
      },
      {
        id: 'gold-4',
        text: 'Triple therapy (ICS/LAMA/LABA) reduces exacerbations in high-risk patients.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Escalation Therapy'
      }
    ],
    diagnosticCriteria: [
      {
        id: 'gold-spirometry',
        category: 'Spirometric Classification',
        criteria: [
          'GOLD 1 Mild: FEV1 >= 80% predicted',
          'GOLD 2 Moderate: 50% <= FEV1 < 80% predicted',
          'GOLD 3 Severe: 30% <= FEV1 < 50% predicted',
          'GOLD 4 Very Severe: FEV1 < 30% predicted'
        ],
        notes: 'Post-bronchodilator FEV1/FVC < 0.70 required for diagnosis'
      }
    ]
  },
  {
    id: 'ats-idsa-cap-2019',
    title: 'Diagnosis and Treatment of Adults with Community-acquired Pneumonia',
    shortTitle: 'CAP Guidelines',
    organization: getOrg('ats-idsa'),
    specialty: 'pulmonology',
    condition: 'Community-Acquired Pneumonia',
    year: 2019,
    lastUpdated: '2019-10-01',
    url: 'https://www.atsjournals.org/doi/10.1164/rccm.201908-1581ST',
    keywords: ['pneumonia', 'CAP', 'respiratory infection', 'antibiotics', 'procalcitonin', 'CURB-65', 'PSI', 'fluoroquinolone', 'beta-lactam', 'macrolide'],
    summary: 'Evidence-based recommendations for diagnostic testing and empiric antibiotic therapy for community-acquired pneumonia in immunocompetent adults.',
    keyRecommendations: [
      {
        id: 'cap-1',
        text: 'Empiric therapy should cover S. pneumoniae and atypical pathogens.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Treatment'
      },
      {
        id: 'cap-2',
        text: 'For outpatients without comorbidities: amoxicillin or doxycycline or macrolide.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'Moderate',
        category: 'Outpatient Treatment'
      },
      {
        id: 'cap-3',
        text: 'For inpatients non-severe: beta-lactam + macrolide OR respiratory fluoroquinolone.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Inpatient Treatment'
      },
      {
        id: 'cap-4',
        text: 'Duration of antibiotic therapy should be 5 days minimum, guided by clinical stability.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'Moderate',
        category: 'Duration'
      }
    ],
    treatmentAlgorithm: [
      {
        id: 'cap-outpt',
        phase: 'Outpatient',
        title: 'No Comorbidities',
        recommendations: [
          'Amoxicillin 1g TID',
          'Doxycycline 100mg BID',
          'Azithromycin (if local resistance <25%)'
        ]
      },
      {
        id: 'cap-outpt-comorbid',
        phase: 'Outpatient',
        title: 'With Comorbidities',
        recommendations: [
          'Amoxicillin-clavulanate + macrolide',
          'Cephalosporin + macrolide',
          'Respiratory fluoroquinolone monotherapy'
        ]
      },
      {
        id: 'cap-inpt',
        phase: 'Inpatient Non-ICU',
        title: 'Standard Treatment',
        recommendations: [
          'Beta-lactam + macrolide',
          'Respiratory fluoroquinolone monotherapy'
        ],
        medications: [
          { name: 'Ceftriaxone', dose: '1-2g', route: 'IV', frequency: 'Daily' },
          { name: 'Azithromycin', dose: '500mg', route: 'IV/PO', frequency: 'Daily' },
          { name: 'Levofloxacin', dose: '750mg', route: 'IV/PO', frequency: 'Daily' }
        ]
      },
      {
        id: 'cap-icu',
        phase: 'ICU',
        title: 'Severe Pneumonia',
        recommendations: [
          'Beta-lactam + macrolide',
          'Beta-lactam + respiratory fluoroquinolone',
          'Add vancomycin if MRSA risk factors'
        ]
      }
    ]
  },

  // ============================================
  // INFECTIOUS DISEASE GUIDELINES
  // ============================================
  {
    id: 'sccm-sepsis-2021',
    title: 'Surviving Sepsis Campaign: International Guidelines for Management of Sepsis and Septic Shock',
    shortTitle: 'Surviving Sepsis Guidelines',
    organization: getOrg('sccm'),
    specialty: 'critical-care',
    condition: 'Sepsis',
    year: 2021,
    lastUpdated: '2021-10-01',
    url: 'https://journals.lww.com/ccmjournal/Fulltext/2021/11000/Surviving_Sepsis_Campaign__International.21.aspx',
    keywords: ['sepsis', 'septic shock', 'SIRS', 'qSOFA', 'lactate', 'vasopressor', 'norepinephrine', 'fluid resuscitation', 'antibiotics', 'source control'],
    summary: 'International consensus guidelines for early recognition and management of sepsis and septic shock, emphasizing the 1-hour bundle and early goal-directed therapy.',
    keyRecommendations: [
      {
        id: 'sepsis-1',
        text: 'Administer antibiotics within 1 hour of sepsis recognition.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'Moderate',
        category: 'Antibiotics'
      },
      {
        id: 'sepsis-2',
        text: 'Administer 30 mL/kg crystalloid within 3 hours for sepsis-induced hypoperfusion.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'Low',
        category: 'Fluid Resuscitation'
      },
      {
        id: 'sepsis-3',
        text: 'Norepinephrine is the first-line vasopressor for septic shock.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Vasopressors'
      },
      {
        id: 'sepsis-4',
        text: 'Target MAP >= 65 mmHg in patients requiring vasopressors.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'Moderate',
        category: 'Hemodynamic Goals'
      },
      {
        id: 'sepsis-5',
        text: 'Use lactate to guide resuscitation; aim for normalization.',
        classOfRecommendation: 'B',
        levelOfEvidence: 'Low',
        category: 'Monitoring'
      },
      {
        id: 'sepsis-6',
        text: 'Add vasopressin as second-line agent when norepinephrine is inadequate.',
        classOfRecommendation: 'B',
        levelOfEvidence: 'Moderate',
        category: 'Vasopressors'
      }
    ],
    treatmentAlgorithm: [
      {
        id: 'sepsis-hour1',
        phase: 'Hour 1 Bundle',
        title: 'Immediate Actions',
        recommendations: [
          'Measure lactate level',
          'Obtain blood cultures before antibiotics',
          'Administer broad-spectrum antibiotics',
          'Begin fluid resuscitation (30 mL/kg crystalloid)',
          'Start vasopressors if hypotensive during/after fluid resuscitation'
        ],
        timing: 'Within 1 hour of recognition'
      },
      {
        id: 'sepsis-ongoing',
        phase: 'Ongoing Management',
        title: '3-6 Hour Reassessment',
        recommendations: [
          'Reassess volume status',
          'Repeat lactate if initially elevated',
          'Adjust antibiotics based on cultures',
          'Identify and control source of infection'
        ]
      }
    ]
  },
  {
    id: 'idsa-uti-2019',
    title: 'Clinical Practice Guideline for the Management of Asymptomatic Bacteriuria',
    shortTitle: 'UTI Guidelines',
    organization: getOrg('idsa'),
    specialty: 'infectious-disease',
    condition: 'Urinary Tract Infection',
    year: 2019,
    lastUpdated: '2019-03-21',
    url: 'https://academic.oup.com/cid/article/68/10/e83/5407612',
    keywords: ['UTI', 'urinary tract infection', 'cystitis', 'pyelonephritis', 'bacteriuria', 'pyuria', 'antibiotics', 'nitrofurantoin', 'TMP-SMX', 'fluoroquinolone'],
    summary: 'Evidence-based guidelines for the diagnosis and treatment of urinary tract infections, including cystitis and pyelonephritis.',
    keyRecommendations: [
      {
        id: 'uti-1',
        text: 'Screen and treat asymptomatic bacteriuria only in pregnancy and before urologic procedures.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Screening'
      },
      {
        id: 'uti-2',
        text: 'Nitrofurantoin, TMP-SMX, or fosfomycin are first-line for uncomplicated cystitis.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Treatment'
      },
      {
        id: 'uti-3',
        text: 'Fluoroquinolones should be reserved for complicated UTI or pyelonephritis.',
        classOfRecommendation: 'B',
        levelOfEvidence: 'Moderate',
        category: 'Treatment'
      }
    ],
    treatmentAlgorithm: [
      {
        id: 'uti-uncomplicated',
        phase: 'Uncomplicated Cystitis',
        title: 'First-Line Options',
        recommendations: [
          'Nitrofurantoin 100mg BID x 5 days',
          'TMP-SMX DS BID x 3 days (if resistance <20%)',
          'Fosfomycin 3g single dose'
        ],
        medications: [
          { name: 'Nitrofurantoin', dose: '100mg', route: 'PO', frequency: 'BID', duration: '5 days' },
          { name: 'TMP-SMX', dose: '160/800mg', route: 'PO', frequency: 'BID', duration: '3 days' }
        ]
      },
      {
        id: 'uti-pyelo',
        phase: 'Pyelonephritis',
        title: 'Outpatient Treatment',
        recommendations: [
          'Ciprofloxacin 500mg BID x 7 days',
          'Levofloxacin 750mg daily x 5 days',
          'TMP-SMX DS BID x 14 days'
        ]
      }
    ]
  },
  {
    id: 'idsa-cdiff-2021',
    title: 'Clinical Practice Guidelines for Clostridioides difficile Infection',
    shortTitle: 'C. diff Guidelines',
    organization: getOrg('idsa'),
    specialty: 'infectious-disease',
    condition: 'Clostridioides difficile Infection',
    year: 2021,
    lastUpdated: '2021-06-24',
    url: 'https://academic.oup.com/cid/article/73/5/e1029/6298219',
    keywords: ['C. diff', 'CDI', 'Clostridioides difficile', 'colitis', 'pseudomembranous colitis', 'vancomycin', 'fidaxomicin', 'FMT', 'fecal transplant', 'diarrhea'],
    summary: 'Updated guidelines for diagnosis and management of C. difficile infection, emphasizing oral vancomycin and fidaxomicin over metronidazole.',
    keyRecommendations: [
      {
        id: 'cdiff-1',
        text: 'Oral vancomycin or fidaxomicin (not metronidazole) is recommended for initial CDI episode.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Treatment'
      },
      {
        id: 'cdiff-2',
        text: 'Fidaxomicin is preferred over vancomycin for initial episode due to lower recurrence.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Treatment'
      },
      {
        id: 'cdiff-3',
        text: 'FMT is recommended for patients with multiple CDI recurrences.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Recurrent CDI'
      },
      {
        id: 'cdiff-4',
        text: 'Bezlotoxumab is recommended to prevent recurrence in high-risk patients.',
        classOfRecommendation: 'B',
        levelOfEvidence: 'Moderate',
        category: 'Prevention'
      }
    ],
    treatmentAlgorithm: [
      {
        id: 'cdiff-initial',
        phase: 'Initial Episode',
        title: 'Non-Severe',
        recommendations: [
          'Fidaxomicin 200mg BID x 10 days (preferred)',
          'Vancomycin 125mg QID x 10 days'
        ],
        medications: [
          { name: 'Fidaxomicin', dose: '200mg', route: 'PO', frequency: 'BID', duration: '10 days' },
          { name: 'Vancomycin', dose: '125mg', route: 'PO', frequency: 'QID', duration: '10 days' }
        ]
      },
      {
        id: 'cdiff-severe',
        phase: 'Severe CDI',
        title: 'WBC >15k or Cr >1.5x baseline',
        recommendations: [
          'Vancomycin 125mg QID x 10 days',
          'Fidaxomicin 200mg BID x 10 days'
        ]
      },
      {
        id: 'cdiff-fulminant',
        phase: 'Fulminant CDI',
        title: 'Hypotension, ileus, megacolon',
        recommendations: [
          'Vancomycin 500mg QID PO/NG + rectal instillation',
          'IV metronidazole 500mg TID',
          'Surgical consultation'
        ]
      }
    ]
  },

  // ============================================
  // ENDOCRINOLOGY GUIDELINES
  // ============================================
  {
    id: 'ada-diabetes-2024',
    title: 'Standards of Care in Diabetes',
    shortTitle: 'ADA Diabetes Standards',
    organization: getOrg('ada'),
    specialty: 'endocrinology',
    condition: 'Diabetes Mellitus',
    year: 2024,
    lastUpdated: '2024-01-01',
    url: 'https://diabetesjournals.org/care/issue/47/Supplement_1',
    keywords: ['diabetes', 'type 2 diabetes', 'type 1 diabetes', 'HbA1c', 'glucose', 'metformin', 'SGLT2i', 'GLP-1', 'insulin', 'hypoglycemia'],
    summary: 'Comprehensive standards for diabetes prevention, diagnosis, and management including glycemic targets, pharmacotherapy, and cardiovascular risk reduction.',
    keyRecommendations: [
      {
        id: 'dm-1',
        text: 'Metformin remains first-line pharmacotherapy for type 2 diabetes.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Treatment'
      },
      {
        id: 'dm-2',
        text: 'For patients with ASCVD, heart failure, or CKD, SGLT2i or GLP-1 RA with proven benefit should be used.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Cardiorenal Protection'
      },
      {
        id: 'dm-3',
        text: 'A1C target of <7% is appropriate for most non-pregnant adults.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Glycemic Targets'
      },
      {
        id: 'dm-4',
        text: 'Individualize A1C target based on hypoglycemia risk, life expectancy, and patient preference.',
        classOfRecommendation: 'B',
        levelOfEvidence: 'Moderate',
        category: 'Glycemic Targets'
      }
    ],
    diagnosticCriteria: [
      {
        id: 'dm-diagnosis',
        category: 'Diagnostic Criteria',
        criteria: [
          'Fasting plasma glucose >= 126 mg/dL',
          '2-hour OGTT >= 200 mg/dL',
          'HbA1c >= 6.5%',
          'Random glucose >= 200 mg/dL with symptoms'
        ],
        notes: 'Two abnormal tests required for diagnosis (unless unequivocal hyperglycemia)'
      },
      {
        id: 'dm-prediabetes',
        category: 'Prediabetes',
        criteria: [
          'Fasting plasma glucose 100-125 mg/dL (IFG)',
          '2-hour OGTT 140-199 mg/dL (IGT)',
          'HbA1c 5.7-6.4%'
        ]
      }
    ]
  },
  {
    id: 'ada-dka-hhs-2024',
    title: 'Hyperglycemic Crises in Diabetes',
    shortTitle: 'DKA/HHS Guidelines',
    organization: getOrg('ada'),
    specialty: 'endocrinology',
    condition: 'Diabetic Ketoacidosis',
    year: 2024,
    lastUpdated: '2024-01-01',
    url: 'https://diabetesjournals.org/care/article/47/Supplement_1/S181/153948',
    keywords: ['DKA', 'diabetic ketoacidosis', 'HHS', 'hyperosmolar', 'insulin drip', 'anion gap', 'ketones', 'bicarbonate', 'potassium'],
    summary: 'Guidelines for recognition and management of diabetic ketoacidosis and hyperosmolar hyperglycemic state.',
    keyRecommendations: [
      {
        id: 'dka-1',
        text: 'Initial fluid resuscitation with isotonic saline at 15-20 mL/kg/hr for the first hour.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Fluid Resuscitation'
      },
      {
        id: 'dka-2',
        text: 'Start insulin infusion at 0.1 units/kg/hr after potassium is >= 3.3 mEq/L.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Insulin Therapy'
      },
      {
        id: 'dka-3',
        text: 'Add dextrose to IV fluids when glucose reaches 200-250 mg/dL.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'Moderate',
        category: 'Glucose Management'
      },
      {
        id: 'dka-4',
        text: 'Replace potassium to maintain K+ between 4-5 mEq/L.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Electrolytes'
      }
    ],
    diagnosticCriteria: [
      {
        id: 'dka-criteria',
        category: 'DKA Diagnostic Criteria',
        criteria: [
          'Blood glucose > 250 mg/dL',
          'Arterial pH < 7.30',
          'Serum bicarbonate < 18 mEq/L',
          'Anion gap > 10 mEq/L',
          'Positive serum/urine ketones'
        ]
      },
      {
        id: 'dka-severity',
        category: 'DKA Severity',
        criteria: [
          'Mild: pH 7.25-7.30, HCO3 15-18, alert',
          'Moderate: pH 7.00-7.24, HCO3 10-15, drowsy',
          'Severe: pH <7.00, HCO3 <10, stupor/coma'
        ]
      }
    ]
  },

  // ============================================
  // NEPHROLOGY GUIDELINES
  // ============================================
  {
    id: 'kdigo-aki-2024',
    title: 'Clinical Practice Guideline for Acute Kidney Injury',
    shortTitle: 'KDIGO AKI Guidelines',
    organization: getOrg('kdigo'),
    specialty: 'nephrology',
    condition: 'Acute Kidney Injury',
    year: 2024,
    lastUpdated: '2024-01-01',
    url: 'https://kdigo.org/guidelines/acute-kidney-injury/',
    keywords: ['AKI', 'acute kidney injury', 'creatinine', 'oliguria', 'dialysis', 'CRRT', 'nephrotoxins', 'contrast nephropathy', 'renal replacement therapy'],
    summary: 'Evidence-based guidelines for prevention, diagnosis, and management of acute kidney injury.',
    keyRecommendations: [
      {
        id: 'aki-1',
        text: 'Use KDIGO staging criteria for AKI diagnosis and severity assessment.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Diagnosis'
      },
      {
        id: 'aki-2',
        text: 'Avoid nephrotoxic agents when possible in patients at risk for AKI.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'Moderate',
        category: 'Prevention'
      },
      {
        id: 'aki-3',
        text: 'Do not use diuretics to prevent AKI.',
        classOfRecommendation: 'D',
        levelOfEvidence: 'Moderate',
        category: 'Prevention'
      },
      {
        id: 'aki-4',
        text: 'Initiate RRT emergently for life-threatening indications.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'Low',
        category: 'Renal Replacement Therapy'
      }
    ],
    diagnosticCriteria: [
      {
        id: 'aki-staging',
        category: 'KDIGO AKI Staging',
        criteria: [
          'Stage 1: Cr increase >= 0.3 mg/dL within 48h OR >= 1.5-1.9x baseline OR UOP < 0.5 mL/kg/h for 6-12h',
          'Stage 2: Cr 2.0-2.9x baseline OR UOP < 0.5 mL/kg/h for >= 12h',
          'Stage 3: Cr >= 3x baseline OR >= 4.0 mg/dL OR initiation of RRT OR UOP < 0.3 mL/kg/h for >= 24h OR anuria >= 12h'
        ]
      }
    ]
  },
  {
    id: 'kdigo-ckd-2024',
    title: 'Clinical Practice Guideline for Chronic Kidney Disease',
    shortTitle: 'KDIGO CKD Guidelines',
    organization: getOrg('kdigo'),
    specialty: 'nephrology',
    condition: 'Chronic Kidney Disease',
    year: 2024,
    lastUpdated: '2024-01-01',
    url: 'https://kdigo.org/guidelines/ckd-evaluation-and-management/',
    keywords: ['CKD', 'chronic kidney disease', 'GFR', 'eGFR', 'albuminuria', 'proteinuria', 'ACEi', 'ARB', 'SGLT2i', 'dialysis preparation'],
    summary: 'Comprehensive guidelines for evaluation, classification, and management of chronic kidney disease.',
    keyRecommendations: [
      {
        id: 'ckd-1',
        text: 'Use eGFR and albuminuria to classify CKD stage and predict prognosis.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Classification'
      },
      {
        id: 'ckd-2',
        text: 'ACEi or ARB is recommended for patients with diabetes, hypertension, and albuminuria.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Treatment'
      },
      {
        id: 'ckd-3',
        text: 'SGLT2 inhibitors are recommended for patients with CKD and eGFR >= 20 to reduce progression.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Treatment'
      },
      {
        id: 'ckd-4',
        text: 'Target blood pressure < 120 mmHg systolic when tolerated.',
        classOfRecommendation: 'B',
        levelOfEvidence: 'Moderate',
        category: 'Blood Pressure'
      }
    ],
    diagnosticCriteria: [
      {
        id: 'ckd-staging',
        category: 'CKD GFR Categories',
        criteria: [
          'G1: GFR >= 90 (Normal or high)',
          'G2: GFR 60-89 (Mildly decreased)',
          'G3a: GFR 45-59 (Mild-moderately decreased)',
          'G3b: GFR 30-44 (Moderately-severely decreased)',
          'G4: GFR 15-29 (Severely decreased)',
          'G5: GFR < 15 (Kidney failure)'
        ]
      }
    ]
  },

  // ============================================
  // NEUROLOGY GUIDELINES
  // ============================================
  {
    id: 'aha-asa-stroke-2019',
    title: 'Guidelines for the Early Management of Patients With Acute Ischemic Stroke',
    shortTitle: 'Acute Ischemic Stroke Guidelines',
    organization: getOrg('aha-acc'),
    specialty: 'neurology',
    condition: 'Acute Ischemic Stroke',
    year: 2019,
    lastUpdated: '2019-01-24',
    url: 'https://www.ahajournals.org/doi/10.1161/STR.0000000000000211',
    keywords: ['stroke', 'ischemic stroke', 'tPA', 'alteplase', 'tenecteplase', 'thrombectomy', 'NIHSS', 'door-to-needle', 'CT perfusion', 'penumbra'],
    summary: 'Guidelines for rapid diagnosis and treatment of acute ischemic stroke including IV thrombolysis and mechanical thrombectomy.',
    keyRecommendations: [
      {
        id: 'stroke-1',
        text: 'IV alteplase is recommended within 4.5 hours of symptom onset for eligible patients.',
        classOfRecommendation: 'I',
        levelOfEvidence: 'A',
        category: 'Thrombolysis'
      },
      {
        id: 'stroke-2',
        text: 'Door-to-needle time should be <= 60 minutes.',
        classOfRecommendation: 'I',
        levelOfEvidence: 'A',
        category: 'Time Targets'
      },
      {
        id: 'stroke-3',
        text: 'Mechanical thrombectomy is recommended for LVO within 24 hours with favorable imaging.',
        classOfRecommendation: 'I',
        levelOfEvidence: 'A',
        category: 'Thrombectomy'
      },
      {
        id: 'stroke-4',
        text: 'BP should be maintained < 185/110 before tPA and < 180/105 for 24 hours after.',
        classOfRecommendation: 'I',
        levelOfEvidence: 'B-NR',
        category: 'Blood Pressure'
      }
    ],
    treatmentAlgorithm: [
      {
        id: 'stroke-acute',
        phase: '0-4.5 Hours',
        title: 'IV Thrombolysis',
        recommendations: [
          'CT head to rule out hemorrhage',
          'Assess for tPA eligibility',
          'Alteplase 0.9 mg/kg (max 90 mg) - 10% bolus, 90% over 60 min',
          'Tenecteplase may be used as alternative'
        ],
        timing: 'Door-to-needle <= 60 minutes'
      },
      {
        id: 'stroke-thrombectomy',
        phase: '0-24 Hours',
        title: 'Mechanical Thrombectomy',
        recommendations: [
          'CTA/MRA to identify LVO',
          'CT perfusion or DWI-MRI for extended window',
          'Direct aspiration or stent retriever',
          'Can be performed with or after IV tPA'
        ]
      }
    ]
  },
  {
    id: 'aan-status-epilepticus-2016',
    title: 'Treatment of Convulsive Status Epilepticus',
    shortTitle: 'Status Epilepticus Guidelines',
    organization: getOrg('aan'),
    specialty: 'neurology',
    condition: 'Status Epilepticus',
    year: 2016,
    lastUpdated: '2016-05-10',
    url: 'https://www.aan.com/Guidelines/home/GuidelineDetail/769',
    keywords: ['status epilepticus', 'seizure', 'convulsion', 'benzodiazepine', 'lorazepam', 'midazolam', 'levetiracetam', 'fosphenytoin', 'refractory'],
    summary: 'Evidence-based guidelines for initial and refractory treatment of convulsive status epilepticus.',
    keyRecommendations: [
      {
        id: 'se-1',
        text: 'IV lorazepam or IM midazolam is first-line treatment for convulsive status epilepticus.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'First-Line'
      },
      {
        id: 'se-2',
        text: 'IV fosphenytoin, valproate, or levetiracetam should be used if benzodiazepines fail.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'Moderate',
        category: 'Second-Line'
      },
      {
        id: 'se-3',
        text: 'For refractory status, continuous IV anesthetics (midazolam, propofol, pentobarbital) are indicated.',
        classOfRecommendation: 'B',
        levelOfEvidence: 'Low',
        category: 'Refractory'
      }
    ],
    treatmentAlgorithm: [
      {
        id: 'se-t1',
        phase: '0-5 Minutes',
        title: 'Stabilization',
        recommendations: [
          'ABCs - airway, breathing, circulation',
          'Obtain IV access',
          'Check glucose, give if hypoglycemic',
          'Thiamine if concern for alcohol use'
        ]
      },
      {
        id: 'se-t2',
        phase: '5-20 Minutes',
        title: 'First-Line Therapy',
        recommendations: [
          'IV Lorazepam 0.1 mg/kg (max 4 mg), repeat x1',
          'OR IM Midazolam 10 mg (>40 kg) or 5 mg (<40 kg)',
          'OR IV Diazepam 0.15 mg/kg (max 10 mg)'
        ],
        medications: [
          { name: 'Lorazepam', dose: '0.1 mg/kg', route: 'IV', notes: 'Max 4 mg/dose, may repeat' },
          { name: 'Midazolam', dose: '10 mg', route: 'IM', notes: 'If no IV access' }
        ]
      },
      {
        id: 'se-t3',
        phase: '20-40 Minutes',
        title: 'Second-Line Therapy',
        recommendations: [
          'Fosphenytoin 20 mg PE/kg IV',
          'OR Valproate 40 mg/kg IV',
          'OR Levetiracetam 60 mg/kg IV (max 4500 mg)'
        ]
      },
      {
        id: 'se-t4',
        phase: '>40 Minutes',
        title: 'Refractory Status',
        recommendations: [
          'Intubation for airway protection',
          'Continuous IV midazolam, propofol, or pentobarbital',
          'EEG monitoring for burst suppression'
        ]
      }
    ]
  },

  // ============================================
  // GASTROENTEROLOGY GUIDELINES
  // ============================================
  {
    id: 'acg-gi-bleeding-2021',
    title: 'Management of Patients With Acute Lower Gastrointestinal Bleeding',
    shortTitle: 'GI Bleeding Guidelines',
    organization: getOrg('acg'),
    specialty: 'gastroenterology',
    condition: 'GI Bleeding',
    year: 2021,
    lastUpdated: '2021-02-01',
    url: 'https://journals.lww.com/ajg/fulltext/2021/04000/acg_clinical_guideline__management_of_patients.14.aspx',
    keywords: ['GI bleeding', 'upper GI bleed', 'lower GI bleed', 'melena', 'hematochezia', 'hematemesis', 'endoscopy', 'PPI', 'transfusion', 'variceal bleeding'],
    summary: 'Evidence-based guidelines for risk stratification and management of acute gastrointestinal bleeding.',
    keyRecommendations: [
      {
        id: 'gib-1',
        text: 'Restrictive transfusion strategy (Hgb threshold 7 g/dL) is recommended for most patients.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Transfusion'
      },
      {
        id: 'gib-2',
        text: 'IV PPI therapy is recommended before endoscopy for upper GI bleeding.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'Moderate',
        category: 'Pre-endoscopy'
      },
      {
        id: 'gib-3',
        text: 'Endoscopy should be performed within 24 hours of presentation for UGIB.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Timing'
      },
      {
        id: 'gib-4',
        text: 'For variceal bleeding, octreotide and antibiotic prophylaxis are recommended.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Variceal Bleeding'
      }
    ]
  },
  {
    id: 'aasld-cirrhosis-2021',
    title: 'Practice Guidance on the Diagnosis and Management of Hepatic Encephalopathy',
    shortTitle: 'Hepatic Encephalopathy Guidelines',
    organization: getOrg('aasld'),
    specialty: 'gastroenterology',
    condition: 'Hepatic Encephalopathy',
    year: 2021,
    lastUpdated: '2021-08-01',
    url: 'https://www.aasld.org/practice-guidelines',
    keywords: ['hepatic encephalopathy', 'cirrhosis', 'ammonia', 'lactulose', 'rifaximin', 'asterixis', 'confusion', 'liver failure', 'portosystemic shunt'],
    summary: 'Guidance for diagnosis and management of hepatic encephalopathy in patients with chronic liver disease.',
    keyRecommendations: [
      {
        id: 'he-1',
        text: 'Lactulose is first-line treatment for overt hepatic encephalopathy.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Treatment'
      },
      {
        id: 'he-2',
        text: 'Rifaximin is recommended as add-on therapy for recurrent HE.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Secondary Prophylaxis'
      },
      {
        id: 'he-3',
        text: 'Identify and treat precipitating factors (infection, GI bleeding, electrolyte disturbances).',
        classOfRecommendation: 'A',
        levelOfEvidence: 'Moderate',
        category: 'Evaluation'
      }
    ],
    treatmentAlgorithm: [
      {
        id: 'he-acute',
        phase: 'Acute Episode',
        title: 'Initial Management',
        recommendations: [
          'Identify and treat precipitants',
          'Lactulose 25 mL PO q1-2h until bowel movement, then titrate to 2-3 BM/day',
          'Consider rectal lactulose if unable to take PO'
        ],
        medications: [
          { name: 'Lactulose', dose: '25-30 mL', route: 'PO', frequency: 'TID-QID', notes: 'Titrate to 2-3 BM/day' }
        ]
      },
      {
        id: 'he-secondary',
        phase: 'Secondary Prophylaxis',
        title: 'Prevention of Recurrence',
        recommendations: [
          'Continue lactulose',
          'Add rifaximin 550 mg BID',
          'Maintain adequate nutrition'
        ],
        medications: [
          { name: 'Rifaximin', dose: '550 mg', route: 'PO', frequency: 'BID' }
        ]
      }
    ]
  },

  // ============================================
  // HEMATOLOGY GUIDELINES
  // ============================================
  {
    id: 'ash-vte-2020',
    title: 'Guidelines for Management of Venous Thromboembolism',
    shortTitle: 'VTE Guidelines',
    organization: getOrg('ash'),
    specialty: 'hematology',
    condition: 'Venous Thromboembolism',
    year: 2020,
    lastUpdated: '2020-11-01',
    url: 'https://ashpublications.org/bloodadvances/collection/34/ASH-Guidelines-on-Venous-Thromboembolism',
    keywords: ['VTE', 'DVT', 'PE', 'pulmonary embolism', 'deep vein thrombosis', 'anticoagulation', 'DOAC', 'warfarin', 'heparin', 'thrombolysis'],
    summary: 'Comprehensive guidelines for prevention and treatment of venous thromboembolism including DVT and pulmonary embolism.',
    keyRecommendations: [
      {
        id: 'vte-1',
        text: 'DOACs are preferred over warfarin for most patients with VTE.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Treatment'
      },
      {
        id: 'vte-2',
        text: 'Treatment duration is at least 3 months for provoked VTE.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Duration'
      },
      {
        id: 'vte-3',
        text: 'Extended anticoagulation is recommended for unprovoked VTE with low bleeding risk.',
        classOfRecommendation: 'B',
        levelOfEvidence: 'Moderate',
        category: 'Duration'
      },
      {
        id: 'vte-4',
        text: 'Systemic thrombolysis is suggested for PE with hemodynamic instability.',
        classOfRecommendation: 'B',
        levelOfEvidence: 'Low',
        category: 'Massive PE'
      }
    ]
  },
  {
    id: 'ash-anticoagulation-reversal-2018',
    title: 'Guidelines for Optimal Management of Anticoagulation Reversal',
    shortTitle: 'Anticoagulation Reversal Guidelines',
    organization: getOrg('ash'),
    specialty: 'hematology',
    condition: 'Anticoagulation Reversal',
    year: 2018,
    lastUpdated: '2018-10-01',
    url: 'https://ashpublications.org/bloodadvances/article/2/22/3257/16234',
    keywords: ['anticoagulation reversal', 'warfarin', 'DOAC reversal', 'vitamin K', 'PCC', 'idarucizumab', 'andexanet alfa', 'bleeding', 'INR'],
    summary: 'Evidence-based recommendations for reversal of anticoagulation in bleeding or urgent surgery.',
    keyRecommendations: [
      {
        id: 'rev-1',
        text: 'For life-threatening warfarin-associated bleeding, 4-factor PCC is preferred over FFP.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'Moderate',
        category: 'Warfarin'
      },
      {
        id: 'rev-2',
        text: 'Idarucizumab is recommended for dabigatran reversal in life-threatening bleeding.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'Moderate',
        category: 'DOAC Reversal'
      },
      {
        id: 'rev-3',
        text: 'Andexanet alfa may be used for factor Xa inhibitor reversal.',
        classOfRecommendation: 'B',
        levelOfEvidence: 'Low',
        category: 'DOAC Reversal'
      }
    ]
  },

  // ============================================
  // RHEUMATOLOGY GUIDELINES
  // ============================================
  {
    id: 'acr-gout-2020',
    title: 'Guideline for the Management of Gout',
    shortTitle: 'Gout Guidelines',
    organization: getOrg('acr'),
    specialty: 'rheumatology',
    condition: 'Gout',
    year: 2020,
    lastUpdated: '2020-06-01',
    url: 'https://www.rheumatology.org/Practice-Quality/Clinical-Support/Clinical-Practice-Guidelines/Gout',
    keywords: ['gout', 'uric acid', 'hyperuricemia', 'allopurinol', 'febuxostat', 'colchicine', 'NSAIDs', 'prednisone', 'tophus', 'flare'],
    summary: 'Comprehensive guidelines for management of gout including acute flares and urate-lowering therapy.',
    keyRecommendations: [
      {
        id: 'gout-1',
        text: 'Colchicine, NSAIDs, or corticosteroids are first-line for acute gout flares.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Acute Flare'
      },
      {
        id: 'gout-2',
        text: 'Allopurinol is the preferred first-line urate-lowering therapy.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'ULT'
      },
      {
        id: 'gout-3',
        text: 'Target serum urate < 6 mg/dL for all patients on ULT.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'Moderate',
        category: 'Treatment Goal'
      },
      {
        id: 'gout-4',
        text: 'Continue ULT during acute flares.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'Moderate',
        category: 'Acute Flare'
      }
    ]
  },
  {
    id: 'acr-ra-2021',
    title: 'Guideline for the Treatment of Rheumatoid Arthritis',
    shortTitle: 'RA Treatment Guidelines',
    organization: getOrg('acr'),
    specialty: 'rheumatology',
    condition: 'Rheumatoid Arthritis',
    year: 2021,
    lastUpdated: '2021-06-08',
    url: 'https://www.rheumatology.org/Practice-Quality/Clinical-Support/Clinical-Practice-Guidelines/Rheumatoid-Arthritis',
    keywords: ['rheumatoid arthritis', 'RA', 'DMARD', 'methotrexate', 'biologic', 'TNF inhibitor', 'JAK inhibitor', 'inflammation', 'joint swelling'],
    summary: 'Guidelines for pharmacological management of rheumatoid arthritis using treat-to-target approach.',
    keyRecommendations: [
      {
        id: 'ra-1',
        text: 'Methotrexate monotherapy is preferred initial DMARD for moderate-to-high disease activity.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Initial Therapy'
      },
      {
        id: 'ra-2',
        text: 'Add biologic or JAK inhibitor if target not reached with DMARD monotherapy.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'High',
        category: 'Escalation'
      },
      {
        id: 'ra-3',
        text: 'Treat to target of remission or low disease activity.',
        classOfRecommendation: 'A',
        levelOfEvidence: 'Moderate',
        category: 'Treatment Strategy'
      }
    ]
  }
];

// Keyword mapping for search optimization
export const GUIDELINE_KEYWORD_MAP: Record<string, string[]> = {
  'heart failure': ['CHF', 'HFrEF', 'HFpEF', 'cardiomyopathy', 'EF', 'GDMT', 'congestion'],
  'atrial fibrillation': ['AFib', 'AF', 'irregular heartbeat', 'RVR', 'anticoagulation'],
  'ACS': ['heart attack', 'MI', 'STEMI', 'NSTEMI', 'troponin', 'chest pain'],
  'asthma': ['wheezing', 'bronchospasm', 'inhaler', 'controller', 'reliever'],
  'COPD': ['emphysema', 'chronic bronchitis', 'FEV1', 'bronchodilator'],
  'pneumonia': ['CAP', 'HAP', 'respiratory infection', 'lung infection'],
  'sepsis': ['septic shock', 'SIRS', 'infection', 'bacteremia'],
  'UTI': ['cystitis', 'pyelonephritis', 'urinary infection'],
  'diabetes': ['DM', 'hyperglycemia', 'A1C', 'glucose', 'insulin'],
  'DKA': ['diabetic ketoacidosis', 'anion gap', 'ketones'],
  'AKI': ['acute kidney injury', 'renal failure', 'creatinine', 'oliguria'],
  'CKD': ['chronic kidney disease', 'eGFR', 'proteinuria'],
  'stroke': ['CVA', 'ischemic stroke', 'tPA', 'thrombectomy'],
  'seizure': ['status epilepticus', 'convulsion', 'epilepsy'],
  'GI bleeding': ['melena', 'hematemesis', 'hematochezia', 'UGIB', 'LGIB'],
  'hepatic encephalopathy': ['HE', 'cirrhosis', 'ammonia', 'confusion'],
  'VTE': ['DVT', 'PE', 'blood clot', 'pulmonary embolism'],
  'gout': ['uric acid', 'hyperuricemia', 'podagra', 'tophus']
};

// Export helper function to get all guidelines
export function getAllGuidelines(): ClinicalGuideline[] {
  return CLINICAL_GUIDELINES;
}

// Export helper to get guideline by ID
export function getGuidelineById(id: string): ClinicalGuideline | undefined {
  return CLINICAL_GUIDELINES.find(g => g.id === id);
}

// Export helper to get guidelines by specialty
export function getGuidelinesBySpecialty(specialty: string): ClinicalGuideline[] {
  return CLINICAL_GUIDELINES.filter(g => g.specialty === specialty);
}

// Export helper to get guidelines by organization
export function getGuidelinesByOrganization(orgId: string): ClinicalGuideline[] {
  return CLINICAL_GUIDELINES.filter(g => g.organization.id === orgId);
}
