import "server-only";
import { createHash, randomBytes } from "node:crypto";

// readable name part: "Rajesh Kumar" -> "rajesh-kumar"
export function nameSlug(name: string): string {
  return (
    name.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24) || "guest"
  );
}

// unambiguous alphabet (no 0/O/1/I) for the secret suffix
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function randomCode(len = 6): string {
  const bytes = randomBytes(len);
  let out = "";
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

// full participant slug, e.g. "rajesh-kumar-8F3K2Q" (readable + unguessable)
export function makeSlug(name: string): { slug: string; code: string } {
  const code = randomCode(6);
  return { slug: `${nameSlug(name)}-${code}`, code };
}
