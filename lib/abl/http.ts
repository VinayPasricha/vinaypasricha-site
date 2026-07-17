import "server-only";
import { NextResponse } from "next/server";

export function ok(data: unknown, init?: number) {
  return NextResponse.json({ ok: true, data }, { status: init ?? 200 });
}
export function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

// Wrap a handler so thrown errors (incl. auth errors with .status) become JSON.
export function handler<T extends unknown[]>(fn: (...args: T) => Promise<Response>) {
  return async (...args: T): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      const err = e as Error & { status?: number };
      const status = err.status ?? 500;
      if (status >= 500) console.error("[abl] route error:", err);
      // never leak internal (Supabase/Vertex/SQL) error text to clients on 5xx
      return fail(status >= 500 ? "Something went wrong. Please try again." : (err.message || "Request failed"), status);
    }
  };
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}
