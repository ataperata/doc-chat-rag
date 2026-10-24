import { extractPdfPages } from "@/lib/pdf";
import { ingestPages } from "@/lib/ingest";
import { resolveMode } from "@/lib/env";
import { isPdfFile, isSafeStoragePath, MAX_PDF_BYTES, sanitizeFilename } from "@/lib/files";
import { HttpError, publicError } from "@/lib/http";
import { getLibrary } from "@/lib/store";

export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    if (resolveMode() !== "live") {
      throw new HttpError("Direct upload is used in demo mode.", 400);
    }

    const body = (await request.json()) as {
      path?: unknown;
      name?: unknown;
      byteSize?: unknown;
    };
    if (typeof body.path !== "string" || !isSafeStoragePath(body.path)) {
      throw new HttpError("The storage path was rejected.", 400);
    }
    if (typeof body.name !== "string" || body.name.trim().length === 0) {
      throw new HttpError("The PDF needs a name.", 400);
    }
    if (
      typeof body.byteSize !== "number" ||
      body.byteSize <= 0 ||
      body.byteSize > MAX_PDF_BYTES
    ) {
      throw new HttpError("PDFs must be between 1 byte and 20 MB.", 413);
    }

    const bytes = await getLibrary().downloadPdf(body.path);
    const filename = sanitizeFilename(body.name);
    if (!isPdfFile(bytes, filename)) {
      throw new HttpError("Storage did not contain a PDF at that path.", 415);
    }

    const pages = await extractPdfPages(bytes);
    const document = await ingestPages({
      name: filename.replace(/\.pdf$/i, "").replaceAll("-", " "),
      pages,
      byteSize: body.byteSize,
      bytes,
      storagePath: body.path,
    });

    return Response.json({ document }, { status: 201 });
  } catch (error) {
    return publicError(error, "The uploaded PDF could not be indexed.");
  }
}
