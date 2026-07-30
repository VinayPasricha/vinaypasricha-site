# AI for Business Leaders — Staging Launch Gate

Production must remain untouched until every required item below passes on the deployed `agent/ai-course-staging` service.

## Status

- Code branch: `agent/ai-course-staging`
- Production merge: **blocked**
- Current gate: **awaiting deployed staging smoke test**

## Automated checks

These must pass in GitHub Actions:

- `npm run test:abl-course`
- `npm run test:abl-launch`

The launch audit checks participant authentication, cross-workspace protection, Studio privacy, return navigation, invitation rules, focused homepage, current-session meeting-link wiring, cohort-safe persistence, safe archiving and private assignment uploads.

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
- [ ] When no assignment is published, the participant sees a clear unavailable message rather than a blank screen.
- [ ] A participant can upload an allowed PDF, Word, PowerPoint or image file of 15 MB or less.
- [ ] A disguised or unsupported file is rejected.
- [ ] Participant A cannot retrieve Participant B's uploaded assignment.
- [ ] An uploaded file remains available after saving a draft, submitting and refreshing.
- [ ] Draft assignment text saves, survives refresh, and submits successfully.
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
- [ ] Material draft, preview, publish, hide, archive and unused-draft deletion behave correctly.
- [ ] Assignment publish, safe archive, participant submission review and uploaded-file download work.
- [ ] Announcement publishing targets only the selected audience.

### Persistence and isolation

- [ ] Staging writes only to staging-prefixed Firestore collections.
- [ ] Assignment files are stored only in the private staging upload bucket.
- [ ] The Cloud Run service account can create, read and replace objects in that bucket.
- [ ] Refreshing any saved participant page preserves server data.
- [ ] Participant records, submissions, files and materials do not leak between accounts or cohorts.
- [ ] No participant, uploaded file or Studio page is cached publicly.

## Required staging configuration

- [ ] `STUDIO_PASSPHRASE`
- [ ] `ADMIN_TOKEN`
- [ ] `ABL_AUTH_SECRET`
- [ ] `RESEND_API_KEY`
- [ ] `ABL_FROM_EMAIL`
- [ ] `FIRESTORE_COLLECTION_PREFIX=staging_`
- [ ] `ABL_UPLOAD_BUCKET` pointing to a private staging-only Google Cloud Storage bucket

## Launch decision

Production may be considered only when:

1. Both automated checks pass.
2. Every deployed-staging smoke-test item above is checked.
3. The final staging commit SHA is recorded.
4. Vinay has personally tested the participant experience on his phone.
5. A separate production merge/deployment is explicitly approved.

Until then, the safe operational fallback is Google Meet plus email/WhatsApp delivery of the case and session links. The website must remain optional and must never gate attendance.
