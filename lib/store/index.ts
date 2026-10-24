import { resolveMode } from "@/lib/env";
import { memoryLibrary } from "@/lib/store/memory";
import { supabaseLibrary } from "@/lib/store/supabase";
import type { LibraryStore } from "@/lib/store/types";

export function getLibrary(): LibraryStore {
  return resolveMode() === "live" ? supabaseLibrary : memoryLibrary;
}
