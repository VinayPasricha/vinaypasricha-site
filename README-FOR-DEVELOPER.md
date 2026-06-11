# vinaypasricha.com — deployment package (June 10, 2026)

This is the complete, merged, reviewed site: Vinay's latest work (memory server scaffold,
lab pages) + a full bug-fix and SEO/i18n pass done the same day. Conflict-free merge, verified.

## ⚠️ DO NOT upload these folders to the public web server

They are in the repo for reference/build purposes only and are excluded by `.gitignore`:

- `_brief/` — internal architecture & planning documents (includes your handoff specs — read them, don't host them)
- `_prompts/` — internal prompt sources
- `uploads/` — **full PDFs of commercially sold books** — hosting these gives the books away free
- `scraps/`, `screenshots/` — internal screenshots
- `server/` — backend code; deploy separately (Node service), never as static files. Never host `server/.env`.
- `memory-lab.html` and `civilization-lab.html` — internal test pages (noindex). `civilization-lab.html` contains unpublished book content via the lab; per its own header it "must not ship as a public surface". Recommend not deploying both, or password-protecting.
- `node_modules/`, `package-lock.json`, `_audit/` — local tooling

Everything else is the static site: host it as-is (GitHub Pages / Cloudflare Pages / Netlify all fine).

## What was fixed today (full details in repo history / FIXES doc)

- Homepage language menu pointed at nonexistent `/hi/`, `/ta/`… folders → fixed
- `paths/decisions.html` canonical/hreflang/JSON-LD pointed at a 404 `/en/...` URL → fixed
- `books.html` EN language link → fixed; `signal/index.html` got a full SEO head
- `sitemap.xml`: +5 missing pages, 23 URLs total, all with 13-language hreflang
- `js/site.js` + `js/i18n.js`: generic site-root path resolver (now works under `frequency/`, `runtime/`, `library/`)
- `js/intake.js`, `js/siv-conversation.js`, `js/i18n.js`: graceful fallbacks when `window.claude` is absent (no silent failures)
- `assets/data/prompts.json`: Signal Resonance Record prompts 2–8 authored (were empty → wrong fallback)
- `assets/data/i18n/`: complete translation packs for all 12 non-English languages
  (hi, bn, ta, te, kn, es, fr, pt, ja, zh, ko, ru) — 1,014 strings each, machine-verified
  with `node scripts/verify-packs.mjs` (run it after any content change: first
  `node scripts/extract-strings.mjs`, then check coverage)

## Wiring still needed (in priority order)

1. **AI bridge** — every AI feature calls `window.claude.complete({system, messages}) → string`.
   Provide that function via a small relay (Cloudflare Worker / the `server/` Node app) that holds
   the Anthropic API key server-side. Until it exists, features show friendly "coming soon" notices.
2. **Email capture** — `js/intake.js` line ~20: set `POST_ENDPOINT` to a real endpoint.
   The blog subscribe form (`paths/blog.html`) and book notify buttons (`js/books.js`) currently
   store emails in localStorage only — wire to the backend or a form service or leads are lost.
3. **Memory server** — `server/` is a Stage-1 scaffold; see `server/README.md` and
   `_brief/memory-handoff-stage1.md`. `js/memory.js` switches from localStorage to the API via
   `Memory.config({ apiBase })` — no shape change.
4. **Studio access** — `studio/` is gated by a client-side passphrase visible in source
   (`studio/studio.js`). Put real access control in front (e.g. Cloudflare Access) before launch.
5. **Analytics** — `js/site.js` → `ANALYTICS.provider` ('plausible' recommended), one-line switch.
6. **Translation upkeep** — new/changed copy: run `npm install --include=dev`, then
   `node scripts/extract-strings.mjs`, then either rerun the translation flow or the
   GitHub Action (`.github/workflows/translate.yml`, needs `ANTHROPIC_API_KEY` secret).

## Quick verify after deploy

- `/?lang=hi` shows the homepage in Hindi instantly (same for ta/te/kn/bn/es/fr/pt/ja/zh/ko/ru)
- `/paths/decisions.html` canonical = `https://vinaypasricha.com/paths/decisions.html`
- `/sitemap.xml` reachable; `/uploads/` and `/_brief/` return 404 (not hosted)
- AION1 on `/paths/connect.html` answers with the "going live soon" notice (until the AI bridge is wired)
