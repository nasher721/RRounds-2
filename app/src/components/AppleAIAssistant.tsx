import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { animate, stagger } from 'animejs';
import { durations, ease, staggers } from '@/lib/anime-presets';
import { useMotionPreference } from '@/hooks/useReducedMotion';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Sparkles, Stethoscope, ClipboardCheck, FileText, ListChecks, Loader2,
  Brain, AlertTriangle, CheckCircle2, Copy, X, Calendar, ClipboardList, Undo2,
  Zap, Activity, Clock, UserPlus, GraduationCap, MessageSquarePlus, Trash2, Plus,
  List
} from 'lucide-react';

import { AIErrorBoundary } from '@/components/AIErrorBoundary';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Hooks
import { useAIClinicalAssistant } from '@/hooks/useAIClinicalAssistant';
import { useIntervalEventsGenerator } from '@/hooks/useIntervalEventsGenerator';
import { usePatientCourseGenerator } from '@/hooks/usePatientCourseGenerator';
import { useTextTransform, TransformType, CustomPrompt } from '@/hooks/useTextTransform';
import { useWritingStyleProfile } from '@/hooks/useWritingStyleProfile';

// Types
import type { Patient } from '@/types/patient';
import type { DDxResponse, DocumentationCheckResponse, SOAPNote, AssessmentPlanResponse } from '@/lib/openai-config';

// Prompts
import {
  SYSTEM_BASED_ROUNDS_PROMPT, DATE_ORGANIZER_PROMPT, PROBLEM_LIST_PROMPT,
  ICU_BOARDS_QUESTIONS_PROMPT, INTERVAL_EVENTS_PROMPT, NEURO_ICU_HPI_PROMPT,
} from '@/data/baselinePrompts';

// Interfaces
interface AppleAIAssistantProps {
  // Context
  patient?: Patient;
  onUpdatePatient?: (id: string, field: string, value: unknown) => void;
  getSelectedText?: () => string | null;
  replaceSelectedText?: (newText: string) => void;
  
  // UI Props
  disabled?: boolean;
  className?: string;
  compact?: boolean;
}

type DialogType = 'ddx' | 'doc_check' | 'soap' | 'ap' | 'summary' | 'course' | 'custom_prompt' | 'save_prompt' | 'advanced_input' | null;

type AdvancedFeatureKey =
  | 'system_based_rounds' | 'date_organizer' | 'problem_list'
  | 'icu_boards_explainer' | 'interval_events_generator' | 'neuro_icu_hpi';

interface AdvancedFeatureConfig {
  key: AdvancedFeatureKey;
  title: string;
  description: string;
  requiresTextInput?: boolean;
  textPlaceholder?: string;
}

const ADVANCED_FEATURES: AdvancedFeatureConfig[] = [
  { key: 'system_based_rounds', title: 'System-Based Rounds', description: 'Neuro ICU template output' },
  { key: 'problem_list', title: 'Problem List A&P', description: 'Fellow-style Neuro ICU A&P' },
  { key: 'interval_events_generator', title: 'Interval Events Generator', description: 'DAY/NIGHT structured summary', requiresTextInput: true, textPlaceholder: 'Paste prior day + overnight events with dates...' },
  { key: 'neuro_icu_hpi', title: 'Neuro ICU HPI Generator', description: '3-paragraph admission/consult HPI', requiresTextInput: true, textPlaceholder: 'Paste consult/admission details, timeline, labs, imaging...' },
  { key: 'date_organizer', title: 'Date Organizer', description: 'Chronologic clinical timeline', requiresTextInput: true, textPlaceholder: 'Paste clinical history to organize chronologically...' },
  { key: 'icu_boards_explainer', title: 'ICU Boards Explainer', description: 'Question breakdown + mnemonic', requiresTextInput: true, textPlaceholder: 'Paste board-style question and options...' },
];

export const AppleAIAssistant = ({
  patient,
  onUpdatePatient,
  getSelectedText,
  replaceSelectedText,
  disabled,
  className,
  compact
}: AppleAIAssistantProps) => {
  const { toast } = useToast();
  
  // State
  const [isOpen, setIsOpen] = React.useState(false);
  const [dialogType, setDialogType] = React.useState<DialogType>(null);
  const [activeCategory, setActiveCategory] = React.useState<'all' | 'clinical' | 'write' | 'neuro'>('all');
  
  // Dialog Results State
  const [ddxResult, setDdxResult] = React.useState<DDxResponse | null>(null);
  const [docCheckResult, setDocCheckResult] = React.useState<DocumentationCheckResponse | null>(null);
  const [soapResult, setSoapResult] = React.useState<SOAPNote | null>(null);
  const [apResult, setApResult] = React.useState<AssessmentPlanResponse | null>(null);
  const [summaryResult, setSummaryResult] = React.useState<string | null>(null);
  const [generatedCourse, setGeneratedCourse] = React.useState<string | null>(null);
  
  // Advanced Generator State
  const [advancedTitle, setAdvancedTitle] = React.useState<string | null>(null);
  const [advancedResult, setAdvancedResult] = React.useState<string | null>(null);
  const [activeAdvancedFeature, setActiveAdvancedFeature] = React.useState<AdvancedFeatureConfig | null>(null);
  const [advancedInput, setAdvancedInput] = React.useState('');
  
  // Custom Prompt State
  const [customPromptText, setCustomPromptText] = React.useState('');
  const [newPromptName, setNewPromptName] = React.useState('');
  const [newPromptText, setNewPromptText] = React.useState('');

  // History for generators
  const [history, setHistory] = React.useState<{field: string, previousValue: string, timestamp: Date}[]>([]);

  // Hooks
  const clinicalAi = useAIClinicalAssistant();
  const eventsGen = useIntervalEventsGenerator();
  const courseGen = usePatientCourseGenerator();
  const textTools = useTextTransform();
  const writingStyle = useWritingStyleProfile();

  const isProcessing = clinicalAi.isProcessing || eventsGen.isGenerating || courseGen.isGenerating || textTools.isTransforming;

  const { prefersReducedMotion } = useMotionPreference();
  const popoverBodyRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!isOpen) return;

    const timer = requestAnimationFrame(() => {
      const el = popoverBodyRef.current;
      if (!el) return;

      const sections = el.querySelectorAll<HTMLElement>(':scope > *');
      if (!sections.length) return;

      if (prefersReducedMotion) {
        sections.forEach(s => { s.style.opacity = '1'; });
        return;
      }

      sections.forEach(s => { s.style.opacity = '0'; s.style.transform = 'translateY(10px)'; });

      animate(sections, {
        opacity: [0, 1],
        translateY: [10, 0],
        delay: stagger(staggers.tight),
        duration: durations.normal,
        ease: ease.out,
      });
    });

    return () => cancelAnimationFrame(timer);
  }, [isOpen, prefersReducedMotion]);

  // Utilities
  const closeDialogs = () => {
    setDialogType(null);
    setAdvancedTitle(null);
    setAdvancedResult(null);
    setActiveAdvancedFeature(null);
    setAdvancedInput('');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ description: 'Copied to clipboard' });
  };

  const insertIntoField = (field: string, content: string) => {
    if (!onUpdatePatient || !patient) return;
    const currentValue = patient[field as keyof Patient] as string || '';
    const newValue = currentValue ? `${currentValue}\n\n---\n${content}` : content;
    onUpdatePatient(patient.id, field, newValue);
    closeDialogs();
    toast({ description: `Content added to ${field}` });
  };

  const addToHistory = React.useCallback((field: string, previousValue: string) => {
    setHistory(prev => [
      { field, previousValue, timestamp: new Date() },
      ...prev.slice(0, 9),
    ]);
  }, []);

  const handleUndo = React.useCallback(() => {
    if (history.length === 0 || !patient || !onUpdatePatient) return;
    const [lastEntry, ...rest] = history;
    onUpdatePatient(patient.id, lastEntry.field, lastEntry.previousValue);
    setHistory(rest);
    toast({ description: 'Undid last AI change' });
  }, [history, onUpdatePatient, patient, toast]);

  // Actions - Clinical
  const handleDDX = async () => {
    if (!patient) return;
    const res = await clinicalAi.getDifferentialDiagnosis(patient);
    if (res) { setDdxResult(res); setDialogType('ddx'); setIsOpen(false); }
  };
  const handleDocCheck = async () => {
    if (!patient) return;
    const res = await clinicalAi.checkDocumentation(patient);
    if (res) { setDocCheckResult(res); setDialogType('doc_check'); setIsOpen(false); }
  };
  const handleSOAP = async () => {
    if (!patient) return;
    const res = await clinicalAi.formatAsSOAP(patient);
    if (res) { setSoapResult(res); setDialogType('soap'); setIsOpen(false); }
  };
  const handleAP = async () => {
    if (!patient) return;
    const res = await clinicalAi.generateAssessmentPlan(patient);
    if (res) { setApResult(res); setDialogType('ap'); setIsOpen(false); }
  };
  const handleSummary = async () => {
    if (!patient) return;
    const res = await clinicalAi.generateClinicalSummary(patient);
    if (res) { 
      // Reuse summary dialog
      setSummaryResult(res); setAdvancedResult(null); setAdvancedTitle('Clinical Summary');
      setDialogType('summary'); setIsOpen(false); 
    }
  };

  // Actions - Generators
  const handleGenEvents = async () => {
    if (!patient || !onUpdatePatient) return;
    addToHistory('intervalEvents', patient.intervalEvents);
    const result = await eventsGen.generateIntervalEvents(patient.systems, patient.intervalEvents, patient.name);
    if (result) {
      const newValue = patient.intervalEvents ? `${patient.intervalEvents}\n\n${result}` : result;
      onUpdatePatient(patient.id, 'intervalEvents', newValue);
      setIsOpen(false);
    }
  };
  const handleGenCourse = async () => {
    if (!patient) return;
    const result = await courseGen.generatePatientCourse(patient);
    if (result) {
      setGeneratedCourse(result); setDialogType('course'); setIsOpen(false);
    }
  };

  // Actions - Text
  const handleTransform = async (type: TransformType, customPrompt?: string) => {
    if (!getSelectedText || !replaceSelectedText) return;
    const text = getSelectedText();
    if (!text) { toast({ variant: 'destructive', description: 'Please select text first' }); return; }
    
    // Support using baseline prompts as custom prompts if passed
    const combinedPrompt = customPrompt ? `${writingStyle.stylePrompt}\n\n${customPrompt}` : writingStyle.stylePrompt;
    const result = await textTools.transformText(text, type, combinedPrompt);
    if (result) {
      replaceSelectedText(result.text);
      writingStyle.updateFromSample(result.text);
      setIsOpen(false); closeDialogs();
      toast({ description: 'Text transformed' });
    }
  };

  const handleSmartExpand = async () => {
    if (!getSelectedText || !replaceSelectedText) return;
    const text = getSelectedText();
    if (!text) return toast({ variant: 'destructive', description: 'Select text first' });
    const result = await clinicalAi.smartExpand(text);
    if (result) { replaceSelectedText(result); writingStyle.updateFromSample(result); setIsOpen(false); }
  };

  const handleMedicalCorrection = async () => {
    if (!getSelectedText || !replaceSelectedText) return;
    const text = getSelectedText();
    if (!text) return toast({ variant: 'destructive', description: 'Select text first' });
    const result = await clinicalAi.correctMedicalText(text);
    if (result) { replaceSelectedText(result); writingStyle.updateFromSample(result); setIsOpen(false); }
  };

  // Actions - Advanced (Neuro/Custom)
  const runAdvancedGenerator = async (feature: AdvancedFeatureKey, title: string, textInput?: string) => {
    if (!patient) return;
    const result = await clinicalAi.processWithAI<string>(feature, { patient, text: textInput?.trim() || undefined });
    if (result) {
      setAdvancedTitle(title);
      setAdvancedResult(result);
      setSummaryResult(null); // Clear normal summary
      setDialogType('summary');
      setIsOpen(false);
    }
  };

  const handleAdvancedClick = (feature: AdvancedFeatureConfig) => {
    if (feature.requiresTextInput) {
      setActiveAdvancedFeature(feature);
      setAdvancedInput('');
      setDialogType('advanced_input');
      setIsOpen(false);
    } else {
      void runAdvancedGenerator(feature.key, feature.title);
    }
  };

  // Cancellation
  const handleCancelAll = () => {
    clinicalAi.cancel();
    eventsGen.cancelGeneration();
    courseGen.cancelGeneration();
  };

  // --------------
  // RENDER DIALOGS
  // --------------
  const renderBadges = () => (
    <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground mt-2">
      <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
        <Sparkles className="h-3 w-3 mr-1" /> Apple Intelligence
      </Badge>
      <Badge variant="outline">Model: {clinicalAi.lastModel || 'Unknown'}</Badge>
    </div>
  );

  const renderDDxDialog = () => {
    if (!ddxResult) return null;
    return (
      <Dialog open={dialogType === 'ddx'} onOpenChange={closeDialogs}>
        <DialogContent className="max-w-2xl max-h-[85vh] border-primary/20 bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-medium tracking-tight">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full text-white shadow-inner">
                <Stethoscope className="h-5 w-5" />
              </div>
              Differential Diagnosis
            </DialogTitle>
            <DialogDescription>
              Review AI-generated differentials, critical rule-outs, and suggested workup.
            </DialogDescription>
            {renderBadges()}
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <AIErrorBoundary featureLabel="Differential Diagnosis">
              <div className="space-y-4 pr-4">
                <div className="p-4 bg-green-50/50 dark:bg-green-950/20 rounded-2xl border border-green-200/50 dark:border-green-800/50">
                  <div className="font-semibold text-green-800 dark:text-green-200 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5" /> Most Likely: {ddxResult.mostLikely}
                  </div>
                </div>
                {ddxResult.criticalToRuleOut?.length > 0 && (
                  <div className="p-4 bg-red-50/50 dark:bg-red-950/20 rounded-2xl border border-red-200/50 dark:border-red-800/50">
                    <div className="font-semibold text-red-800 dark:text-red-200 flex items-center gap-2 mb-2">
                      <AlertTriangle className="h-5 w-5" /> Critical to Rule Out
                    </div>
                    <ul className="list-disc list-inside text-sm text-red-700/80 dark:text-red-300">
                      {ddxResult.criticalToRuleOut.map((item, i) => <li key={i}>{item}</li>)}
                    </ul>
                  </div>
                )}
                {ddxResult.differentials?.map((dx, i) => (
                  <div key={i} className="p-4 bg-muted/40 rounded-2xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">{dx.diagnosis}</span>
                      <Badge variant={dx.likelihood === 'high' ? 'default' : dx.likelihood === 'moderate' ? 'secondary' : 'outline'}>{dx.likelihood}</Badge>
                    </div>
                    {dx.supportingFindings?.length > 0 && <div className="text-sm text-muted-foreground mb-1"><span className="font-medium text-foreground">Supporting: </span>{dx.supportingFindings.join(', ')}</div>}
                    {dx.workupNeeded?.length > 0 && <div className="text-sm"><span className="font-medium">Workup: </span>{dx.workupNeeded.join(', ')}</div>}
                  </div>
                ))}
              </div>
            </AIErrorBoundary>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    );
  };
  
  // Create a unified dialog for text output (Summary, Course, SOAP, AP, etc.)
  const renderTextOutputDialog = () => {
    let title = "", icon = null, content = "";
    if (dialogType === 'summary') {
      title = advancedTitle || 'Clinical Summary';
      icon = <Brain className="h-5 w-5" />;
      content = advancedResult ?? summaryResult ?? '';
    } else if (dialogType === 'course') {
      title = 'Patient Course';
      icon = <Calendar className="h-5 w-5" />;
      content = generatedCourse ?? '';
    } else if (dialogType === 'soap' && soapResult) {
      title = 'SOAP Note';
      icon = <FileText className="h-5 w-5" />;
      content = `SUBJECTIVE:\n${soapResult.subjective}\n\nOBJECTIVE:\n${soapResult.objective}\n\nASSESSMENT:\n${soapResult.assessment}\n\nPLAN:\n${soapResult.plan}`;
    } else if (dialogType === 'ap' && apResult) {
      title = 'Assessment & Plan';
      icon = <ListChecks className="h-5 w-5" />;
      content = `ASSESSMENT:\n${apResult.overallAssessment}\n\nPLAN:\n` + apResult.problems.map((p, i) => `\n${i + 1}. ${p.problem}\n   Assessment: ${p.assessment}\n   Plan:\n${p.plan.map(item => `   - ${item}`).join('\n')}`).join('');
    } else {
      return null;
    }

    return (
      <Dialog open={!!dialogType && ['summary', 'course', 'soap', 'ap'].includes(dialogType)} onOpenChange={closeDialogs}>
        <DialogContent className="max-w-2xl max-h-[85vh] border-primary/20 bg-background/95 backdrop-blur-xl shadow-2xl overflow-hidden rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-xl font-medium tracking-tight">
              <div className="p-2 bg-gradient-to-br from-indigo-500 to-primary rounded-full text-white shadow-inner">
                {icon}
              </div>
              {title}
            </DialogTitle>
            <DialogDescription>
              Review the generated clinical text, then copy or insert it into the chart.
            </DialogDescription>
            {renderBadges()}
          </DialogHeader>
          <ScrollArea className="max-h-[55vh] p-4 bg-muted/30 rounded-2xl border border-border/50">
            <AIErrorBoundary featureLabel={title}>
              <div className="whitespace-pre-wrap text-[15px] leading-relaxed font-medium text-foreground/90 font-mono">
                {content}
              </div>
            </AIErrorBoundary>
          </ScrollArea>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={closeDialogs} className="rounded-full">Close</Button>
            <Button variant="secondary" onClick={() => copyToClipboard(content)} className="rounded-full shadow-sm"><Copy className="h-4 w-4 mr-2" />Copy</Button>
            {(onUpdatePatient && patient) && (
              <Button onClick={() => insertIntoField('clinicalSummary', content)} className="rounded-full bg-gradient-to-r from-primary to-indigo-600 shadow-md">
                Insert into Summary
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  const renderCustomPromptDialogs = () => (
    <>
      <Dialog open={dialogType === 'custom_prompt'} onOpenChange={closeDialogs}>
        <DialogContent className="sm:max-w-md rounded-3xl bg-background/95 backdrop-blur-xl border-primary/20">
          <DialogHeader>
            <DialogTitle className="text-xl font-medium flex items-center gap-2"><MessageSquarePlus className="h-5 w-5 text-primary"/> Custom Instruction</DialogTitle>
            <DialogDescription>
              Enter a custom instruction to transform the selected clinical text.
            </DialogDescription>
          </DialogHeader>
          <Textarea placeholder="e.g., 'Summarize in 2 sentences' or 'Make it sound more professional'" value={customPromptText} onChange={(e) => setCustomPromptText(e.target.value)} className="min-h-[120px] resize-none bg-muted/40 rounded-2xl border-border/50 focus-visible:ring-primary/30" autoFocus />
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialogs} className="rounded-full">Cancel</Button>
            <Button className="rounded-full bg-gradient-to-r from-primary to-indigo-600" onClick={() => handleTransform('custom', customPromptText)} disabled={isProcessing || !customPromptText.trim()}><Sparkles className="h-4 w-4 mr-2"/> Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogType === 'advanced_input'} onOpenChange={closeDialogs}>
        <DialogContent className="sm:max-w-xl rounded-3xl bg-background/95 backdrop-blur-xl border-primary/20">
          <DialogHeader><DialogTitle className="text-xl font-medium">{activeAdvancedFeature?.title}</DialogTitle><DialogDescription>Provide additional context for the generation.</DialogDescription></DialogHeader>
          <Textarea placeholder={activeAdvancedFeature?.textPlaceholder} value={advancedInput} onChange={(e) => setAdvancedInput(e.target.value)} className="min-h-[150px] resize-none bg-muted/40 rounded-2xl" autoFocus />
          <DialogFooter>
            <Button variant="ghost" onClick={closeDialogs} className="rounded-full">Cancel</Button>
            <Button className="rounded-full bg-gradient-to-r from-primary to-indigo-600" onClick={() => activeAdvancedFeature && runAdvancedGenerator(activeAdvancedFeature.key, activeAdvancedFeature.title, advancedInput)} disabled={isProcessing}><Sparkles className="h-4 w-4 mr-2"/> Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  // Determine what to show
  const hasPatientContext = !!patient;
  const hasTextContext = !!getSelectedText && !!replaceSelectedText;
  
  // -------------------------
  // THE APPLE-STYLE POPOVER UI
  // -------------------------
  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={hasTextContext && !hasPatientContext ? 'ghost' : 'outline'}
            size={compact || hasTextContext ? "sm" : "default"}
            disabled={disabled || isProcessing}
            className={cn(
              "relative overflow-hidden group transition-all duration-300",
              (compact || hasTextContext) ? "h-8 px-2" : "rounded-full shadow-sm border-primary/20 hover:border-primary/50",
              className
            )}
            title="Apple Intelligence"
          >
            {/* Animated Gradient Background for Button */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full" />
            
            {isProcessing ? (
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            ) : (
              <div className="relative flex items-center justify-center">
                <Sparkles className={cn("text-primary transition-all duration-500 group-hover:scale-110 group-hover:rotate-12", (compact || hasTextContext) ? "h-4 w-4" : "h-4 w-4 mr-2")} />
                {(!compact && !hasTextContext) && <span className="font-medium bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">AI Assist</span>}
              </div>
            )}
          </Button>
        </PopoverTrigger>

        <PopoverContent 
          align="end" 
          sideOffset={8}
          className="w-[320px] p-0 rounded-3xl border-primary/10 shadow-2xl bg-background/80 backdrop-blur-3xl overflow-hidden"
        >
          <div ref={popoverBodyRef}>
          {/* Header Area */}
          <div className="px-4 pt-4 pb-2 border-b border-border/40 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-[40px] rounded-full pointer-events-none" />
            <div className="absolute top-0 left-0 w-32 h-32 bg-blue-500/10 blur-[40px] rounded-full pointer-events-none" />
            
            <h3 className="font-semibold text-lg flex items-center gap-2 mb-3 relative z-10">
              <Sparkles className="h-4 w-4 text-purple-500" />
              Apple Intelligence
            </h3>

            {/* Category Tabs (if both contexts exist, or we just segregate features) */}
            <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-xl relative z-10">
              <Button variant={activeCategory === 'all' ? 'secondary' : 'ghost'} size="sm" className="h-7 text-xs rounded-lg flex-1" onClick={() => setActiveCategory('all')}>All</Button>
              {hasPatientContext && <Button variant={activeCategory === 'clinical' ? 'secondary' : 'ghost'} size="sm" className="h-7 text-xs rounded-lg flex-1" onClick={() => setActiveCategory('clinical')}>Clinical</Button>}
              {hasTextContext && <Button variant={activeCategory === 'write' ? 'secondary' : 'ghost'} size="sm" className="h-7 text-xs rounded-lg flex-1" onClick={() => setActiveCategory('write')}>Write</Button>}
            </div>
          </div>

          <ScrollArea className="h-[400px] p-2">
            <div className="space-y-4 pb-4">
              
              {/* ------------ TEXT CONTEXT TOOLS ------------ */}
              {(hasTextContext && (activeCategory === 'all' || activeCategory === 'write')) && (
                <div className="px-2 space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Writing Tools</p>
                  <Button variant="ghost" size="sm" className="w-full justify-start h-10 rounded-xl hover:bg-primary/5 group" onClick={() => handleTransform('custom', 'Make it sound more professional')}>
                    <WandIcon /> Make Professional
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start h-10 rounded-xl hover:bg-primary/5 group" onClick={() => handleTransform('comma-list')}>
                    <ListIcon /> Convert to List
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start h-10 rounded-xl hover:bg-primary/5 group" onClick={handleSmartExpand}>
                    <ExpandIcon /> Smart Expand
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start h-10 rounded-xl hover:bg-primary/5 group" onClick={handleMedicalCorrection}>
                    <MedIcon /> Format Medical Text
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full justify-start h-10 rounded-xl hover:bg-primary/5 group" onClick={() => { setCustomPromptText(''); setDialogType('custom_prompt'); setIsOpen(false); }}>
                    <MessageSquarePlus className="h-4 w-4 mr-3 text-muted-foreground group-hover:text-primary transition-colors" /> Custom Instruction...
                  </Button>
                </div>
              )}

              {/* ------------ PATIENT CONTEXT TOOLS ------------ */}
              {(hasPatientContext && (activeCategory === 'all' || activeCategory === 'clinical')) && (
                <>
                  <div className="px-2 space-y-1">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Clinical Actions</p>
                    <Button variant="ghost" size="sm" className="w-full justify-start h-10 rounded-xl hover:bg-primary/5 group" onClick={handleDDX}>
                      <StethoscopeIcon /> Differential Diagnosis
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start h-10 rounded-xl hover:bg-primary/5 group" onClick={handleAP}>
                      <ListChecksIcon /> Assessment & Plan
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start h-10 rounded-xl hover:bg-primary/5 group" onClick={handleSummary}>
                      <SummaryIcon /> Clinical Summary
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start h-10 rounded-xl hover:bg-primary/5 group" onClick={handleDocCheck}>
                      <ClipboardCheckIcon /> Check Documentation
                    </Button>
                  </div>

                  <div className="px-2 space-y-1 mt-4">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Generators</p>
                    <Button variant="ghost" size="sm" className="w-full justify-start h-10 rounded-xl hover:bg-primary/5 group" onClick={handleGenEvents}>
                      <ClipboardListIcon /> Generate Interval Events
                    </Button>
                    <Button variant="ghost" size="sm" className="w-full justify-start h-10 rounded-xl hover:bg-primary/5 group" onClick={handleGenCourse}>
                      <CalendarIcon /> Generate Patient Course
                    </Button>
                  </div>

                  <div className="px-2 space-y-1 mt-4">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Advanced / Neuro</p>
                    {ADVANCED_FEATURES.map((feat) => (
                      <Button key={feat.key} variant="ghost" size="sm" className="w-full justify-start h-10 rounded-xl hover:bg-primary/5 group text-left leading-tight" onClick={() => handleAdvancedClick(feat)}>
                        <Activity className="h-4 w-4 mr-3 text-muted-foreground group-hover:text-amber-500 transition-colors shrink-0" /> 
                        <span className="truncate">{feat.title}</span>
                      </Button>
                    ))}
                  </div>
                </>
              )}

            </div>
          </ScrollArea>

          {/* Footer Actions (Undo / Cancel) */}
          {(history.length > 0 || isProcessing) && (
            <div className="p-3 bg-muted/50 border-t border-border/40 flex gap-2">
              {history.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleUndo} disabled={isProcessing} className="flex-1 rounded-xl h-9">
                  <Undo2 className="h-4 w-4 mr-2" /> Undo
                </Button>
              )}
              {isProcessing && (
                <Button variant="destructive" size="sm" onClick={handleCancelAll} className="flex-1 rounded-xl h-9 shadow-sm">
                  <X className="h-4 w-4 mr-2" /> Cancel
                </Button>
              )}
            </div>
          )}

          </div>
        </PopoverContent>
      </Popover>

      {renderDDxDialog()}
      {renderTextOutputDialog()}
      {renderCustomPromptDialogs()}
    </>
  );
};

// Helper Icon Components for consistent styling
const WandIcon = () => <Sparkles className="h-4 w-4 mr-3 text-muted-foreground group-hover:text-purple-500 transition-colors" />;
const ListIcon = () => <List className="h-4 w-4 mr-3 text-muted-foreground group-hover:text-blue-500 transition-colors" />;
const ExpandIcon = () => <Zap className="h-4 w-4 mr-3 text-muted-foreground group-hover:text-yellow-500 transition-colors" />;
const MedIcon = () => <FileText className="h-4 w-4 mr-3 text-muted-foreground group-hover:text-emerald-500 transition-colors" />;
const StethoscopeIcon = () => <Stethoscope className="h-4 w-4 mr-3 text-muted-foreground group-hover:text-cyan-500 transition-colors" />;
const ListChecksIcon = () => <ListChecks className="h-4 w-4 mr-3 text-muted-foreground group-hover:text-indigo-500 transition-colors" />;
const SummaryIcon = () => <Brain className="h-4 w-4 mr-3 text-muted-foreground group-hover:text-pink-500 transition-colors" />;
const ClipboardCheckIcon = () => <ClipboardCheck className="h-4 w-4 mr-3 text-muted-foreground group-hover:text-rose-500 transition-colors" />;
const ClipboardListIcon = () => <ClipboardList className="h-4 w-4 mr-3 text-muted-foreground group-hover:text-orange-500 transition-colors" />;
const CalendarIcon = () => <Calendar className="h-4 w-4 mr-3 text-muted-foreground group-hover:text-teal-500 transition-colors" />;
