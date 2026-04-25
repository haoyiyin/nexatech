/**
 * Extracts plain text from HTML content.
 * HTML is never rendered as markup in the app.
 */
const HTML_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

const HTML_ATTRIBUTE_PATTERN = String.raw`\s+[\w:-]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^'"<>\s]+))?`;
const HTML_TAG_SUFFIX_PATTERN = String.raw`(?:${HTML_ATTRIBUTE_PATTERN})*\s*\/?>`;
const LINE_BREAK_SENTINEL = "\u0000LINE_BREAK_SENTINEL\u0000";
const BR_TAG_PATTERN = new RegExp(String.raw`<br\b${HTML_TAG_SUFFIX_PATTERN}`, "gi");
const BLOCK_TAG_PATTERN = new RegExp(
  String.raw`<\/?(?:p|div|tr|li|h[1-6]|ul|ol)\b${HTML_TAG_SUFFIX_PATTERN}`,
  "gi"
);
const GENERIC_TAG_PATTERN = new RegExp(
  String.raw`<\/?[a-z][\w:-]*\b${HTML_TAG_SUFFIX_PATTERN}`,
  "gi"
);
const SCRIPT_TAG_PATTERN = new RegExp(
  String.raw`<script\b(?:${HTML_ATTRIBUTE_PATTERN})*\s*>[\s\S]*?(?:<\/script\s*>|$)`,
  "gi"
);
const STYLE_TAG_PATTERN = new RegExp(
  String.raw`<style\b(?:${HTML_ATTRIBUTE_PATTERN})*\s*>[\s\S]*?(?:<\/style\s*>|$)`,
  "gi"
);

export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) {
    return "";
  }

  return html
    .replace(BR_TAG_PATTERN, LINE_BREAK_SENTINEL)
    .replace(SCRIPT_TAG_PATTERN, "")
    .replace(STYLE_TAG_PATTERN, "")
    .replace(BLOCK_TAG_PATTERN, "\n")
    .replace(GENERIC_TAG_PATTERN, "")
    .replace(/&([a-zA-Z]+);/g, (match, entity: string) => HTML_ENTITIES[entity] ?? match)
    .replace(/&#(\d+);/g, (_, codePoint: string) => decodeCodePoint(Number.parseInt(codePoint, 10)))
    .replace(/&#x([\da-fA-F]+);/g, (_, codePoint: string) =>
      decodeCodePoint(Number.parseInt(codePoint, 16))
    )
    .replace(/\n[\t ]+/g, "\n")
    .replace(/[\t ]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .replace(/(?:\u0000LINE_BREAK_SENTINEL\u0000){2,}/g, "\n\n")
    .replace(/\u0000LINE_BREAK_SENTINEL\u0000/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeCodePoint(codePoint: number): string {
  if (!Number.isFinite(codePoint) || codePoint <= 0) {
    return "";
  }

  try {
    return String.fromCodePoint(codePoint);
  } catch {
    return "";
  }
}
