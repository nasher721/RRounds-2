import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Wand2,
  List,
  Stethoscope,
  MessageSquarePlus,
  Trash2,
  Plus,
  Loader2,
  Sparkles,
  Brain,
  FileText,
  Zap,
  Activity,
  Calendar,
  ClipboardList,
  GraduationCap,
  Clock,
  UserPlus,
} from 'lucide-react';
import { useTextTransform, TransformType, CustomPrompt } from '@/hooks/useTextTransform';
import { useAIClinicalAssistant } from '@/hooks/useAIClinicalAssistant';
import { useWritingStyleProfile } from '@/hooks/useWritingStyleProfile';
import { toast } from 'sonner';
import {
  SYSTEM_BASED_ROUNDS_PROMPT,
  DATE_ORGANIZER_PROMPT,
  PROBLEM_LIST_PROMPT,
  ICU_BOARDS_QUESTIONS_PROMPT,
  INTERVAL_EVENTS_PROMPT,
  NEURO_ICU_HPI_PROMPT,
} from '@/data/baselinePrompts';

interface AITextToolsProps {
  getSelectedText: () => string | null;
  replaceSelectedText: (newText: string) => void;
  disabled?: boolean;
}

export const AITextTools = ({
  getSelectedText,
  replaceSelectedText,
  disabled,
}: AITextToolsProps) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [showCustomDialog, setShowCustomDialog] = React.useState(false);
  const [showSaveDialog, setShowSaveDialog] = React.useState(false);
  const [customPromptText, setCustomPromptText] = React.useState('');
  const [newPromptName, setNewPromptName] = React.useState('');
  const [newPromptText, setNewPromptText] = React.useState('');

  const {
    transformText,
    isTransforming,
    customPrompts,
    addCustomPrompt,
    removeCustomPrompt,
  } = useTextTransform();

  const {
    smartExpand,
    correctMedicalText,
    isProcessing: isAIProcessing,
  } = useAIClinicalAssistant();
  const { summary, stylePrompt, updateFromSample, resetProfile } = useWritingStyleProfile();

  const isLoading = isTransforming || isAIProcessing;

  const handleTransform = async (type: TransformType, customPrompt?: string) => {
    const selectedText = getSelectedText();
    if (!selectedText) {
      toast.error('Please select some text first');
      return;
    }

    const combinedPrompt = customPrompt ? `${stylePrompt}\n\n${customPrompt}` : stylePrompt;
    const result = await transformText(selectedText, type, combinedPrompt);
    if (result) {
      replaceSelectedText(result.text);
      updateFromSample(result.text);
      setIsOpen(false);
      setShowCustomDialog(false);
      toast.success('Text transformed');
    }
  };

  // GPT-4 powered AI transformations
  const handleSmartExpand = async () => {
    const selectedText = getSelectedText();
    if (!selectedText) {
      toast.error('Please select some text first');
      return;
    }

    const result = await smartExpand(selectedText);
    if (result) {
      replaceSelectedText(result);
      updateFromSample(result);
      setIsOpen(false);
      toast.success('Text expanded with GPT-4');
    }
  };

  const handleMedicalCorrection = async () => {
    const selectedText = getSelectedText();
    if (!selectedText) {
      toast.error('Please select some text first');
      return;
    }

    const result = await correctMedicalText(selectedText);
    if (result) {
      replaceSelectedText(result);
      updateFromSample(result);
      setIsOpen(false);
      toast.success('Medical text corrected');
    }
  };

  const handleAnalyzeStyle = () => {
    const selectedText = getSelectedText();
    if (!selectedText) {
      toast.error('Please select some text first');
      return;
    }
    updateFromSample(selectedText);
    toast.success('Writing style profile updated');
  };

  const handleCustomPromptSubmit = () => {
    if (!customPromptText.trim()) {
      toast.error('Please enter a prompt');
      return;
    }
    handleTransform('custom', customPromptText);
  };

  const handleSavePrompt = () => {
    if (!newPromptName.trim() || !newPromptText.trim()) {
      toast.error('Please fill in both fields');
      return;
    }
    addCustomPrompt(newPromptName.trim(), newPromptText.trim());
    setNewPromptName('');
    setNewPromptText('');
    setShowSaveDialog(false);
  };

  const handleSavedPromptClick = (prompt: CustomPrompt) => {
    handleTransform('custom', prompt.prompt);
  };

  return (
    <>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled || isLoading}
            className="h-8 w-8 p-0"
            title="AI Text Tools"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Wand2 className="h-4 w-4" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-2" align="start">
          <div className="space-y-1">
            {/* GPT-4 Powered Section */}
            <p className="text-xs font-medium text-muted-foreground px-2 py-1 flex items-center gap-1">
              <Brain className="h-3 w-3" />
              GPT-4 Powered
            </p>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start h-9"
              onClick={handleSmartExpand}
              disabled={isLoading}
            >
              <Zap className="h-4 w-4 mr-2 text-yellow-500" />
              <div className="flex flex-col items-start">
                <span>Smart Expand</span>
                <span className="text-xs text-muted-foreground">Expand abbreviations to full text</span>
              </div>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start h-9"
              onClick={handleMedicalCorrection}
              disabled={isLoading}
            >
              <FileText className="h-4 w-4 mr-2 text-blue-500" />
              <div className="flex flex-col items-start">
                <span>Medical Correction</span>
                <span className="text-xs text-muted-foreground">Fix terminology & formatting</span>
              </div>
            </Button>

            <Separator className="my-2" />

            <p className="text-xs font-medium text-muted-foreground px-2 py-1">
              Writing Style Memory
            </p>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start h-9"
              onClick={handleAnalyzeStyle}
              disabled={isLoading}
            >
              <Sparkles className="h-4 w-4 mr-2 text-purple-500" />
              Analyze Selected Text
            </Button>

            <div className="px-2 text-xs text-muted-foreground space-y-1">
              <p>Samples: {summary.samples}</p>
              <p>Style: {summary.tone}</p>
              <p>Avg sentence: {summary.avgSentenceLength.toFixed(1)} words</p>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start h-9 text-destructive"
              onClick={resetProfile}
              disabled={isLoading}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Reset Style Profile
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start h-9"
              onClick={() => handleTransform('comma-list')}
              disabled={isLoading}
            >
              <List className="h-4 w-4 mr-2" />
              To Comma List
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start h-9"
              onClick={() => handleTransform('medical-shorthand')}
              disabled={isLoading}
            >
              <Stethoscope className="h-4 w-4 mr-2" />
              Medical Shorthand
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start h-9"
              onClick={() => {
                setCustomPromptText('');
                setShowCustomDialog(true);
                setIsOpen(false);
              }}
              disabled={isLoading}
            >
              <MessageSquarePlus className="h-4 w-4 mr-2" />
              Custom Prompt...
            </Button>

            <Separator className="my-2" />

            <p className="text-xs font-medium text-muted-foreground px-2 py-1 flex items-center gap-1">
              <Stethoscope className="h-3 w-3" />
              Neuro ICU Tools
            </p>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start h-9"
              onClick={() => handleTransform('custom', SYSTEM_BASED_ROUNDS_PROMPT)}
              disabled={isLoading}
            >
              <Activity className="h-4 w-4 mr-2 text-rose-500" />
              <div className="flex flex-col items-start text-left">
                <span className="text-sm">Systems Rounds</span>
                <span className="text-[10px] text-muted-foreground">Structured NC rounding update</span>
              </div>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start h-9"
              onClick={() => handleTransform('custom', PROBLEM_LIST_PROMPT)}
              disabled={isLoading}
            >
              <ClipboardList className="h-4 w-4 mr-2 text-indigo-500" />
              <div className="flex flex-col items-start text-left">
                <span className="text-sm">Problem List</span>
                <span className="text-[10px] text-muted-foreground">NICU Fellow-style A&P</span>
              </div>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start h-9"
              onClick={() => handleTransform('custom', INTERVAL_EVENTS_PROMPT)}
              disabled={isLoading}
            >
              <Clock className="h-4 w-4 mr-2 text-amber-500" />
              <div className="flex flex-col items-start text-left">
                <span className="text-sm">Interval Summary</span>
                <span className="text-[10px] text-muted-foreground">Day/Night running summary</span>
              </div>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start h-9"
              onClick={() => handleTransform('custom', NEURO_ICU_HPI_PROMPT)}
              disabled={isLoading}
            >
              <UserPlus className="h-4 w-4 mr-2 text-emerald-500" />
              <div className="flex flex-col items-start text-left">
                <span className="text-sm">Neuro HPI / Consult</span>
                <span className="text-[10px] text-muted-foreground">Med-dense NICU admission HPI</span>
              </div>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start h-9"
              onClick={() => handleTransform('custom', DATE_ORGANIZER_PROMPT)}
              disabled={isLoading}
            >
              <Calendar className="h-4 w-4 mr-2 text-cyan-500" />
              <span className="text-sm">Date Organizer</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start h-9"
              onClick={() => handleTransform('custom', ICU_BOARDS_QUESTIONS_PROMPT)}
              disabled={isLoading}
            >
              <GraduationCap className="h-4 w-4 mr-2 text-orange-500" />
              <span className="text-sm">ICU Board Tutor</span>
            </Button>

            {customPrompts.length > 0 && (
              <>
                <Separator className="my-2" />
                <p className="text-xs font-medium text-muted-foreground px-2 py-1 flex items-center justify-between">
                  <span>Saved Prompts</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      setShowSaveDialog(true);
                      setIsOpen(false);
                    }}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </p>
                <ScrollArea className="max-h-32">
                  {customPrompts.map((prompt) => (
                    <div
                      key={prompt.id}
                      className="flex items-center gap-1 group"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 justify-start h-8 text-sm"
                        onClick={() => handleSavedPromptClick(prompt)}
                        disabled={isLoading}
                      >
                        <Sparkles className="h-3 w-3 mr-2 text-muted-foreground" />
                        {prompt.name}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeCustomPrompt(prompt.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </ScrollArea>
              </>
            )}

            {customPrompts.length === 0 && (
              <>
                <Separator className="my-2" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start h-9 text-muted-foreground"
                  onClick={() => {
                    setShowSaveDialog(true);
                    setIsOpen(false);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Save Custom Prompt
                </Button>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Custom Prompt Dialog */}
      <Dialog open={showCustomDialog} onOpenChange={setShowCustomDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquarePlus className="h-5 w-5" />
              Custom AI Prompt
            </DialogTitle>
            <DialogDescription>
              Enter instructions to transform the selected note text with AI.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Enter your prompt... (e.g., 'Summarize this in 2 sentences' or 'Convert to bullet points')"
              value={customPromptText}
              onChange={(e) => setCustomPromptText(e.target.value)}
              className="min-h-[100px]"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              The selected text will be transformed according to your prompt.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCustomDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCustomPromptSubmit}
              disabled={isLoading || !customPromptText.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Transforming...
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Transform
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save Prompt Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Save Custom Prompt
            </DialogTitle>
            <DialogDescription>
              Name and save this prompt so it can be reused from the AI text tools menu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Prompt Name</label>
              <Input
                placeholder="e.g., Summarize, Simplify, Expand..."
                value={newPromptName}
                onChange={(e) => setNewPromptName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Prompt Instructions</label>
              <Textarea
                placeholder="e.g., 'Summarize this text in 2-3 sentences'"
                value={newPromptText}
                onChange={(e) => setNewPromptText(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePrompt}
              disabled={!newPromptName.trim() || !newPromptText.trim()}
            >
              <Plus className="h-4 w-4 mr-2" />
              Save Prompt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
