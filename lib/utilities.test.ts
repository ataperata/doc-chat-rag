import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { embedTextLocal, cosineSimilarity } from "@/lib/embed-local";
import { resolveMode } from "@/lib/env";
import { formatBytes, isPdfFile, isSafeStoragePath, sanitizeFilename } from "@/lib/files";
import { ingestPages } from "@/lib/ingest";
import { messageText } from "@/lib/messages";
import { buildInstructions, composeDemoAnswer } from "@/lib/prompt";
import { rankChunks } from "@/lib/retrieve";
import { SAMPLE_PAGES, SAMPLE_TITLE } from "@/lib/sample";
import { memoryLibrary, resetMemoryLibrary } from "@/lib/store/memory";

describe("files", () => {
  it("sanitizes names and checks PDF bytes", () => {
    expect(sanitizeFilename("../My Report!.pdf")).toBe("My-Report-.pdf");
    expect(sanitizeFilename("notes")).toBe("notes.pdf");
    expect(formatBytes(1536)).toBe("2 KB");
    expect(isSafeStoragePath("library/11111111-1111-4111-8111-111111111111/notes.pdf")).toBe(true);
    expect(isSafeStoragePath("../secrets.pdf")).toBe(false);

    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
    expect(isPdfFile(bytes, "notes.pdf", "application/pdf")).toBe(true);
    expect(isPdfFile(bytes, "notes.txt", "application/pdf")).toBe(false);
  });
});

describe("mode", () => {
  it("stays in demo without credentials and goes live only when both sides are set", () => {
    expect(resolveMode({})).toBe("demo");
    expect(
      resolveMode({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
        AI_GATEWAY_API_KEY: "gateway",
      }),
    ).toBe("live");
    expect(
      resolveMode({
        FOLIO_DATA_MODE: "demo",
        AI_GATEWAY_API_KEY: "gateway",
        NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
        SUPABASE_SERVICE_ROLE_KEY: "service",
      }),
    ).toBe("demo");
  });
});

describe("retrieval and citations", () => {
  beforeEach(() => {
    resetMemoryLibrary();
    vi.stubEnv("FOLIO_DATA_MODE", "demo");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
  });

  it("embeds similar wording closer than an unrelated sentence", () => {
    const open = embedTextLocal("the reading room opens at 9:15");
    const hours = embedTextLocal("reading room open hours");
    const fog = embedTextLocal("the tagus fog delayed the steamer");
    expect(cosineSimilarity(open, hours)).toBeGreaterThan(cosineSimilarity(open, fog));
  });

  it("ranks the sample essay and cites the matching page", async () => {
    const saved = await ingestPages({
      name: SAMPLE_TITLE,
      pages: SAMPLE_PAGES,
      byteSize: 1200,
    });
    expect(saved.chunkCount).toBe(3);

    const stored = await memoryLibrary.listDocuments();
    expect(stored[0]?.name).toBe(SAMPLE_TITLE);

    const matched = await memoryLibrary.match({
      query: "When does the reading room open?",
      queryEmbedding: [],
      documentIds: [saved.id],
      matchCount: 3,
    });
    expect(matched[0]?.content).toMatch(/9:15/);
    expect(matched[0]?.pageNumber).toBe(1);

    const answer = composeDemoAnswer("When does the reading room open?", matched);
    expect(answer).toMatch(/9:15/);
    expect(answer).toMatch(/\[1\]/);

    const missed = rankChunks("quantum superconductors", [
      {
        id: "c1",
        documentId: saved.id,
        documentName: SAMPLE_TITLE,
        content: matched[0]?.content ?? "",
        pageNumber: 1,
        chunkIndex: 0,
        embedding: embedTextLocal(matched[0]?.content ?? ""),
      },
    ]);
    expect(composeDemoAnswer("quantum superconductors", missed)).toMatch(/Nothing in the selected/);

    const instructions = buildInstructions(matched);
    expect(instructions).toContain("[1]");
    expect(instructions).toContain("page 1");
  });

  it("reads text parts from a chat message", () => {
    expect(
      messageText({
        parts: [
          { type: "text", text: "When does it open?" },
          { type: "file", text: "ignore" },
        ],
      }),
    ).toBe("When does it open?");
  });
});

describe("migration", () => {
  it("enables pgvector, stores embeddings, and locks the match function down", () => {
    const sql = readFileSync("supabase/migrations/20261023235000_init_rag.sql", "utf8");
    expect(sql).toMatch(/create extension if not exists vector/i);
    expect(sql).toMatch(/document_chunks/);
    expect(sql).toMatch(/extensions\.vector\(1536\)/);
    expect(sql).toMatch(/match_document_chunks/);
    expect(sql).toMatch(/enable row level security/i);
    expect(sql).toMatch(/revoke all on table public\.documents from anon, authenticated/i);
    expect(sql).toMatch(/vector_cosine_ops/);
    expect(sql).toMatch(/storage\.buckets/);
  });
});
