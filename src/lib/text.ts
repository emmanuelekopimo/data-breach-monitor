const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

/**
 * Strips HTML tags and entities and replaces typographic characters
 * (curly quotes, en and em dashes, ellipses) with plain ASCII.
 */
export function cleanText(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/&[a-z#0-9]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? " ")
    .replace(/[\u2018\u2019\u201A\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/\s*[\u2013\u2014]\s*/g, " - ")
    .replace(/\u2026/g, "...")
    .replace(/[\u00A0\u2009\u200B]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
