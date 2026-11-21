import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import {
  createSessionToken,
  passwordMatches,
  readAccessConfig,
  SESSION_COOKIE,
  sessionCookie,
  verifySessionToken,
} from "@/lib/access";
import { jsonError, publicError } from "@/lib/http";

function isSecure(request: NextRequest) {
  return request.nextUrl.protocol === "https:";
}

export async function GET() {
  try {
    const access = readAccessConfig();
    if (!access.enabled) return Response.json({ enabled: false, authenticated: true });
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    return Response.json({ enabled: true, authenticated: verifySessionToken(token, access.key) });
  } catch (error) {
    return publicError(error, "Access settings could not be read.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const access = readAccessConfig();
    if (!access.enabled) return Response.json({ enabled: false, authenticated: true });

    const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
    const candidate = typeof body?.password === "string" ? body.password : "";
    if (!candidate || !passwordMatches(candidate, access.password)) {
      return jsonError("That password did not match.", 401);
    }

    (await cookies()).set(sessionCookie(createSessionToken(access.key), isSecure(request)));
    return Response.json({ enabled: true, authenticated: true });
  } catch (error) {
    return publicError(error, "Sign in failed.");
  }
}

export async function DELETE(request: NextRequest) {
  (await cookies()).set(sessionCookie("", isSecure(request), 0));
  return Response.json({ authenticated: false });
}
