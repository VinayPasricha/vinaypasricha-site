# AI for Business Leaders — Deployment & Operations Guide
### For Vinay's assistant · everything you need to launch it, test it, and run it day-to-day

---

## Part 0 · What we are building, and why (read this first)

Vinay runs a course, **"AI for Business Leaders,"** for the alumni of his Harvard OPM
batch. Before each participant's one-on-one meeting with Vinay, we want to:

1. **Personalise their course experience**, and
2. **Prepare Vinay** so every one-on-one starts already 20 minutes ahead.

The way we do this is a **personalised AI preparation agent**. Each participant gets a
private link. When they open it, they meet a warm, senior AI agent that *already knows
some background* about them and their company (we research them in advance). The agent
helps the participant **think** — about their goals for the course, their company, their
real business challenges, and where AI might, or might not, be relevant.

**This is not a chatbot, and it is not a salesperson.** Three rules define its character:
- It **helps the leader think first**. It never assumes they are ready to "implement AI."
- It talks about AI as a **possibility to explore**, never as a plan they must follow.
- It is **humble** about our research — it treats it as preliminary and invites corrections.

**What everyone gets out of it:**
- **The participant** leaves with a genuinely useful, downloadable brief (a Course
  Preparation Brief, a Use-Case Map, or an AI Strategy Note — depending on how deep they go).
- **Vinay** gets a sharp, private 2-page intelligence brief before the meeting.
- **The participant stays in control**: before anything is shared with Vinay, they review
  the summary and can edit or remove anything sensitive.

**The three roles (that's you and Vinay):**
| Role | Who | What they do |
|---|---|---|
| **Admin / assistant** | **You** | Create participants, add research, test the agent (QA), approve & send links, view briefs. |
| **Participant** | Course alumni | Open their link, chat, get their reward, review what's shared. |
| **Vinay / viewer** | Vinay | Reads the private meeting brief before each 1:1. |

**The participant's journey (what they experience):**
`Open link → accept privacy → choose 15 / 30 / 45-minute journey → chat with the agent →
receive a reward (downloadable PDF) → review the summary shared with Vinay → done.`

Everything lives at **`vinaypasricha.com/ai-business-leaders`**. The rest of Vinay's
website is untouched. Under the hood: a Next.js app on **Google Cloud Run**, a
**Supabase** database, and **Claude (Anthropic's AI) running on Google's Vertex AI**.

> **Your north star:** a participant should finish thinking *"that was genuinely useful and
> respectful of my time,"* and Vinay should walk into the meeting already understanding them.

---

## Part 1 · What you'll need before you start

This has a **one-time technical setup** (Parts 2–3) and then an **easy daily routine**
(Part 5). Parts 2–3 touch Google Cloud and Supabase. If you're comfortable following
steps, you can do it. If not, hand Parts 2–3 to a developer once — after that, **everything
you do day-to-day (Part 5) needs no code at all.**

You'll need access to:
- **A Google Cloud (GCP) account/project** — this hosts the app and the AI.
- **A Supabase account** — this is the database (free tier is fine to start).
- The ability to point the domain path `vinaypasricha.com/ai-business-leaders` at the app
  (whoever manages Vinay's DNS/hosting on GCP).

You'll collect a handful of secret values along the way. Keep them in a private password
manager — **never** email or message them, and never put them in a public place.

---

## Part 2 · One-time setup

### 2A · Supabase (the database) — ~10 minutes
1. Go to **supabase.com**, sign in, click **New project**. Give it a name (e.g.
   `abl-course`), set a strong database password (save it), pick a region near your users,
   create it.
2. When it's ready, open the project → left sidebar → **SQL Editor** → **New query**.
3. Open the file **`supabase/migrations/0001_init.sql`** from this repository, copy its
   entire contents, paste into the SQL editor, and click **Run**. You should see "Success."
   *(This creates all the tables the app needs.)*
4. Go to **Project Settings → API**. Copy and save three values:
   - **Project URL** → this is `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY`
   > ⚠️ The **service_role** key is powerful. Treat it like a master password. It only ever
   > lives on the server — never share it, never put it in a browser, a link, or a message.

### 2B · Google Vertex AI (the AI brain) — ~15 minutes
The agent is **Claude**, run through **Google's Vertex AI**. You need to switch it on and
give the app permission to use it.
1. In the **Google Cloud Console**, select (or create) the project you'll use. Note its
   **Project ID** → this is `GOOGLE_CLOUD_PROJECT`.
2. In the search bar, go to **Vertex AI** → enable the **Vertex AI API** if prompted.
3. Go to **Vertex AI → Model Garden**, search for **Claude** (Anthropic). Click the model
   (e.g. *Claude Sonnet 4.5*) and **Enable / Request access**. Approval is usually quick.
4. Note two things:
   - The **model ID** shown for Vertex (looks like `claude-sonnet-4-5@20250929`) → this is
     `ANTHROPIC_MODEL`.
   - A **region** where the model is available (e.g. `us-east5`) → this is
     `GOOGLE_CLOUD_REGION`.
5. Permissions: the app (running on Cloud Run) will use a **service account**. That service
   account needs the role **Vertex AI User**. (In Part 3 the deploy uses the default
   compute service account; grant it **Vertex AI User** under **IAM & Admin → IAM**.)

> **Why Vertex and not a plain API key?** On Google Cloud, Claude is accessed through Vertex
> using the project's built-in credentials — there's no separate API key to leak. That's the
> safest setup, and it's what we're using everywhere.

### 2C · Choose your admin values
- **`ADMIN_PASSWORD`** — the password *you* will type to open the admin dashboard. Make it
  long and random.
- **`ADMIN_SESSION_SECRET`** — any other long random string (used to keep you logged in
  securely). You never type this one.

### 2D · Fill in this table (you'll paste these during deploy)
| Variable | Where it came from | Your value |
|---|---|---|
| `AI_PROVIDER` | fixed | `vertex` |
| `GOOGLE_CLOUD_PROJECT` | 2B‑1 | |
| `GOOGLE_CLOUD_REGION` | 2B‑4 | |
| `ANTHROPIC_MODEL` | 2B‑4 | |
| `SUPABASE_URL` | 2A‑4 | |
| `SUPABASE_ANON_KEY` | 2A‑4 | |
| `SUPABASE_SERVICE_ROLE_KEY` | 2A‑4 (secret) | |
| `ADMIN_PASSWORD` | 2C (secret) | |
| `ADMIN_SESSION_SECRET` | 2C (secret) | |
| `NEXT_PUBLIC_APP_ORIGIN` | fixed | `https://vinaypasricha.com` |

---

## Part 3 · Deploy the app to Cloud Run

> This is the one genuinely technical step. It can be done from a terminal with the
> **gcloud** CLI installed and logged in (`gcloud auth login`, `gcloud config set project …`).
> If that's unfamiliar, this is the part to hand to a developer once.

**Step 1 — store the secrets** (so they're not typed in plain text). In Cloud Console →
**Security → Secret Manager**, create secrets for the four sensitive values
(`ADMIN_PASSWORD`, `ADMIN_SESSION_SECRET`, `SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`).

**Step 2 — deploy** from the project folder:
```bash
gcloud run deploy abl-course \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "AI_PROVIDER=vertex,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT,GOOGLE_CLOUD_REGION=us-east5,ANTHROPIC_MODEL=claude-sonnet-4-5@20250929,SUPABASE_URL=YOUR_SUPABASE_URL,NEXT_PUBLIC_APP_ORIGIN=https://vinaypasricha.com" \
  --set-secrets "ADMIN_PASSWORD=abl-admin-pw:latest,ADMIN_SESSION_SECRET=abl-session:latest,SUPABASE_ANON_KEY=abl-anon:latest,SUPABASE_SERVICE_ROLE_KEY=abl-service:latest"
```
**Step 3 — grant permissions:** give the Cloud Run service account the roles **Vertex AI
User** (to call Claude) and **Secret Manager Secret Accessor** (to read the secrets).

**Step 4 — get the URL.** When deploy finishes, gcloud prints a **Service URL** like
`https://abl-course-xxxx.a.run.app`. **Test on this raw URL first** (Part 4) before wiring
the domain.

**Step 5 — connect the domain path (once testing passes).** Point
`vinaypasricha.com/ai-business-leaders/*` at this Cloud Run service. On GCP the clean way is
an **external HTTPS Load Balancer** with a URL path-matcher rule sending
`/ai-business-leaders/*` to the service. The app already expects to live under that path, so
no code changes are needed. *(This is a networking task — hand to whoever manages Vinay's GCP
ingress/DNS.)*

> **Re-deploying later:** any time the code changes, run the same `gcloud run deploy …`
> command again. Nothing else changes.

---

## Part 4 · Smoke test — prove it actually works (do this right after deploy)

Do this on the Cloud Run **Service URL** (or the live domain once connected). Replace
`BASE` below with that URL.

1. **Admin loads & login works.** Open `BASE/ai-business-leaders/admin/ai-business-leaders`.
   Enter your `ADMIN_PASSWORD`. You should see the (empty) Participants table.
   *Proves: the app is up and the admin password works.*
2. **Create a test participant.** Click **+ New participant**. Name: `Test Person`,
   Company: `Test Co`. Create. Fill a couple of other fields, **Save**.
   *Proves: the app can write to Supabase.*
3. **Add research.** In section 2, put a line in "Customers," paste a short paragraph in the
   **Research dossier**, **Save research**.
4. **Test the agent (the big one).** In section 3, pick **15m**, type
   *"Hi"* and send. Within a few seconds the agent should greet you by (test) name/company,
   invite corrections, and ask a thoughtful question.
   *Proves: the app can reach Claude on Vertex AI. **If this fails, it's almost always a
   Vertex model-access, region, or permission issue — see Troubleshooting.***
5. **Complete QA.** Tick all 14 checklist boxes (for the test, just to see the flow), then
   **Mark QA passed**.
6. **Approve & copy the link.** In section 4, click **Approve link**, then **Copy
   participant link**.
7. **Be the participant.** Open the copied link in a **private/incognito window**. You should
   see the welcome message, privacy notice, and the three journey cards. Accept privacy,
   pick **15 minutes**, and have a short chat (send 3–4 messages).
   *Proves: the participant experience and message storage work.*
8. **Get the reward.** Click **"I'm ready — prepare my summary & reward."** After a moment
   you should see a **Course Preparation Brief** and a **Download PDF** link. Download it —
   check it opens as a clean PDF.
   *Proves: output generation + PDF work.*
9. **Review & approve the summary.** Edit a line in the "Summary to be shared with Vinay,"
   optionally add a note, click **Approve & send to Vinay.** You should reach a "Thank you"
   screen.
10. **Vinay's brief.** Back in the admin participant page, click **Generate Vinay brief** →
    it appears → **Download brief PDF**.
    *Proves: the full loop end-to-end.*

If all ten pass, **you are live.** Delete the test participant's data later if you wish
(via Supabase), or just leave it.

**Quick pass/fail checklist:**
- [ ] Admin login works
- [ ] Create participant saves
- [ ] Research saves
- [ ] Agent replies in QA test chat *(this confirms Vertex/Claude)*
- [ ] Link approves + copies
- [ ] Participant link opens, chat works
- [ ] Reward generates + PDF downloads
- [ ] Summary review + approve works
- [ ] Vinay brief generates + PDF downloads

---

## Part 5 · The day-to-day routine — creating a real participant link

This is what you'll actually do for each course participant. **No code needed.**

1. **Research the participant first** (outside the app): their company, role, industry,
   what the company does, its customers, competitors, pressures, and any known AI use.
   Write it up in a paragraph or two.
2. Open the admin, **+ New participant**, enter their real details, **Create**.
3. In **section 2 (Research)**, fill the structured fields and paste your write-up into the
   **Research dossier**. **Save research.** *(Good research = a much more personal, useful
   conversation. This is the highest-leverage thing you do.)*
4. **Test it (QA)** in section 3: chat as if you were the participant. Check the agent gets
   their name/company right, asks smart questions, stays humble, offers the journeys, and
   doesn't push AI. Tick the checklist honestly. Fix the research if anything's off. When
   it's genuinely good, **Mark QA passed**.
5. **Approve link** (section 4) → **Copy participant link**.
6. **Send the link** to the participant yourself — email or WhatsApp. *(V1 doesn't send
   emails automatically; you send it.)* A suggested message:
   > *"Ahead of your one-on-one with Vinay for AI for Business Leaders, here's a short private
   > preparation session you can do at your own pace: [link]. It'll help personalise the
   > course and make our meeting more useful."*
7. **Before the meeting**, open their participant page → **Generate Vinay brief** →
   **Download brief PDF** → give it to Vinay.

That's the whole loop. Repeat per participant.

**A note on statuses** (what the dashboard column means):
`draft → research_added → qa_pending → qa_approved → link_ready → active (they've started) →
completed (they finished & approved their summary).`

---

## Part 6 · The QA checklist — what "pass" actually means

When you test in section 3, you're checking the agent behaves the way Vinay wants. Here's
what each item is really asking:

| Check | Pass when… |
|---|---|
| Name / Company / Role correct | The agent refers to the right person, company, and role. |
| Research fields / dossier loaded | The agent clearly knows the background you entered. |
| Greets correctly | Warm, senior, brief — confirms who they are and invites corrections. |
| Offers 15/30/45 journey | The choice is presented (participant sees the cards). |
| **Does not assume AI readiness** | It never says "you should implement AI"; it helps them think. |
| Asks intelligent questions | Questions feel sharp and relevant, not generic. |
| Uses the course framework | It draws on the Company-Brain / use-case thinking naturally. |
| Humble about research | It treats the research as preliminary and asks them to correct it. |
| Privacy notice appears | The participant sees the privacy/sharing note before chatting. |
| Reward generation works | A brief is produced and downloads as PDF. |
| Vinay brief generation works | The private brief is produced and downloads as PDF. |

If any behaviour is off, the fix is almost always **better research** or trying again —
then re-test.

---

## Part 7 · Troubleshooting

| Symptom | Most likely cause → fix |
|---|---|
| **Agent doesn't reply / error in QA chat** | Vertex/Claude not reachable. Check: Vertex AI API enabled; the Claude model is *access-granted* in Model Garden; `GOOGLE_CLOUD_REGION` is a region where the model exists; `ANTHROPIC_MODEL` matches the exact Vertex model id; the Cloud Run service account has **Vertex AI User**. |
| **"Incorrect password" on admin** | `ADMIN_PASSWORD` typo, or the secret wasn't set on Cloud Run. Re-check the Secret Manager value and redeploy. |
| **Anything about the database / can't save** | Supabase values wrong, or the SQL wasn't run. Re-check `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; confirm `0001_init.sql` ran successfully. |
| **"This session is not active yet"** on a participant link | The link hasn't been **approved** yet. Approve it in section 4. |
| **Participant link 404 / not found** | Wrong or truncated link. Copy it again with the **Copy link** button. |
| **PDF won't download** | Rare. Re-generate the output and try again; check the Cloud Run logs. |
| **Page styling looks broken under the domain** | The `/ai-business-leaders` path routing isn't sending assets to the app. Confirm the path rule covers `/ai-business-leaders/*` (Part 3, Step 5). |
| **Message limit reached** | Each session caps at 200 messages (a warning shows at 180). Expected — the participant finishes and generates their summary. |

**Where to look:** Cloud Run → your service → **Logs** shows server errors. Supabase →
**Table editor** lets you see participants, sessions, and messages directly.

---

## Part 8 · Security & privacy — the rules that matter

- **Never share the `SUPABASE_SERVICE_ROLE_KEY` or the admin password.** Not in email, chat,
  or screenshots. They live only in Cloud Run's secrets.
- **Participant links are private.** Each link is unguessable and opens only that one
  person's session. Send each link only to that person.
- **Respect the participant's edits.** What they approve in "Summary to be shared with
  Vinay" is what's shared. Don't work around it.
- **The research is preliminary.** If a participant corrects something, that's the point —
  their answers always win.
- **The admin dashboard is for you and Vinay only.** Don't share the admin URL or password
  with participants.

---

## Appendix · Quick reference

**Key URLs** (replace `BASE` with the live domain or the Cloud Run URL):
- Admin dashboard: `BASE/ai-business-leaders/admin/ai-business-leaders`
- A participant link looks like: `BASE/ai-business-leaders/session/rajesh-kumar-8F3K2Q`

**Files a developer may reference:**
- `AI_BUSINESS_LEADERS_README.md` — the engineering README (stack, env, deploy).
- `supabase/migrations/0001_init.sql` — the database setup script.
- `.env.example` — the full list of environment variables with explanations.
- `Dockerfile` — how the app is packaged for Cloud Run.

**The one thing to get right first:** the **Vertex AI model access + region + permission**
(Part 2B / Part 7). If the agent replies in the QA test chat, everything else is easy.
