export const MAX_PDF_BYTES = 20 * 1024 * 1024;
export const DIRECT_UPLOAD_BYTES = 4 * 1024 * 1024;
export const PDF_BUCKET = "pdfs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID_PATTERN.test(value);
}

export function sanitizeFilename(name: string) {
  const base = name.split(/[/\\]/).pop() ?? "document.pdf";
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const withPdf = cleaned.toLowerCase().endsWith(".pdf")
    ? cleaned
    : `${cleaned || "document"}.pdf`;
  return withPdf.slice(0, 120);
}

export function storagePathFor(id: string, filename: string) {
  return `library/${id}/${sanitizeFilename(filename)}`;
}

export function isSafeStoragePath(path: string) {
  return /^library\/[0-9a-f-]{36}\/[A-Za-z0-9._-]{1,120}$/.test(path);
}

export function isPdfFile(bytes: Uint8Array, filename: string, mime?: string) {
  const header = String.fromCharCode(...bytes.subarray(0, 5));
  const nameOk = filename.toLowerCase().endsWith(".pdf");
  const mimeOk =
    !mime || mime === "application/pdf" || mime === "application/octet-stream";
  return header === "%PDF-" && nameOk && mimeOk;
}

export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
