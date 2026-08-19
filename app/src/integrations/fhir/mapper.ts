import type { 
  FHIRPatientResource, 
  FHIRMedicationRequest, 
  FHIRAllergyIntolerance 
} from './client';
import type { Patient, PatientGender } from '@/types/patient';
import { defaultSystems, defaultMedications } from '@/types/patient';

function extractPatientName(name: FHIRPatientResource['name']): string {
  if (!name || name.length === 0) return 'Unknown Patient';
  
  const primaryName = name[0];
  if (primaryName.text) return primaryName.text;
  
  const given = primaryName.given?.join(' ') || '';
  const family = primaryName.family || '';
  
  return [given, family].filter(Boolean).join(' ') || 'Unknown Patient';
}

/** Exported for FHIR callback and other call sites that need MRN only */
export function extractMRN(identifiers: FHIRPatientResource['identifier']): string {
  if (!identifiers || identifiers.length === 0) return '';
  
  const mrn = identifiers.find(
    (id) => id.type?.coding?.some((c) => c.code === 'MR')
  );
  
  return mrn?.value || '';
}

function extractDOB(birthDate?: string): string {
  return birthDate || '';
}

function extractGender(gender?: string): PatientGender | undefined {
  const normalized = gender?.trim().toLowerCase();
  if (normalized === 'male' || normalized === 'female' || normalized === 'other' || normalized === 'unknown') {
    return normalized;
  }
  return undefined;
}

function mapMedications(medRequests: FHIRMedicationRequest[]): {
  scheduled: string[];
  prn: string[];
} {
  const scheduled: string[] = [];
  const prn: string[] = [];

  for (const req of medRequests) {
    const medName = req.medicationCodeableConcept?.text || 
      req.medicationCodeableConcept?.coding?.[0]?.display || 
      'Unknown Medication';
    
    const doseText = req.dosageInstruction?.[0]?.text || '';
    const fullMed = doseText ? `${medName} ${doseText}` : medName;
    
    const isPRN = req.dosageInstruction?.some((d) => d.asNeededBoolean === true);
    
    if (isPRN) {
      prn.push(fullMed);
    } else {
      scheduled.push(fullMed);
    }
  }

  return { scheduled, prn };
}

function mapAllergies(allergies: FHIRAllergyIntolerance[]): string[] {
  return allergies
    .filter((a) => a.clinicalStatus?.coding?.some((c) => c.code === 'active'))
    .map((a) => {
      const name = a.substance?.text || a.substance?.coding?.[0]?.display || 'Unknown Allergen';
      const reaction = a.reaction?.[0]?.description;
      return reaction ? `${name} (${reaction})` : name;
    });
}

export interface FHIRImportResult {
  patient: Partial<Patient>;
  raw: {
    fhirPatient: FHIRPatientResource;
    medications: FHIRMedicationRequest[];
    allergies: FHIRAllergyIntolerance[];
  };
}

export function mapFHIRToPatient(
  fhirPatient: FHIRPatientResource,
  fhirMeds: FHIRMedicationRequest[],
  fhirAllergies: FHIRAllergyIntolerance[]
): FHIRImportResult {
  const name = extractPatientName(fhirPatient.name);
  const mrn = extractMRN(fhirPatient.identifier);
  const dob = extractDOB(fhirPatient.birthDate);
  const gender = extractGender(fhirPatient.gender);
  const { scheduled, prn } = mapMedications(fhirMeds);
  const allergies = mapAllergies(fhirAllergies);

  const patient: Partial<Patient> = {
    name,
    mrn,
    bed: '',
    clinicalSummary: '',
    dateOfBirth: dob || undefined,
    gender,
    alerts: allergies.length > 0 ? allergies : undefined,
    systems: { ...defaultSystems },
    medications: {
      ...defaultMedications,
      scheduled,
      prn,
    },
  };

  return {
    patient,
    raw: {
      fhirPatient,
      medications: fhirMeds,
      allergies: fhirAllergies,
    },
  };
}

export function formatFHIRPatientForDisplay(fhirPatient: FHIRPatientResource): string {
  const name = extractPatientName(fhirPatient.name);
  const dob = extractDOB(fhirPatient.birthDate);
  const mrn = extractMRN(fhirPatient.identifier);
  
  const parts = [name];
  if (dob) parts.push(`DOB: ${dob}`);
  if (mrn) parts.push(`MRN: ${mrn}`);
  
  return parts.join(' - ');
}
