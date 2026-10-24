import { createClient } from "@supabase/supabase-js";
import { assertLiveConfig, resolveMode } from "@/lib/env";
import {
  isSafeStoragePath,
  MAX_PDF_BYTES,
  PDF_BUCKET,
  sanitizeFilename,
  storagePathFor,
} from "@/lib/files";
import { HttpError, publicError } from "@/lib/http";

export async function POST(request: Request) {
  try {
    if (resolveMode() !== "live") {
      throw new HttpError("Signed uploads are used only when Supabase is configured.", 400);
    }

    const body = (await request.json()) as { filename?: unknown; byteSize?: unknown };
    if (typeof body.filename !== "string" || !body.filename.toLowerCase().endsWith(".pdf")) {
      throw new HttpError("Choose a PDF to upload.", 415);
    }
    if (typeof body.byteSize !== "number" || body.byteSize <= 0 || body.byteSize > MAX_PDF_BYTES) {
      throw new HttpError("PDFs must be between 1 byte and 20 MB.", 413);
    }

    const config = assertLiveConfig();
    const path = storagePathFor(crypto.randomUUID(), sanitizeFilename(body.filename));
    if (!isSafeStoragePath(path)) throw new HttpError("The storage path was rejected.", 400);

    const supabase = createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase.storage
      .from(PDF_BUCKET)
      .createSignedUploadUrl(path);

    if (error || !data) {
      throw new Error(error?.message ?? "Supabase did not return an upload URL.");
    }

    return Response.json({
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
    });
  } catch (error) {
    return publicError(error, "An upload URL could not be created.");
  }
}
