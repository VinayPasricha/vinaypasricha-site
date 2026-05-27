# Prompt Studio — admin requirement

A new requirement, May 17, 2026: the site needs a private admin section
where Vinay (and only Vinay) can manage, iterate on, and deploy the
system prompts that power the AI conversations on each path.

This is a real product requirement, not a UI sketch. It must be built
as part of v1.

---

## Why this exists

The site is **a family of cognitive instruments** (see
`interaction-architecture.md`). Each instrument is powered by a system
prompt — for example, the SIV Method conversation is driven by the
master prompt at `_prompts/siv/v1.0.md`.

These prompts are **living source code.** They will be refined every
time Vinay sees a session that could have gone better. Sometimes the
refinement is one word; sometimes it's a new lens. Either way, the
prompt must be editable without redeploying the whole site.

The studio is the editing environment. The visitors never see it.

---

## What it does

A single private page at `/studio/` (auth-gated) that lets Vinay:

1. **See all prompts** — one per path (SIV, Signal, AI for Business,
   Execution, Career, etc.). Each shows its current version, last
   edited date, and total number of conversations completed against it.
2. **Edit a prompt** — full-screen markdown editor with live preview.
   Saving creates a new version (semantic bump: 1.0 → 1.1).
3. **Diff versions** — side-by-side comparison of any two versions of
   the same prompt.
4. **Preview** — run a fresh conversation against the draft prompt in
   a sandbox before publishing. The visitor doesn't see drafts.
5. **Publish** — promote a draft to live. The site picks up the new
   prompt on the next page load.
6. **Roll back** — promote any historical version back to live in one
   click.
7. **Analytics** — for each prompt:
   - Total conversations started
   - Conversations completed (made it to artefact)
   - Average turn count
   - Average session duration
   - Languages used (which of the 13)
   - Drop-off points (which phase visitors abandon)
   - A reviewable log of full anonymised transcripts (opt-in by visitor)
8. **Notes** — a small notes field per prompt where Vinay can jot
   *"why this version, what to watch for, what to consider next."*

## How it's built (v1)

**Frontend (we can build now):**
- A single static HTML page at `/studio/` with the full UI
- Markdown editor with monospace font, line numbers, basic syntax
  highlighting
- All UI rendered in the same calm aesthetic as the rest of the site —
  this is *not* a dashboardy admin panel; it is a quiet editing room
- Mobile-friendly (Vinay may want to tweak from anywhere)

**Backend (needs Vinay's technical team):**
- Authentication — magic-link email or hardware key, whichever Vinay
  prefers. No password.
- Prompt storage — versioned in a database. Each save creates a new
  immutable row.
- Conversation analytics — every AI session writes a row (anonymised).
- A small API the frontend talks to (`GET /api/prompts`, `POST
  /api/prompts/:id/versions`, `POST /api/prompts/:id/publish`, etc.)
- Hosting — same Vercel project, or a small Cloud Run / Fly.io
  service. We can recommend.

**Question for Vinay's team:** does GoodSpace already have auth
infrastructure we can lean on? If so, we can use it for `/studio/`
auth and skip building a new login.

## v1 scope vs later

**Build now in v1:**
- The studio frontend (full UI, persists drafts to localStorage)
- The SIV master prompt as the first managed prompt
- A "publish" button that, for now, just outputs the prompt as text
  for Vinay to commit to the repo
- Visible counters showing total conversations (initially zero)
- Notes field

**Defer to v1.1 (after team is on it):**
- Real backend auth and storage
- Live conversation analytics
- Diff view across versions
- Sandbox preview

This means: in v1, the studio is a **carefully designed local editor**
that produces a versioned `.md` file Vinay (or his team) commits. It
is not yet a live ops dashboard. But the UI is built to scale into
that role.

## The aesthetic

The studio is not a tool. It is a **room.** The same calm, ivory,
serif, intellectually honest aesthetic as the rest of the site. The
prompts are treated like manuscripts. The editing experience feels
like working in a private library, not a SaaS admin panel.

Visually: full-bleed light cream, a single column, the prompt as
monospace black-on-cream, generous margins, a quiet right rail with
metadata and history. Save indicator that says *"saved"* in italic,
not a green checkmark.

## Security posture

- Studio is a separate route, `noindex,nofollow` in meta
- Listed in `robots.txt` as `Disallow: /studio/`
- Excluded from sitemap
- All requests authenticated server-side (when backend exists)
- Visitor-facing site never references `/studio/`
- All prompt content is plain markdown — no executable code

## What we build in this turn

When Vinay says "go," we build:

1. `/studio/index.html` — the prompt list (showing SIV v1.0 only for now)
2. `/studio/editor.html` — the editor view, opens SIV v1.0 for editing
3. Local persistence via `localStorage` for in-progress drafts
4. A clean "export" button that downloads the new version as a `.md`
   file Vinay can commit to `_prompts/siv/v1.1.md` (or wherever)
5. A small `studio.css` and `studio.js` — separate from the public
   `site.css` to keep concerns clean
6. Mock conversation-count and "last edited" data — placeholder until
   real backend
