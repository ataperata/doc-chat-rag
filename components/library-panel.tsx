import { formatBytes } from "@/lib/files";
import { SAMPLE_TITLE } from "@/lib/sample";
import type { AppMode, DocumentSummary } from "@/lib/types";

type LibraryPanelProps = {
  documents: DocumentSummary[];
  selectedIds: string[];
  mode: AppMode | null;
  busy: boolean;
  error: string | null;
  onToggle: (id: string) => void;
  onUpload: (file: File) => void;
  onSample: () => void;
  onDelete: (id: string) => void;
};

export function LibraryPanel({
  documents,
  selectedIds,
  mode,
  busy,
  error,
  onToggle,
  onUpload,
  onSample,
  onDelete,
}: LibraryPanelProps) {
  const selected = new Set(selectedIds);

  return (
    <aside className="flex min-h-0 flex-col bg-spine text-paper">
      <div className="border-b border-white/10 px-5 py-6">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-copper uppercase">
          The shelf
        </p>
        <h2 className="font-display mt-2 text-3xl text-paper">Documents</h2>
        <p className="mt-2 text-sm leading-6 text-paper/70">
          {mode === "live"
            ? "Originals go to a private Supabase bucket. Passages are embedded and stored in pgvector."
            : "Demo mode keeps passages in this server process. Nothing is sent to a model."}
        </p>
      </div>

      <div className="space-y-3 px-5 py-5">
        <label className="block cursor-pointer rounded-2xl border border-dashed border-white/25 bg-spine-soft px-4 py-4 transition hover:border-copper">
          <input
            className="sr-only"
            type="file"
            accept="application/pdf,.pdf"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) onUpload(file);
            }}
          />
          <span className="block text-sm font-medium text-paper">Drop a PDF, or browse</span>
          <span className="mt-1 block text-xs leading-5 text-paper/60">
            Text-based PDFs up to 20 MB. Scanned pages without a text layer are skipped.
          </span>
        </label>
        <button
          type="button"
          onClick={onSample}
          disabled={busy}
          className="w-full rounded-full border border-white/15 px-4 py-2 text-sm text-paper transition hover:border-copper hover:text-copper disabled:opacity-50"
        >
          Load the sample essay
        </button>
        {error ? (
          <p role="alert" className="text-sm leading-5 text-[#ffb4a2]">
            {error}
          </p>
        ) : null}
      </div>

      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-6">
        {documents.length === 0 ? (
          <li className="px-3 py-6 text-sm leading-6 text-paper/60">
            The shelf is empty. Add the sample essay to try a question before you upload anything.
          </li>
        ) : (
          documents.map((document) => {
            const checked = selected.has(document.id);
            return (
              <li key={document.id} className="rounded-2xl bg-white/5 px-3 py-3">
                <div className="flex items-start gap-3">
                  <input
                    id={`doc-${document.id}`}
                    type="checkbox"
                    className="mt-1 accent-copper"
                    checked={checked}
                    disabled={document.status !== "ready"}
                    onChange={() => onToggle(document.id)}
                  />
                  <div className="min-w-0 flex-1">
                    <label htmlFor={`doc-${document.id}`} className="block truncate text-sm font-medium">
                      {document.name}
                    </label>
                    <p className="mt-1 text-xs text-paper/60">
                      {document.status === "ready"
                        ? `${document.pageCount} ${document.pageCount === 1 ? "page" : "pages"} · ${document.chunkCount} passages · ${formatBytes(document.byteSize)}`
                        : document.status}
                      {document.name === SAMPLE_TITLE ? " · sample" : ""}
                    </p>
                    {document.error ? (
                      <p className="mt-1 text-xs text-[#ffb4a2]">{document.error}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="text-xs text-paper/50 underline-offset-2 hover:text-paper hover:underline"
                    onClick={() => onDelete(document.id)}
                  >
                    Remove
                  </button>
                </div>
              </li>
            );
          })
        )}
      </ul>
    </aside>
  );
}
