/**
 * Voice Commands Types
 * Voice control and speech recognition support
 */

export type VoiceCommandCategory =
  | 'navigation'
  | 'patient'
  | 'editing'
  | 'reference'
  | 'action'
  | 'system';

export interface VoiceCommand {
  id: string;
  phrases: string[]; // Multiple ways to trigger the command
  category: VoiceCommandCategory;
  description: string;
  action: string; // Action identifier to dispatch
  parameters?: VoiceCommandParameter[];
  requiresConfirmation?: boolean;
  feedback?: string; // Text to speak back
}

export interface VoiceCommandParameter {
  name: string;
  type: 'text' | 'number' | 'patient' | 'field' | 'section';
  required: boolean;
  extractPattern?: RegExp;
}

export interface VoiceCommandResult {
  command: VoiceCommand | null;
  confidence: number;
  parameters: Record<string, string | number>;
  rawTranscript: string;
  timestamp: string;
}

export interface VoiceSettings {
  enabled: boolean;
  language: string;
  continuous: boolean;
  interimResults: boolean;
  commandConfirmation: boolean;
  voiceFeedback: boolean;
  wakeWord?: string;
  sensitivity: number; // 0-1
}

// Default voice settings
export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  enabled: false,
  language: 'en-US',
  continuous: false,
  interimResults: true,
  commandConfirmation: true,
  voiceFeedback: true,
  wakeWord: 'hey rounds',
  sensitivity: 0.7,
};

// Voice command definitions
export const VOICE_COMMANDS: VoiceCommand[] = [
  // Navigation commands
  {
    id: 'nav-next-patient',
    phrases: ['next patient', 'go to next patient', 'next'],
    category: 'navigation',
    description: 'Navigate to the next patient',
    action: 'NAVIGATE_NEXT_PATIENT',
    feedback: 'Moving to next patient',
  },
  {
    id: 'nav-prev-patient',
    phrases: ['previous patient', 'go to previous patient', 'previous', 'go back'],
    category: 'navigation',
    description: 'Navigate to the previous patient',
    action: 'NAVIGATE_PREV_PATIENT',
    feedback: 'Moving to previous patient',
  },
  {
    id: 'nav-patient-by-name',
    phrases: ['go to patient', 'show patient', 'find patient', 'open patient'],
    category: 'navigation',
    description: 'Navigate to a specific patient by name',
    action: 'NAVIGATE_TO_PATIENT',
    parameters: [{ name: 'patientName', type: 'patient', required: true }],
    feedback: 'Opening patient',
  },
  {
    id: 'nav-patient-by-bed',
    phrases: ['go to bed', 'show bed', 'bed number'],
    category: 'navigation',
    description: 'Navigate to a patient by bed number',
    action: 'NAVIGATE_TO_BED',
    parameters: [{ name: 'bedNumber', type: 'text', required: true }],
    feedback: 'Going to bed',
  },
  {
    id: 'nav-home',
    phrases: ['go home', 'show all patients', 'patient list', 'back to list'],
    category: 'navigation',
    description: 'Return to the patient list',
    action: 'NAVIGATE_HOME',
    feedback: 'Returning to patient list',
  },

  // Patient commands
  {
    id: 'patient-add',
    phrases: ['add patient', 'new patient', 'create patient'],
    category: 'patient',
    description: 'Add a new patient',
    action: 'ADD_PATIENT',
    feedback: 'Adding new patient',
  },
  {
    id: 'patient-duplicate',
    phrases: ['duplicate patient', 'copy patient', 'clone patient'],
    category: 'patient',
    description: 'Duplicate the current patient',
    action: 'DUPLICATE_PATIENT',
    requiresConfirmation: true,
    feedback: 'Duplicating patient',
  },
  {
    id: 'patient-delete',
    phrases: ['delete patient', 'remove patient'],
    category: 'patient',
    description: 'Delete the current patient',
    action: 'DELETE_PATIENT',
    requiresConfirmation: true,
    feedback: 'Are you sure you want to delete this patient?',
  },

  // Editing commands
  {
    id: 'edit-summary',
    phrases: ['edit summary', 'update summary', 'clinical summary'],
    category: 'editing',
    description: 'Focus on clinical summary field',
    action: 'FOCUS_FIELD',
    parameters: [{ name: 'fieldName', type: 'field', required: false }],
    feedback: 'Editing clinical summary',
  },
  {
    id: 'edit-events',
    phrases: ['edit events', 'interval events', 'update events', 'overnight events'],
    category: 'editing',
    description: 'Focus on interval events field',
    action: 'FOCUS_FIELD',
    parameters: [{ name: 'fieldName', type: 'field', required: false }],
    feedback: 'Editing interval events',
  },
  {
    id: 'edit-labs',
    phrases: ['edit labs', 'update labs', 'lab values'],
    category: 'editing',
    description: 'Focus on labs field',
    action: 'FOCUS_FIELD',
    parameters: [{ name: 'fieldName', type: 'field', required: false }],
    feedback: 'Editing labs',
  },
  {
    id: 'edit-imaging',
    phrases: ['edit imaging', 'update imaging', 'radiology'],
    category: 'editing',
    description: 'Focus on imaging field',
    action: 'FOCUS_FIELD',
    parameters: [{ name: 'fieldName', type: 'field', required: false }],
    feedback: 'Editing imaging',
  },
  {
    id: 'edit-system',
    phrases: ['edit neuro', 'edit cardiovascular', 'edit respiratory', 'edit renal', 'edit gi', 'edit endo', 'edit heme', 'edit infectious disease', 'edit skin lines', 'edit dispo'],
    category: 'editing',
    description: 'Focus on a specific system',
    action: 'FOCUS_SYSTEM',
    parameters: [{ name: 'systemName', type: 'section', required: true }],
    feedback: 'Editing system',
  },
  {
    id: 'start-dictation',
    phrases: ['start dictation', 'dictate', 'voice input', 'speak'],
    category: 'editing',
    description: 'Start voice dictation in current field',
    action: 'START_DICTATION',
    feedback: 'Starting dictation. Speak now.',
  },
  {
    id: 'stop-dictation',
    phrases: ['stop dictation', 'stop speaking', 'done dictating', 'finish'],
    category: 'editing',
    description: 'Stop voice dictation',
    action: 'STOP_DICTATION',
    feedback: 'Dictation stopped',
  },

  // Reference commands
  {
    id: 'ref-open-ibcc',
    phrases: ['open reference', 'show ibcc', 'open ibcc', 'clinical reference'],
    category: 'reference',
    description: 'Open the IBCC reference panel',
    action: 'OPEN_IBCC',
    feedback: 'Opening clinical reference',
  },
  {
    id: 'ref-search-ibcc',
    phrases: ['search for', 'look up', 'find topic', 'search ibcc'],
    category: 'reference',
    description: 'Search IBCC for a topic',
    action: 'SEARCH_IBCC',
    parameters: [{ name: 'searchTerm', type: 'text', required: true }],
    feedback: 'Searching for',
  },
  {
    id: 'ref-close',
    phrases: ['close reference', 'close ibcc', 'hide reference'],
    category: 'reference',
    description: 'Close the reference panel',
    action: 'CLOSE_IBCC',
    feedback: 'Closing reference',
  },

  // Action commands
  {
    id: 'action-add-todo',
    phrases: ['add task', 'add todo', 'new task', 'remember to'],
    category: 'action',
    description: 'Add a new todo item',
    action: 'ADD_TODO',
    parameters: [{ name: 'todoText', type: 'text', required: true }],
    feedback: 'Adding task',
  },
  {
    id: 'action-complete-todo',
    phrases: ['complete task', 'mark done', 'finish task', 'task complete'],
    category: 'action',
    description: 'Mark a todo as complete',
    action: 'COMPLETE_TODO',
    parameters: [{ name: 'todoIndex', type: 'number', required: false }],
    feedback: 'Task marked complete',
  },
  {
    id: 'action-print',
    phrases: ['print', 'print list', 'print patients'],
    category: 'action',
    description: 'Open print dialog',
    action: 'OPEN_PRINT',
    feedback: 'Opening print options',
  },
  {
    id: 'action-save',
    phrases: ['save', 'save changes', 'save all'],
    category: 'action',
    description: 'Save current changes',
    action: 'SAVE',
    feedback: 'Saving changes',
  },
  {
    id: 'action-handoff',
    phrases: ['start handoff', 'create handoff', 'shift handoff'],
    category: 'action',
    description: 'Start a shift handoff',
    action: 'START_HANDOFF',
    feedback: 'Starting handoff',
  },

  // System commands
  {
    id: 'sys-help',
    phrases: ['help', 'what can you do', 'show commands', 'voice help'],
    category: 'system',
    description: 'Show available voice commands',
    action: 'SHOW_HELP',
    feedback: 'Here are the available commands',
  },
  {
    id: 'sys-cancel',
    phrases: ['cancel', 'never mind', 'stop', 'abort'],
    category: 'system',
    description: 'Cancel current voice operation',
    action: 'CANCEL',
    feedback: 'Cancelled',
  },
  {
    id: 'sys-settings',
    phrases: ['open settings', 'show settings', 'preferences'],
    category: 'system',
    description: 'Open application settings',
    action: 'OPEN_SETTINGS',
    feedback: 'Opening settings',
  },
];

// Helper to find matching command
export const findMatchingCommand = (transcript: string): VoiceCommandResult => {
  const normalizedTranscript = transcript.toLowerCase().trim();
  let bestMatch: VoiceCommand | null = null;
  let bestConfidence = 0;
  const parameters: Record<string, string | number> = {};

  for (const command of VOICE_COMMANDS) {
    for (const phrase of command.phrases) {
      const normalizedPhrase = phrase.toLowerCase();

      // Exact match
      if (normalizedTranscript === normalizedPhrase) {
        return {
          command,
          confidence: 1.0,
          parameters,
          rawTranscript: transcript,
          timestamp: new Date().toISOString(),
        };
      }

      // Starts with match
      if (normalizedTranscript.startsWith(normalizedPhrase)) {
        const confidence = normalizedPhrase.length / normalizedTranscript.length;
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestMatch = command;

          // Extract parameters (text after the phrase)
          const remainder = normalizedTranscript.slice(normalizedPhrase.length).trim();
          if (remainder && command.parameters?.length) {
            parameters[command.parameters[0].name] = remainder;
          }
        }
      }

      // Contains match (lower confidence)
      if (normalizedTranscript.includes(normalizedPhrase)) {
        const confidence = (normalizedPhrase.length / normalizedTranscript.length) * 0.8;
        if (confidence > bestConfidence) {
          bestConfidence = confidence;
          bestMatch = command;
        }
      }
    }
  }

  return {
    command: bestMatch,
    confidence: bestConfidence,
    parameters,
    rawTranscript: transcript,
    timestamp: new Date().toISOString(),
  };
};

// Get commands by category
export const getCommandsByCategory = (category: VoiceCommandCategory): VoiceCommand[] => {
  return VOICE_COMMANDS.filter(cmd => cmd.category === category);
};

// Format commands for help display
export const formatCommandsForHelp = (): string => {
  const categories: Record<VoiceCommandCategory, string> = {
    navigation: 'Navigation',
    patient: 'Patient Management',
    editing: 'Editing',
    reference: 'Reference',
    action: 'Actions',
    system: 'System',
  };

  let help = '';
  for (const [category, label] of Object.entries(categories)) {
    const commands = getCommandsByCategory(category as VoiceCommandCategory);
    if (commands.length > 0) {
      help += `\n${label}:\n`;
      commands.forEach(cmd => {
        help += `  "${cmd.phrases[0]}" - ${cmd.description}\n`;
      });
    }
  }
  return help;
};
