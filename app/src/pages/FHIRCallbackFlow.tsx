import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  assertFHIRLaunchOwner,
  clearFHIRState,
  fetchPatientData,
  handleCallback,
} from '@/integrations/fhir/client';
import { mapFHIRToPatient } from '@/integrations/fhir/mapper';
import { useAuth } from '@/hooks/useAuth';
import { usePatients } from '@/hooks/usePatients';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

type ImportStatus = 'loading' | 'fetching' | 'importing' | 'success' | 'error';

function safeFHIRCallbackMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (
    message === 'You must be signed in to complete an EHR import.'
    || message === 'The EHR import was interrupted by an authentication change.'
    || message === 'This EHR import no longer belongs to the current user. Please start it again.'
    || message === 'No patient data received from EHR'
  ) {
    return message;
  }
  return 'The EHR import could not be completed securely. Please start it again.';
}

export default function FHIRCallbackFlow() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { addPatientWithData } = usePatients();
  const [status, setStatus] = useState<ImportStatus>('loading');
  const [error, setError] = useState<string | null>(null);
  const [patientName, setPatientName] = useState<string | null>(null);
  const callbackRunId = useRef(0);
  const userId = user?.id;

  useEffect(() => {
    const runId = ++callbackRunId.current;
    let redirectTimer: number | undefined;

    const isCurrentRun = () => callbackRunId.current === runId;
    const retireRun = () => {
      if (!isCurrentRun()) return;
      callbackRunId.current += 1;
      const retiredRunId = callbackRunId.current;

      // A StrictMode probe is replaced synchronously and advances the run ID.
      // A real unmount has no replacement, so purge its abandoned SMART state.
      void Promise.resolve().then(() => {
        if (callbackRunId.current === retiredRunId) clearFHIRState();
      });
    };

    if (authLoading) {
      return retireRun;
    }

    if (!userId) {
      clearFHIRState();
      setError('You must be signed in to complete an EHR import.');
      setStatus('error');
      return retireRun;
    }

    const ownerId = userId;
    const requireCurrentOwner = () => {
      if (!isCurrentRun()) {
        throw new Error('The EHR import was interrupted by an authentication change.');
      }
      assertFHIRLaunchOwner(ownerId);
    };

    async function processCallback() {
      try {
        setStatus('loading');
        setError(null);

        requireCurrentOwner();
        const client = await handleCallback(ownerId);

        if (!client) {
          throw new Error('Failed to initialize FHIR client');
        }

        requireCurrentOwner();
        setStatus('fetching');

        const fhirData = await fetchPatientData(client);
        requireCurrentOwner();

        if (!fhirData.patient) {
          throw new Error('No patient data received from EHR');
        }

        const name = fhirData.patient.name?.[0];
        const fullName = name
          ? `${name.given?.join(' ') || ''} ${name.family || ''}`.trim()
          : 'Unknown Patient';

        setPatientName(fullName);
        setStatus('importing');

        const mappedFHIR = mapFHIRToPatient(
          fhirData.patient,
          fhirData.medications,
          fhirData.allergies,
        ).patient;

        const patientData = {
          name: fullName,
          mrn: mappedFHIR.mrn ?? '',
          bed: '',
          clinicalSummary: `Imported from EHR on ${new Date().toLocaleDateString()}`,
          intervalEvents: '',
          imaging: '',
          labs: '',
          systems: {
            neuro: '',
            cv: '',
            resp: '',
            renalGU: '',
            gi: '',
            endo: '',
            heme: '',
            infectious: '',
            skinLines: '',
            dispo: '',
          },
          medications: {
            infusions: [],
            scheduled: mappedFHIR.medications?.scheduled ?? [],
            prn: mappedFHIR.medications?.prn ?? [],
            rawText: '',
          },
          dateOfBirth: mappedFHIR.dateOfBirth,
          gender: mappedFHIR.gender,
          alerts: mappedFHIR.alerts,
        };

        requireCurrentOwner();
        await addPatientWithData(patientData);
        requireCurrentOwner();

        setStatus('success');

        redirectTimer = window.setTimeout(() => {
          navigate('/');
        }, 2000);

      } catch (err) {
        if (!isCurrentRun()) return;
        console.error('FHIR callback failed');
        setError(safeFHIRCallbackMessage(err));
        setStatus('error');
      } finally {
        if (isCurrentRun()) clearFHIRState();
      }
    }

    // Defer one microtask so React StrictMode can retire its probe effect
    // before any one-time OAuth callback work begins.
    void Promise.resolve().then(processCallback);

    return () => {
      retireRun();
      if (redirectTimer !== undefined) window.clearTimeout(redirectTimer);
    };
  }, [addPatientWithData, authLoading, navigate, userId]);

  return (
    <main id="main-content" className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md" role="region" aria-labelledby="fhir-import-title">
        <CardHeader>
          <CardTitle id="fhir-import-title" className="flex items-center gap-2 text-balance">
            {status === 'loading' && (
              <>
                <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none shrink-0" aria-hidden />
                <span>Connecting to EHR…</span>
              </>
            )}
            {status === 'fetching' && (
              <>
                <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none shrink-0" aria-hidden />
                <span>Fetching patient data…</span>
              </>
            )}
            {status === 'importing' && (
              <>
                <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none shrink-0" aria-hidden />
                <span>Importing {patientName}…</span>
              </>
            )}
            {status === 'success' && (
              <>
                <CheckCircle className="h-5 w-5 text-green-500 shrink-0" aria-hidden />
                <span>Import successful</span>
              </>
            )}
            {status === 'error' && (
              <>
                <AlertCircle className="h-5 w-5 text-destructive shrink-0" aria-hidden />
                <span>Import failed</span>
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {status === 'loading' && (
            <p className="text-sm text-muted-foreground">
              Please wait while we connect to your EHR system…
            </p>
          )}
          {status === 'fetching' && (
            <p className="text-sm text-muted-foreground">
              Retrieving patient demographics, medications, and allergies…
            </p>
          )}
          {status === 'importing' && (
            <p className="text-sm text-muted-foreground">
              Creating patient record for <strong>{patientName}</strong>…
            </p>
          )}
          {status === 'success' && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Successfully imported <strong>{patientName}</strong> from your EHR.
              </p>
              <p className="text-sm text-muted-foreground">
                Redirecting to dashboard…
              </p>
            </div>
          )}
          {status === 'error' && (
            <div className="space-y-4">
              <p className="text-sm text-destructive" role="alert">
                {error || 'An error occurred while importing patient data.'}
              </p>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="text-sm text-primary hover:underline min-h-[44px] px-1 -mx-1 rounded-md inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Return to dashboard
              </button>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
