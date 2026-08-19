import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Sparkles,
  Stethoscope,
  ClipboardCheck,
  FileText,
  ListChecks,
  Loader2,
  Brain,
  AlertTriangle,
  CheckCircle2,
  Copy,
  X,
} from 'lucide-react';
import { useAIClinicalAssistant } from '@/hooks/useAIClinicalAssistant';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { AIErrorBoundary } from '@/components/AIErrorBoundary';
import type { Patient } from '@/types/patient';
import type {
  DDxResponse,
  DocumentationCheckResponse,
  SOAPNote,
  AssessmentPlanResponse,
} from '@/lib/openai-config';

interface AIClinicalAssistantProps {
  patient: Patient;
  onUpdatePatient?: (id: string, field: string, value: unknown) => void;
  className?: string;
  compact?: boolean;
}

type DialogType = 'ddx' | 'doc_check' | 'soap' | 'ap' | 'summary' | null;
type AdvancedFeatureKey =
  | 'system_based_rounds'
  | 'date_organizer'
  | 'problem_list'
  | 'icu_boards_explainer'
  | 'interval_events_generator'
  | 'neuro_icu_hpi';

interface AdvancedFeatureConfig {
  key: AdvancedFeatureKey;
  title: string;
  description: string;
  requiresTextInput?: boolean;
  textPlaceholder?: string;
}

const ADVANCED_FEATURES: AdvancedFeatureConfig[] = [
  { key: 'system_based_rounds', title: 'System-Based Rounds', description: 'Neuro ICU template output' },
  { key: 'date_organizer', title: 'Date Organizer', description: 'Chronologic clinical timeline', requiresTextInput: true, textPlaceholder: 'Paste clinical history to organize chronologically...' },
  { key: 'problem_list', title: 'Problem List A&P', description: 'Fellow-style Neuro ICU A&P' },
  { key: 'icu_boards_explainer', title: 'ICU Boards Explainer', description: 'Question breakdown + mnemonic', requiresTextInput: true, textPlaceholder: 'Paste board-style question and options...' },
  { key: 'interval_events_generator', title: 'Interval Events Generator', description: 'DAY/NIGHT structured summary', requiresTextInput: true, textPlaceholder: 'Paste prior day + overnight events with dates...' },
  { key: 'neuro_icu_hpi', title: 'Neuro ICU HPI Generator', description: '3-paragraph admission/consult HPI', requiresTextInput: true, textPlaceholder: 'Paste consult/admission details, timeline, labs, imaging...' },
];

export const AIClinicalAssistant = ({
  patient,
  onUpdatePatient,
  compact = false,
}: AIClinicalAssistantProps) => {
  const { toast } = useToast();
  const {
    isProcessing,
    lastModel,
    processWithAI,
    getDifferentialDiagnosis,
    checkDocumentation,
    formatAsSOAP,
    generateAssessmentPlan,
    generateClinicalSummary,
    cancel,
  } = useAIClinicalAssistant();

  const [dialogType, setDialogType] = React.useState<DialogType>(null);
  const [ddxResult, setDdxResult] = React.useState<DDxResponse | null>(null);
  const [docCheckResult, setDocCheckResult] = React.useState<DocumentationCheckResponse | null>(null);
  const [soapResult, setSoapResult] = React.useState<SOAPNote | null>(null);
  const [apResult, setApResult] = React.useState<AssessmentPlanResponse | null>(null);
  const [summaryResult, setSummaryResult] = React.useState<string | null>(null);
  const [advancedTitle, setAdvancedTitle] = React.useState<string | null>(null);
  const [advancedResult, setAdvancedResult] = React.useState<string | null>(null);
  const [activeAdvancedFeature, setActiveAdvancedFeature] = React.useState<AdvancedFeatureConfig | null>(null);
  const [advancedInput, setAdvancedInput] = React.useState('');

  const handleDifferentialDiagnosis = React.useCallback(async () => {
    const result = await getDifferentialDiagnosis(patient);
    if (result) {
      setDdxResult(result);
      setDialogType('ddx');
    }
  }, [getDifferentialDiagnosis, patient]);

  const handleDocumentationCheck = React.useCallback(async () => {
    const result = await checkDocumentation(patient);
    if (result) {
      setDocCheckResult(result);
      setDialogType('doc_check');
    }
  }, [checkDocumentation, patient]);

  const handleSOAPFormat = React.useCallback(async () => {
    const result = await formatAsSOAP(patient);
    if (result) {
      setSoapResult(result);
      setDialogType('soap');
    }
  }, [formatAsSOAP, patient]);

  const handleAssessmentPlan = React.useCallback(async () => {
    const result = await generateAssessmentPlan(patient);
    if (result) {
      setApResult(result);
      setDialogType('ap');
    }
  }, [generateAssessmentPlan, patient]);

  const handleClinicalSummary = React.useCallback(async () => {
    const result = await generateClinicalSummary(patient);
    if (result) {
      setSummaryResult(result);
      setDialogType('summary');
    }
  }, [generateClinicalSummary, patient]);

  const runAdvancedGenerator = React.useCallback(async (
    feature: AdvancedFeatureKey,
    title: string,
    textInput?: string,
  ) => {
    const result = await processWithAI<string>(feature, { patient, text: textInput?.trim() || undefined });
    if (result) {
      setAdvancedTitle(title);
      setAdvancedResult(result);
      setDialogType('summary');
    }
  }, [patient, processWithAI]);

  const handleAdvancedFeatureClick = React.useCallback((feature: AdvancedFeatureConfig) => {
    if (feature.requiresTextInput) {
      setActiveAdvancedFeature(feature);
      setAdvancedInput('');
      return;
    }

    void runAdvancedGenerator(feature.key, feature.title);
  }, [runAdvancedGenerator]);

  const handleAdvancedSubmit = React.useCallback(async () => {
    if (!activeAdvancedFeature) return;

    await runAdvancedGenerator(activeAdvancedFeature.key, activeAdvancedFeature.title, advancedInput);
    setActiveAdvancedFeature(null);
    setAdvancedInput('');
  }, [activeAdvancedFeature, advancedInput, runAdvancedGenerator]);

  const closeDialog = React.useCallback(() => {
    setDialogType(null);
    setAdvancedTitle(null);
    setAdvancedResult(null);
    setActiveAdvancedFeature(null);
    setAdvancedInput('');
  }, []);

  const copyToClipboard = React.useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: 'Copied to clipboard',
      description: 'Content has been copied',
    });
  }, [toast]);

  const insertIntoField = React.useCallback((field: string, content: string) => {
    if (!onUpdatePatient) return;

    const currentValue = patient[field as keyof Patient] as string || '';
    const newValue = currentValue
      ? `${currentValue}\n\n---\n${content}`
      : content;

    onUpdatePatient(patient.id, field, newValue);
    closeDialog();
    toast({
      title: 'Inserted',
      description: `Content added to ${field}`,
    });
  }, [onUpdatePatient, patient, closeDialog, toast]);

  const renderResponseBadges = () => (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="secondary">AI-generated</Badge>
      <Badge variant="outline">Scope: Selected patient</Badge>
      <Badge variant="outline">Model: {lastModel || 'Unknown'}</Badge>
    </div>
  );

  // Render differential diagnosis result
  const renderDDxDialog = () => {
    if (!ddxResult) return null;

    return (
      <Dialog open={dialogType === 'ddx'} onOpenChange={() => closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="h-5 w-5" />
              Differential Diagnosis
            </DialogTitle>
            <DialogDescription>
              AI-generated differential diagnosis based on available clinical data.
            </DialogDescription>
            {renderResponseBadges()}
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <AIErrorBoundary featureLabel="Differential Diagnosis">
              <div className="space-y-4 pr-4">
                {/* Most Likely */}
                <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="font-medium text-green-800 dark:text-green-200 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Most Likely: {ddxResult.mostLikely}
                  </div>
                </div>

                {/* Critical to Rule Out */}
                {ddxResult.criticalToRuleOut?.length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="font-medium text-red-800 dark:text-red-200 flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-4 w-4" />
                      Critical to Rule Out
                    </div>
                    <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300">
                      {ddxResult.criticalToRuleOut.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Differentials */}
                <div className="space-y-3">
                  <h4 className="font-medium">Differential Diagnoses</h4>
                  {ddxResult.differentials?.map((dx, i) => (
                    <div key={i} className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{dx.diagnosis}</span>
                        <Badge
                          variant={
                            dx.likelihood === 'high' ? 'default' :
                            dx.likelihood === 'moderate' ? 'secondary' : 'outline'
                          }
                        >
                          {dx.likelihood}
                        </Badge>
                      </div>
                      {dx.supportingFindings?.length > 0 && (
                        <div className="text-sm text-muted-foreground mb-2">
                          <span className="font-medium">Supporting: </span>
                          {dx.supportingFindings.join(', ')}
                        </div>
                      )}
                      {dx.workupNeeded?.length > 0 && (
                        <div className="text-sm">
                          <span className="font-medium">Workup: </span>
                          {dx.workupNeeded.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Suggested Workup */}
                {ddxResult.suggestedWorkup?.length > 0 && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                    <div className="font-medium text-blue-800 dark:text-blue-200 mb-2">
                      Suggested Workup
                    </div>
                    <ul className="list-disc list-inside text-sm text-blue-700 dark:text-blue-300">
                      {ddxResult.suggestedWorkup.map((item, i) => (
                        <li key={i}>{item}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </AIErrorBoundary>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Close
            </Button>
            <Button
              variant="secondary"
              onClick={() => copyToClipboard(JSON.stringify(ddxResult, null, 2))}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // Render documentation check result
  const renderDocCheckDialog = () => {
    if (!docCheckResult) return null;

    const scoreColor =
      docCheckResult.overallScore >= 80 ? 'text-green-600' :
      docCheckResult.overallScore >= 60 ? 'text-yellow-600' : 'text-red-600';

    return (
      <Dialog open={dialogType === 'doc_check'} onOpenChange={() => closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Documentation Quality Check
            </DialogTitle>
            <DialogDescription>
              Structured review of documentation completeness and strengths for the current patient.
            </DialogDescription>
          </DialogHeader>
          {renderResponseBadges()}
          <ScrollArea className="max-h-[60vh]">
            <AIErrorBoundary featureLabel="Documentation Check">
              <div className="space-y-4 pr-4">
                {/* Score */}
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Overall Score</span>
                    <span className={`text-2xl font-bold ${scoreColor}`}>
                      {docCheckResult.overallScore}/100
                    </span>
                  </div>
                  <Progress value={docCheckResult.overallScore} className="h-2" />
                </div>

                {/* Gaps */}
                {docCheckResult.gaps?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium">Documentation Gaps</h4>
                    {docCheckResult.gaps.map((gap, i) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg border ${
                          gap.priority === 'critical' ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800' :
                          gap.priority === 'important' ? 'bg-yellow-50 dark:bg-yellow-950 border-yellow-200 dark:border-yellow-800' :
                          'bg-muted'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{gap.section}</span>
                          <Badge
                            variant={
                              gap.priority === 'critical' ? 'destructive' :
                              gap.priority === 'important' ? 'default' : 'secondary'
                            }
                          >
                            {gap.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{gap.issue}</p>
                        <p className="text-sm mt-1"><span className="font-medium">Suggestion:</span> {gap.suggestion}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Strengths */}
                {docCheckResult.strengths?.length > 0 && (
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                    <h4 className="font-medium text-green-800 dark:text-green-200 mb-2">Strengths</h4>
                    <ul className="list-disc list-inside text-sm text-green-700 dark:text-green-300">
                      {docCheckResult.strengths.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}

                {/* Suggestions */}
                {docCheckResult.suggestions?.length > 0 && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <h4 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Suggestions</h4>
                    <ul className="list-disc list-inside text-sm text-blue-700 dark:text-blue-300">
                      {docCheckResult.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </AIErrorBoundary>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // Render SOAP format result
  const renderSOAPDialog = () => {
    if (!soapResult) return null;

    const formatSOAPText = () => {
      return `SUBJECTIVE:\n${soapResult.subjective}\n\nOBJECTIVE:\n${soapResult.objective}\n\nASSESSMENT:\n${soapResult.assessment}\n\nPLAN:\n${soapResult.plan}`;
    };

    return (
      <Dialog open={dialogType === 'soap'} onOpenChange={() => closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              SOAP Note Format
            </DialogTitle>
            <DialogDescription>
              AI-generated SOAP note organized into Subjective, Objective, Assessment, and Plan sections.
            </DialogDescription>
          </DialogHeader>
          {renderResponseBadges()}
          <ScrollArea className="max-h-[60vh]">
            <AIErrorBoundary featureLabel="SOAP Note">
              <div className="space-y-4 pr-4">
                {['subjective', 'objective', 'assessment', 'plan'].map((section) => (
                  <div key={section} className="p-3 bg-muted rounded-lg">
                    <h4 className="font-medium uppercase text-sm text-muted-foreground mb-2">
                      {section}
                    </h4>
                    <p className="text-sm whitespace-pre-wrap">
                      {soapResult[section as keyof SOAPNote]}
                    </p>
                  </div>
                ))}
              </div>
            </AIErrorBoundary>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Close
            </Button>
            <Button variant="secondary" onClick={() => copyToClipboard(formatSOAPText())}>
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
            {onUpdatePatient && (
              <Button onClick={() => insertIntoField('clinicalSummary', formatSOAPText())}>
                Insert into Summary
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // Render Assessment & Plan result
  const renderAPDialog = () => {
    if (!apResult) return null;

    const formatAPText = () => {
      let text = `ASSESSMENT:\n${apResult.overallAssessment}\n\nPLAN:\n`;
      apResult.problems?.forEach((p, i) => {
        text += `\n${i + 1}. ${p.problem}\n`;
        text += `   Assessment: ${p.assessment}\n`;
        text += `   Plan:\n`;
        p.plan?.forEach((item) => {
          text += `   - ${item}\n`;
        });
      });
      return text;
    };

    return (
      <Dialog open={dialogType === 'ap'} onOpenChange={() => closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="h-5 w-5" />
              Assessment & Plan
            </DialogTitle>
            <DialogDescription>
              Problem-based assessment and plan synthesized from the current patient&apos;s data.
            </DialogDescription>
          </DialogHeader>
          {renderResponseBadges()}
          <ScrollArea className="max-h-[60vh]">
            <AIErrorBoundary featureLabel="Assessment & Plan">
              <div className="space-y-4 pr-4">
                {/* Overall Assessment */}
                <div className="p-3 bg-muted rounded-lg">
                  <h4 className="font-medium mb-2">Overall Assessment</h4>
                  <p className="text-sm">{apResult.overallAssessment}</p>
                </div>

                {/* Problems */}
                <div className="space-y-3">
                  <h4 className="font-medium">Problem-Based Plan</h4>
                  {apResult.problems?.map((problem, i) => (
                    <div key={i} className="p-3 border rounded-lg">
                      <div className="font-medium text-primary mb-2">
                        {i + 1}. {problem.problem}
                      </div>
                      <div className="text-sm text-muted-foreground mb-2">
                        {problem.assessment}
                      </div>
                      <ul className="list-disc list-inside text-sm space-y-1">
                        {problem.plan?.map((item, j) => (
                          <li key={j}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </AIErrorBoundary>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Close
            </Button>
            <Button variant="secondary" onClick={() => copyToClipboard(formatAPText())}>
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
            {onUpdatePatient && (
              <Button onClick={() => insertIntoField('clinicalSummary', formatAPText())}>
                Insert into Summary
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // Render Summary result
  const renderSummaryDialog = () => {
    const displayText = advancedResult ?? summaryResult;
    if (!displayText) return null;

    return (
      <Dialog open={dialogType === 'summary'} onOpenChange={() => closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              {advancedTitle || 'AI Clinical Summary'}
            </DialogTitle>
            <DialogDescription>
              Generated narrative output for the selected AI feature and patient context.
            </DialogDescription>
          </DialogHeader>
          {renderResponseBadges()}
          <ScrollArea className="max-h-[60vh]">
            <AIErrorBoundary featureLabel="Clinical Summary">
              <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm">
                {displayText}
              </div>
            </AIErrorBoundary>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              Close
            </Button>
            <Button variant="secondary" onClick={() => copyToClipboard(displayText)}>
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </Button>
            {onUpdatePatient && (
              <Button onClick={() => insertIntoField('clinicalSummary', displayText)}>
                Insert into Summary
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={compact ? 'ghost' : 'outline'}
            size="sm"
            disabled={isProcessing}
            className={compact ? 'h-7 px-2 text-xs' : ''}
            aria-busy={isProcessing || undefined}
            aria-label={isProcessing ? "Clinical AI assistant busy" : "Clinical AI assistant"}
            title="Clinical AI: differentials, documentation checks, SOAP, and summaries"
          >
            {isProcessing ? (
              <Loader2 className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} animate-spin mr-1`} aria-hidden="true" />
            ) : (
              <Brain className={`${compact ? 'h-3 w-3' : 'h-4 w-4'} mr-1`} aria-hidden="true" />
            )}
            {compact ? 'AI Assist' : 'AI Clinical Assistant'}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Clinical AI Tools (GPT-4)</DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleDifferentialDiagnosis} disabled={isProcessing}>
            <Stethoscope className="h-4 w-4 mr-2" />
            <div className="flex flex-col">
              <span>Differential Diagnosis</span>
              <span className="text-xs text-muted-foreground">Generate DDx from patient data</span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleDocumentationCheck} disabled={isProcessing}>
            <ClipboardCheck className="h-4 w-4 mr-2" />
            <div className="flex flex-col">
              <span>Documentation Check</span>
              <span className="text-xs text-muted-foreground">Review completeness & quality</span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onClick={handleSOAPFormat} disabled={isProcessing}>
            <FileText className="h-4 w-4 mr-2" />
            <div className="flex flex-col">
              <span>Format as SOAP</span>
              <span className="text-xs text-muted-foreground">Convert to SOAP note format</span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleAssessmentPlan} disabled={isProcessing}>
            <ListChecks className="h-4 w-4 mr-2" />
            <div className="flex flex-col">
              <span>Assessment & Plan</span>
              <span className="text-xs text-muted-foreground">Generate problem-based A&P</span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem onClick={handleClinicalSummary} disabled={isProcessing}>
            <Sparkles className="h-4 w-4 mr-2" />
            <div className="flex flex-col">
              <span>Clinical Summary</span>
              <span className="text-xs text-muted-foreground">Generate comprehensive summary</span>
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          {ADVANCED_FEATURES.map((feature) => (
            <DropdownMenuItem key={feature.key} onClick={() => handleAdvancedFeatureClick(feature)} disabled={isProcessing}>
              <Sparkles className="h-4 w-4 mr-2" />
              <div className="flex flex-col">
                <span>{feature.title}</span>
                <span className="text-xs text-muted-foreground">
                  {feature.description}{feature.requiresTextInput ? ' • accepts pasted text' : ''}
                </span>
              </div>
            </DropdownMenuItem>
          ))}

          {isProcessing && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={cancel} className="text-destructive">
                <X className="h-4 w-4 mr-2" />
                Cancel
              </DropdownMenuItem>
              <div role="status" aria-live="polite" aria-busy="true" className="px-2 py-1.5 text-xs text-muted-foreground">
                Clinical AI is working…
              </div>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>


      <Dialog open={!!activeAdvancedFeature} onOpenChange={(open) => { if (!open) { setActiveAdvancedFeature(null); setAdvancedInput(''); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{activeAdvancedFeature?.title}</DialogTitle>
            <DialogDescription>
              Paste optional source text to guide generation. Patient context will also be included automatically.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={advancedInput}
            onChange={(e) => setAdvancedInput(e.target.value)}
            placeholder={activeAdvancedFeature?.textPlaceholder || 'Paste source text...'}
            className="min-h-40"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActiveAdvancedFeature(null); setAdvancedInput(''); }}>Cancel</Button>
            <Button onClick={() => void handleAdvancedSubmit()} disabled={isProcessing}>Run</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Result Dialogs */}
      {renderDDxDialog()}
      {renderDocCheckDialog()}
      {renderSOAPDialog()}
      {renderAPDialog()}
      {renderSummaryDialog()}
    </>
  );
};
