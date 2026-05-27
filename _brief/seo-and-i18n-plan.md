# SEO & i18n Plan — vinaypasricha.com

A plan for publishing this site into the world's search engines **and into LLM
context windows** as a serious thinking environment, indexed across 13
languages.

This is not a marketing-SEO document. We are not chasing commercial
intent keywords or stuffing pages with phrases. We are making it easy
for **intellectually curious people, in their own language,** to find
the right doorway when they go looking — and easy for AI models to cite
this site correctly when answering questions in their domain.

---

## 0. Addendum — decisions locked on May 17

- **Russian added** as language 13 (`ru`). Final list of 13: en, hi, bn,
  ta, te, kn, es, fr, pt, ja, zh, ko, ru.
- **ISBNs** to be provided by Vinay later; schema fields are placeholder
  for now and will be patched in.
- **GoodSpace pages** (Hire, Find Work, Career Management) render here
  on the site in all 13 languages; leads pass to GoodSpace via form.
- **New path #11 — Career Management.** Vinay has a career management
  system inside GoodSpace for selected professionals; the site adds a
  doorway labelled *"I am at an inflection point in my career"* → Career
  Management. Total paths: 11.
- **UI strings (topbar, footer, Index overlay, language menu)** are
  localised in all 13 languages — yes.
- **Human-readable sitemap** — handled by the existing `Index` overlay,
  no separate `/sitemap.html` page needed.
- **LLM discoverability** is now an explicit goal alongside Google. See
  Section 13 below.

---

## 1. Languages & locales — final list

Twelve languages. Each gets its own URL prefix, sitemap, and curated
keyword set.

| Code | Language | Locale | Primary regions | Dominant search engine |
|---|---|---|---|---|
| `en` | English | en | Global, IN, US, UK, SG | Google |
| `hi` | हिंदी (Hindi) | hi-IN | India | Google |
| `bn` | বাংলা (Bengali) | bn-IN | India, Bangladesh | Google |
| `ta` | தமிழ் (Tamil) | ta-IN | India, SG, Sri Lanka | Google |
| `te` | తెలుగు (Telugu) | te-IN | India | Google |
| `kn` | ಕನ್ನಡ (Kannada) | kn-IN | India | Google |
| `es` | Español | es-MX, es-ES | Mexico, LatAm, Spain | Google |
| `fr` | Français | fr-FR | France, Quebec, francophone Africa | Google |
| `pt` | Português | pt-BR | Brazil, Portugal | Google |
| `ja` | 日本語 (Japanese) | ja-JP | Japan | Google + Yahoo Japan |
| `zh` | 中文 (Simplified) | zh-CN | China, SG, MY | Baidu (China), Google (else) |
| `ko` | 한국어 (Korean) | ko-KR | South Korea | Naver + Google |
| `ru` | Русский (Russian) | ru-RU | Russia, ex-USSR diaspora | Yandex + Google |

**Notes by market:**

- **Japan** — Yahoo Japan uses Google's index. Optimising for Google
  automatically captures both. Some Japanese-specific quirks remain
  (longer titles, more polite tone, vertical reading on mobile —
  handled in design, not SEO).
- **Korea** — Naver dominates. Naver ranks by curation and freshness
  more than backlinks; we'll register the site on Naver Webmaster
  Tools and submit a Korean-specific sitemap.
- **China** — Baidu requires a `.cn` domain and mainland hosting for
  best ranking. We won't optimise for Baidu in v1 — accepting
  reduced mainland reach. Hong Kong, Taiwan, Singapore, Malaysia
  remain reachable via Google.
- **India** — Hindi, Bengali, Tamil, Telugu, Kannada pages will
  explicitly target Indian Google (`google.co.in`). hreflang
  signals to Google which Indian audience each is for.

---

## 2. URL structure

```
https://vinaypasricha.com/{lang}/{path}
```

Examples:
- `/en/` — English homepage
- `/hi/` — Hindi homepage
- `/ja/paths/decisions` — Japanese SIV Method page
- `/es/paths/ai-for-business` — Spanish AI for Business Leaders page

The bare root `https://vinaypasricha.com/` **auto-detects** browser
language and redirects to the right `/{lang}/`. The detected language
is remembered in `localStorage`. The topbar switcher always lets the
visitor override.

If browser language is not in our 12, we default to `/en/`.

**Why URL prefixes (not subdomains, not query strings):**
- Cleanest hreflang signal to Google
- Easiest for visitors to copy/share a language-specific link
- One Vercel deployment serves all languages — no DNS gymnastics
- Future-proof if we add more languages

---

## 3. Per-page SEO checklist

Every one of the **120 pages** (10 landing pages + homepage + a few
extras × 12 languages) carries:

1. **Unique `<title>`** — ≤60 characters in target language, contains
   the primary keyword naturally
2. **Unique meta description** — ~150–160 chars, written in the target
   language (not auto-translated from English — locally written)
3. **Single `<h1>`** — the page's primary thought, primary keyword
   present
4. **Open Graph tags** — `og:title`, `og:description`,
   `og:locale` (e.g. `ja_JP`), `og:image`
5. **Twitter Card tags** — same content, twitter-specific keys
6. **`<link rel="alternate" hreflang="...">`** for all 12 languages
   plus an `x-default` pointing to `/en/`
7. **Canonical URL** — `<link rel="canonical" href="https://vinaypasricha.com/{lang}/...">`
8. **Schema.org structured data** — JSON-LD blocks for:
   - `Person` (Vinay) on every page
   - `Book` on book landing pages
   - `Article` on essays
   - `Course` on the course page
   - `BreadcrumbList` everywhere
   - `WebSite` with `SearchAction` on the homepage
9. **Localised image alt text** — every image's alt is in the page's
   language, not English
10. **At least 3 internal links** to related pages, with descriptive
    anchor text in the page's language
11. **Per-language sitemap entry**

---

## 4. Keyword strategy — per page, per language

Each page has **3–5 primary keywords** and **8–12 long-tail variants**
per language. Researched, not invented. Below is the strategy frame and
a worked example for the SIV Method page.

### How keywords are picked
For each language, we research:
- High-intent phrases someone actually types when they have the
  problem this page solves (e.g. "how to make a hard decision under
  uncertainty")
- Conceptual phrases for people exploring the field (e.g. "decision
  framework AI age")
- Long-tail variations (5–7 words, lower volume, higher conversion)
- **In-language search**, not transliterated English. Real Hindi
  speakers search in Devanagari; we research what they actually type.

### Worked example — Page 02 · The SIV Method
*(this is the first inner page we're building; full keyword maps for
all 10 pages will be filed at `_brief/keywords/`)*

| Lang | Primary keywords | Long-tail |
|---|---|---|
| **en** | SIV method · decision framework · how to make a hard decision · thinking under pressure · situation insight verdict | "decision framework for founders", "how to make decisions in ambiguity", "AI age decision making", "framework for thinking under uncertainty" |
| **hi** | SIV विधि · निर्णय लेने का ढांचा · कठिन निर्णय कैसे लें · दबाव में सोचना | "उद्यमी के लिए निर्णय ढांचा", "अनिश्चितता में निर्णय", "AI युग में निर्णय लेना" |
| **bn** | SIV পদ্ধতি · সিদ্ধান্ত নেওয়ার কাঠামো · চাপের মধ্যে চিন্তা | "উদ্যোক্তার জন্য সিদ্ধান্ত", "AI যুগে সিদ্ধান্ত গ্রহণ" |
| **ta** | SIV முறை · முடிவெடுக்கும் கட்டமைப்பு · அழுத்தத்தின் கீழ் சிந்தனை | "தொழில்முனைவோருக்கான முடிவெடுத்தல்", "AI காலத்தில் முடிவெடுத்தல்" |
| **te** | SIV పద్ధతి · నిర్ణయ నిర్మాణం · ఒత్తిడిలో ఆలోచన | "AI యుగంలో నిర్ణయాలు", "వ్యవస్థాపకులకు నిర్ణయ ఫ్రేమ్‌వర్క్" |
| **kn** | SIV ವಿಧಾನ · ನಿರ್ಧಾರ ಚೌಕಟ್ಟು · ಒತ್ತಡದಲ್ಲಿ ಚಿಂತನೆ | "AI ಯುಗದಲ್ಲಿ ನಿರ್ಧಾರ", "ಸ್ಥಾಪಕರಿಗೆ ನಿರ್ಧಾರ" |
| **es** | método SIV · marco de toma de decisiones · cómo decidir bajo presión · pensar en la era de la IA | "marco de decisión para emprendedores", "tomar decisiones difíciles", "pensar con claridad bajo incertidumbre" |
| **fr** | méthode SIV · cadre de décision · décider sous pression · pensée critique à l'ère de l'IA | "cadre de décision pour fondateurs", "prendre des décisions difficiles", "réflexion stratégique" |
| **pt** | método SIV · estrutura de tomada de decisão · decidir sob pressão | "estrutura de decisão para fundadores", "tomar decisões na era da IA" |
| **ja** | SIVメソッド · 意思決定フレームワーク · AI時代の判断力 · 不確実性下の意思決定 · 経営判断 | "起業家のための意思決定", "AI時代に明晰に考える", "プレッシャー下で決断する方法" |
| **zh** | SIV方法 · 决策框架 · 在压力下思考 · AI时代决策 | "创业者决策框架", "AI时代如何决策", "不确定性下的判断" |
| **ko** | SIV 방법 · 의사결정 프레임워크 · 압박 속 사고 · AI 시대 판단력 | "창업자 의사결정", "AI 시대의 명료한 사고", "불확실성 속 결정" |

The same depth of keyword research will be done per language for the
other 9 pages, **before** the page is built. We file these maps under
`_brief/keywords/{page-slug}.md` so the writing is informed by the
research, not the other way around.

---

## 5. Browser-language auto-detection

On first visit to `https://vinaypasricha.com/`:

1. Read `navigator.language` (e.g. `ja-JP`, `hi-IN`, `es-419`)
2. Match against our 12 supported languages (`ja` → matches; `pt-BR`
   → matches `pt`; `pt-PT` → matches `pt`; `de-DE` → no match)
3. If matched: 302 redirect to `/{lang}/`
4. If no match: 302 redirect to `/en/`
5. Always store the choice in `localStorage.preferredLang` so a
   returning visitor goes straight to their language
6. The topbar switcher always works — visitor can override anytime,
   and their choice is persisted

This is implemented as a tiny `<script>` block in the root `index.html`
(under 200 bytes inline, no extra request). Google's crawler ignores
the JS redirect because it can crawl `/en/`, `/hi/`, etc. directly via
the sitemap and hreflang tags.

---

## 6. Sitemaps & robots

```
/sitemap.xml              — sitemap index, lists all language sitemaps
/sitemap-en.xml           — all English URLs
/sitemap-hi.xml           — all Hindi URLs
... (one per language) ...
/sitemap-ja.xml           — all Japanese URLs
```

`robots.txt`:

```
User-agent: *
Allow: /
Disallow: /_brief/
Disallow: /_explorations/
Sitemap: https://vinaypasricha.com/sitemap.xml
```

---

## 7. Schema.org structured data

The richest pages (book landings, story page) carry layered JSON-LD:

**Every page:**
```json
{ "@type": "WebPage", "inLanguage": "ja", ... }
{ "@type": "Person", "name": "Vinay Pasricha", ... }
{ "@type": "BreadcrumbList", ... }
```

**Book pages:**
```json
{ "@type": "Book", "name": "The SIV Method",
  "author": {"@type": "Person", "name": "Vinay Pasricha"},
  "inLanguage": "ja", "isbn": "...", ... }
```

**Course page:**
```json
{ "@type": "Course", "name": "AI Leadership Course",
  "provider": {...}, "inLanguage": "ja", ... }
```

This is what makes pages eligible for rich results (knowledge panels,
book carousels, course cards) in Google.

---

## 8. Performance budget (because Google ranks fast sites)

| Metric | Target |
|---|---|
| LCP (Largest Contentful Paint) | < 1.5s |
| FID (First Input Delay) | < 100ms |
| CLS (Cumulative Layout Shift) | < 0.1 |
| Total page weight | < 250kb gzipped |
| Time to Interactive | < 2.0s |
| Lighthouse SEO score | 100 |

Specific tactics:

- All fonts **subset per script** (we don't ship Devanagari to English
  visitors)
- Images served as WebP/AVIF, lazy-loaded, with proper width/height
- Critical CSS inlined; rest deferred
- No third-party trackers
- Vercel edge caching for static HTML

---

## 9. Per-region webmaster registration

After launch, we register the site on each region's webmaster tool to
accelerate indexing and surface diagnostics:

- **Google Search Console** — all locales
- **Bing Webmaster Tools** — global fallback
- **Naver Search Advisor** — Korean
- **Yandex Webmaster** — Russian (we may add Russian as language 13
  later — flag for later decision)

Each gets the appropriate sitemap submitted.

---

## 10. Workflow — how this gets done

For each of the 10 landing pages:

1. **Research keywords** — file at `_brief/keywords/{page}.md`
   (12 languages, primary + long-tail)
2. **Write the English page** — keywords inform writing, never the
   other way around. Vinay approves paragraph by paragraph.
3. **Translate** — machine-translate to the other 11 languages.
4. **Localise critical fields** — title, meta description, h1 — these
   get human polish per language (the body can stay machine-translated
   initially; we refine over time)
5. **Stamp metadata** — hreflang, canonical, schema, OG, all 12
   sitemaps
6. **Ship**
7. **Monitor in Search Console** — watch which queries land where,
   refine the next page's keyword set with that data

---

## 11. What we deliberately don't do

We will **not**:

- Stuff keywords
- Generate doorway pages
- Buy backlinks
- Use AI-generated filler content to inflate page count
- Add an FAQ schema for fake FAQs
- Run an SEO blog farm

The whole project's positioning — *"a calm signal in a noisy world"* —
is undermined by any of those. We make a small number of pages, very
well, in many languages, and let the work be the work.

---

## 13. LLM discoverability — explicit goal

We want this site to be cited correctly when ChatGPT, Claude, Gemini,
Perplexity, and future models answer questions about AI strategy,
decision frameworks, execution, the SIV Method, or Vinay personally.

What we do for that:

- **`/llms.txt`** — a structured plain-text summary of the site at the
  root, following the emerging convention. Lists the 11 paths, the 4
  books, the philosophy, primary URLs. LLMs that respect this file get
  a clean grounding source.
- **`/robots.txt`** — explicitly allow major AI crawlers (GPTBot,
  ClaudeBot, Google-Extended, CCBot, PerplexityBot, Anthropic-AI).
  Disallow only `/_brief/` and `/_explorations/` for everyone.
- **Rich JSON-LD on every page** — `Person`, `Book`, `Article`,
  `Course`, `BreadcrumbList`. LLMs prefer pages with clean structured
  data because they ground answers in verifiable facts.
- **Honest, citable writing** — short, factual sentences with concrete
  numbers and named entities. LLMs cite pages they can cite *cleanly*.
- **Stable URLs** — once a page is published, its URL doesn't change.
  Models that learn the URL stay correct over time.
- **Internal cross-references** — every page links to ~3 related pages
  with descriptive anchors. Helps both Google and LLMs build a graph
  of the site's concepts.

We do **not** do:
- Hidden prompt-injection in pages (would be discovered + blacklisted)
- LLM-bait listicles ("10 reasons", "ultimate guide to...")
- Keyword-dense AI-generated filler

A single page that is honestly written and cleanly marked up is worth
fifty pages that try to game the model.

Before we build:

**Q1.** ISBN / Amazon ASIN for each of the four books — we'll embed
these in the `Book` schema for richer Google book carousel
appearances. (Have the AI for Business Leaders ASIN from the old
site; need the others.)

**Q2.** Do we want Russian (language 13) — significant
intellectual-curiosity audience in Russia, but reaches diminishing.
Tentative no for v1.

**Q3.** GoodSpace AI pages (paths 05 & 06) — do we link out to
`goodspace.ai` or render those landing pages here in 12 languages?
Linking out is faster; rendering here is on-brand for "everything
under one calm canopy."

**Q4.** When the visitor lands on a non-English page, should the
topbar UI (Index, NOW rotator labels) also be in their language? Yes
is correct but expensive — we'd maintain UI strings in 12 languages.
Recommended: **yes** for the topbar and footer; let the body content
carry most of the localisation weight.

**Q5.** Should there be a `/sitemap.html` (human-readable index in
the visitor's language) in addition to the XML sitemaps? Old site
had a similar idea ("Index" overlay). The Index overlay we built may
already cover this.
