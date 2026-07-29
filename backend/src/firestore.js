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

// Keep non-production deployments in their own Firestore collections while
// preserving the existing production collection names by default. For
// example, set FIRESTORE_COLLECTION_PREFIX=staging_ on the staging Cloud Run
// service. Restricting the prefix to simple characters prevents accidental
// creation of invalid or surprising collection paths.
const collectionPrefix = (process.env.FIRESTORE_COLLECTION_PREFIX || '').trim();
if (!/^[A-Za-z0-9_-]*$/.test(collectionPrefix)) {
  throw new Error('FIRESTORE_COLLECTION_PREFIX may contain only letters, numbers, hyphens, and underscores');
}
const collectionName = (name) => `${collectionPrefix}${name}`;

// Collection names used by the site and the AI for Business Leaders workspace.
export const COLLECTIONS = {
  conversations: collectionName('conversations'),
  leads: collectionName('leads'),
  companyProfiles: collectionName('companyProfiles'),
  ablParticipants: collectionName('abl_participants'),
  ablResearch: collectionName('abl_research'),
  ablSessions: collectionName('abl_sessions'),
  ablMessages: collectionName('abl_messages'),
  ablOutputs: collectionName('abl_outputs'),
  ablQa: collectionName('abl_qa'),
  // Shared Course Memory: what each participant has established, reused by
  // every course runtime so none of them re-asks a settled question.
  ablMemory: collectionName('abl_memory'),
  ablBuilders: collectionName('abl_builders'),
  ablCohorts: collectionName('abl_cohorts'),
  ablMaterials: collectionName('abl_materials'),
  ablAssignments: collectionName('abl_assignments'),
  ablSubmissions: collectionName('abl_submissions'),
  ablAnnouncements: collectionName('abl_announcements'),
  // Passwordless participant sign-in: short-lived email codes, and the
  // long-lived session records issued once a code is verified.
  ablAuthCodes: collectionName('abl_auth_codes'),
  ablParticipantSessions: collectionName('abl_participant_sessions'),
};
