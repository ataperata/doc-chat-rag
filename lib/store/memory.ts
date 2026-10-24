import { rankChunks } from "@/lib/retrieve";
import type { Citation, DocumentSummary } from "@/lib/types";
import type { LibraryStore, StoredChunk, StoredDocument } from "@/lib/store/types";

const documents = new Map<string, StoredDocument>();
const chunks = new Map<string, StoredChunk[]>();

export function resetMemoryLibrary() {
  documents.clear();
  chunks.clear();
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
    documents.set(document.id, document);
    chunks.set(document.id, nextChunks);
  },

  async deleteDocument(id) {
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
        })),
      );

    return rankChunks(query, pool, matchCount);
  },
};
