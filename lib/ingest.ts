import { chunkPages } from "@/lib/chunk";
import { embedTexts } from "@/lib/embeddings";
import { storagePathFor } from "@/lib/files";
import { HttpError } from "@/lib/http";
import { getLibrary } from "@/lib/store";
import type { PageText } from "@/lib/types";

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

  await getLibrary().save(
    {
      id,
      name: input.name,
      storagePath,
      byteSize: input.byteSize,
      pageCount: input.pages.length,
      status: "ready",
      error: null,
      createdAt,
    },
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

  const documents = await getLibrary().listDocuments();
  const saved = documents.find((document) => document.id === id);
  if (!saved) throw new Error("The document was saved but could not be reloaded.");
  return saved;
}
