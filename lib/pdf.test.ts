import { describe, expect, it } from "vitest";
import { extractPdfPages } from "@/lib/pdf";

describe("extractPdfPages", () => {
  it("reads one text page from a tiny PDF", async () => {
    const pages = await extractPdfPages(buildSimplePdf(["Hello from page one."]));
    expect(pages).toHaveLength(1);
    expect(pages[0]?.pageNumber).toBe(1);
    expect(pages[0]?.text).toMatch(/Hello from page one/);
  });
});

function buildSimplePdf(pageTexts: string[]) {
  const escaped = pageTexts.map((text) =>
    text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)"),
  );
  const chunks = ["%PDF-1.4\n"];
  const offsets = [0];

  function pushObject(id: number, body: string) {
    offsets[id] = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    chunks.push(`${id} 0 obj\n${body}\nendobj\n`);
  }

  const pageIds = escaped.map((_, index) => 4 + index * 2);
  const contentIds = escaped.map((_, index) => 5 + index * 2);

  pushObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
  pushObject(
    2,
    `<< /Type /Pages /Count ${escaped.length} /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] >>`,
  );
  pushObject(3, "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  escaped.forEach((text, index) => {
    const stream = `BT /F1 18 Tf 48 120 Td (${text}) Tj ET`;
    pushObject(
      pageIds[index] ?? 0,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentIds[index]} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
    );
    pushObject(
      contentIds[index] ?? 0,
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    );
  });

  const size = 4 + escaped.length * 2;
  const xrefStart = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  let xref = `xref\n0 ${size}\n0000000000 65535 f \n`;
  for (let id = 1; id < size; id += 1) {
    xref += `${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  chunks.push(xref);
  return new TextEncoder().encode(chunks.join(""));
}
