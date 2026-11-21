"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { readApi } from "@/lib/client-upload";

type AccessState = { enabled: boolean; authenticated: boolean };

export function AccessGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccessState | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const next = await readApi<AccessState>(await fetch("/api/auth"));
        if (!cancelled) setState(next);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Folio could not open.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await readApi<AccessState>(
        await fetch("/api/auth", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ password }),
        }),
      );
      setPassword("");
      setState(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  if (state?.authenticated) return <>{children}</>;

  return (
    <div className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-card px-6 py-8 shadow-sm">
        <p className="text-[11px] font-semibold tracking-[0.22em] text-copper uppercase">Private desk</p>
        <h1 className="font-display mt-2 text-3xl tracking-tight">Folio</h1>
        {state === null && !error ? (
          <p className="mt-4 text-sm text-muted">Opening</p>
        ) : null}
        {state?.enabled ? (
          <form className="mt-5 space-y-3" onSubmit={submit}>
            <label htmlFor="folio-password" className="block text-sm text-muted">
              Enter the access password to continue.
            </label>
            <input
              id="folio-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-full border border-line bg-paper px-4 py-2 text-sm outline-none focus:border-copper"
            />
            <button
              type="submit"
              disabled={busy || !password}
              className="w-full rounded-full bg-spine px-4 py-2 text-sm text-paper transition hover:bg-spine-soft disabled:opacity-50"
            >
              {busy ? "Checking" : "Sign in"}
            </button>
          </form>
        ) : null}
        {error ? (
          <p role="alert" className="mt-3 text-sm leading-5 text-copper-deep">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  );
}
