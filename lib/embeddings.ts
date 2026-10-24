import { embedMany } from "ai";
import { embedTextLocal } from "@/lib/embed-local";
import { assertLiveConfig, EMBEDDING_DIMENSIONS, resolveMode } from "@/lib/env";

export async function embedTexts(values: string[]) {
  if (values.length === 0) return [];
  if (resolveMode() === "demo") return values.map((value) => embedTextLocal(value));

  const config = assertLiveConfig();
  const { embeddings } = await embedMany({
    model: config.embeddingModel,
    values,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  for (const embedding of embeddings) {
    if (embedding.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Expected ${EMBEDDING_DIMENSIONS}-dimension embeddings from ${config.embeddingModel}, received ${embedding.length}. The pgvector column is vector(${EMBEDDING_DIMENSIONS}).`,
      );
    }
  }

  return embeddings;
}

export async function embedQuery(value: string) {
  const [embedding] = await embedTexts([value]);
  if (!embedding) throw new Error("The embedding model returned no vector.");
  return embedding;
}
