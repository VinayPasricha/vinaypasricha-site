# AI for Business Leaders — Staging Launch Gate

Production must remain untouched until every required item below passes on the deployed `agent/ai-course-staging` service.

## Status

- Code branch: `agent/ai-course-staging`
- Production merge: **blocked**
- Current gate: **awaiting deployed staging smoke test**

## Automated checks

These must pass in a deliberately started manual audit:

- `npm run test:abl-course`
- `npm run test:abl-launch`

The launch audit checks participant authentication, cross-workspace protection, Studio privacy, return navigation, invitation rules, focused homepage, safe persistence, assignment uploads, participant research and cross-course intelligence. The GitHub workflow must remain manual-only.

## Required deployed-staging smoke test

### Participant access

- [ ] Homepage banner opens the course sign-in page.
- [ ] An unknown or uninvited email receives no access and reveals no membership information.
- [ ] An invited participant receives a six-digit OTP email.
- [ ] A wrong or expired OTP is rejected.
- [ ] A valid OTP opens the correct participant workspace.
- [ ] Participant A cannot open Participant B's workspace by changing the slug.
- [ ] Sign out removes access; sign-in resumes the same saved workspace.

### Participant workspace

- [ ] No Vinay Studio control, link, route, or label appears anywhere participant-facing.
- [ ] Mobile menu opens, closes, and scrolls without trapping the page.
- [ ] Every internal page has a working `Workspace Home` return.
- [ ] Preparation, VED, SIV, Initiative Builder, assignments, materials, recordings, and initiative pages all return home correctly.
- [ ] The adaptive `Do this now` action points to the correct next step.
- [ ] The current session displays the correct date and Google Meet link for that cohort.
- [ ] Missing material links show a safe unavailable state rather than a dead button.
- [ ] An assignment shows written response, drag-and-drop/file picker, Drive-link fallback, Save draft and Submit.
- [ ] PDF, Word, PowerPoint and image uploads save privately and remain downloadable after refresh.
- [ ] Oversized, mismatched or disguised file types are rejected.
- [ ] A participant cannot upload to another participant's or an unavailable assignment.
- [ ] Draft assignment saves, survives refresh, and submits successfully.
- [ ] Notebook and 90-Day Initiative edits survive refresh.
- [ ] Layout works at 360 px, 390 px, tablet width, and desktop width.

### Vinay Studio

- [ ] `/studio` is inaccessible without the configured private passphrase.
- [ ] Studio fails closed when `STUDIO_PASSPHRASE` is missing.
- [ ] Studio login, logout, and session expiry work.
- [ ] Add participant rejects missing name/email and prevents duplicate email records.
- [ ] Send Invite activates only the intended participant and points to secure sign-in.
- [ ] Cohort reassignment does not delete participant work.
- [ ] Current session and all five dates/meeting links save correctly.
- [ ] Material draft, preview, publish, hide and Archive/Delete-unused-draft actions behave correctly.
- [ ] Published content and assignments containing participant work cannot be permanently erased.
- [ ] Assignment publish, uploaded-file download and participant submission review work.
- [ ] Announcement publishing targets only the selected audience.

### Participant Research Agent

- [ ] Every private participant profile shows `Ask AI about [participant]` directly beneath the Admin Snapshot.
- [ ] The agent answers from the participant's profile, research, meeting notes, uploaded references, conversations and course outputs.
- [ ] A follow-up question such as `What about their event business?` uses the preceding conversation rather than treating it as a new unrelated query.
- [ ] With fresh web research enabled, the agent returns current public findings with clickable sources.
- [ ] Private meeting notes and course evidence are never sent as the public web-search query.
- [ ] The answer clearly distinguishes private evidence, public findings, inference and unknown information.
- [ ] `Save grounded findings to this dossier` appends only grounded public research and its sources.
- [ ] Refreshing the profile preserves the private research conversation.
- [ ] The participant-facing workspace cannot access any participant-research-agent endpoint.

### Course Intelligence Agent

- [ ] The private unified Studio shows a `Course Intelligence` navigation item and home card.
- [ ] Questions can run across all cohorts or one selected cohort.
- [ ] `Which Gurugram participants may need recruitment help?` returns named records and exact counts classified as Confirmed, Probable/inferred and Insufficient evidence.
- [ ] Counts are supported by profile, research, meeting-note, conversation or course-output evidence rather than model assumptions.
- [ ] Matched participant cards open the correct private profile.
- [ ] A follow-up question understands the preceding Course Intelligence conversation.
- [ ] Missing geography, hiring need or commercial-interest evidence is surfaced rather than silently treated as negative.
- [ ] The agent does a compact directory scan first and deep-reads only shortlisted participant records.
- [ ] An unauthenticated or participant-authenticated request cannot access cross-participant intelligence.

### Persistence and isolation

- [ ] Staging writes only to staging-prefixed Firestore collections.
- [ ] Refreshing any saved participant page preserves server data.
- [ ] Participant records, submissions, research threads and materials do not leak between accounts or cohorts.
- [ ] Course Intelligence conversation history remains private to Studio.
- [ ] Assignment files remain private Cloud Storage objects and are never exposed through public URLs.
- [ ] No participant or Studio page is cached publicly.

## Required staging configuration

- [ ] `STUDIO_PASSPHRASE`
- [ ] `ADMIN_TOKEN`
- [ ] `ABL_AUTH_SECRET`
- [ ] `RESEND_API_KEY`
- [ ] `ABL_FROM_EMAIL`
- [ ] `FIRESTORE_COLLECTION_PREFIX=staging_`
- [ ] `ABL_UPLOAD_BUCKET` points to a private staging Cloud Storage bucket
- [ ] Cloud Run service account can use Vertex AI, Firestore and the private upload bucket

## Launch decision

Production may be considered only when:

1. Both automated checks pass in one deliberately started manual audit.
2. Every deployed-staging smoke-test item above is checked.
3. The final staging commit SHA is recorded.
4. Vinay has personally tested the participant and Studio experiences on phone and desktop.
5. A separate production merge/deployment is explicitly approved.

Until then, the safe operational fallback is Google Meet plus email/WhatsApp delivery of the case and session links. The website must remain optional and must never gate attendance.
