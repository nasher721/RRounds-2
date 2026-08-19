import type { ClinicalPhrase } from "@/types/phrases";

export interface PhraseUsageStats {
  phraseId: string;
  phraseShortcut: string;
  phraseTitle: string;
  usageCount: number;
  lastUsed: string;
}

interface PhraseUsageLog {
  phrase_id: string;
  created_at: string;
}

export const ESTIMATED_SECONDS_SAVED_PER_USE = 45;

export function buildPhraseUsageStats(
  phrases: Array<Pick<ClinicalPhrase, "id" | "shortcut" | "name">>,
  usageData: PhraseUsageLog[],
): PhraseUsageStats[] {
  const phraseUsageMap = new Map<string, number>();
  const phraseLastUsedMap = new Map<string, string>();

  usageData.forEach((log) => {
    phraseUsageMap.set(log.phrase_id, (phraseUsageMap.get(log.phrase_id) || 0) + 1);
    const previousLastUsed = phraseLastUsedMap.get(log.phrase_id);
    if (!previousLastUsed || new Date(log.created_at) > new Date(previousLastUsed)) {
      phraseLastUsedMap.set(log.phrase_id, log.created_at);
    }
  });

  return phrases
    .filter((phrase) => phraseUsageMap.has(phrase.id))
    .map((phrase) => ({
      phraseId: phrase.id,
      phraseShortcut: phrase.shortcut ?? "No shortcut",
      phraseTitle: phrase.name,
      usageCount: phraseUsageMap.get(phrase.id) || 0,
      lastUsed: phraseLastUsedMap.get(phrase.id) || "",
    }))
    .sort((a, b) => b.usageCount - a.usageCount);
}
