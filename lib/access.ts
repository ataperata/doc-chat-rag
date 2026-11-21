import { createHash, createHmac, hkdfSync, timingSafeEqual } from "node:crypto";
import { ConfigError } from "@/lib/http";

export const SESSION_COOKIE = "folio_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
export const MIN_SECRET_LENGTH = 32;

type AccessEnv = {
  [key: string]: string | undefined;
  FOLIO_ACCESS_PASSWORD?: string;
  FOLIO_SESSION_SECRET?: string;
};

export type AccessConfig =
  | { enabled: false }
  | { enabled: true; password: string; key: Buffer };

function source(env?: AccessEnv): AccessEnv {
  return env ?? (process.env as AccessEnv);
}

// The signing key comes from FOLIO_SESSION_SECRET and a fingerprint of the
// password, so changing either one signs everyone out.
export function readAccessConfig(env?: AccessEnv): AccessConfig {
  const current = source(env);
  const password = current.FOLIO_ACCESS_PASSWORD ?? "";
  if (!password) return { enabled: false };

  const secret = current.FOLIO_SESSION_SECRET?.trim() ?? "";
  if (!secret) {
    throw new ConfigError(
      "FOLIO_SESSION_SECRET is required when FOLIO_ACCESS_PASSWORD is set.",
    );
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new ConfigError(
      `FOLIO_SESSION_SECRET must be at least ${MIN_SECRET_LENGTH} characters.`,
    );
  }

  const salt = createHash("sha256").update(password).digest();
  const key = Buffer.from(hkdfSync("sha256", secret, salt, "folio session v1", 32));
  return { enabled: true, password, key };
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest();
}

export function passwordMatches(candidate: string, password: string) {
  return timingSafeEqual(sha256(candidate), sha256(password));
}

function sign(payload: string, key: Buffer) {
  return createHmac("sha256", key).update(payload).digest("base64url");
}

export function createSessionToken(key: Buffer, now = Date.now()) {
  const expires = String(now + SESSION_MAX_AGE_SECONDS * 1000);
  return `v1.${expires}.${sign(`v1.${expires}`, key)}`;
}

export function verifySessionToken(token: string | undefined, key: Buffer, now = Date.now()) {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1" || !/^\d{1,15}$/.test(parts[1])) return false;

  const expected = Buffer.from(sign(`v1.${parts[1]}`, key));
  const given = Buffer.from(parts[2]);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  return Number(parts[1]) > now;
}

export function sessionCookie(value: string, secure: boolean, maxAge = SESSION_MAX_AGE_SECONDS) {
  return {
    name: SESSION_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge,
  };
}
