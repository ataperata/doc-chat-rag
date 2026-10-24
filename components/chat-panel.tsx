"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { SAMPLE_TITLE } from "@/lib/sample";
import type { Citation, DocumentSummary, FolioMessageMetadata } from "@/lib/types";

type FolioUIMessage = UIMessage<FolioMessageMetadata>;

const SUGGESTIONS = [
  "When does the reading room open?",
  "What delayed the steamer Estrela?",
  "What does membership cost now?",
];

type ChatPanelProps = {
  documents: DocumentSummary[];
  selectedIds: string[];
};

export function ChatPanel({ documents, selectedIds }: ChatPanelProps) {
  const [draft, setDraft] = useState("");
  const [activeCite, setActiveCite] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<FolioUIMessage>({
        api: "/api/chat",
        fetch: async (input, init) => {
          const response = await fetch(input, init);
          if (response.ok) return response;
          const text = await response.text();
          let message = "The request failed.";
          try {
            const parsed = JSON.parse(text) as { error?: unknown };
            if (typeof parsed.error === "string") message = parsed.error;
          } catch {
            if (text.trim()) message = text.trim().slice(0, 400);
          }
          return new Response(message, { status: response.status });
        },
      }),
    [],
  );

  const { messages, sendMessage, status, stop, error, clearError } = useChat<FolioUIMessage>({
    transport,
  });

  const readySelected = documents.filter(
    (document) => document.status === "ready" && selectedIds.includes(document.id),
  );
  const canAsk = readySelected.length > 0 && status !== "submitted" && status !== "streaming";
  const sampleReady = documents.some(
    (document) => document.name === SAMPLE_TITLE && document.status === "ready",
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, status]);

  function ask(text: string) {
    const question = text.trim();
    if (!question || !canAsk) return;
    clearError();
    setDraft("");
    void sendMessage(
      { text: question },
      { body: { documentIds: selectedIds } },
    );
  }

  return (
    <section className="paper-grid flex min-h-0 flex-col">
      <header className="flex items-end justify-between gap-4 border-b border-line px-6 py-5 sm:px-10">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.22em] text-copper-deep uppercase">
            Marginal notes
          </p>
          <h2 className="font-display mt-1 text-4xl tracking-tight">Ask the page</h2>
        </div>
        <p className="hidden max-w-xs text-right text-sm leading-5 text-muted sm:block">
          {readySelected.length > 0
            ? `Searching ${readySelected.length} ${readySelected.length === 1 ? "document" : "documents"}.`
            : "Select a ready document to begin."}
        </p>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-8 sm:px-10" aria-live="polite">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-2xl pt-8">
            <p className="font-display text-5xl leading-tight tracking-tight text-ink">
              Answers stay on the page they came from.
            </p>
            <p className="mt-4 max-w-xl text-base leading-7 text-muted">
              Folio retrieves the closest passages, then answers with the page number attached.
              Load the sample essay if you want three questions that already have a home.
            </p>
            {sampleReady ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    disabled={!canAsk}
                    onClick={() => ask(suggestion)}
                    className="rounded-full border border-line bg-card px-4 py-2 text-left text-sm transition hover:border-copper disabled:opacity-50"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          messages.map((message) => (
            <article key={message.id} className="mx-auto max-w-2xl">
              {message.role === "user" ? (
                <p className="ml-auto max-w-lg rounded-3xl rounded-br-md bg-spine px-5 py-3 text-sm leading-6 text-paper">
                  {textOf(message)}
                </p>
              ) : (
                <div>
                  <p className="font-display text-2xl leading-9 text-ink">
                    <CitedText
                      text={textOf(message)}
                      onCite={(number) => setActiveCite(`${message.id}:${number}`)}
                    />
                    {status === "streaming" && message.id === messages.at(-1)?.id ? (
                      <span className="caret ml-0.5 inline-block h-5 w-px translate-y-0.5 bg-copper align-middle" />
                    ) : null}
                  </p>
                  <CitationList
                    messageId={message.id}
                    sources={message.metadata?.sources ?? []}
                    activeCite={activeCite}
                  />
                </div>
              )}
            </article>
          ))
        )}
        {status === "submitted" ? (
          <p className="mx-auto max-w-2xl text-sm text-muted">Looking through the selected pages…</p>
        ) : null}
        {error ? (
          <p role="alert" className="mx-auto max-w-2xl text-sm text-copper-deep">
            {error.message || "The answer stopped before it finished."}
          </p>
        ) : null}
        <div ref={bottomRef} />
      </div>

      <form
        className="border-t border-line px-6 py-4 sm:px-10"
        onSubmit={(event) => {
          event.preventDefault();
          ask(draft);
        }}
      >
        <div className="mx-auto flex max-w-2xl items-end gap-3">
          <label className="sr-only" htmlFor="question">
            Question
          </label>
          <textarea
            id="question"
            value={draft}
            rows={2}
            disabled={readySelected.length === 0 || status === "submitted" || status === "streaming"}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                ask(draft);
              }
            }}
            placeholder={
              readySelected.length > 0
                ? "Ask something the pages might know"
                : "Add a document before asking"
            }
            className="min-h-14 flex-1 resize-none rounded-2xl border border-line bg-card px-4 py-3 text-sm leading-6 outline-none focus:border-copper"
          />
          {status === "submitted" || status === "streaming" ? (
            <button
              type="button"
              onClick={() => stop()}
              className="rounded-full bg-ink px-4 py-3 text-sm text-paper"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!canAsk || draft.trim().length === 0}
              className="rounded-full bg-copper px-5 py-3 text-sm font-medium text-white disabled:opacity-40"
            >
              Ask
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

function textOf(message: FolioUIMessage) {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function CitedText({
  text,
  onCite,
}: {
  text: string;
  onCite: (number: number) => void;
}) {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((part, index) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (!match) return <span key={index}>{part}</span>;
    const number = Number(match[1]);
    return (
      <button
        key={index}
        type="button"
        onClick={() => onCite(number)}
        className="mx-0.5 inline-flex min-w-6 items-center justify-center rounded-full bg-copper/15 px-1.5 text-sm text-copper-deep"
      >
        {number}
      </button>
    );
  });
}

function CiteCard({
  messageId,
  number,
  source,
  active,
}: {
  messageId: string;
  number: number;
  source: Citation;
  active: boolean;
}) {
  const itemRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!active) return;
    const details = itemRef.current?.querySelector("details");
    if (details instanceof HTMLDetailsElement) details.open = true;
    itemRef.current?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <li ref={itemRef} id={`${messageId}-cite-${number}`}>
      <details
        className={`rounded-2xl border bg-card px-4 py-3 ${active ? "border-copper" : "border-line"}`}
      >
        <summary className="cursor-pointer text-sm">
          <span className="mr-2 text-copper-deep">[{number}]</span>
          {source.documentName}, page {source.pageNumber}
          <span className="ml-2 text-xs text-muted">
            {Math.round(source.similarity * 100)}% match
          </span>
        </summary>
        <p className="mt-2 text-sm leading-6 text-muted">{source.content}</p>
      </details>
    </li>
  );
}

function CitationList({
  messageId,
  sources,
  activeCite,
}: {
  messageId: string;
  sources: Citation[];
  activeCite: string | null;
}) {
  if (sources.length === 0) return null;

  return (
    <ol className="mt-4 space-y-2">
      {sources.map((source, index) => {
        const number = index + 1;
        return (
          <CiteCard
            key={source.id}
            messageId={messageId}
            number={number}
            source={source}
            active={activeCite === `${messageId}:${number}`}
          />
        );
      })}
    </ol>
  );
}
