/**
 * IBCC Trigger Button
 * Floating action button to open IBCC panel with context indicator
 */

import { BookOpen, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface IBCCTriggerProps {
  onClick: () => void;
  hasContextSuggestions?: boolean;
  suggestionCount?: number;
}

export function IBCCTrigger({ onClick, hasContextSuggestions, suggestionCount = 0 }: IBCCTriggerProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onClick}
            className={cn(
              "fixed left-4 bottom-4 z-40 h-14 w-14 rounded-full shadow-lg transition-all duration-300",
              "bg-primary hover:bg-primary-dark hover:scale-105",
              hasContextSuggestions && "ring-2 ring-warning ring-offset-2 ring-offset-background"
            )}
          >
            <div className="relative">
              <BookOpen className="h-6 w-6" />
              {hasContextSuggestions && (
                <div className="absolute -top-1 -right-1">
                  <Sparkles className="h-3 w-3 text-warning animate-pulse" />
                </div>
              )}
            </div>
            {suggestionCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-warning text-warning-foreground text-xs font-medium flex items-center justify-center">
                {suggestionCount}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="right" className="flex flex-col gap-1">
          <span className="font-medium">IBCC Clinical Reference</span>
          <span className="text-xs text-muted-foreground">Press Ctrl+I to open</span>
          {hasContextSuggestions && (
            <span className="text-xs text-warning">
              ✨ {suggestionCount} suggestion{suggestionCount !== 1 ? 's' : ''} for current patient
            </span>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
