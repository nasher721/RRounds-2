export { 
  launchSMART, 
  handleCallback, 
  fetchPatientDemographics,
  fetchMedications,
  fetchAllergies,
  fetchPatientData,
  getFHIRContext,
  getPatientId,
  getServerUrl,
  saveFHIRState,
  loadFHIRState,
  clearFHIRState,
  FHIR_SCOPES,
} from './client';

export type { 
  FHIRClient, 
  FHIRPatientResource, 
  FHIRMedicationRequest, 
  FHIRAllergyIntolerance,
  FHIRState,
} from './client';

export { 
  mapFHIRToPatient, 
  formatFHIRPatientForDisplay,
} from './mapper';

export type { FHIRImportResult } from './mapper';
