import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { embedQuery } from "@/lib/embeddings";
import { assertLiveConfig, resolveMode } from "@/lib/env";
import { isUuid } from "@/lib/files";
import { HttpError, publicError } from "@/lib/http";
import { messageText } from "@/lib/messages";
import { buildInstructions, composeDemoAnswer } from "@/lib/prompt";
import { getLibrary } from "@/lib/store";
import type { FolioMessageMetadata } from "@/lib/types";

export const maxDuration = 60;

type FolioUIMessage = UIMessage<FolioMessageMetadata>;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      messages?: unknown;
      documentIds?: unknown;
    };
    const messages = parseMessages(body.messages);
    const documentIds = parseDocumentIds(body.documentIds);
    const question = [...messages].reverse().find((message) => message.role === "user");
    const query = question ? messageText(question) : "";
    if (!query) throw new HttpError("Ask a question first.", 400);

    const mode = resolveMode();
    const queryEmbedding = await embedQuery(query);
    const sources = await getLibrary().match({
      query,
      queryEmbedding,
      documentIds,
      matchCount: 6,
    });

    if (mode === "demo") {
      const answer = composeDemoAnswer(query, sources);
      const stream = createUIMessageStream<FolioUIMessage>({
        execute: async ({ writer }) => {
          writer.write({
            type: "start",
            messageMetadata: { sources, mode: "demo" },
          });
          writer.write({ type: "start-step" });
          writer.write({ type: "text-start", id: "answer" });
          for (const part of answer.split(/(\s+)/)) {
            if (!part) continue;
            writer.write({ type: "text-delta", id: "answer", delta: part });
          }
          writer.write({ type: "text-end", id: "answer" });
          writer.write({ type: "finish-step" });
          writer.write({ type: "finish", finishReason: "stop" });
        },
      });
      return createUIMessageStreamResponse({ stream });
    }

    const config = assertLiveConfig();
    const result = streamText({
      model: config.chatModel,
      instructions: buildInstructions(sources),
      messages: await convertToModelMessages(messages.slice(-16)),
    });

    return createUIMessageStreamResponse({
      stream: toUIMessageStream({
        stream: result.stream,
        messageMetadata: ({ part }) => {
          if (part.type === "start") {
            const metadata: FolioMessageMetadata = { sources, mode: "live" };
            return metadata;
          }
        },
        onError: () => "The model stream stopped before the answer finished.",
      }),
    });
  } catch (error) {
    return publicError(error, "The question could not be answered.");
  }
}

function parseMessages(value: unknown): FolioUIMessage[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HttpError("Send at least one message.", 400);
  }

  return value.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new HttpError("A chat message was malformed.", 400);
    }
    const message = entry as { id?: unknown; role?: unknown; parts?: unknown };
    if (
      (message.role !== "user" && message.role !== "assistant" && message.role !== "system") ||
      !Array.isArray(message.parts)
    ) {
      throw new HttpError("A chat message was malformed.", 400);
    }
    return {
      id: typeof message.id === "string" ? message.id : crypto.randomUUID(),
      role: message.role,
      parts: message.parts,
    } as FolioUIMessage;
  });
}

function parseDocumentIds(value: unknown) {
  if (value == null) return null;
  if (!Array.isArray(value)) throw new HttpError("documentIds must be a list.", 400);
  return value.map((id) => {
    if (typeof id !== "string" || !isUuid(id)) {
      throw new HttpError("documentIds must be document ids.", 400);
    }
    return id;
  });
}
