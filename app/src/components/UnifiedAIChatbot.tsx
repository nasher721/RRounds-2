import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, X, Send, Stethoscope, FileText, ListChecks, ClipboardCheck,
  Brain, Calendar, Activity, Wand2, Lightbulb, Mic, MessageSquare,
  Copy, Check, User, Bot, Trash2, Minimize2, Maximize2, ChevronRight,
  Zap, BookOpen, Pill,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useStreamingAI } from '@/hooks/useStreamingAI';
import { useActivePatientId, useCurrentPatients } from '@/contexts/CurrentPatientsContext';
import { useAuth } from '@/hooks/useAuth';
import { useMotionPreference } from '@/hooks/useReducedMotion';
import { shouldRunAnime, useAnimeTimeline } from '@/lib/anime';
import type { AIFeature } from '@/lib/openai-config';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  featureLabel?: string;
  isStreaming?: boolean;
  timestamp: Date;
  isError?: boolean;
}

interface QuickAction {
  id: AIFeature;
  name: string;
  description: string;
  icon: React.ReactNode;
  requiresText?: boolean;
  category: Category;
}

type Category = 'Clinical' | 'Notes' | 'Text Tools';

// ─── Feature definitions ───────────────────────────────────────────────────────

const QUICK_ACTIONS: QuickAction[] = [
  // Clinical
  {
    id: 'differential_diagnosis',
    name: 'DDx',
    description: 'Generate differential diagnoses from patient data',
    icon: <Stethoscope className="h-3.5 w-3.5" />,
    category: 'Clinical',
  },
  {
    id: 'documentation_check',
    name: 'Doc Check',
    description: 'Review documentation completeness & gaps',
    icon: <ClipboardCheck className="h-3.5 w-3.5" />,
    category: 'Clinical',
  },
  {
    id: 'soap_format',
    name: 'SOAP',
    description: 'Reformat notes into SOAP structure',
    icon: <FileText className="h-3.5 w-3.5" />,
    category: 'Clinical',
  },
  {
    id: 'assessment_plan',
    name: 'A&P',
    description: 'Generate problem-based Assessment & Plan',
    icon: <ListChecks className="h-3.5 w-3.5" />,
    category: 'Clinical',
  },
  {
    id: 'clinical_summary',
    name: 'Summary',
    description: 'Generate concise clinical summary',
    icon: <Brain className="h-3.5 w-3.5" />,
    category: 'Clinical',
  },
  {
    id: 'system_based_rounds',
    name: 'Rounds',
    description: 'Neuro ICU system-based rounds template',
    icon: <Activity className="h-3.5 w-3.5" />,
    category: 'Clinical',
  },
  // Notes
  {
    id: 'problem_list',
    name: 'Problem List',
    description: 'Fellow-level Neuro ICU problem list A&P',
    icon: <ListChecks className="h-3.5 w-3.5" />,
    category: 'Notes',
  },
  {
    id: 'neuro_icu_hpi',
    name: 'HPI',
    description: 'Write a 3-paragraph Neuro ICU HPI',
    icon: <BookOpen className="h-3.5 w-3.5" />,
    requiresText: true,
    category: 'Notes',
  },
  {
    id: 'interval_events_generator',
    name: 'Interval Events',
    description: 'Generate DAY/NIGHT interval event summary',
    icon: <Calendar className="h-3.5 w-3.5" />,
    requiresText: true,
    category: 'Notes',
  },
  {
    id: 'date_organizer',
    name: 'Timeline',
    description: 'Organize clinical events chronologically',
    icon: <Calendar className="h-3.5 w-3.5" />,
    requiresText: true,
    category: 'Notes',
  },
  // Text Tools
  {
    id: 'smart_expand',
    name: 'Expand',
    description: 'Expand medical shorthand into full text',
    icon: <Wand2 className="h-3.5 w-3.5" />,
    requiresText: true,
    category: 'Text Tools',
  },
  {
    id: 'medical_correction',
    name: 'Correct',
    description: 'Fix medical terminology and abbreviations',
    icon: <Check className="h-3.5 w-3.5" />,
    requiresText: true,
    category: 'Text Tools',
  },
  {
    id: 'icu_boards_explainer',
    name: 'Explain',
    description: 'ICU boards-style explanation with mnemonics',
    icon: <Lightbulb className="h-3.5 w-3.5" />,
    requiresText: true,
    category: 'Text Tools',
  },
  {
    id: 'transcription',
    name: 'Transcribe+',
    description: 'Enhance and correct medical dictation',
    icon: <Mic className="h-3.5 w-3.5" />,
    requiresText: true,
    category: 'Text Tools',
  },
];

const CATEGORIES: Category[] = ['Clinical', 'Notes', 'Text Tools'];

// Features that use patient context rather than free text
const PATIENT_FEATURES: AIFeature[] = [
  'differential_diagnosis',
  'documentation_check',
  'soap_format',
  'assessment_plan',
  'clinical_summary',
  'system_based_rounds',
  'problem_list',
];

// ─── Helper: create ID ─────────────────────────────────────────────────────────

const makeId = () => `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ─── Subcomponent: Message bubble ─────────────────────────────────────────────

interface MessageBubbleProps {
  message: ChatMessage;
  onCopy: (id: string, content: string) => void;
  copiedId: string | null;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onCopy, copiedId }) => {
  const isUser = message.role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={cn('flex gap-2.5', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center',
          isUser
            ? 'bg-violet-500 text-white'
            : 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white',
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
      </div>

      {/* Bubble */}
      <div className={cn('group relative max-w-[85%]', isUser ? 'items-end' : 'items-start')}>
        {message.featureLabel && !isUser && (
          <Badge
            variant="outline"
            className="mb-1 text-[10px] py-0 h-4 border-violet-300/60 text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-900/20"
          >
            <Zap className="h-2.5 w-2.5 mr-1" />
            {message.featureLabel}
          </Badge>
        )}

        <div
          className={cn(
            'rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed',
            isUser
              ? 'bg-gradient-to-br from-violet-500 to-indigo-600 text-white rounded-tr-sm shadow-sm shadow-violet-500/20'
              : message.isError
              ? 'bg-destructive/10 border border-destructive/30 rounded-tl-sm text-destructive'
              : 'bg-muted/80 border border-border/40 rounded-tl-sm',
          )}
        >
          {/* Typing dots while streaming but no content yet */}
          {message.isStreaming && !message.content ? (
            <div className="flex gap-1 py-0.5 items-center">
              {[0, 150, 300].map((delay) => (
                <span
                  key={delay}
                  className="h-1.5 w-1.5 rounded-full bg-current animate-bounce"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </div>
          ) : (
            <p className="whitespace-pre-wrap">{message.content}</p>
          )}

          {/* Streaming cursor */}
          {message.isStreaming && message.content && (
            <span className="inline-block h-3.5 w-0.5 bg-current animate-pulse ml-0.5 align-middle" />
          )}
        </div>

        {/* Copy button (assistant only, after streaming) */}
        {!isUser && !message.isStreaming && message.content && !message.isError && (
          <button
            onClick={() => onCopy(message.id, message.content)}
            className="mt-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
          >
            {copiedId === message.id ? (
              <>
                <Check className="h-3 w-3 text-green-500" />
                <span className="text-green-500">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        )}
      </div>
    </motion.div>
  );
};

// ─── Main component ────────────────────────────────────────────────────────────

export const UnifiedAIChatbot: React.FC = () => {
  const { user } = useAuth();
  const patients = useCurrentPatients();
  const activePatientId = useActivePatientId();
  const { prefersReducedMotion } = useMotionPreference();

  const [isOpen, setIsOpen] = React.useState(false);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = React.useState('');
  const [selectedPatientId, setSelectedPatientId] = React.useState<string>('__none__');
  const [activeCategory, setActiveCategory] = React.useState<Category>('Clinical');
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const [pendingAction, setPendingAction] = React.useState<QuickAction | null>(null);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const streamingIdRef = React.useRef<string | null>(null);
  const quickActionsStaggerRef = React.useRef<HTMLDivElement>(null);

  const selectedPatient = React.useMemo(
    () => patients.find((p) => p.id === selectedPatientId) ?? null,
    [patients, selectedPatientId],
  );

  React.useEffect(() => {
    if (activePatientId && patients.some((patient) => patient.id === activePatientId)) {
      setSelectedPatientId(activePatientId);
      return;
    }
    if (selectedPatientId !== '__none__' && !patients.some((patient) => patient.id === selectedPatientId)) {
      setSelectedPatientId('__none__');
    }
  }, [activePatientId, patients, selectedPatientId]);

  const patientIdentifier = React.useCallback((patient: (typeof patients)[number]) => {
    if (patient.mrn?.trim()) return `MRN …${patient.mrn.trim().slice(-4)}`;
    if (patient.bed?.trim()) return `Bed ${patient.bed.trim()}`;
    return `Record …${patient.id.slice(-4)}`;
  }, []);

  // ── Streaming AI hook ────────────────────────────────────────────────────────

  const { streamWithAI, isStreaming, cancel } = useStreamingAI({
    onChunk: (_chunk, accumulated) => {
      if (!streamingIdRef.current) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingIdRef.current
            ? { ...m, content: accumulated, isStreaming: true }
            : m,
        ),
      );
    },
    onComplete: (full) => {
      if (!streamingIdRef.current) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingIdRef.current
            ? { ...m, content: full, isStreaming: false }
            : m,
        ),
      );
      streamingIdRef.current = null;
    },
    onError: (err) => {
      if (!streamingIdRef.current) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamingIdRef.current
            ? { ...m, content: `Sorry, something went wrong: ${err}`, isStreaming: false, isError: true }
            : m,
        ),
      );
      streamingIdRef.current = null;
    },
  });

  // ── Keyboard shortcut ⌘⇧K ──────────────────────────────────────────────────

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey) && e.shiftKey) {
        e.preventDefault();
        setIsOpen((v) => !v);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // ── Auto-scroll ─────────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ── Focus input on open ─────────────────────────────────────────────────────

  React.useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const addMessage = React.useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>): string => {
    const id = makeId();
    setMessages((prev) => [...prev, { ...msg, id, timestamp: new Date() }]);
    return id;
  }, []);

  const runFeature = React.useCallback(
    async (feature: AIFeature, text?: string, featureLabel?: string) => {
      const actionName = featureLabel ?? QUICK_ACTIONS.find((a) => a.id === feature)?.name ?? feature;

      // User bubble
      const userContent = text
        ? text
        : `Run ${actionName} on ${selectedPatient?.name ?? 'current patient'}`;
      addMessage({ role: 'user', content: userContent });

      // Placeholder assistant bubble
      const assistantId = addMessage({
        role: 'assistant',
        content: '',
        featureLabel: actionName,
        isStreaming: true,
      });
      streamingIdRef.current = assistantId;

      await streamWithAI(feature, {
        text: text ?? undefined,
        patient: selectedPatient ?? undefined,
      });
    },
    [addMessage, selectedPatient, streamWithAI],
  );

  // ── Quick action click ──────────────────────────────────────────────────────

  const handleQuickAction = React.useCallback(
    (action: QuickAction) => {
      if (isStreaming) return;

      if (action.requiresText) {
        // Queue action, prompt user to fill in text
        setPendingAction(action);
        setInputValue('');
        inputRef.current?.focus();
        return;
      }

      // Patient-required features
      if (PATIENT_FEATURES.includes(action.id) && !selectedPatient) {
        addMessage({
          role: 'assistant',
          content: 'Please select a patient from the dropdown above to use this feature.',
          isError: true,
        });
        return;
      }

      runFeature(action.id, undefined, action.name);
    },
    [isStreaming, selectedPatient, addMessage, runFeature],
  );

  // ── Send ─────────────────────────────────────────────────────────────────────

  const handleSend = React.useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isStreaming) return;
    setInputValue('');

    if (pendingAction) {
      const action = pendingAction;
      setPendingAction(null);
      await runFeature(action.id, text, action.name);
    } else {
      // General query → smart_expand with the text
      await runFeature('smart_expand', text, 'Smart Assist');
    }
  }, [inputValue, isStreaming, pendingAction, runFeature]);

  // ── Copy ─────────────────────────────────────────────────────────────────────

  const handleCopy = React.useCallback((id: string, content: string) => {
    navigator.clipboard.writeText(content).catch((err) => { console.error('[clipboard] Failed to write:', err) });
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  // ── Clear ────────────────────────────────────────────────────────────────────

  const handleClear = React.useCallback(() => {
    if (isStreaming) cancel();
    setMessages([]);
    setPendingAction(null);
    streamingIdRef.current = null;
  }, [cancel, isStreaming]);

  const filteredActions = React.useMemo(
    () => (!user ? [] : QUICK_ACTIONS.filter((a) => a.category === activeCategory)),
    [user, activeCategory],
  );

  const quickActionsChipsKey = React.useMemo(
    () => `${activeCategory}|${filteredActions.map((a) => a.id).join(',')}`,
    [activeCategory, filteredActions],
  );

  const animeRunQuickChips =
    shouldRunAnime(prefersReducedMotion) && !!user && isOpen && filteredActions.length > 0;

  useAnimeTimeline(
    ({ createTimeline, stagger }) => {
      const root = quickActionsStaggerRef.current;
      if (!root) return null;
      const items = root.querySelectorAll<HTMLElement>('[data-anime-stagger-item]');
      if (items.length === 0) return null;
      const tl = createTimeline({ defaults: { ease: 'outCubic' } });
      tl.add(items, {
        opacity: { from: 0, to: 1 },
        y: { from: 6, to: 0 },
        duration: 280,
        delay: stagger(28, { from: 'first' }),
      });
      return tl;
    },
    [quickActionsChipsKey, isOpen, activeCategory],
    { enabled: animeRunQuickChips, afterLayout: true },
  );

  if (!user) return null;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Floating trigger ── */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            key="trigger"
            type="button"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={prefersReducedMotion ? undefined : { scale: 1.08 }}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.93 }}
            onClick={() => setIsOpen(true)}
            title="AI Clinical Assistant (⌘⇧K)"
            aria-label="Open AI Clinical Assistant"
            className={cn(
              'fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-4 z-50 md:bottom-6 md:right-6',
              'h-14 w-14 rounded-full',
              'bg-gradient-to-br from-violet-500 via-indigo-500 to-purple-600',
              'shadow-lg shadow-violet-500/30',
              'flex items-center justify-center text-white',
              'hover:shadow-xl hover:shadow-violet-500/40 transition-shadow',
              'ring-2 ring-white/30 dark:ring-white/10',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            )}
          >
            <Sparkles className="h-6 w-6" aria-hidden />
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Chat panel ── */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-chatbot-title"
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 16 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className={cn(
              'fixed z-50 flex max-h-[100dvh] max-w-[100vw] flex-col',
              'overflow-hidden sm:rounded-2xl',
              'border border-border/60 bg-background',
              'shadow-2xl shadow-black/25',
              isExpanded
                ? 'inset-0 h-[100dvh] w-screen sm:inset-4 sm:h-auto sm:w-auto'
                : 'inset-0 h-[100dvh] w-screen sm:inset-auto sm:bottom-6 sm:right-6 sm:h-[min(620px,calc(100dvh-3rem))] sm:w-[min(460px,calc(100vw-3rem))]',
            )}
          >
            {/* ── Header ── */}
            <div className="relative flex-shrink-0 bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 text-white">
              {/* Subtle animated shimmer overlay */}
              <div
                className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 animate-[shimmer_3s_ease-in-out_infinite] motion-reduce:animate-none"
                aria-hidden
              />

              <div className="relative px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-white/15 backdrop-blur-sm ring-1 ring-white/20 shrink-0">
                      <Sparkles className="h-4.5 w-4.5" aria-hidden />
                    </div>
                    <div className="min-w-0">
                      <p id="ai-chatbot-title" className="font-semibold text-sm leading-tight tracking-tight">
                        AI Clinical Assistant
                      </p>
                      <p className="text-[11px] text-white/65 mt-0.5">
                        {isStreaming ? (
                          <span className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse motion-reduce:animate-none shrink-0" aria-hidden />
                            Generating…
                          </span>
                        ) : (
                          `${messages.filter((m) => m.role === 'assistant').length} responses · ⌘⇧K to toggle`
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Header controls */}
                  <div className="flex items-center gap-0.5 shrink-0">
                    {messages.length > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={handleClear}
                            className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-violet-700"
                            aria-label="Clear conversation"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>Clear conversation</TooltipContent>
                      </Tooltip>
                    )}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setIsExpanded((v) => !v)}
                          className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-violet-700"
                          aria-label={isExpanded ? 'Minimize panel' : 'Expand panel'}
                          aria-expanded={isExpanded}
                        >
                          {isExpanded ? (
                            <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                          )}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{isExpanded ? 'Minimize' : 'Expand'}</TooltipContent>
                    </Tooltip>
                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="p-2 min-h-[40px] min-w-[40px] rounded-lg hover:bg-white/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-violet-700"
                      aria-label="Close AI assistant"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                </div>

                {/* Patient selector */}
                <div className="mt-2.5">
                  <Select value={selectedPatientId} onValueChange={setSelectedPatientId}>
                    <SelectTrigger
                      aria-label="Patient context for AI"
                      className="h-8 text-xs bg-white/10 border-white/25 text-white hover:bg-white/20 focus:ring-white/30 [&>span]:text-white/90 [&>svg]:text-white/60"
                    >
                      <SelectValue placeholder="No patient selected" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        <span className="text-muted-foreground">No patient selected</span>
                      </SelectItem>
                      {patients.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <div className="flex items-center gap-2">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span>{p.name || `Patient ${p.bed || p.id?.slice(0, 8)}`}</span>
                            <span className="text-xs text-muted-foreground">{patientIdentifier(p)}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* ── Quick actions bar ── */}
            <div className="flex-shrink-0 px-3 pt-2.5 pb-2 border-b border-border/50 bg-muted/20 backdrop-blur-sm">
              {/* Category tabs */}
              <div className="flex gap-1 mb-2" role="group" aria-label="AI action categories">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    aria-pressed={activeCategory === cat}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      'px-2.5 py-1.5 min-h-[36px] text-xs rounded-full font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2',
                      activeCategory === cat
                        ? 'bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300 shadow-sm'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/70',
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Action chips */}
              <div ref={quickActionsStaggerRef} className="flex flex-wrap gap-1.5">
                {filteredActions.map((action) => (
                  <Tooltip key={action.id}>
                    <TooltipTrigger asChild>
                      <button
                        data-anime-stagger-item
                        type="button"
                        style={animeRunQuickChips ? { opacity: 0 } : undefined}
                        onClick={() => handleQuickAction(action)}
                        disabled={isStreaming || (PATIENT_FEATURES.includes(action.id) && !selectedPatient)}
                        aria-label={`${action.name}: ${action.description}`}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] rounded-full text-xs font-medium',
                          'border bg-background transition-all duration-150',
                          'disabled:opacity-40 disabled:cursor-not-allowed',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2',
                          pendingAction?.id === action.id
                            ? 'border-violet-400 bg-violet-50 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-600'
                            : [
                                'border-border/60',
                                'hover:border-violet-300 hover:text-violet-700 hover:bg-violet-50/50',
                                'dark:hover:border-violet-600 dark:hover:text-violet-300 dark:hover:bg-violet-900/20',
                                action.requiresText && 'border-dashed',
                              ],
                        )}
                      >
                        <span aria-hidden className="inline-flex [&>svg]:shrink-0">
                          {action.icon}
                        </span>
                        {action.name}
                        {action.requiresText && (
                          <ChevronRight className="h-2.5 w-2.5 opacity-50 shrink-0" aria-hidden />
                        )}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[200px] text-center">
                      {action.description}
                      {action.requiresText && (
                        <span className="block text-[10px] opacity-70 mt-0.5">Requires text input</span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>

            {/* ── Messages ── */}
            <div
              ref={scrollRef}
              className="min-h-0 flex-1 overflow-y-auto px-3 py-3 space-y-3 scroll-smooth"
            >
              {messages.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex flex-col items-center justify-center h-full text-center gap-4 py-10"
                >
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/40 dark:to-indigo-900/40 flex items-center justify-center ring-1 ring-violet-200/50 dark:ring-violet-700/30">
                    <Sparkles className="h-7 w-7 text-violet-500" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">
                      AI Clinical Assistant
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5 max-w-[240px] leading-relaxed">
                      Select confirmed patient context, then choose action. Generated text stays in review until you copy it into chart.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                    {['Differential Dx', 'SOAP Note', 'A&P', 'Doc Check', 'HPI'].map((tip) => (
                      <span
                        key={tip}
                        className="text-[11px] bg-muted/80 border border-border/50 px-2 py-0.5 rounded-full text-muted-foreground"
                      >
                        {tip}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ) : (
                messages.map((msg) => (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    onCopy={handleCopy}
                    copiedId={copiedId}
                  />
                ))
              )}
            </div>

            {/* ── Input area ── */}
            <div className="flex-shrink-0 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-border/50 bg-background/80 backdrop-blur-sm">
              {/* Pending action banner */}
              <AnimatePresence>
                {pendingAction && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 mb-2 px-2.5 py-1.5 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800/50"
                  >
                    <Zap className="h-3 w-3 text-violet-500 flex-shrink-0" />
                    <span className="text-xs text-violet-700 dark:text-violet-300 flex-1">
                      <strong>{pendingAction.name}:</strong> {pendingAction.description}. Type your text below.
                    </span>
                    <button
                      type="button"
                      onClick={() => setPendingAction(null)}
                      className="p-1 rounded-md text-violet-400 hover:text-violet-600 dark:hover:text-violet-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 min-h-[44px] min-w-[44px] inline-flex items-center justify-center"
                      aria-label="Cancel pending action"
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Streaming indicator */}
              {isStreaming && (
                <div className="flex items-center justify-between mb-2 px-0.5">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Sparkles className="h-3 w-3 animate-spin motion-reduce:animate-none text-violet-500" aria-hidden />
                    <span>Generating response…</span>
                  </div>
                  <button
                    type="button"
                    onClick={cancel}
                    className="text-xs min-h-[44px] px-2 rounded-md text-destructive/70 hover:text-destructive transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                    aria-label="Stop generating"
                  >
                    Stop
                  </button>
                </div>
              )}

              {/* Input row */}
              <div className="flex gap-2 items-end">
                  <Textarea
                  ref={inputRef}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                    if (e.key === 'Escape') {
                      setPendingAction(null);
                    }
                  }}
                  placeholder={
                    pendingAction
                      ? `Enter text for ${pendingAction.name}…`
                      : 'Ask a clinical question, paste notes, or use a quick action…'
                  }
                  aria-label={pendingAction ? `Text for ${pendingAction.name}` : 'Message to AI assistant'}
                  className="min-h-[44px] max-h-[120px] resize-none text-sm rounded-xl flex-1 focus-visible:ring-violet-400/50"
                  disabled={isStreaming}
                  rows={1}
                />
                <Button
                  type="button"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isStreaming}
                  size="icon"
                  aria-label="Send message"
                  className={cn(
                    'flex-shrink-0 h-[44px] w-[44px] rounded-xl shadow-none transition-all',
                    'bg-gradient-to-br from-violet-500 to-indigo-600',
                    'hover:from-violet-600 hover:to-indigo-700',
                    'disabled:opacity-40',
                  )}
                >
                  <Send className="h-4 w-4" aria-hidden />
                </Button>
              </div>

              <p className="text-[10px] text-muted-foreground/60 mt-1.5 px-1">
                Enter to send · Shift+Enter for new line · Esc to cancel action
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
