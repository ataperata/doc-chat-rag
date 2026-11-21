import { chunkPages } from "@/lib/chunk";
import { embedTexts } from "@/lib/embeddings";
import { storagePathFor } from "@/lib/files";
import { HttpError } from "@/lib/http";
import { getLibrary } from "@/lib/store";
import type { StoredDocument } from "@/lib/store/types";
import type { DocumentSummary, PageText } from "@/lib/types";

const MAX_CHUNKS = 200;

export async function ingestPages(input: {
  name: string;
  pages: PageText[];
  byteSize: number;
  bytes?: Uint8Array | null;
  storagePath?: string | null;
}) {
  const chunks = chunkPages(input.pages);
  if (chunks.length === 0) {
    throw new HttpError("The document did not contain enough text to index.", 422);
  }
  if (chunks.length > MAX_CHUNKS) {
    throw new HttpError(
      `This document split into ${chunks.length} passages. The limit is ${MAX_CHUNKS}. Try a shorter PDF.`,
      413,
    );
  }

  const embeddings = await embedTexts(chunks.map((chunk) => chunk.content));
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const storagePath =
    input.storagePath ??
    (input.bytes && input.bytes.byteLength > 0 ? storagePathFor(id, input.name) : null);

  const document: StoredDocument = {
    id,
    name: input.name,
    storagePath,
    byteSize: input.byteSize,
    pageCount: input.pages.length,
    status: "ready",
    error: null,
    createdAt,
  };
  await getLibrary().save(
    document,
    chunks.map((chunk, index) => ({
      id: crypto.randomUUID(),
      documentId: id,
      content: chunk.content,
      pageNumber: chunk.pageNumber,
      chunkIndex: chunk.chunkIndex,
      embedding: embeddings[index] ?? [],
    })),
    storagePath && input.bytes && !input.storagePath
      ? { path: storagePath, bytes: input.bytes }
      : null,
  );

  // Everything in the summary is already known here, so there is no need to
  // reload the whole library just to find the row that was inserted.
  const saved: DocumentSummary = {
    id,
    name: document.name,
    pageCount: document.pageCount,
    chunkCount: chunks.length,
    byteSize: document.byteSize,
    status: document.status,
    error: document.error,
    createdAt,
  };
  return saved;
}
