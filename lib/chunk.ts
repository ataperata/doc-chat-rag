import type { PageText, TextChunk } from "@/lib/types";
import { normalizePageText } from "@/lib/text";

export type ChunkOptions = {
  maxChars?: number;
  overlap?: number;
};

const DEFAULT_MAX_CHARS = 1200;
const DEFAULT_OVERLAP = 180;
const MIN_PAGE_CHARS = 20;

export function chunkPages(pages: PageText[], options: ChunkOptions = {}): TextChunk[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlap = options.overlap ?? DEFAULT_OVERLAP;

  if (!Number.isInteger(maxChars) || maxChars < 80) {
    throw new Error("maxChars must be an integer of at least 80.");
  }
  if (!Number.isInteger(overlap) || overlap < 0 || overlap >= maxChars) {
    throw new Error("overlap must be a non-negative integer smaller than maxChars.");
  }

  const chunks: TextChunk[] = [];

  for (const page of pages) {
    if (!Number.isInteger(page.pageNumber) || page.pageNumber < 1) {
      throw new Error("pageNumber must be a positive integer.");
    }

    const text = normalizePageText(page.text ?? "");
    if (text.replace(/\s/g, "").length < MIN_PAGE_CHARS) continue;

    for (const part of splitWithOverlap(text, maxChars, overlap)) {
      chunks.push({
        content: part,
        pageNumber: page.pageNumber,
        chunkIndex: chunks.length,
      });
    }
  }

  return chunks;
}

function splitWithOverlap(text: string, maxChars: number, overlap: number) {
  if (text.length <= maxChars) return [text];

  const parts: string[] = [];
  let start = 0;

  while (start < text.length) {
    if (text.length - start <= maxChars) {
      const tail = text.slice(start).trim();
      if (tail) parts.push(tail);
      break;
    }

    const windowEnd = start + maxChars;
    let end = findBreak(text, start, windowEnd);
    if (end <= start) end = Math.min(windowEnd, text.length);

    const piece = text.slice(start, end).trim();
    if (piece) parts.push(piece);

    const next = Math.max(end - overlap, start + 1);
    const snapped = snapForward(text, next, end);
    start = snapped > start ? snapped : end;
  }

  return parts;
}

function findBreak(text: string, start: number, windowEnd: number) {
  const slice = text.slice(start, windowEnd);
  const minimum = Math.floor(slice.length * 0.5);
  const markers = ["\n\n", "\n", ". ", "? ", "! ", "; ", ", ", " "];

  for (const marker of markers) {
    const index = slice.lastIndexOf(marker);
    if (index >= minimum) return start + index + marker.length;
  }

  return windowEnd;
}

function snapForward(text: string, index: number, limit: number) {
  let cursor = index;
  while (cursor < limit && /\s/.test(text[cursor] ?? "")) cursor += 1;
  return cursor;
}
