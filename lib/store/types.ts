import type { Citation, DocumentSummary } from "@/lib/types";

export type StoredDocument = {
  id: string;
  name: string;
  storagePath: string | null;
  byteSize: number;
  pageCount: number;
  status: DocumentSummary["status"];
  error: string | null;
  createdAt: string;
};

export type StoredChunk = {
  id: string;
  documentId: string;
  content: string;
  pageNumber: number;
  chunkIndex: number;
  embedding: number[];
};

export type MatchOptions = {
  query: string;
  queryEmbedding: number[];
  documentIds: string[] | null;
  matchCount: number;
};

export interface LibraryStore {
  listDocuments(): Promise<DocumentSummary[]>;
  save(
    document: StoredDocument,
    chunks: StoredChunk[],
    pdf: { path: string; bytes: Uint8Array } | null,
  ): Promise<void>;
  deleteDocument(id: string): Promise<void>;
  downloadPdf(path: string): Promise<Uint8Array>;
  match(options: MatchOptions): Promise<Citation[]>;
}
