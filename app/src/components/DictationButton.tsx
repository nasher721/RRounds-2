import { Mic, MicOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useDictation } from "@/hooks/useDictation";

interface DictationButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "default" | "lg";
  variant?: "ghost" | "outline" | "default";
  enhanceMedical?: boolean;
}

const DICTATION_DATA_DISCLOSURE =
  "Raw audio may be sent to OpenAI for transcription. When medical enhancement is enabled, the resulting transcript may then be sent to the selected AI provider.";

// Simple audio level bars component
const AudioLevelIndicator = ({ level }: { level: number }) => {
  const barCount = 5;
  const bars = Array.from({ length: barCount }, (_, i) => {
    const threshold = ((i + 1) / barCount) * 100;
    const isActive = level >= threshold * 0.6; // Activate with some headroom
    const height = 8 + (i * 3); // Bars get progressively taller
    
    return (
      <div
        key={i}
        className={cn(
          "w-1 rounded-full transition-all duration-75",
          isActive ? "bg-destructive" : "bg-destructive/30"
        )}
        style={{ 
          height: `${height}px`,
          transform: isActive ? `scaleY(${0.7 + (level / 100) * 0.3})` : 'scaleY(0.5)',
        }}
      />
    );
  });

  return (
    <div className="flex items-center gap-0.5 h-6">
      {bars}
    </div>
  );
};

export const DictationButton = ({
  onTranscript,
  disabled = false,
  className,
  size = "sm",
  variant = "ghost",
  enhanceMedical = true,
}: DictationButtonProps) => {
  const { isRecording, isProcessing, toggleRecording, audioLevel, error } = useDictation({
    onTranscript,
    enhanceMedical,
  });

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await toggleRecording();
  };

  const buttonSize = size === "sm" ? "h-7 w-7 p-0" : size === "lg" ? "h-10 w-10 p-0" : "h-8 w-8 p-0";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : size === "lg" ? "h-5 w-5" : "h-4 w-4";

  const ariaLabel = isProcessing
    ? "Transcribing audio"
    : isRecording
      ? "Stop dictation"
      : "Start voice dictation"

  const statusMessage = error
    ? error
    : isProcessing
      ? "Transcribing dictation. Keep focus here; recording has stopped."
      : isRecording
        ? "Recording. Click stop when finished speaking."
        : null

  const buttonContent = (
    <Button
      type="button"
      variant={isRecording ? "destructive" : variant}
      size="icon"
      onClick={handleClick}
      disabled={disabled || isProcessing}
      aria-label={ariaLabel}
      aria-busy={isProcessing || undefined}
      aria-pressed={isRecording || undefined}
      title={isProcessing ? "Transcribing…" : isRecording ? "Recording — click to stop" : "Voice dictation"}
      className={cn(
        buttonSize,
        isRecording && "animate-pulse",
        className
      )}
    >
      {isProcessing ? (
        <Loader2 className={cn(iconSize, "animate-spin")} />
      ) : isRecording ? (
        <MicOff className={iconSize} />
      ) : (
        <Mic className={iconSize} />
      )}
    </Button>
  );

  const statusRegion = statusMessage ? (
    <span
      role={error ? "alert" : "status"}
      aria-live={error ? "assertive" : "polite"}
      aria-atomic="true"
      className={cn(
        "max-w-64 text-xs",
        error ? "text-destructive" : "text-muted-foreground",
        !error && "sr-only sm:not-sr-only sm:inline",
      )}
    >
      {error ? error : isProcessing ? "Transcribing…" : "Recording"}
    </span>
  ) : null

  // When recording, show popover with audio level indicator
  if (isRecording) {
    return (
      <span className="inline-flex items-center gap-2">
        <Popover open={isRecording}>
          <PopoverTrigger asChild>
            {buttonContent}
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="center"
            className="w-auto p-2 bg-destructive/10 border-destructive/30"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="flex items-center gap-2" role="status" aria-live="polite" aria-atomic="true">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" aria-hidden="true" />
                <span className="text-xs font-medium text-destructive">Recording</span>
              </div>
              <div className="w-px h-4 bg-destructive/30" aria-hidden="true" />
              <AudioLevelIndicator level={audioLevel} />
              <div className="w-px h-4 bg-destructive/30" aria-hidden="true" />
              <button
                type="button"
                onClick={handleClick}
                className="text-xs text-destructive hover:text-destructive/80 font-medium"
                aria-label="Stop dictation"
              >
                Stop
              </button>
            </div>
          </PopoverContent>
        </Popover>
        <span className="sr-only" role="status" aria-live="polite" aria-atomic="true">
          {statusMessage}
        </span>
      </span>
    );
  }

  // When not recording, show tooltip
  return (
    <span className="inline-flex items-center gap-2">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {buttonContent}
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p className="font-medium">
              {isProcessing
                ? "Processing transcription…"
                : "Start medical dictation"}
            </p>
            <p className="mt-1 max-w-72 text-xs text-muted-foreground">
              {error
                ? "Microphone access was blocked. Allow it in browser settings, then try again."
                : DICTATION_DATA_DISCLOSURE}
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {statusRegion}
    </span>
  );
};
