import { headers } from "next/headers";
import { readConfig } from "@/lib/env";
import { DIRECT_UPLOAD_BYTES, MAX_PDF_BYTES } from "@/lib/files";
import { publicError } from "@/lib/http";
import type { PublicConfig } from "@/lib/types";

export async function GET() {
  await headers();
  try {
    const config = readConfig();
    const body: PublicConfig = {
      mode: config.mode,
      supabaseUrl: config.mode === "live" ? config.supabaseUrl : null,
      supabaseAnonKey: config.mode === "live" ? config.supabaseAnonKey : null,
      maxUploadBytes: MAX_PDF_BYTES,
      directUploadBytes: DIRECT_UPLOAD_BYTES,
      chatModel: config.mode === "live" ? config.chatModel : null,
    };
    return Response.json(body);
  } catch (error) {
    return publicError(error, "Configuration could not be read.");
  }
}
