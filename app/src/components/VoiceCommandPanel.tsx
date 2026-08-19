import * as React from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Settings,
  HelpCircle,
  ChevronRight,
  Command,
  Keyboard,
  X,
  Check,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  VoiceCommand,
  VoiceCommandCategory,
  VoiceCommandResult,
  VoiceSettings,
} from "@/types/voiceCommands";
import {
  VOICE_COMMANDS,
  DEFAULT_VOICE_SETTINGS,
  findMatchingCommand,
  getCommandsByCategory,
} from "@/types/voiceCommands";

interface VoiceCommandPanelProps {
  onCommand: (action: string, parameters: Record<string, string | number>) => void;
  className?: string;
}

interface VoiceRecognitionResult {
  readonly isFinal: boolean;
  readonly [index: number]: { readonly transcript: string };
}

interface VoiceRecognitionEvent {
  readonly results: {
    readonly length: number;
    readonly [index: number]: VoiceRecognitionResult;
  };
}

interface VoiceRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: VoiceRecognitionEvent) => void) | null;
  onerror: ((event: { readonly error: string }) => void) | null;
  onend: (() => void) | null;
  abort(): void;
  start(): void;
  stop(): void;
}

type VoiceRecognitionConstructor = new () => VoiceRecognition;

export function VoiceCommandPanel({ onCommand, className }: VoiceCommandPanelProps) {
  const [settings, setSettings] = React.useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [isListening, setIsListening] = React.useState(false);
  const [transcript, setTranscript] = React.useState('');
  const [lastResult, setLastResult] = React.useState<VoiceCommandResult | null>(null);
  const [showFeedback, setShowFeedback] = React.useState(false);

  const recognitionRef = React.useRef<VoiceRecognition | null>(null);

  const speak = React.useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = settings.language;
      window.speechSynthesis.speak(utterance);
    }
  }, [settings.language]);

  const processCommand = React.useCallback((text: string) => {
    const result = findMatchingCommand(text);
    setLastResult(result);

    if (result.command && result.confidence > 0.5) {
      // Show feedback
      setShowFeedback(true);
      setTimeout(() => setShowFeedback(false), 2000);

      // Speak feedback if enabled
      if (settings.voiceFeedback && result.command.feedback) {
        speak(result.command.feedback);
      }

      // Execute command
      if (!result.command.requiresConfirmation) {
        onCommand(result.command.action, result.parameters);
      }
    }
  }, [onCommand, settings.voiceFeedback, speak]);

  // Initialize speech recognition
  React.useEffect(() => {
    if (typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const speechWindow = window as unknown as {
        SpeechRecognition?: VoiceRecognitionConstructor;
        webkitSpeechRecognition?: VoiceRecognitionConstructor;
      };
      const SpeechRecognitionCtor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
      if (!SpeechRecognitionCtor) return;

      const recognition = new SpeechRecognitionCtor();
      recognitionRef.current = recognition;
      recognition.continuous = settings.continuous;
      recognition.interimResults = settings.interimResults;
      recognition.lang = settings.language;

      recognition.onresult = (event) => {
        const result = event.results[event.results.length - 1];
        const text = result[0].transcript;
        setTranscript(text);

        if (result.isFinal) {
          processCommand(text);
        }
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        if (settings.continuous && isListening) {
          recognitionRef.current?.start();
        } else {
          setIsListening(false);
        }
      };
    }

    return () => {
      recognitionRef.current?.abort();
    };
  }, [isListening, processCommand, settings.continuous, settings.interimResults, settings.language]);

  const toggleListening = () => {
    if (!settings.enabled) return;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      setTranscript('');
      setLastResult(null);
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const updateSettings = (updates: Partial<VoiceSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  };

  const isSpeechSupported = typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  if (!isSpeechSupported) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" disabled className={className}>
              <MicOff className="h-5 w-5 text-muted-foreground" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Voice commands not supported in this browser</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Main mic button */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant={isListening ? "default" : "outline"}
            size="icon"
            className={cn(
              "relative",
              isListening && "bg-red-500 hover:bg-red-600 animate-pulse"
            )}
            onClick={toggleListening}
            disabled={!settings.enabled}
          >
            {isListening ? (
              <Mic className="h-5 w-5" />
            ) : (
              <MicOff className="h-5 w-5" />
            )}
            {showFeedback && lastResult?.command && (
              <span className="absolute -top-1 -right-1">
                <Check className="h-4 w-4 text-green-500" />
              </span>
            )}
          </Button>
        </PopoverTrigger>
        {isListening && (
          <PopoverContent className="w-80" align="end">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Mic className="h-5 w-5 text-red-500" />
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping" />
                </div>
                <span className="font-medium">Listening...</span>
              </div>

              {transcript && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm italic">"{transcript}"</p>
                </div>
              )}

              {lastResult?.command && (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <Check className="h-4 w-4" />
                  <span>Recognized: {lastResult.command.description}</span>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={toggleListening}
              >
                <X className="h-4 w-4 mr-1" />
                Stop Listening
              </Button>
            </div>
          </PopoverContent>
        )}
      </Popover>

      {/* Settings */}
      <VoiceSettingsDialog
        settings={settings}
        onUpdateSettings={updateSettings}
      />

      {/* Help */}
      <VoiceCommandHelp />
    </div>
  );
}

interface VoiceSettingsDialogProps {
  settings: VoiceSettings;
  onUpdateSettings: (updates: Partial<VoiceSettings>) => void;
}

function VoiceSettingsDialog({ settings, onUpdateSettings }: VoiceSettingsDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Voice Command Settings</DialogTitle>
          <DialogDescription>
            Adjust voice recognition, confirmations, and spoken feedback.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Voice Commands</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Allow voice control of the application
              </p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => onUpdateSettings({ enabled: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Continuous Listening</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Keep listening after each command
              </p>
            </div>
            <Switch
              checked={settings.continuous}
              onCheckedChange={(checked) => onUpdateSettings({ continuous: checked })}
              disabled={!settings.enabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Voice Feedback</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Speak confirmation of commands
              </p>
            </div>
            <Switch
              checked={settings.voiceFeedback}
              onCheckedChange={(checked) => onUpdateSettings({ voiceFeedback: checked })}
              disabled={!settings.enabled}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label>Command Confirmation</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Confirm before executing commands
              </p>
            </div>
            <Switch
              checked={settings.commandConfirmation}
              onCheckedChange={(checked) => onUpdateSettings({ commandConfirmation: checked })}
              disabled={!settings.enabled}
            />
          </div>

          <div className="space-y-2">
            <Label>Recognition Sensitivity</Label>
            <Slider
              value={[settings.sensitivity * 100]}
              onValueChange={([value]) => onUpdateSettings({ sensitivity: value / 100 })}
              min={0}
              max={100}
              step={10}
              disabled={!settings.enabled}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Strict</span>
              <span>Lenient</span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function VoiceCommandHelp() {
  const categories: { key: VoiceCommandCategory; label: string; icon: React.ElementType }[] = [
    { key: 'navigation', label: 'Navigation', icon: ChevronRight },
    { key: 'patient', label: 'Patient Management', icon: Command },
    { key: 'editing', label: 'Editing', icon: Keyboard },
    { key: 'reference', label: 'Reference', icon: HelpCircle },
    { key: 'action', label: 'Actions', icon: Command },
    { key: 'system', label: 'System', icon: Settings },
  ];

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon">
          <HelpCircle className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Voice Commands
          </SheetTitle>
          <SheetDescription className="sr-only">
            Review supported voice commands for navigation, patient management, and note editing.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6">
          <div className="space-y-6 pr-4">
            {categories.map(({ key, label, icon: Icon }) => {
              const commands = getCommandsByCategory(key);
              if (commands.length === 0) return null;

              return (
                <div key={key}>
                  <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
                    <Icon className="h-4 w-4" />
                    {label}
                  </h3>
                  <div className="space-y-2">
                    {commands.map(command => (
                      <Card key={command.id} className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs font-mono">
                                "{command.phrases[0]}"
                              </Badge>
                              {command.requiresConfirmation && (
                                <Badge variant="outline" className="text-[10px]">
                                  Confirm
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {command.description}
                            </p>
                            {command.phrases.length > 1 && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Also: {command.phrases.slice(1).map(p => `"${p}"`).join(', ')}
                              </p>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium text-sm mb-2">Tips</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>Speak clearly and at a normal pace</li>
                <li>Wait for the listening indicator before speaking</li>
                <li>You can add parameters after commands (e.g., "go to patient John Smith")</li>
                <li>Say "help" to see available commands</li>
                <li>Say "cancel" to stop any ongoing operation</li>
              </ul>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

// Floating voice button for easy access
interface FloatingVoiceButtonProps {
  isListening: boolean;
  onToggle: () => void;
  disabled?: boolean;
}

export function FloatingVoiceButton({ isListening, onToggle, disabled }: FloatingVoiceButtonProps) {
  return (
    <Button
      variant={isListening ? "destructive" : "secondary"}
      size="lg"
      className={cn(
        "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg",
        isListening && "animate-pulse"
      )}
      onClick={onToggle}
      disabled={disabled}
    >
      {isListening ? (
        <Mic className="h-6 w-6" />
      ) : (
        <MicOff className="h-6 w-6" />
      )}
    </Button>
  );
}

export default VoiceCommandPanel;
