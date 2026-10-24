export type AppMode = "demo" | "live";

export type DocumentStatus = "processing" | "ready" | "failed";

export type PageText = {
  pageNumber: number;
  text: string;
};

export type TextChunk = {
  content: string;
  pageNumber: number;
  chunkIndex: number;
};

export type DocumentSummary = {
  id: string;
  name: string;
  pageCount: number;
  chunkCount: number;
  byteSize: number;
  status: DocumentStatus;
  error: string | null;
  createdAt: string;
};

export type Citation = {
  id: string;
  documentId: string;
  documentName: string;
  pageNumber: number;
  chunkIndex: number;
  content: string;
  similarity: number;
};

export type FolioMessageMetadata = {
  sources?: Citation[];
  mode?: AppMode;
};

export type PublicConfig = {
  mode: AppMode;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  maxUploadBytes: number;
  directUploadBytes: number;
  chatModel: string | null;
};
