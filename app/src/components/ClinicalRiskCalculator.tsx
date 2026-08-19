import * as React from "react";
import { AlertCircle, AlertTriangle, Calculator, CheckCircle, Info, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import {
  calculateCURB65,
  calculateNEWS2,
  calculateQSOFA,
  calculateSOFA,
  calculateWellsDVT,
  calculateWellsPE,
  type CURB65Inputs,
  type NEWS2Inputs,
  type QSOFAInputs,
  type RiskScoreResult,
  type SOFAInputs,
  type WellsDVTInputs,
  type WellsPEInputs,
} from "@/types/riskScores";

interface ClinicalRiskCalculatorProps {
  className?: string;
}

type ScoreTab = 'qsofa' | 'sofa' | 'curb65' | 'wells_dvt' | 'wells_pe' | 'news2';

const parseOptionalNumber = (value: string) => value === '' ? undefined : Number(value);
const isFiniteNumber = (value: number | undefined): value is number =>
  value !== undefined && Number.isFinite(value);
const isNonNegativeNumber = (value: number | undefined): value is number =>
  isFiniteNumber(value) && value >= 0;

const RiskLevelIcon = ({ level }: { level: RiskScoreResult['riskLevel'] }) => {
  switch (level) {
    case 'low':
      return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'moderate':
      return <AlertCircle className="h-4 w-4 text-amber-600" />;
    case 'high':
      return <AlertTriangle className="h-4 w-4 text-red-600" />;
    default:
      return <Info className="h-4 w-4 text-blue-600" />;
  }
};

const ScoreDisplay = ({ result, title }: { result: RiskScoreResult | null; title: string }) => {
  if (!result) return null;

  const tone = result.riskLevel === 'low' ? 'bg-green-50 border-green-200' :
    result.riskLevel === 'moderate' ? 'bg-amber-50 border-amber-200' :
    result.riskLevel === 'high' ? 'bg-red-50 border-red-200' :
    'bg-blue-50 border-blue-200';

  return (
    <div className={cn("rounded-lg border-2 p-4", tone)}>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="font-semibold">{title}</h4>
        <div className="flex items-center gap-2">
          <RiskLevelIcon level={result.riskLevel} />
          <Badge variant="outline" className="capitalize">{result.riskLevel}</Badge>
        </div>
      </div>
      <div className="mb-3 flex items-center gap-4">
        <div className="text-3xl font-bold">{result.score}</div>
        <div className="text-sm text-muted-foreground">/ {result.maxScore} points</div>
      </div>
      <p className={cn("text-sm font-medium", result.color)}>{result.interpretation}</p>
    </div>
  );
};

const QSOFACalculator = () => {
  const [inputs, setInputs] = React.useState<QSOFAInputs>({ alteredMentation: false });
  const [result, setResult] = React.useState<RiskScoreResult | null>(null);
  const update = (next: QSOFAInputs) => {
    setInputs(next);
    setResult(null);
  };
  const complete = isNonNegativeNumber(inputs.respiratoryRate) && isNonNegativeNumber(inputs.systolicBP);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Respiratory Rate (breaths/min)</Label>
        <Input
          aria-label="qSOFA respiratory rate"
          type="number"
          min={0}
          placeholder="22"
          value={inputs.respiratoryRate ?? ''}
          onChange={(event) => update({ ...inputs, respiratoryRate: parseOptionalNumber(event.target.value) })}
        />
        <p className="text-xs text-muted-foreground">+1 if ≥22 breaths/min</p>
      </div>
      <div className="space-y-2">
        <Label>Systolic Blood Pressure (mmHg)</Label>
        <Input
          aria-label="qSOFA systolic blood pressure"
          type="number"
          min={0}
          placeholder="100"
          value={inputs.systolicBP ?? ''}
          onChange={(event) => update({ ...inputs, systolicBP: parseOptionalNumber(event.target.value) })}
        />
        <p className="text-xs text-muted-foreground">+1 if ≤100 mmHg</p>
      </div>
      <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
        <div>
          <Label>Altered Mentation</Label>
          <p className="text-xs text-muted-foreground">GCS &lt;15</p>
        </div>
        <Switch
          aria-label="Altered mentation"
          checked={inputs.alteredMentation}
          onCheckedChange={(checked) => update({ ...inputs, alteredMentation: checked })}
        />
      </div>
      <Button className="w-full" disabled={!complete} onClick={() => setResult(calculateQSOFA(inputs))}>
        Calculate qSOFA
      </Button>
      {!complete && <p className="text-xs text-muted-foreground">Enter both numeric fields to calculate.</p>}
      <ScoreDisplay result={result} title="qSOFA Criteria Count" />
    </div>
  );
};

const CURB65Calculator = () => {
  const [inputs, setInputs] = React.useState<CURB65Inputs>({ confusion: false });
  const [result, setResult] = React.useState<RiskScoreResult | null>(null);
  const update = (next: CURB65Inputs) => {
    setInputs(next);
    setResult(null);
  };
  const complete = [inputs.bun, inputs.respiratoryRate, inputs.systolicBP, inputs.diastolicBP, inputs.age]
    .every(isNonNegativeNumber);

  const numericFields: Array<{
    key: keyof Pick<CURB65Inputs, 'bun' | 'respiratoryRate' | 'systolicBP' | 'diastolicBP' | 'age'>;
    label: string;
    placeholder: string;
  }> = [
    { key: 'bun', label: 'BUN (mg/dL)', placeholder: '20' },
    { key: 'respiratoryRate', label: 'Respiratory Rate', placeholder: '30' },
    { key: 'systolicBP', label: 'Systolic BP', placeholder: '90' },
    { key: 'diastolicBP', label: 'Diastolic BP', placeholder: '60' },
    { key: 'age', label: 'Age (years)', placeholder: '65' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
        <div>
          <Label>Confusion</Label>
          <p className="text-xs text-muted-foreground">New disorientation</p>
        </div>
        <Switch
          aria-label="Confusion"
          checked={inputs.confusion}
          onCheckedChange={(checked) => update({ ...inputs, confusion: checked })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {numericFields.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label>{field.label}</Label>
            <Input
              aria-label={`CURB-65 ${field.label}`}
              type="number"
              min={0}
              placeholder={field.placeholder}
              value={inputs[field.key] ?? ''}
              onChange={(event) => update({ ...inputs, [field.key]: parseOptionalNumber(event.target.value) })}
            />
          </div>
        ))}
      </div>
      <Button className="w-full" disabled={!complete} onClick={() => setResult(calculateCURB65(inputs))}>
        Calculate CURB-65
      </Button>
      {!complete && <p className="text-xs text-muted-foreground">Enter all five numeric fields to calculate.</p>}
      <ScoreDisplay result={result} title="CURB-65 Score" />
    </div>
  );
};

const dvtCriteria: Array<{ field: keyof WellsDVTInputs; label: string; points: string }> = [
  { field: 'activeCancer', label: 'Active cancer (treated within 6 months or palliative)', points: '+1' },
  { field: 'paralysisParesis', label: 'Paralysis, paresis, or recent plaster immobilization of a leg', points: '+1' },
  { field: 'recentImmobilization', label: 'Bedridden >3 days or major surgery <12 weeks', points: '+1' },
  { field: 'localizedTenderness', label: 'Tenderness along the deep venous system', points: '+1' },
  { field: 'entireLegSwollen', label: 'Entire leg swollen', points: '+1' },
  { field: 'calfSwelling3cm', label: 'Calf swelling >3 cm', points: '+1' },
  { field: 'pittingEdema', label: 'Pitting edema confined to the symptomatic leg', points: '+1' },
  { field: 'collateralVeins', label: 'Collateral superficial veins (nonvaricose)', points: '+1' },
  { field: 'previousDVT', label: 'Previous documented DVT', points: '+1' },
  { field: 'alternativeDiagnosisLikely', label: 'Alternative diagnosis at least as likely', points: '-2' },
];

const WellsDVTCalculator = () => {
  const [inputs, setInputs] = React.useState<WellsDVTInputs>({});
  const [result, setResult] = React.useState<RiskScoreResult | null>(null);
  const update = (field: keyof WellsDVTInputs, checked: boolean) => {
    setInputs((current) => ({ ...current, [field]: checked }));
    setResult(null);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Review every criterion, then calculate the three-tier Wells DVT score.</p>
      <div className="space-y-2">
        {dvtCriteria.map((criterion) => (
          <div key={criterion.field} className="flex items-center justify-between rounded-lg bg-secondary/30 p-3">
            <span className="pr-3 text-sm">{criterion.label} <span className="font-mono text-xs">({criterion.points})</span></span>
            <Switch
              aria-label={criterion.label}
              checked={inputs[criterion.field] ?? false}
              onCheckedChange={(checked) => update(criterion.field, checked)}
            />
          </div>
        ))}
      </div>
      <Button className="w-full" onClick={() => setResult(calculateWellsDVT(inputs))}>Calculate Wells DVT</Button>
      <ScoreDisplay result={result} title="Wells DVT Score" />
    </div>
  );
};

const peCriteria: Array<{ field: keyof WellsPEInputs; label: string; points: string }> = [
  { field: 'clinicalDVTSigns', label: 'Clinical signs of DVT', points: '+3' },
  { field: 'alternativeDiagnosisLessLikely', label: 'PE is more likely than an alternative diagnosis', points: '+3' },
  { field: 'heartRate100', label: 'Heart rate >100 bpm', points: '+1.5' },
  { field: 'immobilizationOrSurgery', label: 'Immobilization ≥3 days or surgery in past 4 weeks', points: '+1.5' },
  { field: 'previousPEOrDVT', label: 'Previous PE or DVT', points: '+1.5' },
  { field: 'hemoptysis', label: 'Hemoptysis', points: '+1' },
  { field: 'malignancy', label: 'Malignancy (treated within 6 months or palliative)', points: '+1' },
];

const WellsPECalculator = () => {
  const [inputs, setInputs] = React.useState<WellsPEInputs>({});
  const [result, setResult] = React.useState<RiskScoreResult | null>(null);
  const update = (field: keyof WellsPEInputs, checked: boolean) => {
    setInputs((current) => ({ ...current, [field]: checked }));
    setResult(null);
  };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Review every criterion, then calculate the two-tier Wells PE score.</p>
      <div className="space-y-2">
        {peCriteria.map((criterion) => (
          <div key={criterion.field} className="flex items-center justify-between rounded-lg bg-secondary/30 p-3">
            <span className="pr-3 text-sm">{criterion.label} <span className="font-mono text-xs">({criterion.points})</span></span>
            <Switch
              aria-label={criterion.label}
              checked={inputs[criterion.field] ?? false}
              onCheckedChange={(checked) => update(criterion.field, checked)}
            />
          </div>
        ))}
      </div>
      <Button className="w-full" onClick={() => setResult(calculateWellsPE(inputs))}>Calculate Wells PE</Button>
      <ScoreDisplay result={result} title="Wells PE Score" />
    </div>
  );
};

const NEWS2Calculator = () => {
  const [inputs, setInputs] = React.useState<NEWS2Inputs>({ onSupplementalO2: false });
  const [result, setResult] = React.useState<RiskScoreResult | null>(null);
  const update = (next: NEWS2Inputs) => {
    setInputs(next);
    setResult(null);
  };
  const complete = isNonNegativeNumber(inputs.respiratoryRate)
    && isFiniteNumber(inputs.spo2) && inputs.spo2 >= 0 && inputs.spo2 <= 100
    && isFiniteNumber(inputs.temperature) && inputs.temperature > 0
    && isNonNegativeNumber(inputs.systolicBP)
    && isNonNegativeNumber(inputs.heartRate)
    && inputs.consciousness !== undefined;
  const numericFields: Array<{
    key: keyof Pick<NEWS2Inputs, 'respiratoryRate' | 'spo2' | 'temperature' | 'systolicBP' | 'heartRate'>;
    label: string;
    placeholder: string;
    step?: string;
  }> = [
    { key: 'respiratoryRate', label: 'Respiratory Rate', placeholder: '16' },
    { key: 'spo2', label: 'SpO2 (%) — Scale 1', placeholder: '97' },
    { key: 'temperature', label: 'Temperature (°C)', placeholder: '37.0', step: '0.1' },
    { key: 'systolicBP', label: 'Systolic BP', placeholder: '120' },
    { key: 'heartRate', label: 'Heart Rate', placeholder: '80' },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {numericFields.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label>{field.label}</Label>
            <Input
              aria-label={`NEWS2 ${field.label}`}
              type="number"
              min={0}
              step={field.step}
              placeholder={field.placeholder}
              value={inputs[field.key] ?? ''}
              onChange={(event) => update({ ...inputs, [field.key]: parseOptionalNumber(event.target.value) })}
            />
          </div>
        ))}
        <div className="flex items-center gap-2 rounded-lg bg-secondary/50 p-2">
          <Switch
            aria-label="Supplemental oxygen"
            checked={inputs.onSupplementalO2}
            onCheckedChange={(checked) => update({ ...inputs, onSupplementalO2: checked })}
          />
          <Label>On supplemental O2</Label>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Consciousness</Label>
        <div className="flex flex-wrap gap-2">
          {(['alert', 'confusion', 'voice', 'pain', 'unresponsive'] as const).map((level) => (
            <Button
              key={level}
              variant={inputs.consciousness === level ? 'default' : 'outline'}
              size="sm"
              onClick={() => update({ ...inputs, consciousness: level })}
              className="capitalize"
            >
              {level}
            </Button>
          ))}
        </div>
      </div>
      <Button className="w-full" disabled={!complete} onClick={() => setResult(calculateNEWS2(inputs))}>
        Calculate NEWS2
      </Button>
      {!complete && <p className="text-xs text-muted-foreground">Enter all numeric fields and select consciousness to calculate.</p>}
      <ScoreDisplay result={result} title="NEWS2 Score" />
    </div>
  );
};

const SOFACalculator = () => {
  const [inputs, setInputs] = React.useState<SOFAInputs>({ onVentilator: false, dobutamine: false });
  const [result, setResult] = React.useState<RiskScoreResult | null>(null);
  const update = (next: SOFAInputs) => {
    setInputs(next);
    setResult(null);
  };
  const complete = [
    inputs.pao2fio2,
    inputs.platelets,
    inputs.bilirubin,
    inputs.map,
    inputs.dopamine,
    inputs.epinephrine,
    inputs.norepinephrine,
  ].every(isNonNegativeNumber)
    && isFiniteNumber(inputs.gcs) && inputs.gcs >= 3 && inputs.gcs <= 15
    && (isNonNegativeNumber(inputs.creatinine) || isNonNegativeNumber(inputs.urineOutput));

  const fields: Array<{
    key: keyof Pick<SOFAInputs, 'pao2fio2' | 'platelets' | 'bilirubin' | 'map' | 'dopamine' | 'epinephrine' | 'norepinephrine' | 'gcs' | 'creatinine' | 'urineOutput'>;
    label: string;
    placeholder: string;
    step?: string;
  }> = [
    { key: 'pao2fio2', label: 'PaO2/FiO2 ratio', placeholder: '400' },
    { key: 'platelets', label: 'Platelets (×10³/µL)', placeholder: '150' },
    { key: 'bilirubin', label: 'Bilirubin (mg/dL)', placeholder: '1.0', step: '0.1' },
    { key: 'map', label: 'MAP (mmHg)', placeholder: '70' },
    { key: 'dopamine', label: 'Dopamine (mcg/kg/min)', placeholder: '0', step: '0.1' },
    { key: 'epinephrine', label: 'Epinephrine (mcg/kg/min)', placeholder: '0', step: '0.01' },
    { key: 'norepinephrine', label: 'Norepinephrine (mcg/kg/min)', placeholder: '0', step: '0.01' },
    { key: 'gcs', label: 'Glasgow Coma Scale (3–15)', placeholder: '15' },
    { key: 'creatinine', label: 'Creatinine (mg/dL)', placeholder: '1.0', step: '0.1' },
    { key: 'urineOutput', label: 'Urine output (mL/day)', placeholder: '1500' },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Enter all organ-system values. Enter 0 for absent vasoactive infusions; creatinine or 24-hour urine output is required.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((field) => (
          <div key={field.key} className="space-y-2">
            <Label>{field.label}</Label>
            <Input
              aria-label={`SOFA ${field.label}`}
              type="number"
              min={field.key === 'gcs' ? 3 : 0}
              max={field.key === 'gcs' ? 15 : undefined}
              step={field.step}
              placeholder={field.placeholder}
              value={inputs[field.key] as number | undefined ?? ''}
              onChange={(event) => update({ ...inputs, [field.key]: parseOptionalNumber(event.target.value) })}
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
          <Label>Respiratory support</Label>
          <Switch
            aria-label="Respiratory support"
            checked={inputs.onVentilator}
            onCheckedChange={(checked) => update({ ...inputs, onVentilator: checked })}
          />
        </div>
        <div className="flex items-center justify-between rounded-lg bg-secondary/50 p-3">
          <Label>Dobutamine</Label>
          <Switch
            aria-label="Dobutamine"
            checked={inputs.dobutamine}
            onCheckedChange={(checked) => update({ ...inputs, dobutamine: checked })}
          />
        </div>
      </div>
      <Button className="w-full" disabled={!complete} onClick={() => setResult(calculateSOFA(inputs))}>
        Calculate SOFA
      </Button>
      {!complete && <p className="text-xs text-muted-foreground">Complete all required SOFA fields before calculating.</p>}
      <ScoreDisplay result={result} title="SOFA Score" />
    </div>
  );
};

export function ClinicalRiskCalculator({ className }: ClinicalRiskCalculatorProps) {
  const [activeTab, setActiveTab] = React.useState<ScoreTab>('qsofa');

  const tabContent: Record<ScoreTab, { title: string; description: string; calculator: React.ReactNode }> = {
    qsofa: {
      title: 'Quick SOFA',
      description: 'Manual criteria count for adults with suspected infection',
      calculator: <QSOFACalculator />,
    },
    sofa: {
      title: 'SOFA Score',
      description: 'Sequential Organ Failure Assessment',
      calculator: <SOFACalculator />,
    },
    curb65: {
      title: 'CURB-65',
      description: 'Manual pneumonia severity score',
      calculator: <CURB65Calculator />,
    },
    wells_dvt: {
      title: 'Wells Criteria — DVT',
      description: 'Three-tier pretest-probability score',
      calculator: <WellsDVTCalculator />,
    },
    wells_pe: {
      title: 'Wells Criteria — PE',
      description: 'Two-tier pretest-probability score',
      calculator: <WellsPECalculator />,
    },
    news2: {
      title: 'NEWS2',
      description: 'National Early Warning Score 2 — SpO2 Scale 1 only',
      calculator: <NEWS2Calculator />,
    },
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-8 gap-2", className)}>
          <Calculator className="h-4 w-4" />
          <span>Risk Scores</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[420px] overflow-y-auto sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5" />
            Clinical Risk Calculators
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <strong>Manual entry only.</strong> No values are inferred from notes, labs, or patient records. Results are score
          context only and do not estimate individual outcomes or recommend treatment or disposition.
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ScoreTab)} className="mt-4">
          <TabsList className="grid h-auto grid-cols-3 gap-1 p-1 lg:grid-cols-6">
            <TabsTrigger value="qsofa" className="px-2 py-1.5 text-xs">qSOFA</TabsTrigger>
            <TabsTrigger value="sofa" className="px-2 py-1.5 text-xs">SOFA</TabsTrigger>
            <TabsTrigger value="curb65" className="px-2 py-1.5 text-xs">CURB-65</TabsTrigger>
            <TabsTrigger value="wells_dvt" className="px-2 py-1.5 text-xs">Wells DVT</TabsTrigger>
            <TabsTrigger value="wells_pe" className="px-2 py-1.5 text-xs">Wells PE</TabsTrigger>
            <TabsTrigger value="news2" className="px-2 py-1.5 text-xs">NEWS2</TabsTrigger>
          </TabsList>

          {(Object.keys(tabContent) as ScoreTab[]).map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{tabContent[tab].title}</CardTitle>
                  <p className="text-xs text-muted-foreground">{tabContent[tab].description}</p>
                </CardHeader>
                <CardContent>{tabContent[tab].calculator}</CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>

        <div className="mt-6 rounded-lg bg-secondary/30 p-3">
          <p className="text-xs text-muted-foreground">
            Verify the selected score, population, units, and current institutional guidance before clinical use.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default ClinicalRiskCalculator;
