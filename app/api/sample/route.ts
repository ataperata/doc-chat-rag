import { ingestPages } from "@/lib/ingest";
import { HttpError, publicError } from "@/lib/http";
import { SAMPLE_PAGES, SAMPLE_TITLE } from "@/lib/sample";
import { getLibrary } from "@/lib/store";

export async function POST() {
  try {
    const existing = (await getLibrary().listDocuments()).find(
      (document) => document.name === SAMPLE_TITLE && document.status === "ready",
    );
    if (existing) return Response.json({ document: existing });

    const byteSize = new TextEncoder().encode(
      SAMPLE_PAGES.map((page) => page.text).join("\n"),
    ).byteLength;
    const document = await ingestPages({
      name: SAMPLE_TITLE,
      pages: SAMPLE_PAGES,
      byteSize,
    });
    return Response.json({ document }, { status: 201 });
  } catch (error) {
    if (error instanceof HttpError) return publicError(error, error.message);
    return publicError(error, "The sample essay could not be added.");
  }
}
