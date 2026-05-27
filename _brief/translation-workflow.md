# Translation workflow

The site supports 13 languages. By default visitors hit English. A
visitor who chooses Hindi (or sets `?lang=hi`) gets the Hindi
language pack instantly — no per-visitor AI calls — assuming the
pack is published.

This doc covers two paths:

1. **The automatic path** — GitHub Action keeps every language pack
   refreshed against the site. Set up once; never touch again.
2. **The Studio path** — manual edits / on-demand refresh for when
   you want hand-curated translations for high-visibility strings.

## The automatic path (recommended)

The repo ships with a GitHub Action at
`.github/workflows/translate.yml`. It runs on every push that
touches HTML, plus weekly. It:

1. Crawls every HTML file in the repo.
2. Extracts every translatable string.
3. For every language pack at `assets/data/i18n/<code>.json`,
   fills any missing entries via the Anthropic API.
4. Commits the refreshed packs back to the repo.

After commit, the static site picks up the new translations on
next deploy — Googlebot indexes them in their respective languages
via the `<link rel="alternate" hreflang>` tags already in every
page head.

**One-time setup:** add an `ANTHROPIC_API_KEY` to repo Secrets.
See `scripts/README.md` for step-by-step.

**Cost:** ~$1.50 for a full first-time refresh across 12 languages
(uses Claude Haiku). Subsequent runs only translate new strings, so
typical pushes cost cents.

## The Studio path

For when you want to hand-edit a specific translation, override
the AI's choice, or batch-translate from your browser without
running CI.

Open **Studio → Translations** at `/studio/i18n.html`. The room:

- Shows every language tab with completion percentage.
- **Discover strings** crawls all public pages and adds any new
  strings as empty entries across every pack.
- **Translate untranslated via AI** sends missing strings to
  Claude in chunks of 20 (uses `window.claude.complete` in the
  browser — no API key needed).
- Each string is inline-editable. Filter by translated /
  untranslated / search.
- **Publish & download** produces a fresh `<lang>.json` for the
  repo.

## How a visitor experiences this

Three-layer fallback, in priority order:

1. **Studio draft** in their `localStorage` (only present if they
   themselves are mid-edit in Studio)
2. **The published pack** at `assets/data/i18n/<lang>.json`
3. **Live Claude translation** per-string, cached in the visitor's
   own browser

If the GitHub Action keeps layer 2 full, layer 3 almost never
fires. The visitor sees the page in their language instantly.

The "Translating…" indicator that used to appear during layer 3
calls is **disabled by default** — visitors shouldn't be aware
translation is happening. To re-enable for debugging, run in
devtools: `localStorage.setItem('i18n.debug', '1')`.

## Proper noun policy

The translation prompt forbids translating these terms (same list
in both `js/i18n.js` and `scripts/translate-pack.mjs`):

- Vinay Pasricha, GoodSpace AI, AION1
- SIV, SIV Method
- AI for Business Leaders, The Execution Doctrine, The Signal,
  Organizational Frequency
- Amazon, YouTube, Instagram, LinkedIn

If you find the AI translating one of these by mistake, fix it in
Studio and add the term to the system prompts in both files.

## Adding a new language

1. Edit the `LANGS` arrays in `js/i18n.js`,
   `studio/i18n-admin.js`, and `scripts/translate-pack.mjs`.
2. Push. The action will create the new pack from scratch.

## Adding a new page

1. Add the path to `SITE_PAGES` in `studio/i18n-admin.js` and
   `scripts/translate-pack.mjs`.
2. Push. The action will crawl it and fill all 12 languages.

## What the AI is NOT good at

- Sustaining a specific literary register over hundreds of lines.
  It will translate well most of the time and occasionally produce
  something flat.
- Idioms and irony.
- Recognising when an em-dash carries meaning vs. when it's
  decorative.

For phrases that matter editorially (hero, book titles, taglines),
hand-curate them via Studio. The script never overwrites a
non-empty translation, so your edits are permanent until you
explicitly clear them.

## How to know it's working

1. Push a change to any HTML file.
2. Watch the **Translate** action run in the GitHub Actions tab.
3. After it commits, visit `https://vinaypasricha.com/?lang=hi`.
   The page should appear in Hindi within a fraction of a second.
4. View source on the rendered page — your search-engine-visible
   content is now translated.

## Where translations live

| Where | What |
|---|---|
| `assets/data/i18n/<lang>.json` | The **published** pack. Loaded instantly at page open. |
| `localStorage` under `studio.i18n.<lang>` | Your **working draft** in the Studio Translations room. Overrides the published pack on your device until you publish. |
| Each visitor's `localStorage` under `i18n.cache.v1.<lang>` | Per-browser fallback. Populated by live Claude calls for strings *not in the pack*. Never needs your attention. |

The system is a three-layer fallback:
1. Your working draft (if you're logged into Studio)
2. The shipped pack at `assets/data/i18n/<lang>.json`
3. Live Claude translation per-string, cached in the visitor's
   own browser

The goal is to fill layer 2 so layer 3 rarely runs.

## The Studio workflow

Open **Studio → Translations** (`/studio/i18n.html`). Steps:

### 1. Discover strings

Click **Discover strings ↻**. The room fetches every public page,
parses the HTML, extracts every translatable text node (using the
same exclusion rules as `js/i18n.js` — proper nouns, code blocks,
mono labels, anything with `data-no-translate`).

This adds every discovered string as an empty entry across every
language pack. Run again any time you add new pages or copy.

### 2. Translate via AI

With Hindi (or any language) tab selected, click **Translate
untranslated via AI**. The room sends the missing strings to
Claude in chunks of 20, with the same system prompt the live
translator uses. Saved to your draft as each chunk completes.

A few-hundred-string pack takes maybe 60 seconds.

### 3. Review and edit

Every string is inline-editable. Filter by **Untranslated**,
**Translated**, or search. The site uses Noto Sans Devanagari and
Noto Sans Bengali so what you type renders correctly.

The single most important edit pass: review the hero copy, the
book titles, and any phrase the AI translates that loses the
intended voice. AI translation is consistent but occasionally
tone-deaf — your hand on the final words matters.

### 4. Publish

Click **Publish & download**. A fresh `<lang>.json` downloads to
your machine. Replace the file in the repo at
`assets/data/i18n/<lang>.json` and commit. The next page load by
anyone with that language preference gets your new translations.

## What's in the seed packs (hi.json, bn.json)

Each language ships with ~50 hand-curated translations for the
strings that appear most often: topbar chrome ("Index", "Now",
"Choose a language"), homepage hero, primary CTAs ("Read the
book", "Buy on Amazon"), the foot tag, the section labels. Plus
the *Now* verbs and a few literary signature lines.

Everything else falls through to live translation until you run
**Translate via AI** to fill the rest.

## Proper noun policy

The Claude system prompt forbids translating these terms:

- Vinay Pasricha, GoodSpace AI, AION1
- SIV, SIV Method
- AI for Business Leaders, The Execution Doctrine, The Signal,
  Organizational Frequency
- Amazon, YouTube, Instagram, LinkedIn

If you find the AI translating one of these by mistake, fix it
inline and add the term to the system prompt in `i18n-admin.js`
under "CRITICAL RULES".

## Adding a new language

1. Open `studio/i18n-admin.js`. Find the `LANGS` array.
2. Add an entry — it's already there for all 13, but if you add
   a 14th, mirror the shape.
3. Open `js/i18n.js`. Find `I18N_LANGUAGES`. Mirror the addition.
4. Open the Studio Translations room → click that language's tab
   → Translate via AI → Publish.

## What the AI is NOT good at

- Sustaining a specific literary register over hundreds of lines.
  It will translate well most of the time and occasionally produce
  something flat. The Review pass catches this.
- Idioms and irony. The site uses both. Review carefully.
- Recognising when an em-dash carries meaning vs. when it's
  decorative. AI tends to flatten punctuation.

## How to know it's working

Visit `https://vinaypasricha.com/?lang=hi`. The page should appear
in Hindi within a fraction of a second — no "Translating..."
indicator should flash. If the indicator appears, that means
strings are missing from the pack and falling through to live
translation. Run **Discover** + **Translate via AI** again to
fill them.
