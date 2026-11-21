import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { assertLiveConfig } from "@/lib/env";
import { PDF_BUCKET } from "@/lib/files";
import { HttpError } from "@/lib/http";
import type { Citation, DocumentSummary } from "@/lib/types";
import type { LibraryStore, MatchOptions, StoredChunk, StoredDocument } from "@/lib/store/types";

type MatchRow = {
  id: string;
  document_id: string;
  document_name: string;
  content: string;
  page_number: number;
  chunk_index: number;
  similarity: number;
};

const CHUNK_BATCH = 25;

let client: SupabaseClient | null = null;

function admin() {
  if (client) return client;
  const config = assertLiveConfig();
  client = createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

function countOf(value: unknown) {
  if (!Array.isArray(value) || !value[0] || typeof value[0] !== "object") return 0;
  const count = (value[0] as { count?: unknown }).count;
  return typeof count === "number" ? count : Number(count) || 0;
}

export const supabaseLibrary: LibraryStore = {
  async listDocuments() {
    const { data, error } = await admin()
      .from("documents")
      .select(
        "id, name, page_count, byte_size, status, error, created_at, document_chunks(count)",
      )
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      pageCount: Number(row.page_count) || 0,
      chunkCount: countOf(row.document_chunks),
      byteSize: Number(row.byte_size) || 0,
      status: row.status as DocumentSummary["status"],
      error: row.error ? String(row.error) : null,
      createdAt: String(row.created_at),
    }));
  },

  async save(document: StoredDocument, nextChunks: StoredChunk[], pdf) {
    const db = admin();

    if (pdf) {
      const { error } = await db.storage.from(PDF_BUCKET).upload(pdf.path, pdfBytes(pdf.bytes), {
        contentType: "application/pdf",
        upsert: false,
      });
      if (error) throw new Error(error.message);
    }

    const { error: documentError } = await db.from("documents").insert({
      id: document.id,
      name: document.name,
      storage_path: document.storagePath,
      byte_size: document.byteSize,
      page_count: document.pageCount,
      status: document.status,
      error: document.error,
      created_at: document.createdAt,
    });

    if (documentError) {
      if (pdf) await db.storage.from(PDF_BUCKET).remove([pdf.path]);
      throw new Error(documentError.message);
    }

    // Each row carries a 1536-float embedding, so rows go in batches of 25.
    // The batches are independent and are sent together instead of one
    // round trip after another.
    const batches: StoredChunk[][] = [];
    for (let index = 0; index < nextChunks.length; index += CHUNK_BATCH) {
      batches.push(nextChunks.slice(index, index + CHUNK_BATCH));
    }
    const results = await Promise.allSettled(
      batches.map(async (batch) => {
        const rows = batch.map((chunk) => ({
          id: chunk.id,
          document_id: chunk.documentId,
          content: chunk.content,
          page_number: chunk.pageNumber,
          chunk_index: chunk.chunkIndex,
          embedding: chunk.embedding,
        }));
        const { error } = await db.from("document_chunks").insert(rows);
        if (error) throw new Error(error.message);
      }),
    );
    const failed = results.find((result) => result.status === "rejected");
    if (failed) {
      // Deleting the document cascades to any batches that did land.
      await db.from("documents").delete().eq("id", document.id);
      if (pdf) await db.storage.from(PDF_BUCKET).remove([pdf.path]);
      throw failed.reason;
    }
  },

  async deleteDocument(id) {
    const db = admin();
    // One round trip: delete the row and read back its storage path.
    const { data, error } = await db
      .from("documents")
      .delete()
      .eq("id", id)
      .select("storage_path");
    if (error) throw new Error(error.message);

    const path = data?.[0]?.storage_path;
    if (typeof path === "string" && path.length > 0) {
      await db.storage.from(PDF_BUCKET).remove([path]);
    }
  },

  async downloadPdf(path) {
    const { data, error } = await admin().storage.from(PDF_BUCKET).download(path);
    if (error || !data) {
      throw new HttpError("The uploaded PDF could not be read back from storage.", 422);
    }
    return new Uint8Array(await data.arrayBuffer());
  },

  async match(options: MatchOptions): Promise<Citation[]> {
    const { data, error } = await admin().rpc("match_document_chunks", {
      query_embedding: options.queryEmbedding,
      match_threshold: 0.2,
      match_count: options.matchCount,
      filter_document_ids: options.documentIds,
    });

    if (error) throw new Error(error.message);

    return ((data ?? []) as MatchRow[]).map((row) => ({
      id: row.id,
      documentId: row.document_id,
      documentName: row.document_name,
      content: row.content,
      pageNumber: row.page_number,
      chunkIndex: row.chunk_index,
      similarity: row.similarity,
    }));
  },
};

function pdfBytes(bytes: Uint8Array) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}
