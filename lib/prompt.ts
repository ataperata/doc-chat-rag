import { tokenize } from "@/lib/text";
import type { Citation } from "@/lib/types";

export function buildInstructions(sources: Citation[]) {
  const voice =
    "You are Folio, a careful reading assistant. Write plain prose. Do not use markdown headings, bullets, or tables. Cite passages inline as [1], [2], and so on. Never invent a page, quotation, or document.";

  if (sources.length === 0) {
    return `${voice} The library search returned no passages. Say that the selected documents do not contain the answer.`;
  }

  const passages = sources
    .map(
      (source, index) =>
        `[${index + 1}] ${source.documentName}, page ${source.pageNumber}\n${source.content}`,
    )
    .join("\n\n");

  return `${voice} Answer only from the numbered passages. If they do not contain the answer, say so.\n\nPassages:\n${passages}`;
}

export function bestSentences(content: string, terms: string[]) {
  const sentences = content
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  if (sentences.length === 0) return content.trim();

  const termSet = new Set(terms);
  const ranked = sentences
    .map((sentence) => ({
      sentence,
      score: tokenize(sentence).filter((token) => termSet.has(token)).length,
    }))
    .sort((left, right) => right.score - left.score);

  const picked = ranked.filter((item) => item.score > 0).slice(0, 2);
  const chosen = (picked.length > 0 ? picked : ranked.slice(0, 1)).map(
    (item) => item.sentence,
  );
  return chosen.join(" ");
}

export function composeDemoAnswer(question: string, sources: Citation[]) {
  if (sources.length === 0) {
    return "Nothing in the selected documents matches that question. Ask about something those pages cover, or add another PDF.";
  }

  const terms = tokenize(question);

  return sources
    .slice(0, 3)
    .map((source, index) => `${bestSentences(source.content, terms)} [${index + 1}]`)
    .join(" ");
}
