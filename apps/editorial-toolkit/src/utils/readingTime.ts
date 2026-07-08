/**
 * Reading-time estimation. This MUST stay in sync with the authoritative
 * webhook formula (src/app/api/webhooks/reading-time/route.ts) so the live
 * preview in the editor matches the value written on publish.
 *
 *   minutes = max(1, round(words / 200))
 *
 * Only the body's own text is counted — embedded entries are deliberately
 * ignored (counting them inflated the estimate severalfold in the source
 * platform).
 */

export const WORDS_PER_MINUTE = 200;

type RichTextNode = {
  nodeType?: string;
  value?: string;
  content?: RichTextNode[];
};

export function richTextToPlainText(node: RichTextNode | undefined | null): string {
  if (!node) return "";
  if (node.nodeType === "text" && typeof node.value === "string") return node.value;
  if (Array.isArray(node.content)) {
    return node.content.map(richTextToPlainText).join(" ");
  }
  return "";
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  if (words > 1) return words;
  // Fallback for scripts without whitespace word boundaries (e.g. CJK).
  const chars = trimmed.replace(/\s+/g, "").length;
  return Math.max(words, chars ? Math.ceil(chars / 5) : 0);
}

export function calcReadingMinutes(doc: RichTextNode | undefined | null): number {
  const words = countWords(richTextToPlainText(doc));
  if (words === 0) return 0;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}
