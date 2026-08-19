/**
 * Detect overlap between a phrase autotext shortcut and autotexts / other phrases.
 * Normalization: trim + lowercase; empty input yields no conflicts.
 */

export type PhraseShortcutConflict =
  | { type: 'autotext'; label: string }
  | { type: 'phrase'; label: string };

export const getPhraseShortcutConflicts = (
  input: string | null | undefined,
  ctx: {
    autotextShortcuts: string[];
    phrases: { id: string; shortcut: string | null; name: string }[];
    excludePhraseId?: string;
  },
): PhraseShortcutConflict[] => {
  const normalized = input?.trim().toLowerCase() ?? '';
  if (!normalized) {
    return [];
  }

  const out: PhraseShortcutConflict[] = [];

  const autotextMatch = ctx.autotextShortcuts.some(
    (s) => s.trim().toLowerCase() === normalized,
  );
  if (autotextMatch) {
    out.push({ type: 'autotext', label: 'autotext' });
  }

  for (const p of ctx.phrases) {
    if (ctx.excludePhraseId && p.id === ctx.excludePhraseId) {
      continue;
    }
    const ps = p.shortcut?.trim().toLowerCase() ?? '';
    if (ps === normalized) {
      out.push({ type: 'phrase', label: p.name });
    }
  }

  return out;
};
