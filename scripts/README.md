# scripts/

Automation that runs against the site.

## `translate-pack.mjs`

Auto-fills every language pack at `assets/data/i18n/*.json` by:
1. Crawling all HTML files in the repo
2. Extracting translatable strings (same rules as `js/i18n.js`)
3. Calling the Anthropic API to translate anything missing
4. Writing updated packs

The script is run automatically by the GitHub Action at
`.github/workflows/translate.yml` — on every push that touches HTML,
plus weekly, plus on-demand. Once the action is configured, you
**never need to think about translations again** — they refresh
themselves when content changes.

### One-time GitHub setup (do this once)

1. Get an Anthropic API key at
   [console.anthropic.com](https://console.anthropic.com/settings/keys).
   The site uses `claude-3-5-haiku-latest` — the cheapest model;
   ~$0.80 per million input tokens, ~$4 per million output. A full
   site re-translation across 12 languages costs roughly **$1–2**.
2. In this repo on GitHub, go to:
   **Settings → Secrets and variables → Actions → New repository secret**
3. Name: `ANTHROPIC_API_KEY`, value: the key from step 1. Save.
4. That's it. Next push that touches an HTML file triggers a
   translation run; the bot commits the refreshed packs back.

### Running locally (optional)

If you want to translate from your machine instead of waiting for
the CI:

```sh
npm install
ANTHROPIC_API_KEY=sk-ant-... npm run translate
```

Flags:

| Flag | Effect |
|---|---|
| `--dry-run` | Report what's missing without calling the API or writing files |
| `--langs hi,bn` | Restrict to specific languages |
| `--pages index.html,paths/decisions.html` | Restrict to specific pages |

Examples:

```sh
# Just see what's out of date — costs nothing
npm run translate:dry

# Refresh Hindi + Bengali only
ANTHROPIC_API_KEY=sk-ant-... node scripts/translate-pack.mjs --langs hi,bn

# Refresh after adding a new path page
ANTHROPIC_API_KEY=sk-ant-... node scripts/translate-pack.mjs --pages paths/new-page.html
```

After running locally, commit the updated `assets/data/i18n/*.json`
files. Same end-state as the CI run.

### What the script does NOT do

- It does not run the translation editor — open
  `studio/i18n.html` for that. The script is unattended; Studio
  is for review and per-line editing.
- It does not delete translations that a human has refined. It
  only writes to keys whose translation is empty. (Prune logic
  removes strings that no longer appear anywhere on the site, but
  it does not touch translated keys that are still in use.)
- It does not regenerate the sitemap, the SEO meta, or hreflang
  tags. Those are static and don't need refreshing — the existing
  `<link rel="alternate" hreflang>` entries on every page already
  signal Google that translated versions exist.

### Cost back-of-envelope

- Site has ~600–800 unique translatable strings
- 12 languages × ~700 strings = ~8,400 translations
- Each chunk of 20 strings is one API call (~500 input tokens,
  ~800 output) = ~420 calls per full re-translation
- Haiku pricing at the time of writing: ~$0.80/M input, ~$4/M
  output → roughly **$1.50 per full re-translation**
- Subsequent runs only translate *new* strings, so the cost
  drops to cents per push.

### If something goes wrong

The action commits the partial state on each chunk, so an
interrupted run doesn't lose progress. Re-running picks up where
it stopped.

If translations look off for a specific phrase, edit it in
**Studio → Translations** and publish. The script will NOT
overwrite non-empty translations.
