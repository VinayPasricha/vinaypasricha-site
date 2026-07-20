// Firestore client — the single database connection for the whole site.
//
// On Cloud Run this needs NO credentials and NO connection string: the service
// authenticates automatically (Application Default Credentials) and the project
// is detected from the environment. Locally, run once:
//   gcloud auth application-default login
//   set GOOGLE_CLOUD_PROJECT=<your-project-id>
import { Firestore } from '@google-cloud/firestore';

// `ignoreUndefinedProperties` lets us pass partial objects without Firestore
// throwing on undefined fields.
export const db = new Firestore({ ignoreUndefinedProperties: true });

// Collection names — the two "folders" the whole site writes to.
export const COLLECTIONS = {
  conversations: 'conversations',   // every AI chat + its result, tagged by runtime
  leads: 'leads',                   // emails / contacts captured anywhere on the site
  companyProfiles: 'companyProfiles', // published Organizational Frequency pages, keyed by slug
  // AI for Business Leaders (ABL) — its own set of collections, kept separate
  // from the site's general chat data.
  ablParticipants: 'abl_participants',
  ablResearch: 'abl_research',
  ablSessions: 'abl_sessions',
  ablMessages: 'abl_messages',
  ablOutputs: 'abl_outputs',
  ablQa: 'abl_qa',
  // First-party website analytics — one document per tracked event (page view,
  // duration beacon, click, form submit, scroll, custom event, identify).
  // Anonymous; auto-expires via the expiresAt TTL.
  analyticsEvents: 'analytics_events',
  // One document per known person (once identified via a lead, portal login, ABL
  // session, or AI chat). Links their device visitor-ids for timeline stitching.
  analyticsPeople: 'analytics_people',
};
