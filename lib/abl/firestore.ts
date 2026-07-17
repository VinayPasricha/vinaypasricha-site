// Server-only Firestore client — the main vinaypasricha.com site's database.
//
// No connection string / no key: authenticates with Application Default
// Credentials (the Cloud Run service account in prod; `gcloud auth
// application-default login` locally) — exactly like the site's backend.
//
// Collections are PREFIXED (default "abl2_") so this Next.js workspace never
// collides with the main site's own ABL collections (abl_participants, …).
import "server-only";
import { Firestore } from "@google-cloud/firestore";
import { config } from "./config";

let _db: Firestore | null = null;
export function fs(): Firestore {
  if (!_db) {
    _db = new Firestore({
      ignoreUndefinedProperties: true,
      ...(config.ai.gcpProject ? { projectId: config.ai.gcpProject } : {}),
    });
  }
  return _db;
}

const P = config.db.collectionPrefix;
export const COL = {
  participants: `${P}participants`,
  research: `${P}research`,
  sessions: `${P}sessions`,
  messages: `${P}messages`,
  outputs: `${P}outputs`,
  qa: `${P}qa`,
} as const;

export const nowIso = () => new Date().toISOString();

// Attach the document id as `id` on the returned row (matching the old SQL shape).
export function withId<T>(doc: FirebaseFirestore.DocumentSnapshot): T {
  return { id: doc.id, ...(doc.data() as object) } as T;
}
