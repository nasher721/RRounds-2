import { Patient } from '@/types/patient';
import { defaultMedications, defaultSystems } from '@/types/patient';

export interface FHIRBundle {
  resourceType: 'Bundle';
  type: 'collection' | 'transaction';
  entry: FHIRBundleEntry[];
}

export interface FHIRBundleEntry {
  resource: FHIRPatient | FHIRObservation | FHIRMedicationRequest | FHIRCondition | FHIRProcedure | FHIREncounter | FHIRDiagnosticReport;
}

export interface FHIRPatient {
  resourceType: 'Patient';
  id?: string;
  identifier?: Array<{
    system: string;
    value: string;
  }>;
  name?: Array<{
    use?: string;
    family?: string;
    given?: string[];
  }>;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
}

export interface FHIRObservation {
  resourceType: 'Observation';
  id?: string;
  status: 'registered' | 'preliminary' | 'final' | 'amended';
  category?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display?: string;
    }>;
  }>;
  code: {
    coding: Array<{
      system: string;
      code: string;
      display?: string;
    }>;
    text?: string;
  };
  subject: {
    reference: string;
  };
  effectiveDateTime?: string;
  valueString?: string;
  valueQuantity?: {
    value: number;
    unit: string;
  };
}

export interface FHIRMedicationRequest {
  resourceType: 'MedicationRequest';
  id?: string;
  status: 'active' | 'on-hold' | 'cancelled' | 'completed' | 'stopped';
  intent: 'proposal' | 'plan' | 'order';
  medicationCodeableConcept?: {
    coding: Array<{
      system: string;
      code: string;
      display?: string;
    }>;
    text?: string;
  };
  subject: {
    reference: string;
  };
  dosageInstruction?: Array<{
    text?: string;
    timing?: {
      repeat?: {
        frequency?: number;
        period?: number;
        periodUnit?: string;
      };
    };
  }>;
}

export interface FHIRCondition {
  resourceType: 'Condition';
  id?: string;
  clinicalStatus?: {
    coding: Array<{
      system: string;
      code: string;
    }>;
  };
  code: {
    coding: Array<{
      system: string;
      code: string;
      display?: string;
    }>;
    text?: string;
  };
  subject: {
    reference: string;
  };
  onsetDateTime?: string;
}

export interface FHIRProcedure {
  resourceType: 'Procedure';
  id?: string;
  status: 'preparation' | 'in-progress' | 'not-done' | 'on-hold' | 'stopped' | 'completed' | 'entered-in-error' | 'unknown';
  code: {
    coding: Array<{
      system: string;
      code: string;
      display?: string;
    }>;
    text?: string;
  };
  subject: {
    reference: string;
  };
  performedDateTime?: string;
  performedPeriod?: {
    start?: string;
    end?: string;
  };
}

export interface FHIREncounter {
  resourceType: 'Encounter';
  id?: string;
  status: 'planned' | 'arrived' | 'triaged' | 'in-progress' | 'onleave' | 'finished' | 'cancelled' | 'entered-in-error' | 'unknown';
  class: {
    system: string;
    code: string;
    display?: string;
  };
  type?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display?: string;
    }>;
    text?: string;
  }>;
  subject?: {
    reference: string;
  };
  period?: {
    start?: string;
    end?: string;
  };
  reasonCode?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display?: string;
    }>;
    text?: string;
  }>;
}

export interface FHIRDiagnosticReport {
  resourceType: 'DiagnosticReport';
  id?: string;
  status: 'registered' | 'partial' | 'preliminary' | 'final' | 'amended' | 'corrected' | 'appended' | 'cancelled' | 'entered-in-error' | 'unknown';
  category?: Array<{
    coding: Array<{
      system: string;
      code: string;
      display?: string;
    }>;
  }>;
  code: {
    coding: Array<{
      system: string;
      code: string;
      display?: string;
    }>;
    text?: string;
  };
  subject?: {
    reference: string;
  };
  effectiveDateTime?: string;
  issued?: string;
  result?: Array<{
    reference: string;
  }>;
  conclusion?: string;
}

export function patientToFHIR(patient: Patient): FHIRBundle {
  const entries: FHIRBundleEntry[] = [];

  const fhirPatient: FHIRPatient = {
    resourceType: 'Patient',
    id: patient.id,
    identifier: [
      {
        system: 'round-robin-notes/patient',
        value: patient.patientNumber?.toString() || '',
      },
    ],
    name: [
      {
        use: 'official',
        family: patient.name.split(' ').pop() || '',
        given: patient.name.split(' ').slice(0, -1),
      },
    ],
    gender: 'unknown',
    birthDate: undefined,
  };
  entries.push({ resource: fhirPatient });

  if (patient.systems) {
    if (patient.systems.neuro) {
      entries.push({
        resource: {
          resourceType: 'Observation',
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'exam',
                  display: 'Exam',
                },
              ],
            },
          ],
          code: {
            coding: [
              {
                system: 'round-robin-notes',
                code: 'neuro-status',
                display: 'Neurological Status',
              },
            ],
            text: 'Neurological Status',
          },
          subject: { reference: `Patient/${patient.id}` },
          valueString: patient.systems.neuro,
        } as FHIRObservation,
      });
    }

    if (patient.systems.cv) {
      entries.push({
        resource: {
          resourceType: 'Observation',
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                  display: 'Vital Signs',
                },
              ],
            },
          ],
          code: {
            coding: [
              {
                system: 'round-robin-notes',
                code: 'cv-status',
                display: 'Cardiovascular Status',
              },
            ],
            text: 'Cardiovascular Status',
          },
          subject: { reference: `Patient/${patient.id}` },
          valueString: patient.systems.cv,
        } as FHIRObservation,
      });
    }

    if (patient.systems.resp) {
      entries.push({
        resource: {
          resourceType: 'Observation',
          status: 'final',
          category: [
            {
              coding: [
                {
                  system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                  code: 'vital-signs',
                  display: 'Vital Signs',
                },
              ],
            },
          ],
          code: {
            coding: [
              {
                system: 'round-robin-notes',
                code: 'resp-status',
                display: 'Respiratory Status',
              },
            ],
            text: 'Respiratory Status',
          },
          subject: { reference: `Patient/${patient.id}` },
          valueString: patient.systems.resp,
        } as FHIRObservation,
      });
    }
  }

  if (patient.medications) {
    if (patient.medications.infusions?.length) {
      for (const infusion of patient.medications.infusions) {
        entries.push({
          resource: {
            resourceType: 'MedicationRequest',
            status: 'active',
            intent: 'order',
            medicationCodeableConcept: {
              text: infusion,
            },
            subject: { reference: `Patient/${patient.id}` },
            dosageInstruction: [
              {
                text: infusion,
              },
            ],
          } as FHIRMedicationRequest,
        });
      }
    }

    if (patient.medications.scheduled?.length) {
      for (const med of patient.medications.scheduled) {
        entries.push({
          resource: {
            resourceType: 'MedicationRequest',
            status: 'active',
            intent: 'order',
            medicationCodeableConcept: {
              text: med,
            },
            subject: { reference: `Patient/${patient.id}` },
          } as FHIRMedicationRequest,
        });
      }
    }
  }

  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: entries,
  };
}

export function fhirToPatient(fhirBundle: FHIRBundle): Partial<Patient> {
  const patientEntry = fhirBundle.entry?.find((e) => e.resource?.resourceType === 'Patient');
  const patient = patientEntry?.resource as FHIRPatient | undefined;

  if (!patient) {
    return {
      name: 'Unknown Patient',
      systems: defaultSystems,
      medications: defaultMedications,
    };
  }

  const name = patient.name?.[0];
  const patientName = name
    ? `${name.given?.join(' ') || ''} ${name.family || ''}`.trim()
    : 'Unknown Patient';

  const systems: typeof defaultSystems = {
    ...defaultSystems,
  };

  const medications: typeof defaultMedications = {
    infusions: [],
    scheduled: [],
    prn: [],
  };

  for (const entry of fhirBundle.entry || []) {
    const resource = entry.resource;

    if (resource?.resourceType === 'Observation') {
      const obs = resource as FHIRObservation;
      const code = obs.code?.coding?.[0]?.code;

      if (code === 'neuro-status') {
        systems.neuro = obs.valueString || '';
      } else if (code === 'cv-status') {
        systems.cv = obs.valueString || '';
      } else if (code === 'resp-status') {
        systems.resp = obs.valueString || '';
      }
    }

    if (resource?.resourceType === 'MedicationRequest') {
      const med = resource as FHIRMedicationRequest;
      const medText = med.medicationCodeableConcept?.text || '';

      if (medText) {
        medications.scheduled.push(medText);
      }
    }
  }

  return {
    name: patientName,
    systems,
    medications,
  };
}

export function downloadFHIRBundle(patient: Patient): void {
  const bundle = patientToFHIR(patient);
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: 'application/fhir+json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `patient-${patient.patientNumber || 'unknown'}-fhir.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function importFHIRBundle(file: File): Promise<Partial<Patient>> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const bundle = JSON.parse(content) as FHIRBundle;

        if (bundle.resourceType !== 'Bundle') {
          reject(new Error('Invalid FHIR Bundle: missing resourceType'));
          return;
        }

        const patient = fhirToPatient(bundle);
        resolve(patient);
      } catch (err) {
        reject(new Error('Failed to parse FHIR Bundle'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
