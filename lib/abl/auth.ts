// Minimal admin auth for the 24-hour launch: a single ADMIN_PASSWORD gate that
// issues an HMAC-signed, httpOnly session cookie. No user table, no sessions in
// the DB. Reuse a real auth system in V2 (see TODO).
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { config } from "./config";

const COOKIE = "abl_admin";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function sign(payload: string): string {
  const mac = createHmac("sha256", config.admin.sessionSecret).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

function valid(token: string | undefined): boolean {
  if (!token) return false;
  const i = token.lastIndexOf(".");
  if (i < 0) return false;
  const payload = token.slice(0, i);
  const expect = sign(payload);
  const a = Buffer.from(token);
  const b = Buffer.from(expect);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function checkPassword(input: string): boolean {
  const a = Buffer.from(input || "");
  const b = Buffer.from(config.admin.password);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function isAdmin(): Promise<boolean> {
  const c = await cookies();
  return valid(c.get(COOKIE)?.value);
}

export async function startAdminSession(): Promise<void> {
  const c = await cookies();
  c.set(COOKIE, sign(`admin.${Date.now()}`), {
    httpOnly: true, sameSite: "lax", secure: true, path: "/", maxAge: MAX_AGE,
  });
}

export async function endAdminSession(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE);
}

// Guard for API route handlers — throws a 401-style marker if not admin.
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    const e = new Error("unauthorized") as Error & { status?: number };
    e.status = 401;
    throw e;
  }
}
