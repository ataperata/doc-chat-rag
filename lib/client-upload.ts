import type { DocumentSummary, PublicConfig } from "@/lib/types";

export async function readApi<T>(response: Response): Promise<T> {
  const text = await response.text();
  const body = text ? (JSON.parse(text) as T & { error?: string }) : ({} as T & { error?: string });
  if (!response.ok) {
    throw new Error(body.error || "The request failed.");
  }
  return body;
}

export async function uploadPdf(file: File, config: PublicConfig) {
  if (
    config.mode === "live" &&
    file.size > config.directUploadBytes &&
    config.supabaseUrl &&
    config.supabaseAnonKey
  ) {
    const signed = await readApi<{ path: string; token: string }>(
      await fetch("/api/uploads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ filename: file.name, byteSize: file.size }),
      }),
    );
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(config.supabaseUrl, config.supabaseAnonKey);
    const { error } = await supabase.storage
      .from("pdfs")
      .uploadToSignedUrl(signed.path, signed.token, file, {
        contentType: "application/pdf",
      });
    if (error) throw new Error(error.message);

    const ingested = await readApi<{ document: DocumentSummary }>(
      await fetch("/api/documents/ingest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          path: signed.path,
          name: file.name,
          byteSize: file.size,
        }),
      }),
    );
    return ingested.document;
  }

  const form = new FormData();
  form.set("file", file);
  const uploaded = await readApi<{ document: DocumentSummary }>(
    await fetch("/api/documents", { method: "POST", body: form }),
  );
  return uploaded.document;
}
