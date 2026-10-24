import { cosineSimilarity, embedTextLocal } from "@/lib/embed-local";
import { tokenize } from "@/lib/text";
import type { Citation } from "@/lib/types";

export const DEMO_MATCH_COUNT = 4;
export const DEMO_MIN_SCORE = 0.2;

export type RankableChunk = {
  id: string;
  documentId: string;
  documentName: string;
  content: string;
  pageNumber: number;
  chunkIndex: number;
  embedding: number[];
};

export function rankChunks(
  query: string,
  chunks: RankableChunk[],
  limit = DEMO_MATCH_COUNT,
): Citation[] {
  const queryEmbedding = embedTextLocal(query);
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  return chunks
    .map((chunk) => {
      const lexical = lexicalOverlap(queryTerms, tokenize(chunk.content));
      const cosine = cosineSimilarity(queryEmbedding, chunk.embedding);
      return {
        id: chunk.id,
        documentId: chunk.documentId,
        documentName: chunk.documentName,
        content: chunk.content,
        pageNumber: chunk.pageNumber,
        chunkIndex: chunk.chunkIndex,
        similarity: lexical === 0 ? 0 : cosine * 0.35 + lexical * 0.65,
      };
    })
    .filter((chunk) => chunk.similarity >= DEMO_MIN_SCORE)
    .sort(
      (left, right) =>
        right.similarity - left.similarity || left.chunkIndex - right.chunkIndex,
    )
    .slice(0, limit);
}

export function lexicalOverlap(queryTerms: string[], chunkTerms: string[]) {
  if (queryTerms.length === 0 || chunkTerms.length === 0) return 0;
  const chunkSet = new Set(chunkTerms);
  const uniqueQuery = [...new Set(queryTerms)];
  let hits = 0;
  for (const term of uniqueQuery) {
    if (chunkSet.has(term)) hits += 1;
  }
  return hits / uniqueQuery.length;
}
