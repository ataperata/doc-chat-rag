"use client";

import { useEffect, useRef, useState } from "react";
import { ChatPanel } from "@/components/chat-panel";
import { LibraryPanel } from "@/components/library-panel";
import { readApi, uploadPdf } from "@/lib/client-upload";
import type { DocumentSummary, PublicConfig } from "@/lib/types";

export function Workspace() {
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const seen = useRef(new Set<string>());

  async function refresh() {
    const payload = await readApi<{ documents: DocumentSummary[] }>(
      await fetch("/api/documents"),
    );
    setDocuments(payload.documents);
    setSelectedIds((current) => {
      const next = new Set(current.filter((id) => payload.documents.some((document) => document.id === id)));
      for (const document of payload.documents) {
        if (!seen.current.has(document.id) && document.status === "ready") next.add(document.id);
        seen.current.add(document.id);
      }
      return [...next];
    });
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [nextConfig, library] = await Promise.all([
          readApi<PublicConfig>(await fetch("/api/config")),
          readApi<{ documents: DocumentSummary[] }>(await fetch("/api/documents")),
        ]);
        if (cancelled) return;
        setConfig(nextConfig);
        setDocuments(library.documents);
        setSelectedIds(
          library.documents.filter((document) => document.status === "ready").map((document) => document.id),
        );
        for (const document of library.documents) seen.current.add(document.id);
      } catch (error) {
        if (!cancelled) {
          setLibraryError(error instanceof Error ? error.message : "The desk could not open.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setLibraryError(null);
    try {
      await action();
      await refresh();
    } catch (error) {
      setLibraryError(error instanceof Error ? error.message : "That did not work.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-8">
        <div className="flex items-baseline gap-3">
          <p className="font-display text-3xl tracking-tight">Folio</p>
          <p className="hidden text-sm text-muted sm:block">Chat with the PDFs you keep</p>
        </div>
        <p className="rounded-full border border-line bg-card px-3 py-1 text-xs tracking-wide text-muted uppercase">
          {config?.mode === "live" ? `Live · ${config.chatModel}` : config ? "Demo · offline retrieval" : "Opening"}
        </p>
      </header>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[340px_minmax(0,1fr)]">
        <LibraryPanel
          documents={documents}
          selectedIds={selectedIds}
          mode={config?.mode ?? null}
          busy={busy || config === null}
          error={libraryError}
          onToggle={(id) =>
            setSelectedIds((current) =>
              current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
            )
          }
          onUpload={(file) => {
            if (!config) return;
            void run(() => uploadPdf(file, config).then(() => undefined));
          }}
          onSample={() => {
            void run(async () => {
              await readApi(await fetch("/api/sample", { method: "POST" }));
            });
          }}
          onDelete={(id) => {
            if (!window.confirm("Remove this document from the shelf?")) return;
            void run(async () => {
              await readApi(await fetch(`/api/documents/${id}`, { method: "DELETE" }));
            });
          }}
        />
        <ChatPanel documents={documents} selectedIds={selectedIds} />
      </div>
    </div>
  );
}
