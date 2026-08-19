import * as React from "react";
import { AlertTriangle, Calculator, Copy, Info } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateCockcroftGault } from "@/lib/clinicalCalculations";

type Sex = "male" | "female";

interface RenalInputs {
  ageYears: string;
  weightKg: string;
  serumCreatinineMgDl: string;
  sex: Sex;
}

const INITIAL_INPUTS: RenalInputs = {
  ageYears: "",
  weightKg: "",
  serumCreatinineMgDl: "",
  sex: "male",
};

/**
 * Retains the historical export name for callers, but deliberately provides
 * only a renal-function estimate. The previous component combined unversioned
 * drug schedules with a bedside calculator and could present unsafe doses.
 */
export function MedicationDoseCalculators() {
  const [open, setOpen] = React.useState(false);
  const [inputs, setInputs] = React.useState<RenalInputs>(INITIAL_INPUTS);
  const [estimatedCrCl, setEstimatedCrCl] = React.useState<number | null>(null);

  const updateInput = (field: keyof RenalInputs, value: string) => {
    setInputs((current) => ({ ...current, [field]: value }));
    setEstimatedCrCl(null);
  };

  const calculate = () => {
    try {
      const result = calculateCockcroftGault({
        ageYears: Number(inputs.ageYears),
        weightKg: Number(inputs.weightKg),
        serumCreatinineMgDl: Number(inputs.serumCreatinineMgDl),
        sex: inputs.sex,
      });
      setEstimatedCrCl(result);
    } catch (error) {
      setEstimatedCrCl(null);
      toast.error(error instanceof Error ? error.message : "Enter valid clinical inputs.");
    }
  };

  const copyResult = async () => {
    if (estimatedCrCl === null) return;
    try {
      await navigator.clipboard.writeText(
        `Estimated Cockcroft-Gault creatinine clearance: ${estimatedCrCl.toFixed(1)} mL/min`,
      );
      toast.success("Estimate copied to clipboard");
    } catch {
      toast.error("The estimate could not be copied");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Calculator className="h-4 w-4" />
          Renal estimate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Adult Creatinine Clearance Estimate
          </DialogTitle>
          <DialogDescription>
            Cockcroft-Gault estimate for renal-function review. This tool does not recommend a medication dose or interval.
          </DialogDescription>
        </DialogHeader>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Patient inputs</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="renal-age">Age (years)</Label>
                <Input
                  id="renal-age"
                  type="number"
                  min={18}
                  max={120}
                  value={inputs.ageYears}
                  onChange={(event) => updateInput("ageYears", event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="renal-weight">Weight used by protocol (kg)</Label>
                <Input
                  id="renal-weight"
                  type="number"
                  min={0.1}
                  max={500}
                  step="any"
                  value={inputs.weightKg}
                  onChange={(event) => updateInput("weightKg", event.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="renal-sex">Sex coefficient</Label>
                <select
                  id="renal-sex"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                  value={inputs.sex}
                  onChange={(event) => updateInput("sex", event.target.value as Sex)}
                >
                  <option value="male">Male coefficient</option>
                  <option value="female">Female coefficient (0.85)</option>
                </select>
              </div>
              <div>
                <Label htmlFor="renal-creatinine">Serum creatinine (mg/dL)</Label>
                <Input
                  id="renal-creatinine"
                  type="number"
                  min={0.01}
                  step="any"
                  value={inputs.serumCreatinineMgDl}
                  onChange={(event) => updateInput("serumCreatinineMgDl", event.target.value)}
                />
              </div>
            </div>

            <Button onClick={calculate} className="w-full">
              <Calculator className="mr-2 h-4 w-4" />
              Estimate creatinine clearance
            </Button>
          </CardContent>
        </Card>

        {estimatedCrCl !== null && (
          <Card aria-live="polite">
            <CardHeader>
              <CardTitle className="text-base">Estimated Cockcroft-Gault CrCl</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <p className="text-2xl font-semibold">{estimatedCrCl.toFixed(1)} mL/min</p>
              <Button variant="outline" size="sm" onClick={() => void copyResult()}>
                <Copy className="mr-2 h-4 w-4" />
                Copy
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <div className="flex items-start gap-2 font-medium">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Do not use this estimate by itself to select a drug dose or infusion rate.
          </div>
          <div className="flex items-start gap-2 text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Confirm the weight convention and equation required by the current drug label or institutional protocol. The estimate may be unreliable with unstable renal function, pregnancy, amputation, or extremes of body size or muscle mass.
            </p>
          </div>
          <p className="text-muted-foreground">
            Medication-specific dose schedules were removed because they were not tied to a validated, versioned source. Consult pharmacy and the current approved reference.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
