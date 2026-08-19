import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, FileSearch, Info, Loader2, Pill } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  checkDrugInteractions,
  type DrugCoverage,
  type SuccessfulDrugInteractionResponse,
} from "@/services/drug-interaction.service";
import { getUserFacingErrorMessage } from "@/lib/userFacingErrors";

interface OpenFDACheckerProps {
  medications: string[];
  className?: string;
}

const coverageLabel: Record<DrugCoverage['status'], string> = {
  available: 'Label coverage available',
  not_found: 'No matching label found',
  provider_error: 'Label service unavailable',
};

export function InteractionCheckSummary({
  result,
}: {
  result: SuccessfulDrugInteractionResponse;
}): React.ReactElement {
  const isInconclusive = result.overallStatus === 'inconclusive';

  return (
    <div className="space-y-4" aria-live="polite">
      {isInconclusive ? (
        <div
          className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900"
          role="status"
          data-testid="interaction-inconclusive"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Check inconclusive</p>
              <p className="text-sm">
                One or more medication labels could not be reviewed. Do not interpret this result
                as showing that no interaction exists.
              </p>
            </div>
          </div>
        </div>
      ) : result.interactions.length === 0 ? (
        <div
          className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-emerald-900"
          role="status"
          data-testid="interaction-no-documented"
        >
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">No interaction documented in retrieved FDA labels</p>
              <p className="text-sm">
                This is limited label evidence, not proof that the combination is safe.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      {result.interactions.length > 0 && (
        <div className="space-y-2" data-testid="interaction-evidence">
          <h4 className="flex items-center gap-2 text-sm font-medium text-foreground">
            <FileSearch className="h-4 w-4" />
            FDA label interaction mentions
          </h4>
          {result.interactions.map((interaction, index) => (
            <div
              className="rounded-md border border-amber-200 bg-amber-50 p-3"
              key={`${interaction.drug1}-${interaction.drug2}-${index}`}
            >
              <p className="text-sm font-medium text-amber-950">
                {interaction.drug1} + {interaction.drug2}
              </p>
              <p className="mt-1 text-sm text-amber-900">{interaction.description}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Source: {interaction.source}; label reviewed for {interaction.evidenceDrug}. No
                severity was inferred.
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-sm font-medium text-foreground">Medication coverage</h4>
        <ul className="space-y-2 text-sm">
          {result.coverage.map((coverage) => (
            <li className="rounded-md border p-2" key={coverage.drug}>
              <p className="font-medium">{coverage.drug}</p>
              <p className="text-xs text-muted-foreground">
                {coverageLabel[coverage.status]} — {coverage.message}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-start gap-2 rounded-md bg-muted p-3 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>{result.disclaimer}</p>
      </div>
    </div>
  );
}

export function OpenFDAChecker({
  medications,
  className,
}: OpenFDACheckerProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<SuccessfulDrugInteractionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validMeds = medications.filter((m) => m && m.trim().length > 0);

  const handleCheckInteractions = async () => {
    if (validMeds.length < 2) {
      setError("At least 2 medications required to check interactions");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const result = await checkDrugInteractions(validMeds);
      if (result.success) {
        setResult(result);
      } else {
        setError(result.error || "Failed to check interactions");
      }
    } catch (err) {
      setError(getUserFacingErrorMessage(err, "Failed to check interactions. Please try again."));
    } finally {
      setIsLoading(false);
    }
  };

  const interactionCount = result?.interactions.length ?? 0;

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={className}
          disabled={validMeds.length < 2}
        >
          <Pill className="h-4 w-4 mr-2" />
          Check Interactions
          {interactionCount > 0 && (
            <span
              className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800"
            >
              {interactionCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5" />
            Drug Interaction Checker
          </SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-4">
          <div className="text-sm text-gray-600">
            Checking {validMeds.length} medications for interactions
            <ul className="mt-2 list-disc list-inside text-xs text-gray-500">
              {validMeds.slice(0, 5).map((med, i) => (
                <li key={i}>{med}</li>
              ))}
              {validMeds.length > 5 && (
                <li className="text-gray-400">
                  +{validMeds.length - 5} more...
                </li>
              )}
            </ul>
          </div>

          <Button
            onClick={handleCheckInteractions}
            disabled={isLoading || validMeds.length < 2}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              "Check for Interactions"
            )}
          </Button>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700 text-sm">
              {error}
            </div>
          )}

          {result && <InteractionCheckSummary result={result} />}

          {!isLoading && !error && !result && (
            <div className="text-center py-8 text-gray-500">
              <Pill className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>Click "Check for Interactions" to analyze medications</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
