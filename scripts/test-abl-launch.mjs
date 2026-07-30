import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const mustExist = (path) => assert.ok(existsSync(new URL(path, root)), `${path} exists`);
const includes = (source, text, label) => assert.ok(source.includes(text), label || `includes ${text}`);
const excludes = (source, text, label) => assert.ok(!source.includes(text), label || `does not include ${text}`);

[
  'ai-business-leaders/login.html',
  'ai-business-leaders/auth-client.js',
  'ai-business-leaders/participant-only-nav.js',
  'ai-business-leaders/participant-inner-nav.js',
  'ai-business-leaders/workspace-home-focus.js',
  'backend/package.json',
  'backend/src/abl/authRoutes.js',
  'backend/src/abl/participantGuard.js',
  'backend/src/abl/securePageRoutes.js',
  'backend/src/abl/focusedWorkspaceRoute.js',
  'backend/src/abl/workspaceRoutes.js',
  'backend/src/abl/safeArchiveRoutes.js',
  'backend/src/abl/assignmentUploadRoutes.js',
  'backend/src/abl/intelligenceRoutes.js',
  'studio/participant-intelligence.js',
  'studio/course-intelligence.js',
  'studio/abl-intelligence.css',
  'studio/ai-business-leaders-preparation.html',
  'studio/ai-business-leaders.html',
  'studio/unified-abl-studio.js',
  '.github/workflows/abl-launch-audit.yml',
].forEach(mustExist);

const server = read('backend/src/server.js');
const backendPackage = read('backend/package.json');
const guard = read('backend/src/abl/participantGuard.js');
const auth = read('backend/src/abl/authRoutes.js');
const workspace = read('backend/src/abl/workspaceRoutes.js');
const focusedRoute = read('backend/src/abl/focusedWorkspaceRoute.js');
const focusedHome = read('ai-business-leaders/workspace-home-focus.js');
const participantChrome = read('ai-business-leaders/participant-only-nav.js');
const innerNav = read('ai-business-leaders/participant-inner-nav.js');
const securePages = read('backend/src/abl/securePageRoutes.js');
const login = read('ai-business-leaders/login.html');
const safeArchive = read('backend/src/abl/safeArchiveRoutes.js');
const upload = read('backend/src/abl/assignmentUploadRoutes.js');
const intelligence = read('backend/src/abl/intelligenceRoutes.js');
const participantIntelligence = read('studio/participant-intelligence.js');
const courseIntelligence = read('studio/course-intelligence.js');
const prepShell = read('studio/ai-business-leaders-preparation.html');
const legacyProfile = read('studio/ai-business-leaders.html');
const unifiedStudio = read('studio/unified-abl-studio.js');
const auditWorkflow = read('.github/workflows/abl-launch-audit.yml');

// Access control: slug selects a record but never authorises access.
includes(server, 'app.use(participantApiGuard)', 'participant API guard is installed');
includes(guard, 'const match = path.match(', 'participant guard matches protected API paths');
includes(guard, '(?:session|course|workspace)', 'all participant API families are guarded');
includes(guard, 'String(payload.slug) !== String(slug)', 'token slug must match requested workspace');
includes(auth, 'participantCanSignIn', 'Studio invite state gates OTP access');
includes(auth, 'GENERIC_REQUEST_MESSAGE', 'OTP request does not disclose participant membership');
includes(login, 'six-digit sign-in code', 'participant login clearly uses OTP');

// Private participant routes must run before generic static serving.
includes(server, "layer.name === 'serveStatic'", 'participant routes are inserted ahead of express.static');
includes(server, 'registerSecureParticipantPages(app)', 'secure participant shells are registered');

// Studio must fail closed and anonymous Studio UI must be redirected safely.
excludes(workspace, "|| 'vik123'", 'workspace Studio API has no built-in fallback passphrase');
includes(workspace, "if (!passphrase) return ''", 'missing workspace Studio passphrase fails closed');
includes(workspace, 'cookieAllowed || tokenAllowed', 'workspace Studio accepts only configured credentials');
includes(server, 'studio_not_configured', 'central Studio is blocked when its passphrase is absent');
includes(server, 'function explicitStudioHash()', 'server has an explicit Studio cookie hash');
includes(server, "res.setHeader('Location', '/studio/login')", 'anonymous Studio UI uses an explicit safe redirect');
includes(server, 'function requireStudioAdmin', 'new Studio intelligence routes use an explicit fail-closed admin guard');

// Participant chrome must never render or reintroduce the private Studio control.
includes(focusedRoute, 'hidden aria-hidden="true" tabindex="-1"', 'Studio control is removed before participant HTML is sent');
includes(focusedRoute, 'participant-only-nav.js', 'participant-only chrome is layered onto the real workspace');
excludes(participantChrome, '>Vinay Studio<', 'participant chrome contains no visible Studio label');
excludes(participantChrome, 'id="studioMode"', 'participant chrome cannot recreate the Studio switch');
includes(participantChrome, '← Workspace Home', 'every internal workspace screen gets a home return');

// The actual workspace, not just a separate mock, must have a working mobile drawer.
includes(participantChrome, 'workspaceMenuToggle', 'real participant workspace has a mobile menu button');
includes(participantChrome, 'participant-menu-open', 'real participant workspace controls drawer state');
includes(participantChrome, 'participantDrawerOverlay', 'real participant workspace has a tap-outside overlay');
includes(participantChrome, "event.key === 'Escape'", 'mobile drawer supports Escape close');

// External participant tools must also return home and carry auth.
includes(securePages, 'auth-client.js', 'preparation and Builder pages receive authentication');
includes(securePages, 'participant-inner-nav.js', 'preparation and Builder pages receive Workspace Home navigation');
includes(innerNav, "return '/ai-business-leaders/workspace/'", 'inner tools return to the correct private workspace');

// Homepage focus and live-session wiring.
includes(focusedHome, 'Do this now', 'participant home has one dominant command');
includes(focusedHome, 'New from Vinay', 'participant home shows only the latest relevant update');
includes(focusedHome, 'Your saved work', 'participant home preserves access to saved work');
includes(workspace, 'session.meeting_url', 'current session meeting link is selected from the cohort schedule');
includes(workspace, 'session_date', 'current session date is exposed for adaptive behaviour');

// Cohort changes preserve already received work without granting future old-cohort content.
includes(workspace, 'material_entitlements', 'material access is snapshotted before a cohort change');
includes(workspace, 'assignment_entitlements', 'assignment access is snapshotted before a cohort change');
includes(workspace, 'cohort_history', 'cohort movement history is retained');
includes(workspace, "visibleTo(assignment, participant, 'assignment_entitlements') || Boolean(byAssignment[assignment.id])", 'saved assignment work remains visible after reassignment');
includes(workspace, 'existingSubmission', 'an earlier assignment remains editable after reassignment');
includes(workspace, "return fail(res, 'Email already exists', 409)", 'participant email edits reject duplicates');

// Destructive course-content operations are intercepted before legacy handlers.
includes(server, 'registerSafeArchiveRoutes(app)', 'safe archive routes are registered');
includes(safeArchive, "status: 'hidden'", 'published content is archived rather than erased');
assert.ok(server.indexOf('registerSafeArchiveRoutes(app)') < server.indexOf('registerWorkspaceRoutes(app)'), 'safe archive routes run before legacy workspace DELETE handlers');

// Direct assignment uploads remain private and authenticated.
includes(server, 'registerAssignmentUploadRoutes(app)', 'assignment upload routes are registered');
includes(backendPackage, '"@google-cloud/storage"', 'the Cloud Storage client dependency is declared');
includes(upload, "res.set('Cache-Control', 'private, no-store')", 'uploaded assignment downloads are never publicly cached');
includes(upload, 'signatureMatches', 'uploaded files are checked by content signature');
includes(upload, 'assignmentVisible', 'participants can upload only to assignments available to them');

// Participant-level Studio research agent.
includes(server, 'registerIntelligenceRoutes(app', 'Studio intelligence routes are registered');
includes(intelligence, '/api/abl/intelligence/participants/:id/ask', 'participant research endpoint exists');
includes(intelligence, 'completeGrounded', 'participant agent can perform live grounded public research');
includes(intelligence, 'PRIVATE COURSE EVIDENCE', 'private evidence is synthesised separately from public web research');
includes(intelligence, 'Intentionally public-only', 'grounded web queries exclude private meeting and course evidence');
excludes(intelligence, 'RECENT ADMIN QUESTIONS FOR REFERENCE', 'private thread history is not sent to public web search');
includes(intelligence, 'save_to_dossier', 'grounded follow-up findings can be retained in the participant dossier');
includes(intelligence, "thread(participant.id, 'admin_research')", 'participant research conversation persists in its own private thread');
includes(intelligence, 'recentConversation(history)', 'participant agent understands follow-up questions from recent thread context');
includes(prepShell, '/studio/participant-intelligence.js', 'the maintained participant profile loads the research conversation');
includes(participantIntelligence, 'Use fresh public web research', 'operator controls whether fresh public research is used');
includes(participantIntelligence, 'Save grounded findings to this dossier', 'operator controls dossier persistence');

// Cross-participant Course Intelligence agent.
includes(intelligence, '/api/abl/intelligence/cohort/ask', 'cross-participant intelligence endpoint exists');
includes(intelligence, 'compactParticipantEvidence', 'the directory is scanned with compact evidence before deep reads');
includes(intelligence, 'chunks(ranked, 28)', 'every participant is examined in model-sized directory batches');
includes(intelligence, 'mapLimit(participants, 8', 'Firestore directory reads are concurrency limited');
includes(intelligence, 'Confirmed, Probable/inferred, or Insufficient evidence', 'commercial-interest answers separate fact, inference and missing evidence');
includes(intelligence, 'DIRECTORY SIZE EXAMINED', 'answers state how many participant records were examined');
includes(intelligence, 'cohort_id', 'cross-participant analysis can be restricted to one cohort');
includes(courseIntelligence, 'Which Gurugram participants may need recruitment help?', 'Course Intelligence includes the intended recruitment query');
includes(courseIntelligence, 'Records considered', 'answers link back to the records used');
includes(courseIntelligence, 'renderAnswer', 'Course Intelligence renders readable structured answers');
includes(unifiedStudio, '/studio/course-intelligence.js', 'the unified private Studio loads Course Intelligence');

// One maintained profile route: legacy links preserve the participant query string.
includes(legacyProfile, '/studio/ai-business-leaders-preparation', 'legacy participant profiles open the maintained preparation page');
includes(legacyProfile, 'location.search', 'legacy redirect preserves participant identity');

// Avoid another notification flood: launch audit must remain manual-only.
includes(auditWorkflow, 'workflow_dispatch:', 'the launch audit can be started deliberately');
excludes(auditWorkflow, '\n  push:', 'the launch audit does not run on every push');
excludes(auditWorkflow, '\n  pull_request:', 'the launch audit does not run on pull requests');

// Invitation should lead to login, not treat a shareable slug as authentication.
includes(workspace, '/ai-business-leaders/login', 'Studio invitation points participants to secure login');

console.log('AI for Business Leaders launch audit passed: access, privacy, mobile navigation, cohort-safe persistence, safe archives, assignment uploads, participant research and full-directory Course Intelligence.');
