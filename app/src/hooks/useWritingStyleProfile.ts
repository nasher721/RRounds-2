import * as React from 'react';
import { safeLocalStorage } from '@/utils/safeStorage';

interface WritingStyleProfile {
  samples: number;
  totalWords: number;
  totalSentences: number;
  totalAbbreviations: number;
  totalBulletLines: number;
  totalLines: number;
  headingCounts: Record<string, number>;
  lastUpdated: string;
}

interface WritingStyleSummary {
  samples: number;
  avgSentenceLength: number;
  abbreviationRate: number;
  prefersBullets: boolean;
  topHeadings: string[];
  tone: 'concise' | 'balanced' | 'detailed';
  lastUpdated: string;
}

const DEFAULT_PROFILE: WritingStyleProfile = {
  samples: 0,
  totalWords: 0,
  totalSentences: 0,
  totalAbbreviations: 0,
  totalBulletLines: 0,
  totalLines: 0,
  headingCounts: {},
  lastUpdated: new Date().toISOString(),
};

// Older profiles could include headings copied from clinical text. Keep the
// aggregate profile in memory and remove the unscoped browser copy.
safeLocalStorage.removeItem('writing-style-profile');

const extractWords = (text: string) => text.match(/\b[\w/]+\b/g) ?? [];

const extractSentences = (text: string) =>
  text
    .split(/[.!?]+/)
    .map(sentence => sentence.trim())
    .filter(Boolean);

const extractLines = (text: string) => text.split(/\r?\n/).map(line => line.trim());

const extractHeading = (line: string) => {
  const trimmed = line.replace(/[:\s]+$/g, '').trim();
  if (!trimmed || trimmed.length > 40) return null;

  const isHeading = /:$/.test(line) || /^[A-Z\s/]+$/.test(trimmed);
  if (!isHeading) return null;

  return trimmed.toUpperCase();
};

const countAbbreviations = (words: string[]) =>
  words.reduce((count, word) => {
    const isAllCaps = word.toUpperCase() === word && word.length >= 2 && word.length <= 6;
    const hasSlash = word.includes('/');
    return count + (isAllCaps || hasSlash ? 1 : 0);
  }, 0);

const getTone = (avgSentenceLength: number): WritingStyleSummary['tone'] => {
  if (avgSentenceLength <= 12) return 'concise';
  if (avgSentenceLength <= 20) return 'balanced';
  return 'detailed';
};

const buildSummary = (profile: WritingStyleProfile): WritingStyleSummary => {
  const avgSentenceLength = profile.totalSentences > 0
    ? profile.totalWords / profile.totalSentences
    : 0;
  const abbreviationRate = profile.totalWords > 0
    ? profile.totalAbbreviations / profile.totalWords
    : 0;
  const prefersBullets = profile.totalLines > 0
    ? profile.totalBulletLines / profile.totalLines >= 0.2
    : false;
  const topHeadings = Object.entries(profile.headingCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([heading]) => heading);

  return {
    samples: profile.samples,
    avgSentenceLength,
    abbreviationRate,
    prefersBullets,
    topHeadings,
    tone: getTone(avgSentenceLength),
    lastUpdated: profile.lastUpdated,
  };
};

const buildStylePrompt = (summary: WritingStyleSummary) => {
  if (summary.samples === 0) {
    return 'No style profile yet. Use the selected text to build a personalized medical writing profile.';
  }

  const headingLine = summary.topHeadings.length
    ? `Use headings like ${summary.topHeadings.join(', ')} when appropriate.`
    : 'Use concise clinical headings when helpful.';

  const bulletLine = summary.prefersBullets
    ? 'Prefer short bullet points or labeled lines.'
    : 'Prefer short paragraphs with clear sentence breaks.';

  const abbreviationLine = summary.abbreviationRate >= 0.08
    ? 'Retain common medical abbreviations and shorthand.'
    : 'Spell out terms unless already abbreviated.';

  return [
    `Match the writer's ${summary.tone} medical style with ~${summary.avgSentenceLength.toFixed(0)} words per sentence.`,
    bulletLine,
    abbreviationLine,
    headingLine,
    'Keep the content clinically precise and preserve the original meaning.',
  ].join(' ');
};

export const useWritingStyleProfile = () => {
  const [profile, setProfile] = React.useState<WritingStyleProfile>(DEFAULT_PROFILE);

  const summary = React.useMemo(() => buildSummary(profile), [profile]);
  const stylePrompt = React.useMemo(() => buildStylePrompt(summary), [summary]);

  const saveProfile = React.useCallback((nextProfile: WritingStyleProfile) => {
    setProfile(nextProfile);
  }, []);

  const updateFromSample = React.useCallback((text: string) => {
    if (!text.trim()) return;

    const words = extractWords(text);
    const sentences = extractSentences(text);
    const lines = extractLines(text);

    const abbreviations = countAbbreviations(words);
    const bulletLines = lines.filter(line => /^[-*•]|\d+\./.test(line)).length;
    const totalLines = lines.filter(Boolean).length;

    const nextHeadingCounts = { ...profile.headingCounts };
    lines.forEach(line => {
      const heading = extractHeading(line);
      if (!heading) return;
      nextHeadingCounts[heading] = (nextHeadingCounts[heading] ?? 0) + 1;
    });

    saveProfile({
      samples: profile.samples + 1,
      totalWords: profile.totalWords + words.length,
      totalSentences: profile.totalSentences + Math.max(sentences.length, 1),
      totalAbbreviations: profile.totalAbbreviations + abbreviations,
      totalBulletLines: profile.totalBulletLines + bulletLines,
      totalLines: profile.totalLines + totalLines,
      headingCounts: nextHeadingCounts,
      lastUpdated: new Date().toISOString(),
    });
  }, [profile, saveProfile]);

  const resetProfile = React.useCallback(() => {
    saveProfile({ ...DEFAULT_PROFILE, lastUpdated: new Date().toISOString() });
  }, [saveProfile]);

  return {
    profile,
    summary,
    stylePrompt,
    updateFromSample,
    resetProfile,
  };
};
