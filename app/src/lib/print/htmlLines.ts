import { sanitizeHtml } from "@/lib/sanitize";
import type { PatientMedications } from "@/types/patient";

const BLOCK_TAGS = new Set([
  "DIV",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "LI",
  "OL",
  "P",
  "TABLE",
  "TD",
  "TH",
  "TR",
  "UL",
]);

/**
 * Split stored clinical HTML into the source lines a clinician actually typed.
 *
 * Line breaks that already exist in the source are the only split points, so a
 * caller can reproduce every line verbatim without merging, condensing, or
 * rewording clinical content.
 */
export const htmlToSourceLines = (html: string): string[] => {
  if (!html) return [];

  const container = document.createElement("div");
  container.innerHTML = sanitizeHtml(html);

  const readNode = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const element = node as HTMLElement;
    if (element.tagName === "BR") return "\n";

    const content = Array.from(element.childNodes).map(readNode).join("");
    return BLOCK_TAGS.has(element.tagName) ? `${content}\n` : content;
  };

  return Array.from(container.childNodes)
    .map(readNode)
    .join("")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);
};

/** Structured medications rendered as one source line per category. */
export const medicationSourceLines = (medications?: PatientMedications): string[] => {
  if (!medications) return [];
  const lines: string[] = [];
  if (medications.infusions?.length) lines.push(`Infusions: ${medications.infusions.join(", ")}`);
  if (medications.scheduled?.length) lines.push(`Scheduled: ${medications.scheduled.join(", ")}`);
  if (medications.prn?.length) lines.push(`PRN: ${medications.prn.join(", ")}`);
  if (!lines.length && medications.rawText) lines.push(...htmlToSourceLines(medications.rawText));
  return lines;
};
