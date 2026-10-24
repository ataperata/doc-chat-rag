import { describe, expect, it } from "vitest";
import { chunkPages } from "@/lib/chunk";

describe("chunkPages", () => {
  it("keeps a short page as one chunk and drops near-empty pages", () => {
    const chunks = chunkPages([
      { pageNumber: 1, text: "   " },
      { pageNumber: 2, text: "Hi" },
      { pageNumber: 3, text: "The reading room opens at 9:15 and closes at 18:40." },
    ]);

    expect(chunks).toEqual([
      {
        content: "The reading room opens at 9:15 and closes at 18:40.",
        pageNumber: 3,
        chunkIndex: 0,
      },
    ]);
  });

  it("splits long pages on whitespace and carries an overlap", () => {
    const text = Array.from({ length: 220 }, (_, index) => `word${index}`).join(" ");
    const chunks = chunkPages([{ pageNumber: 4, text }], { maxChars: 280, overlap: 60 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.pageNumber === 4)).toBe(true);
    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual(chunks.map((_, index) => index));
    expect(chunks[0]?.content.length).toBeLessThanOrEqual(280);

    const nextStart = chunks[1]?.content.split(" ")[0];
    expect(nextStart).toBeTruthy();
    expect(chunks[0]?.content.includes(nextStart ?? "")).toBe(true);
  });

  it("advances through a page with no spaces", () => {
    const text = "x".repeat(500);
    const chunks = chunkPages([{ pageNumber: 1, text }], { maxChars: 120, overlap: 20 });
    expect(chunks.length).toBeGreaterThan(2);
    expect(chunks.at(-1)?.content.endsWith("x")).toBe(true);
    expect(chunks.reduce((total, chunk) => total + chunk.content.length, 0)).toBeGreaterThan(500);
  });

  it("rejects an overlap that is not smaller than the window", () => {
    expect(() => chunkPages([{ pageNumber: 1, text: "x".repeat(100) }], { maxChars: 80, overlap: 80 })).toThrow(
      /overlap/,
    );
  });
});
