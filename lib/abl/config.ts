// Server-only configuration for the AI-for-Business-Leaders module.
// Values are read via getters so nothing throws at import/build time — a missing
// required var only errors when it is actually used at request time.
import "server-only";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}
function opt(name: string, fallback = ""): string {
  return process.env[name] ?? fallback;
}

export const config = {
  admin: {
    get password() { return req("ADMIN_PASSWORD"); },
    get sessionSecret() { return opt("ADMIN_SESSION_SECRET") || req("ADMIN_PASSWORD"); },
  },
  // Data lives in the main site's Firestore (Google Cloud). No connection string:
  // auth is via ADC, and collections are prefixed so they never collide with the
  // site's own ABL data. See lib/abl/firestore.ts.
  db: {
    // "abl_" = the SAME collections the live main-site ABL runtime writes to
    // (abl_participants, abl_sessions, …), so this app picks up every existing
    // participant's research + conversation. Set ABL_FIRESTORE_PREFIX to isolate.
    get collectionPrefix() { return opt("ABL_FIRESTORE_PREFIX", "abl_"); },
  },
  ai: {
    // Vertex AI (Gemini) — the same backend the main vinaypasricha.com site uses.
    get provider() { return "vertex" as const; },
    // Chat model. gemini-2.5-flash matches the site's default; override via env.
    get model() { return opt("VERTEX_MODEL") || opt("ANTHROPIC_MODEL") || "gemini-2.5-flash"; },
    // Heavier model for long-form reports (SIV/VED/reward). Pro, like the site's research step.
    get docModel() { return opt("VERTEX_DOC_MODEL") || "gemini-2.5-pro"; },
    get gcpProject() { return opt("GOOGLE_CLOUD_PROJECT") || opt("GCLOUD_PROJECT") || opt("GCP_PROJECT"); },
    // Gemini lives in us-central1 by default (Claude-on-Vertex would need us-east5).
    get gcpRegion() { return opt("VERTEX_LOCATION") || opt("GOOGLE_CLOUD_REGION") || "us-central1"; },
  },
  get appOrigin() { return opt("NEXT_PUBLIC_APP_ORIGIN", "https://vinaypasricha.com"); },
  basePath: "/workspace",
  maxMessagesDefault: 200,
  softWarnAt: 180,
} as const;
