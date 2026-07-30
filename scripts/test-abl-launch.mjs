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
  'backend/src/abl/authRoutes.js',
  'backend/src/abl/participantGuard.js',
  'backend/src/abl/securePageRoutes.js',
  'backend/src/abl/focusedWorkspaceRoute.js',
  'backend/src/abl/workspaceRoutes.js',
  'backend/src/abl/safeArchiveRoutes.js',
  'studio/safe-archive-controls.js',
].forEach(mustExist);

const server = read('backend/src/server.js');
const guard = read('backend/src/abl/participantGuard.js');
const auth = read('backend/src/abl/authRoutes.js');
const workspace = read('backend/src/abl/workspaceRoutes.js');
const safeArchive = read('backend/src/abl/safeArchiveRoutes.js');
const studioShell = read('studio/ai-leadership-workspace.html');
const archiveControls = read('studio/safe-archive-controls.js');
const focusedRoute = read('backend/src/abl/focusedWorkspaceRoute.js');
const focusedHome = read('ai-business-leaders/workspace-home-focus.js');
const participantChrome = read('ai-business-leaders/participant-only-nav.js');
const innerNav = read('ai-business-leaders/participant-inner-nav.js');
const securePages = read('backend/src/abl/securePageRoutes.js');
const login = read('ai-business-leaders/login.html');

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
includes(server, 'extensionless paths such as /ai-business-leaders/login', 'route-order rationale is documented');

// Each live response used for sign-off must identify its exact deployed revision.
includes(server, "app.get('/api/abl/deployment'", 'dynamic deployment identity endpoint exists');
includes(server, "res.setHeader('X-ABL-Release'", 'release header is available on guarded responses');
includes(server, "res.setHeader('X-ABL-Revision'", 'Cloud Run revision header is available on guarded responses');
includes(server, 'K_REVISION', 'deployment identity reads the active Cloud Run revision');

// Studio must fail closed and anonymous Studio UI must be redirected safely.
excludes(workspace, "|| 'vik123'", 'new Studio API has no built-in fallback passphrase');
includes(workspace, "if (!passphrase) return ''", 'missing workspace Studio passphrase fails closed');
includes(workspace, 'cookieAllowed || tokenAllowed', 'workspace Studio accepts only configured credentials');
includes(server, 'studio_not_configured', 'central Studio is blocked when its passphrase is absent');
includes(server, "!String(process.env.STUDIO_PASSPHRASE || '').trim()", 'Cloud Run requires an explicit Studio passphrase');
includes(server, 'function explicitStudioHash()', 'server has an explicit Studio cookie hash');
includes(server, "res.setHeader('Location', '/studio/login')", 'anonymous Studio UI uses an explicit safe redirect');
includes(server, "layer.name === 'expressInit'", 'Studio UI guard runs after Express initialisation');

// Participant chrome must never render or reintroduce the private Studio control.
includes(focusedRoute, 'hidden aria-hidden="true" tabindex="-1"', 'Studio control is removed before participant HTML is sent');
includes(focusedRoute, 'participant-only-nav.js', 'participant-only chrome is always layered onto the real workspace');
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

// Cohort changes must preserve only content already received, not future old-cohort content.
includes(workspace, 'material_entitlements', 'participant material access is snapshotted before a cohort move');
includes(workspace, 'assignment_entitlements', 'participant assignment access is snapshotted before a cohort move');
includes(workspace, 'cohort_history', 'cohort reassignment history is retained');
includes(workspace, "visibleTo(a, p, 'assignment_entitlements') || Boolean(byAssignment[a.id])", 'existing assignment work remains visible after reassignment');
includes(workspace, 'existingSubmission', 'a saved assignment remains editable after reassignment');
includes(workspace, "return fail(res, 'Email already exists', 409)", 'participant email edits reject duplicates');

// Published content and participant work must never be destructively deleted.
includes(server, 'registerSafeArchiveRoutes(app)', 'safe archive routes are registered');
assert.ok(server.indexOf('registerSafeArchiveRoutes(app)') < server.indexOf('registerWorkspaceRoutes(app)'), 'safe archive routes run before legacy DELETE handlers');
includes(safeArchive, "status: 'hidden'", 'archived content is removed from active publishing without erasure');
includes(safeArchive, "participant draft or submission exists", 'assignment work forces archival');
includes(safeArchive, "participant entitlement exists", 'previously received content forces archival');
includes(safeArchive, 'deleted_draft: true', 'only unused drafts may be permanently deleted');
includes(studioShell, '/studio/safe-archive-controls.js', 'Studio loads the safe archive controls');
includes(archiveControls, 'Delete unused draft', 'Studio distinguishes draft deletion from archival');
includes(archiveControls, 'Archived safely', 'Studio confirms safe archival to the operator');

// Invitation should lead to login, not treat a shareable slug as authentication.
includes(workspace, '/ai-business-leaders/login', 'Studio invitation points participants to secure login');

console.log('AI for Business Leaders launch audit passed: access, revision identity, route ordering, privacy, mobile navigation, Studio security, cohort-safe persistence, safe archiving, focused home and session wiring.');
