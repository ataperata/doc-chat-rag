import { rankChunks } from "@/lib/retrieve";
import { tokenize } from "@/lib/text";
import type { Citation, DocumentSummary } from "@/lib/types";
import type { LibraryStore, StoredChunk, StoredDocument } from "@/lib/store/types";

const documents = new Map<string, StoredDocument>();
const chunks = new Map<string, StoredChunk[]>();
// Token sets per chunk id, built once at save time for the lexical score.
const chunkTerms = new Map<string, ReadonlySet<string>>();

export function resetMemoryLibrary() {
  documents.clear();
  chunks.clear();
  chunkTerms.clear();
}

function forgetTerms(documentId: string) {
  for (const chunk of chunks.get(documentId) ?? []) chunkTerms.delete(chunk.id);
}

function toSummary(document: StoredDocument): DocumentSummary {
  return {
    id: document.id,
    name: document.name,
    pageCount: document.pageCount,
    chunkCount: chunks.get(document.id)?.length ?? 0,
    byteSize: document.byteSize,
    status: document.status,
    error: document.error,
    createdAt: document.createdAt,
  };
}

export const memoryLibrary: LibraryStore = {
  async listDocuments() {
    return [...documents.values()]
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map(toSummary);
  },

  async save(document, nextChunks) {
    forgetTerms(document.id);
    documents.set(document.id, document);
    chunks.set(document.id, nextChunks);
    for (const chunk of nextChunks) chunkTerms.set(chunk.id, new Set(tokenize(chunk.content)));
  },

  async deleteDocument(id) {
    forgetTerms(id);
    documents.delete(id);
    chunks.delete(id);
  },

  async downloadPdf() {
    throw new Error("Demo mode does not keep the original PDF bytes.");
  },

  async match({ query, documentIds, matchCount }): Promise<Citation[]> {
    const allowed = new Set(documentIds ?? []);
    const pool = [...documents.values()]
      .filter((document) => document.status === "ready")
      .filter((document) => documentIds === null || allowed.has(document.id))
      .flatMap((document) =>
        (chunks.get(document.id) ?? []).map((chunk) => ({
          ...chunk,
          documentName: document.name,
          terms: chunkTerms.get(chunk.id),
        })),
      );

    return rankChunks(query, pool, matchCount);
  },
};
