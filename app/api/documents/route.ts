import { headers } from "next/headers";
import { extractPdfPages } from "@/lib/pdf";
import { ingestPages } from "@/lib/ingest";
import {
  DIRECT_UPLOAD_BYTES,
  isPdfFile,
  MAX_PDF_BYTES,
  sanitizeFilename,
} from "@/lib/files";
import { HttpError, publicError } from "@/lib/http";
import { resolveMode } from "@/lib/env";
import { getLibrary } from "@/lib/store";

export const maxDuration = 120;

export async function GET() {
  await headers();
  try {
    const documents = await getLibrary().listDocuments();
    return Response.json({ documents, mode: resolveMode() });
  } catch (error) {
    return publicError(error, "The library could not be loaded.");
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new HttpError("Choose a PDF to upload.", 400);
    }

    const limit = resolveMode() === "live" ? DIRECT_UPLOAD_BYTES : MAX_PDF_BYTES;
    if (file.size > limit) {
      throw new HttpError(
        resolveMode() === "live"
          ? "Files over 4 MB upload straight to Supabase Storage. Retry the drop and the desk will switch paths."
          : "That PDF is larger than 20 MB.",
        413,
      );
    }
    if (file.size === 0) throw new HttpError("That PDF is empty.", 400);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const filename = sanitizeFilename(file.name || "document.pdf");
    if (!isPdfFile(bytes, filename, file.type)) {
      throw new HttpError("Only PDF files can be added to the library.", 415);
    }

    const pages = await extractPdfPages(bytes);
    const document = await ingestPages({
      name: filename.replace(/\.pdf$/i, "").replaceAll("-", " "),
      pages,
      byteSize: file.size,
      bytes,
    });

    return Response.json({ document }, { status: 201 });
  } catch (error) {
    return publicError(error, "The PDF could not be indexed.");
  }
}
