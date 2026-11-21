import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createSessionToken,
  passwordMatches,
  readAccessConfig,
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  verifySessionToken,
} from "@/lib/access";
import { proxy } from "@/proxy";

const SECRET = "0123456789abcdef0123456789abcdef";

function keyFor(password = "open sesame", secret = SECRET) {
  const access = readAccessConfig({ FOLIO_ACCESS_PASSWORD: password, FOLIO_SESSION_SECRET: secret });
  if (!access.enabled) throw new Error("expected the gate to be enabled");
  return access.key;
}

describe("access config", () => {
  it("stays open when no password is set", () => {
    expect(readAccessConfig({})).toEqual({ enabled: false });
    expect(readAccessConfig({ FOLIO_SESSION_SECRET: SECRET })).toEqual({ enabled: false });
  });

  it("fails closed when the password is set without a usable secret", () => {
    expect(() => readAccessConfig({ FOLIO_ACCESS_PASSWORD: "pw" })).toThrow(/FOLIO_SESSION_SECRET is required/);
    expect(() => readAccessConfig({ FOLIO_ACCESS_PASSWORD: "pw", FOLIO_SESSION_SECRET: "short" })).toThrow(
      /at least 32 characters/,
    );
  });

  it("compares passwords exactly", () => {
    expect(passwordMatches("open sesame", "open sesame")).toBe(true);
    expect(passwordMatches("open sesame ", "open sesame")).toBe(false);
    expect(passwordMatches("", "open sesame")).toBe(false);
  });
});

describe("session tokens", () => {
  it("accepts its own token until it expires", () => {
    const key = keyFor();
    const now = 1_800_000_000_000;
    const token = createSessionToken(key, now);
    expect(verifySessionToken(token, key, now + 1000)).toBe(true);
    expect(verifySessionToken(token, key, now + SESSION_MAX_AGE_SECONDS * 1000 + 1)).toBe(false);
  });

  it("rejects tampered, foreign, and malformed tokens", () => {
    const key = keyFor();
    const token = createSessionToken(key);
    const [version, expires, mac] = token.split(".");
    expect(verifySessionToken(`${version}.${Number(expires) + 1}.${mac}`, key)).toBe(false);
    expect(verifySessionToken(`${version}.${expires}.${mac.slice(0, -1)}`, key)).toBe(false);
    expect(verifySessionToken(token, keyFor("open sesame", `${SECRET}x`))).toBe(false);
    expect(verifySessionToken(token, keyFor("new password"))).toBe(false);
    expect(verifySessionToken(undefined, key)).toBe(false);
    expect(verifySessionToken("garbage", key)).toBe(false);
  });
});

describe("proxy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function request(path: string, cookie?: string) {
    const headers = cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : undefined;
    return new NextRequest(`http://localhost${path}`, { headers });
  }

  it("passes everything through when the gate is off", () => {
    vi.stubEnv("FOLIO_ACCESS_PASSWORD", "");
    expect(proxy(request("/api/documents")).status).toBe(200);
  });

  it("requires a valid session for API routes other than /api/auth", async () => {
    vi.stubEnv("FOLIO_ACCESS_PASSWORD", "open sesame");
    vi.stubEnv("FOLIO_SESSION_SECRET", SECRET);

    const blocked = proxy(request("/api/documents"));
    expect(blocked.status).toBe(401);
    expect(await blocked.json()).toEqual({ error: "Sign in to use Folio." });
    expect(proxy(request("/api/chat", "v1.9999999999999.forged")).status).toBe(401);
    expect(proxy(request("/api/auth")).status).toBe(200);
    expect(proxy(request("/api/documents", createSessionToken(keyFor()))).status).toBe(200);
  });

  it("returns a clear error when the secret is missing", async () => {
    vi.stubEnv("FOLIO_ACCESS_PASSWORD", "open sesame");
    vi.stubEnv("FOLIO_SESSION_SECRET", "");

    const response = proxy(request("/api/auth"));
    expect(response.status).toBe(500);
    expect((await response.json()).error).toMatch(/FOLIO_SESSION_SECRET is required/);
  });
});
