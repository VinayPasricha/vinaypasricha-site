# vinaypasricha.com — Technical Architecture

_Last updated: 2026-06-15_

## 1. Summary

A static HTML/CSS/JS website + a small Node/Express backend, packaged as one
container and hosted on **Google Cloud Run**. Chats and leads are stored in
**Firestore**. AI features run on **Google Gemini via Vertex AI**. Everything
lives in one Google Cloud account; cost is ~$0/month on the free tier.

Live URL: **https://vinay-site-349140108061.asia-south1.run.app**

---

## 2. Tech stack

### Frontend (the website)
- **HTML + CSS + vanilla JavaScript** — no framework, no build step (~114 pages).
- **React 18 + Babel** — loaded *in the browser* from a CDN (`unpkg`) only for the
  6 interactive `/runtime/` experiences (`.jsx` via `<script type="text/babel">`).
- **Google Fonts** — Newsreader, Inter, JetBrains Mono.
- **i18n** — 13 languages; shipped static translation packs + on-the-fly AI
  translation fallback (Gemini) when a string is missing.

### Backend (`backend/`)
- **Node.js 20** (ES modules).
- **Express 4** — serves the static site *and* the JSON API from one process.
- **@google-cloud/firestore** — database client.
- **@google-cloud/vertexai** — Gemini client.
- **cors**, **dotenv**.

### Container
- **Docker** (`Dockerfile` + `.dockerignore` at repo root), base `node:20-slim`,
  runs `node backend/src/server.js`, listens on port **8080**.

### Source control
- **Git** → GitHub `origin`: `github.com/VaishnavSPillai03/vinaypasricha-site`.

### Removed / not used
- ~~MongoDB / Atlas / Mongoose~~ — replaced by Firestore.
- ~~Google Sign-In / google-auth-library~~ — site is anonymous.
- ~~AWS~~ — AWS CLI is installed locally, but hosting is GCP. (The available AWS key
  was Bedrock-only and couldn't deploy.)

---

## 3. Where everything is hosted (all Google Cloud)

**GCP account:** `vpasricha9@gmail.com` (Vinay's personal)
**Project:** "My First Project" — id `project-65b6724f-5ba8-4e67-bf3`, number `349140108061`
**Billing:** Free trial (~₹28,710 credit, expires 14 Sep 2026)

| Concern | Service | Region | Notes |
|---|---|---|---|
| Website + API | **Cloud Run** (`vinay-site`) | asia-south1 (Mumbai) | Serverless container, public, scales to zero |
| Container image | **Artifact Registry** | asia-south1 | `cloud-run-source-deploy/vinay-site` |
| Image builds | **Cloud Build** | global | Builds the Dockerfile, pushes the image |
| Database | **Firestore** (Native) | asia-south1 | Collections: `conversations`, `leads` |
| AI / LLM | **Vertex AI** (Gemini) | us-central1 | Model `gemini-2.5-flash` |

### Enabled Google APIs
`run.googleapis.com` · `cloudbuild.googleapis.com` · `artifactregistry.googleapis.com` ·
`firestore.googleapis.com` · `aiplatform.googleapis.com`

### Service account (Cloud Run runtime identity)
`349140108061-compute@developer.gserviceaccount.com` — roles granted:
`datastore.user` (Firestore), `aiplatform.user` (Vertex/Gemini),
`cloudbuild.builds.builder`, `storage.objectViewer`, `artifactregistry.writer`,
`logging.logWriter`.

> No API keys in the app: Firestore and Vertex AI authenticate via this service
> account automatically on Cloud Run.

---

## 4. The backend API (served by Cloud Run)

| Method + path | Purpose |
|---|---|
| `GET /api/health` | Health check → `{ok:true}` |
| `POST /api/ai/complete` | `{system, messages}` → Gemini → `{completion}` |
| `POST /api/capture` | Universal: appends one AI exchange to a conversation |
| `POST /api/runtimes/:runtime/conversations` | Save a full conversation (Mission Capture) |
| `GET /api/runtimes/:runtime/conversations/:sessionId` | Read one conversation |
| `GET /api/runtimes/:runtime/conversations` | List recent (admin) |
| `POST /api/leads` | Save a captured lead (name, email, phone, …) |
| everything else | Static files (the website) |

Blocked from public serving: `/uploads`, `/_brief`, `/_prompts`, `/scraps`,
`/_audit`, `/_explorations`, `/backend`, `/server`, `/.git`.

---

## 5. The AI layer

- **Provider:** Google **Vertex AI**, model **`gemini-2.5-flash`**, location `us-central1`.
- **Browser side:** `js/claude-bridge.js` defines `window.claude.complete({system, messages})`
  (loaded on all 94 pages). Every AI feature on the site calls this one function.
- **Flow:** `window.claude.complete` → `POST /api/ai/complete` → `backend/src/services/ai.js`
  → Vertex AI → returns text.
- **Auto-capture:** after each reply the bridge also `POST`s the exchange to
  `/api/capture`, so every chat is stored. (Translation calls are skipped.)

AI-powered runtimes: Mission Capture, SIV (decisions), Signal (session),
AION1 (connect/intake), Library (the 6 runtimes), Civilization, Studio research,
and live i18n translation.

---

## 6. Data storage (Firestore, `vinay` project DB)

**`conversations`** — one doc per chat session (id = per-tab sessionId):
`runtime, page, messages[] {role, content, at}, artefact, status, name, email,
phone, ai, source, createdAt, updatedAt, expiresAt`.

**`leads`** — one doc per contact (id = email when present):
`name, email, phone, organizationName, source, sessionId, createdAt, updatedAt`.

Lead capture: an **upfront gate** (`js/lead-gate.js`) on the interactive runtime
pages asks Name + Email + Phone (all required) before use, saves to `leads`, and
tags subsequent chats with those details.

---

## 7. Local dev → deploy flow

```
# Local (from backend/):  npm install && npm start   → http://localhost:8080
# Build image:
gcloud builds submit --tag asia-south1-docker.pkg.dev/project-65b6724f-5ba8-4e67-bf3/cloud-run-source-deploy/vinay-site:vN  "<repo root path>"
# Deploy:
gcloud run deploy vinay-site --image <that image> --region asia-south1 \
  --allow-unauthenticated --memory 512Mi \
  --set-env-vars GOOGLE_CLOUD_PROJECT=project-65b6724f-5ba8-4e67-bf3,VERTEX_LOCATION=us-central1,VERTEX_MODEL=gemini-2.5-flash
```

CLIs installed locally: **gcloud** (Google Cloud SDK) and **AWS CLI v2** (unused for hosting).

---

## 8. Cost

~**$0/month** at current traffic: Cloud Run scales to zero, Firestore + Vertex
usage sit in free tier / trial credit. Only guaranteed cost would be a custom
domain (~$12/yr, not yet set up).
