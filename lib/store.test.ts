import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ingestPages } from "@/lib/ingest";
import { SAMPLE_PAGES, SAMPLE_TITLE } from "@/lib/sample";
import { memoryLibrary, resetMemoryLibrary } from "@/lib/store/memory";
import { supabaseLibrary } from "@/lib/store/supabase";
import type { StoredChunk, StoredDocument } from "@/lib/store/types";

const DOC_ID = "11111111-1111-4111-8111-111111111111";

function storedDocument(): StoredDocument {
  return {
    id: DOC_ID,
    name: "Notes",
    storagePath: null,
    byteSize: 10,
    pageCount: 1,
    status: "ready",
    error: null,
    createdAt: "2026-11-21T00:00:00.000Z",
  };
}

function storedChunks(count: number): StoredChunk[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `chunk-${index}`,
    documentId: DOC_ID,
    content: `passage ${index}`,
    pageNumber: 1,
    chunkIndex: index,
    embedding: [0.1, 0.2],
  }));
}

describe("memory library", () => {
  beforeEach(() => {
    vi.stubEnv("FOLIO_DATA_MODE", "demo");
    resetMemoryLibrary();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns the saved summary without reloading and keeps matching after a delete", async () => {
    const listSpy = vi.spyOn(memoryLibrary, "listDocuments");
    const first = await ingestPages({ name: SAMPLE_TITLE, pages: SAMPLE_PAGES, byteSize: 1200 });
    expect(listSpy).not.toHaveBeenCalled();
    listSpy.mockRestore();
    expect(first).toEqual((await memoryLibrary.listDocuments())[0]);

    const second = await ingestPages({ name: "Copy", pages: SAMPLE_PAGES, byteSize: 1200 });
    await memoryLibrary.deleteDocument(first.id);

    const matched = await memoryLibrary.match({
      query: "When does the reading room open?",
      queryEmbedding: [],
      documentIds: null,
      matchCount: 3,
    });
    expect(matched.length).toBeGreaterThan(0);
    expect(matched.every((citation) => citation.documentId === second.id)).toBe(true);
    expect(matched[0]?.content).toMatch(/9:15/);
  });
});

describe("supabase library", () => {
  let requests: { method: string; url: URL }[];
  let inFlight: number;
  let peak: number;
  let failChunkInsert: boolean;

  beforeEach(() => {
    vi.stubEnv("FOLIO_DATA_MODE", "live");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    vi.stubEnv("AI_GATEWAY_API_KEY", "gateway");
    requests = [];
    inFlight = 0;
    peak = 0;
    failChunkInsert = false;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
        requests.push({ method, url });
        inFlight += 1;
        peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 20));
        inFlight -= 1;
        if (url.pathname.endsWith("/document_chunks") && failChunkInsert) {
          return new Response(JSON.stringify({ message: "insert failed" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        if (method === "DELETE") {
          return new Response(JSON.stringify([{ storage_path: null }]), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        return new Response(null, { status: 201 });
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sends chunk batches concurrently", async () => {
    await supabaseLibrary.save(storedDocument(), storedChunks(200), null);
    const chunkInserts = requests.filter((request) => request.url.pathname.endsWith("/document_chunks"));
    expect(chunkInserts).toHaveLength(8);
    expect(peak).toBe(8);
  });

  it("removes the document when a chunk batch fails", async () => {
    failChunkInsert = true;
    await expect(supabaseLibrary.save(storedDocument(), storedChunks(60), null)).rejects.toThrow("insert failed");
    const last = requests.at(-1);
    expect(last?.method).toBe("DELETE");
    expect(last?.url.pathname).toMatch(/\/documents$/);
  });

  it("deletes a document in one database request", async () => {
    await supabaseLibrary.deleteDocument(DOC_ID);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.method).toBe("DELETE");
    expect(requests[0]?.url.searchParams.get("select")).toBe("storage_path");
  });
});
