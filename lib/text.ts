const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "of",
  "to",
  "and",
  "or",
  "in",
  "on",
  "for",
  "from",
  "what",
  "when",
  "where",
  "who",
  "why",
  "how",
  "does",
  "do",
  "did",
  "is",
  "was",
  "were",
  "be",
  "now",
  "that",
  "this",
  "with",
  "at",
  "by",
  "it",
  "its",
  "are",
  "as",
]);

export function normalizePageText(text: string) {
  return text
    .replaceAll("\u0000", "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function stem(token: string) {
  if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

export function tokenize(text: string) {
  return text
    .toLowerCase()
    .replaceAll("'", "")
    .replaceAll("’", "")
    .split(/[^a-z0-9:]+/)
    .map(stem)
    .filter((token) => token.length > 1 && !STOP_WORDS.has(token));
}
