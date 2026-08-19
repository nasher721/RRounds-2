import type FHIRClientImplementation from 'fhirclient/lib/Client';
import { supabase } from '@/integrations/supabase/client';
import { safeSessionStorage } from '@/utils/safeStorage';

export type FHIRClient = FHIRClientImplementation;

async function loadFHIRClient() {
  const module = await import('fhirclient');
  return module.default;
}

export interface FHIRPatientResource {
  id?: string;
  name?: Array<{
    given?: string[];
    family?: string;
    text?: string;
  }>;
  birthDate?: string;
  gender?: string;
  identifier?: Array<{
    system?: string;
    value?: string;
    type?: {
      coding?: Array<{
        code?: string;
      }>;
    };
  }>;
}

export interface FHIRMedicationRequest {
  id?: string;
  medicationCodeableConcept?: {
    text?: string;
    coding?: Array<{
      display?: string;
      code?: string;
    }>;
  };
  dosageInstruction?: Array<{
    text?: string;
    asNeededBoolean?: boolean;
  }>;
  status?: string;
}

export interface FHIRAllergyIntolerance {
  id?: string;
  substance?: {
    text?: string;
    coding?: Array<{
      display?: string;
    }>;
  };
  reaction?: Array<{
    description?: string;
  }>;
  clinicalStatus?: {
    coding?: Array<{
      code?: string;
    }>;
  };
}



export const FHIR_SCOPES = [
  'patient/Patient.read',
  'patient/MedicationRequest.read',
  'patient/AllergyIntolerance.read',
  'launch',
  'openid',
  'fhirUser',
].join(' ');

const FHIR_STATE_KEY = 'fhir_state';
const FHIR_LAUNCH_STATE_KEY = 'fhir_launch_state';
const FHIRCLIENT_SMART_KEY = 'SMART_KEY';
const FHIR_OWNER_ERROR = 'This EHR import no longer belongs to the current user. Please start it again.';

export interface FHIRState {
  isLaunching: boolean;
  ownerId: string;
  clientId?: string;
  iss?: string;
}

export function saveFHIRState(state: FHIRState): void {
  safeSessionStorage.setItem(FHIR_STATE_KEY, JSON.stringify(state));
}

export function loadFHIRState(): FHIRState | null {
  const stored = safeSessionStorage.getItem(FHIR_STATE_KEY);
  if (stored) {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (
        typeof parsed === 'object'
        && parsed !== null
        && 'isLaunching' in parsed
        && typeof parsed.isLaunching === 'boolean'
        && 'ownerId' in parsed
        && typeof parsed.ownerId === 'string'
        && parsed.ownerId.length > 0
      ) {
        return parsed as FHIRState;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function getSMARTStateStorageKey(): string | null {
  const stored = safeSessionStorage.getItem(FHIRCLIENT_SMART_KEY);
  if (!stored) return null;

  try {
    const parsed: unknown = JSON.parse(stored);
    return typeof parsed === 'string' && parsed.length > 0 ? parsed : null;
  } catch {
    // Support an older/custom adapter that stored the pointer without JSON encoding.
    return stored;
  }
}

/** Purge app launch metadata and fhirclient's token-bearing SMART state. */
export function clearFHIRState(): void {
  const smartStateStorageKey = getSMARTStateStorageKey();
  if (smartStateStorageKey) {
    safeSessionStorage.removeItem(smartStateStorageKey);
  }
  safeSessionStorage.removeItem(FHIRCLIENT_SMART_KEY);
  safeSessionStorage.removeItem(FHIR_STATE_KEY);
  safeSessionStorage.removeItem(FHIR_LAUNCH_STATE_KEY);
}

/**
 * Keep a redirect in progress only when it was launched by the restored user.
 * Legacy or cross-user state is unbound and therefore unsafe to reuse.
 */
export function reconcileFHIRStateForAuthOwner(ownerId: string | null): void {
  const state = loadFHIRState();
  if (ownerId && state?.isLaunching && state.ownerId === ownerId) return;
  clearFHIRState();
}

export function assertFHIRLaunchOwner(ownerId: string): void {
  const state = loadFHIRState();
  if (!state?.isLaunching || state.ownerId !== ownerId) {
    throw new Error(FHIR_OWNER_ERROR);
  }
}

export async function launchSMART(config?: {
  clientId?: string;
  iss?: string;
  redirectUri?: string;
}): Promise<void> {
  const redirectUri = config?.redirectUri || `${window.location.origin}/fhir/callback`;

  const { data, error } = await supabase.auth.getSession();
  const ownerId = data.session?.user.id;
  if (error || !ownerId) {
    clearFHIRState();
    throw new Error('You must be signed in before importing from an EHR.');
  }

  clearFHIRState();
  saveFHIRState({
    isLaunching: true,
    ownerId,
    clientId: config?.clientId,
    iss: config?.iss,
  });

  try {
    const FHIR = await loadFHIRClient();
    await FHIR.oauth2.authorize({
      clientId: config?.clientId || import.meta.env.VITE_FHIR_CLIENT_ID || '',
      scope: FHIR_SCOPES,
      redirectUri,
      iss: config?.iss,
    });
  } catch (error) {
    clearFHIRState();
    throw error;
  }
}

export async function handleCallback(ownerId: string): Promise<FHIRClient> {
  try {
    assertFHIRLaunchOwner(ownerId);
    const FHIR = await loadFHIRClient();
    const client = await FHIR.oauth2.ready();
    assertFHIRLaunchOwner(ownerId);
    return client;
  } catch (error) {
    clearFHIRState();
    throw error;
  }
}

export async function fetchPatientDemographics(client: FHIRClient): Promise<FHIRPatientResource> {
  const patient = await client.patient.read() as FHIRPatientResource;
  return patient;
}

export async function fetchMedications(client: FHIRClient): Promise<FHIRMedicationRequest[]> {
  const patientId = client.patient.id;
  if (!patientId) return [];
  
  const response = await client.request(`/MedicationRequest?patient=${patientId}&status=active`);
  
  if (response.entry && Array.isArray(response.entry)) {
    return response.entry.map((e: { resource: FHIRMedicationRequest }) => e.resource);
  }
  
  return [];
}

export async function fetchAllergies(client: FHIRClient): Promise<FHIRAllergyIntolerance[]> {
  const patientId = client.patient.id;
  if (!patientId) return [];
  
  const response = await client.request(`/AllergyIntolerance?patient=${patientId}&clinical-status=active`);
  
  if (response.entry && Array.isArray(response.entry)) {
    return response.entry.map((e: { resource: FHIRAllergyIntolerance }) => e.resource);
  }
  
  return [];
}

export function getFHIRContext(): { client: FHIRClient | null; isLaunching: boolean } {
  const state = loadFHIRState();
  return {
    client: null,
    isLaunching: state?.isLaunching ?? false,
  };
}

export function getPatientId(client: FHIRClient): string | undefined {
  return client.patient.id ?? undefined;
}

export function getServerUrl(client: FHIRClient): string {
  return client.state.serverUrl;
}

export async function fetchPatientData(client: FHIRClient): Promise<{
  patient: FHIRPatientResource;
  medications: FHIRMedicationRequest[];
  allergies: FHIRAllergyIntolerance[];
}> {
  const [patient, medications, allergies] = await Promise.all([
    fetchPatientDemographics(client),
    fetchMedications(client),
    fetchAllergies(client),
  ]);
  
  return { patient, medications, allergies };
}
