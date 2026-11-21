import { NextResponse, type NextRequest } from "next/server";
import { readAccessConfig, SESSION_COOKIE, verifySessionToken } from "@/lib/access";
import { ConfigError } from "@/lib/http";

// Optional access gate. With FOLIO_ACCESS_PASSWORD unset every request passes
// through. With it set, every /api route except /api/auth needs a valid
// session cookie.
export function proxy(request: NextRequest) {
  let access;
  try {
    access = readAccessConfig();
  } catch (error) {
    const message = error instanceof ConfigError ? error.message : "Access settings could not be read.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!access.enabled || request.nextUrl.pathname === "/api/auth") {
    return NextResponse.next();
  }

  if (verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, access.key)) {
    return NextResponse.next();
  }
  return NextResponse.json({ error: "Sign in to use Folio." }, { status: 401 });
}

export const config = {
  matcher: "/api/:path*",
};
