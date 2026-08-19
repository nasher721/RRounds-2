import { useCallback } from 'react';

export interface PhrasePresenceState {
  viewers: Array<{
    userId: string;
    userName: string;
    avatarUrl?: string;
    lastSeen: Date;
    cursorPosition?: number;
  }>;
  editors: Array<{
    userId: string;
    userName: string;
    avatarUrl?: string;
    cursorPosition: number;
    selection?: { start: number; end: number };
    startedEditing: Date;
  }>;
  viewerCount: number;
  isBeingEdited: boolean;
  currentEditorId: string | null;
}

export interface UsePhrasePresenceOptions {
  phraseId: string;
  onPresenceChange?: (state: PhrasePresenceState) => void;
  onEditStarted?: (userId: string, userName: string) => void;
  onEditEnded?: (userId: string, userName: string) => void;
  enabled?: boolean;
}

const disabledViewers: PhrasePresenceState['viewers'] = [];
const disabledEditors: PhrasePresenceState['editors'] = [];
Object.freeze(disabledViewers);
Object.freeze(disabledEditors);

const DISABLED_PHRASE_PRESENCE_STATE: PhrasePresenceState = {
  viewers: disabledViewers,
  editors: disabledEditors,
  viewerCount: 0,
  isBeingEdited: false,
  currentEditorId: null,
};
Object.freeze(DISABLED_PHRASE_PRESENCE_STATE);

/**
 * Phrase presence is intentionally disabled until Realtime channels are
 * private and their topics are authorized against server-side team access.
 * The stable no-op API prevents predictable phrase topics from publishing
 * user identifiers while callers continue to render normally.
 */
export function usePhrasePresence(_options: UsePhrasePresenceOptions) {
  const startEditing = useCallback(async (_cursorPosition: number = 0): Promise<void> => {
    // Intentionally disabled pending private, server-authorized channels.
  }, []);

  const updateCursorPosition = useCallback(
    async (
      _cursorPosition: number,
      _selection?: { start: number; end: number },
    ): Promise<void> => {
      // Intentionally disabled pending private, server-authorized channels.
    },
    [],
  );

  const stopEditing = useCallback(async (): Promise<void> => {
    // Intentionally disabled pending private, server-authorized channels.
  }, []);

  return {
    presenceState: DISABLED_PHRASE_PRESENCE_STATE,
    startEditing,
    updateCursorPosition,
    stopEditing,
    isEditing: false,
  };
}
