import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Loader2, Wand2, Check, X, RotateCcw } from 'lucide-react';
import { useAIClinicalAssistant } from '@/hooks/useAIClinicalAssistant';
import { AIErrorBoundary } from '@/components/AIErrorBoundary';

interface AISmartExpandProps {
  selectedText: string;
  onReplace: (newText: string) => void;
  className?: string;
  disabled?: boolean;
}

export const AISmartExpand = ({
  selectedText,
  onReplace,
  className = '',
  disabled = false,
}: AISmartExpandProps) => {
  const { smartExpand, correctMedicalText, isProcessing } = useAIClinicalAssistant();
  const [expandedText, setExpandedText] = React.useState<string | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const [mode, setMode] = React.useState<'expand' | 'correct'>('expand');

  const handleExpand = React.useCallback(async () => {
    if (!selectedText.trim()) return;

    setMode('expand');
    const result = await smartExpand(selectedText);
    if (result) {
      setExpandedText(result);
    }
  }, [selectedText, smartExpand]);

  const handleCorrect = React.useCallback(async () => {
    if (!selectedText.trim()) return;

    setMode('correct');
    const result = await correctMedicalText(selectedText);
    if (result) {
      setExpandedText(result);
    }
  }, [selectedText, correctMedicalText]);

  const handleAccept = React.useCallback(() => {
    if (expandedText) {
      onReplace(expandedText);
      setExpandedText(null);
      setIsOpen(false);
    }
  }, [expandedText, onReplace]);

  const handleReject = React.useCallback(() => {
    setExpandedText(null);
  }, []);

  const handleOpenChange = React.useCallback((open: boolean) => {
    setIsOpen(open);
    if (!open) {
      setExpandedText(null);
    }
  }, []);

  // Don't render if no text is selected
  if (!selectedText.trim() || disabled) {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={`h-6 px-2 ${className}`}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Wand2 className="h-3 w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>AI Expand/Correct</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start">
        <div className="space-y-3">
          <div className="text-sm font-medium">AI Text Tools</div>

          {/* Original text */}
          <div className="p-2 bg-muted rounded text-xs">
            <div className="text-muted-foreground mb-1">Selected text:</div>
            <div className="line-clamp-3">{selectedText}</div>
          </div>

          {/* Actions */}
          {!expandedText && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={handleExpand}
                disabled={isProcessing}
              >
                {isProcessing && mode === 'expand' ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <Wand2 className="h-3 w-3 mr-1" />
                )}
                Expand
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={handleCorrect}
                disabled={isProcessing}
              >
                {isProcessing && mode === 'correct' ? (
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ) : (
                  <RotateCcw className="h-3 w-3 mr-1" />
                )}
                Correct
              </Button>
            </div>
          )}

          {/* Expanded result */}
          {expandedText && (
            <>
              <AIErrorBoundary featureLabel="AI Text Expansion" compact>
                <div className="p-2 bg-green-50 dark:bg-green-950 rounded text-xs border border-green-200 dark:border-green-800">
                  <div className="text-green-700 dark:text-green-300 mb-1">
                    {mode === 'expand' ? 'Expanded:' : 'Corrected:'}
                  </div>
                  <div className="whitespace-pre-wrap">{expandedText}</div>
                </div>
              </AIErrorBoundary>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={handleReject}
                >
                  <X className="h-3 w-3 mr-1" />
                  Reject
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleAccept}
                >
                  <Check className="h-3 w-3 mr-1" />
                  Accept
                </Button>
              </div>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
