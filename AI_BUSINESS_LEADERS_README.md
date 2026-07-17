# AI for Business Leaders — course-prep agent (V1)

A personalised AI course-preparation and discovery agent for alumni of Vinay's
Harvard OPM batch. Each participant gets a private link, chats with an agent that
already has preliminary research on them, and leaves with a downloadable reward.
Vinay/admin get a private meeting brief. Built into this Next.js app; served under
`vinaypasricha.com/ai-business-leaders`. The marketing site is untouched.

> **Not a chatbot.** The agent helps a leader *think* first. It never assumes AI
> implementation readiness, frames AI as "possible relevance," and is humble about
> its research.

---

## 1. Stack & where things live
- **Next.js 16 (App Router) + TypeScript + Tailwind v4** — reuses the site's editorial tokens (paper / ink / vermillion, Fraunces / Newsreader / JetBrains Mono).
- **Supabase** — Postgres (all access server-side via the service-role key; RLS on, no public policies).
- **Claude** — via **Vertex AI** on GCP by default (`AI_PROVIDER=vertex`), or direct Anthropic (`AI_PROVIDER=anthropic`). Key never reaches the browser.
- **PDF** — `@react-pdf/renderer`, server-side, on demand.
- Deploy target: **GCP Cloud Run** (container). `basePath: /ai-business-leaders`.

```
lib/abl/            config, supabase, auth, slug, ai (provider), knowledge (course
                    framework), prompt, copy, repo (DB), service (chat+outputs),
                    pdf, http, paths, types
app/api/…           session + admin + pdf route handlers
app/ai-business-leaders/session/[slug]        participant experience
app/admin/ai-business-leaders/…               dashboard + participant hub (edit/QA/brief)
components/abl/      ParticipantSession, Markdown
supabase/migrations/0001_init.sql             schema (run this once)
Dockerfile          Cloud Run image
```

## 2. Environment variables
Copy `.env.example` → `.env.local` (local) or set as Cloud Run env/secrets. Summary:

| Var | Purpose |
|---|---|
| `ADMIN_PASSWORD` | gates `/admin/ai-business-leaders` |
| `ADMIN_SESSION_SECRET` | signs the admin cookie (any long random string) |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only**, bypasses RLS |
| `AI_PROVIDER` | `vertex` (default) or `anthropic` |
| `ANTHROPIC_MODEL` | e.g. `claude-sonnet-4-5@20250929` (Vertex) or `claude-sonnet-4-5` (direct) |
| `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_REGION` | if `AI_PROVIDER=vertex` (uses ADC / the Cloud Run service account) |
| `ANTHROPIC_API_KEY` | only if `AI_PROVIDER=anthropic` |
| `NEXT_PUBLIC_APP_ORIGIN` | e.g. `https://vinaypasricha.com` |

## 3. One-time setup
1. **Supabase:** create a project → SQL editor → paste & run `supabase/migrations/0001_init.sql`. Copy the URL, anon key, and service-role key into env.
2. **Claude on Vertex (default):** in your GCP project, enable Vertex AI and request access to the Claude model in Model Garden. Cloud Run uses the service account (ADC) — grant it the **Vertex AI User** role. Set `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_REGION` (a region where the model is available, e.g. `us-east5`).
   *Alternatively, direct Anthropic:* set `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY`.
3. **Admin:** set `ADMIN_PASSWORD` and `ADMIN_SESSION_SECRET`.

## 4. Run locally
```bash
npm install
# put values in .env.local
npm run dev
# open http://localhost:3000/ai-business-leaders/admin/ai-business-leaders
```
(For Vertex locally: `gcloud auth application-default login`.)

## 5. Deploy to Cloud Run
```bash
gcloud run deploy abl-course \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "AI_PROVIDER=vertex,GOOGLE_CLOUD_PROJECT=...,GOOGLE_CLOUD_REGION=us-east5,ANTHROPIC_MODEL=claude-sonnet-4-5@20250929,SUPABASE_URL=...,NEXT_PUBLIC_APP_ORIGIN=https://vinaypasricha.com" \
  --set-secrets "ADMIN_PASSWORD=abl-admin-pw:latest,ADMIN_SESSION_SECRET=abl-session:latest,SUPABASE_ANON_KEY=abl-anon:latest,SUPABASE_SERVICE_ROLE_KEY=abl-service:latest"
```
(Store secrets in Secret Manager; grant the run service account **Secret Accessor** + **Vertex AI User**.)

**Path routing:** point `vinaypasricha.com/ai-business-leaders/*` to this Cloud Run
service (an external HTTPS Load Balancer with a path-matcher rule, or your existing
GCP ingress). The app already prefixes everything with `/ai-business-leaders`, so no
app changes are needed.

## 6. The end-to-end flow (how to generate a real link)
1. Go to `…/ai-business-leaders/admin/ai-business-leaders`, enter `ADMIN_PASSWORD`.
2. **+ New participant** → fill name + company (rest optional) → **Create**.
3. On the participant page: fill **Research** (structured fields + paste a dossier) → **Save research**.
4. **QA:** use the test chat (pick 15/30/45) to talk to the agent as the participant, then tick the checklist. **Mark QA passed** (enabled once all boxes are checked).
5. **Approve link** (enabled after QA passes) → **Copy participant link** → send it (email/WhatsApp yourself — no email in V1).
6. Participant opens the link → accepts privacy → picks a journey → chats → gets their reward (PDF) → reviews the summary shared with Vinay.
7. Back in admin: **Generate Vinay brief** → view + **Download brief PDF**. The participant-approved summary is shown too.

## 7. Known limitations (V1)
- Admin auth is a single shared `ADMIN_PASSWORD` (no user accounts).
- Participant access = the unguessable link (name + 6-char random). Fine for a small private cohort; add per-link rate limiting / a separate access code for larger use.
- Research is manual-only (a clear TODO/extension point marks where auto-research plugs in).
- No email delivery; links/PDFs are shared manually.
- PDF is clean text/markdown (no rich charts).
- The book "spine" is the compact framework in `lib/abl/knowledge.ts`; swap in full-book RAG later (extension point in `getFramework()`).
- Streaming responses are off (simple request/response); both SDKs support `.messages.stream` when wanted.

## 8. V2 TODO (do not build now)
Email rewards/briefs · email Vinay · automated company research · reminder emails/WhatsApp ·
analytics dashboard · calendar & CRM integration · multi-admin permissions & audit logs ·
full-book RAG ingestion · streaming chat.
