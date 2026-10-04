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
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/\s*[–—]\s*/g, " - ")
    .replace(/…/g, "...")
    .replace(/[  ​]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
