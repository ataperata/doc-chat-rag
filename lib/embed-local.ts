import { tokenize } from "@/lib/text";

export const LOCAL_EMBEDDING_DIMENSIONS = 384;

export function embedTextLocal(text: string) {
  const vector = new Array<number>(LOCAL_EMBEDDING_DIMENSIONS).fill(0);
  const tokens = tokenize(text);

  for (const token of tokens) {
    const hash = fnv1a(token);
    const index = hash % LOCAL_EMBEDDING_DIMENSIONS;
    const sign = (hash & 1) === 0 ? 1 : -1;
    vector[index] += sign;
  }

  return normalize(vector);
}

export function cosineSimilarity(left: number[], right: number[]) {
  const length = Math.min(left.length, right.length);
  let dot = 0;
  for (let index = 0; index < length; index += 1) {
    dot += (left[index] ?? 0) * (right[index] ?? 0);
  }
  return dot;
}

function normalize(vector: number[]) {
  let sum = 0;
  for (const value of vector) sum += value * value;
  const norm = Math.sqrt(sum) || 1;
  return vector.map((value) => value / norm);
}

function fnv1a(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
