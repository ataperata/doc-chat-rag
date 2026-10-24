import { ConfigError } from "@/lib/http";
import type { AppMode } from "@/lib/types";

export const DEFAULT_CHAT_MODEL = "openai/gpt-5.4-mini";
export const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;

export type EnvSource = {
  [key: string]: string | undefined;
  FOLIO_DATA_MODE?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  AI_GATEWAY_API_KEY?: string;
  VERCEL_OIDC_TOKEN?: string;
  AI_CHAT_MODEL?: string;
  AI_EMBEDDING_MODEL?: string;
};

function source(env?: EnvSource): EnvSource {
  return env ?? (process.env as EnvSource);
}

export type AppConfig = {
  mode: AppMode;
  supabaseUrl: string;
  supabaseAnonKey: string;
  serviceRoleKey: string;
  hasModelCredential: boolean;
  chatModel: string;
  embeddingModel: string;
};

export function resolveMode(env?: EnvSource): AppMode {
  const current = source(env);
  const forced = current.FOLIO_DATA_MODE?.trim().toLowerCase();
  if (forced === "demo" || forced === "live") return forced;
  if (forced) {
    throw new ConfigError("FOLIO_DATA_MODE must be demo or live.");
  }

  const hasSupabase = Boolean(
    current.NEXT_PUBLIC_SUPABASE_URL &&
      current.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      current.SUPABASE_SERVICE_ROLE_KEY,
  );
  const hasModel = Boolean(current.AI_GATEWAY_API_KEY || current.VERCEL_OIDC_TOKEN);
  return hasSupabase && hasModel ? "live" : "demo";
}

export function readConfig(env?: EnvSource): AppConfig {
  const current = source(env);
  return {
    mode: resolveMode(current),
    supabaseUrl: current.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "",
    supabaseAnonKey: current.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "",
    serviceRoleKey: current.SUPABASE_SERVICE_ROLE_KEY?.trim() ?? "",
    hasModelCredential: Boolean(current.AI_GATEWAY_API_KEY || current.VERCEL_OIDC_TOKEN),
    chatModel: current.AI_CHAT_MODEL?.trim() || DEFAULT_CHAT_MODEL,
    embeddingModel: current.AI_EMBEDDING_MODEL?.trim() || DEFAULT_EMBEDDING_MODEL,
  };
}

export function assertLiveConfig(env?: EnvSource) {
  const config = readConfig(env);
  const missing: string[] = [];
  if (!config.supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!config.supabaseAnonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!config.serviceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!config.hasModelCredential) missing.push("AI_GATEWAY_API_KEY");
  if (missing.length > 0) {
    throw new ConfigError(
      `Live mode is missing ${missing.join(", ")}. Leave FOLIO_DATA_MODE unset to use the offline demo instead.`,
    );
  }
  return config;
}
