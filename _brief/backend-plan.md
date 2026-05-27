# Backend Plan — vinaypasricha.com

A roadmap for what a real backend unlocks, in what order to build it,
and the migration path from today's local-first v1.

## Where we are today

Everything that looks like a database actually lives in
**`assets/data/*.json`** + **localStorage drafts** inside Studio. The
publish flow is: edit in Studio → save draft to localStorage →
download JSON → manually replace in the repo → git commit → site
rebuilds. This works. It is also explicitly the v1 floor.

Specifically:

| Surface | Today | What backend gives |
|---|---|---|
| Studio auth | client-side SHA-256 of `vinay123` | real auth, multi-device sessions |
| SIV / Signal state | localStorage per browser | sessions follow the reader across devices |
| Mailing list (Notebook subscribers) | localStorage, never sent | real list, real deliverability |
| Notify-me (book releases) | localStorage, never sent | real list |
| AION1 intake messages | localStorage drafts | actually arrive in inbox |
| Books / Notebook / Videos / Now / Prompts / Stats | JSON files committed to repo | live editing, no manual git step |
| Visitor stats | manually entered | API-fed from YouTube/Plausible/etc |

## The principle

The backend is a series of **small targeted services**, not a
monolith. Each Studio room can be wired to a real source one at a
time, in any order, without changing the editor UX or the public
site. The local-first JSON files become the **fallback** when the
backend is offline. That guarantee — never broken by an outage —
matters more than the speed of any single integration.

## Recommended stack

For a site that already lives entirely in static files + a tiny bit
of fetch-and-render JS, the lowest-friction path is:

- **Cloudflare Pages** for static hosting (where the site already
  wants to live). Free for this scale.
- **Cloudflare Workers** for any server-side endpoints — auth, write
  APIs, third-party API proxies. The free tier covers 100k requests
  per day, which is far above this site's traffic.
- **Cloudflare D1** (SQLite) for structured data — users,
  subscribers, sessions, prompt versions. Free tier: 5GB.
- **Cloudflare KV** for hot data — Studio drafts, rate limits, simple
  config. Free tier: 1GB.
- **R2** for any large blobs (book covers, video thumbnails if we
  ever serve them ourselves). Free tier: 10GB egress.
- **Cloudflare Access** for protecting Studio — uses your real
  identity (Google / GitHub / email magic link). Free for up to 50
  users.

Alternative if Cloudflare feels too tied-in: **Supabase** (Postgres +
Auth + Storage) gives you the same shape with a more conventional
stack. Slightly more cost at the free tier but more portable.

I'm recommending Cloudflare because the static site already runs
there cleanly and the edge-runtime is well-matched to the read-heavy
pattern.

**Estimated monthly cost at current scale:** $0. At 100x traffic:
under $20.

## Migration path — one feature at a time

The idea is each backend feature can be turned on independently
without breaking anything else.

### Phase 1 — Studio auth (the smallest real thing)

**Why first.** It unblocks every subsequent backend feature by
proving the auth pattern. Today's passphrase is a wall against
curious visitors but not against anyone who reads the JS. Real auth
also gives every Studio action a verified author.

**Build:**
- Cloudflare Access in front of `/studio/*` — sign in with Google or
  a magic link to a known email.
- Remove `studio.js` client-side hash check (auth becomes an HTTP
  header the worker can verify on writes).

**Effort:** Half a day. No code change to the editors themselves.

### Phase 2 — One write API, used by Studio Notebook first

**Why second.** Notebook is the highest-frequency write surface
(monthly essays). Getting one editor off the local-first download
loop teaches us the contract every other editor will reuse.

**Build:**
- One Worker endpoint: `POST /api/notebook` (authed via Access).
  Writes the essay payload to D1.
- One read endpoint: `GET /api/notebook` returns the live list.
- Update `studio/notebook-admin.js` and `paths/blog.html` to prefer
  the API over `assets/data/notebook.json`. Keep the JSON file as a
  fallback when the API is unreachable.
- The "Publish & download" button stays — it's still useful for
  exporting a snapshot.

**Effort:** One day. Pattern is then reusable for Books, Videos,
Now, Prompts, Stats — each is a near-identical PR.

### Phase 3 — Real mailing list

**Why third.** Currently every email captured on the site sits
silently in localStorage. The Notebook subscribe form, the
book-notify forms, and the AION1 intake all need this. Until we
have it, every form on the site is a friendly lie.

**Build:**
- Worker endpoint: `POST /api/subscribe` — writes to D1, sends a
  one-time confirmation email via Resend or Postmark.
- The same endpoint handles per-list subscriptions (notebook,
  book-the-signal, aion1-intake).
- Studio gets a new room — **Subscribers** — that exports CSVs for
  whatever sending tool you actually use (Buttondown, EmailOctopus,
  Mailchimp).

**Effort:** Two days. Email-deliverability is the real cost, not
code.

### Phase 4 — AION1 intake actually delivers

**Why fourth.** AION1 currently drafts a message and shows it to
the user. The "send" button stores it in localStorage. To actually
arrive in your inbox we need:

- A `POST /api/intake` endpoint that forwards the drafted message
  to your email with the AI's reasoning attached.
- Light spam guard — the AION1 conversation itself already vetted
  the sender (a generic bot would hang on its very specific
  questions); a CAPTCHA isn't needed. But rate-limiting per IP is.

**Effort:** Half a day.

### Phase 5 — Signal session state, server-side

**Why fifth.** Right now each reader's Signal sessions live in
their own browser. If they switch devices, the field forgets them.
That breaks the central promise of The Signal — "the system has
been holding you."

**Build:**
- Anonymous user identity — a UUID stored in a long-lived cookie.
  No email gate. No signup. Just persistence.
- D1 tables: `signal_session`, `signal_record`, `signal_capacity`.
- `signal/session.js` writes to the API. Falls back to localStorage
  if offline.
- The Field can show real cross-device progression.
- Bonus: a moderator dashboard in Studio shows aggregate (never
  individual) what readers are surfacing. Useful for editing
  Sessions 1–8.

**Effort:** Three days. The first feature where the database design
matters more than the API.

### Phase 6 — Automated stats fetching

**Why last.** Until we have it, you log numbers manually in the
Progress room. That actually works fine for the cadence of a
slow-published author. The right moment to automate is when manual
entry becomes friction, not before.

**Build incrementally:**
1. **YouTube Data API v3** — free, no special access needed. A
   nightly Worker cron writes the latest channel-level stats to
   D1. Wires into the Progress dashboard as a new "source: live"
   badge.
2. **Plausible analytics** — install the script tag (one line in
   `site.js`), get the read API key, nightly Worker fetches
   visitor stats.
3. **Instagram Graph API** — requires Business/Creator account +
   FB Page link + OAuth. The auth flow is the only annoying part;
   the fetch itself is straightforward.
4. **Amazon KDP** — no public API. This stays manual.
5. **LinkedIn / X** — both restricted or paid. Stay manual.

**Effort per source:** Half a day each, except Instagram (a full
day of OAuth setup).

## What does NOT need a backend

This list matters more than the previous one — it's why the
local-first v1 isn't a stopgap but the right floor.

- The Bookshelf, the Notebook reader, the SIV conversation chrome,
  The Signal threshold, all path pages — all static. They benefit
  from being purely static (cacheable, instant, offline-friendly).
- The actual AI conversations call `window.claude.complete` (or
  whatever API replaces it). The conversation runtime is
  client-side. Server only enters when we need to persist state.
- Studio's editing UI — entirely client-side. Only the **submit**
  changes from "download JSON" to "POST to API."

## The order of operations, if I had to commit

If you build one thing this quarter, build **Phase 2** (the write
API for Notebook). It is the smallest backend that proves the
pattern and removes the most weekly friction. Everything else
follows in any order.

## What to NOT do

- **Don't migrate the whole site to a CMS.** This site is not a CMS
  use case. It is a small number of opinionated, hand-tuned pages
  with a few dynamic surfaces.
- **Don't build a unified admin panel for everything before
  anything works.** Studio is already that panel; it just talks to
  files. Wire one room at a time.
- **Don't add analytics until you have a question analytics
  answers.** A dashboard you don't act on is a slow leak of
  attention.
- **Don't go to Next.js / SvelteKit / Astro.** The site is HTML +
  vanilla JS + JSON. The complexity floor is correct for what this
  is. Don't reach for a framework that solves problems we don't
  have.

## When the backend is wrong

It's the wrong call if:
- You realise you'd rather not write essays and want to retire the
  Notebook.
- You decide The Signal stays single-device-only by design
  (private to the reader's browser, never persisted anywhere).
- You scale visitors enough that the static site outperforms any
  server, and you'd rather invest in CDN strategy than write APIs.

None of these feel likely. But naming them keeps the choice honest.

## Open questions for the author

1. Email provider preference — Buttondown, Postmark, Resend, or
   something else?
2. Is the AION1 intake supposed to land in your personal inbox, or
   a dedicated `vinay@vinaypasricha.com`-style alias?
3. Is the Signal session state worth persisting at all? An argument
   can be made for keeping it private-to-browser.
4. Cloudflare Access works with whichever IdP you already use
   (Google? GitHub? Email magic link?). Which one?
