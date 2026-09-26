#!/usr/bin/env node
// Builds the static Notebook: notebook.html (/notebook) and one page per
// article (notebook/<slug>.html → /notebook/<slug>) from the Markdown files
// in scripts/notebook/. Same page shell as the /watch pages.
//   node scripts/build-notebook-pages.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://vinaypasricha.com';
const OG_IMAGE = ORIGIN + '/assets/images/brand/og-image.png';
const YOUTUBE = 'https://www.youtube.com/@VinayPasrichauthor';
const FONTS = 'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;1,6..72,400&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap';

// Newest first. `file` is in scripts/notebook/.
const ARTICLES = [
  {
    slug: 'ai-for-msme-india',
    file: 'ai-for-msme-india.md',
    seoTitle: 'AI for MSMEs in India: Where to Start (90-Day Plan)',
    description: "A founder's practical guide to AI for MSMEs in India: 6 low-cost use cases, a 90-day plan, real tools, costs to check, and the mistakes to avoid.",
    datePublished: '2026-09-26',
    dateModified: '2026-09-26',
    topic: 'AI for Business',
    keywords: ['ai for msme india', 'ai for msme', 'ai tools for msme', 'ai for small business india', 'how to implement ai in a small business'],
  },
];

const HUB = {
  title: 'Notebook — Articles by Vinay Pasricha',
  description: 'Articles by Vinay Pasricha on AI for business, leadership, hiring and building companies in India. Practical guides written to be used.',
};

const esc = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function formatDate(iso) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

function inline(text) {
  let html = esc(text);
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
    const external = /^https?:\/\//i.test(href);
    return '<a href="' + href + '"' + (external ? ' target="_blank" rel="noopener"' : '') + '>' + label + '</a>';
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return html;
}

const plain = (text) => text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*+/g, '');

// Small Markdown subset used by the articles: #/##/### headings, one-line
// paragraphs, - and 1. lists, pipe tables.
function parse(markdown) {
  const lines = markdown.replace(/\r/g, '').split('\n');
  let title = '';
  const out = [];
  const faq = [];
  let section = '';
  let pendingQ = null;
  let wordCount = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();
    if (!line.trim()) continue;
    let m;
    if ((m = line.match(/^# (.+)$/))) { title = m[1].trim(); continue; }
    if ((m = line.match(/^## (.+)$/))) { section = m[1].trim(); out.push('<h2>' + inline(section) + '</h2>'); continue; }
    if ((m = line.match(/^### (.+)$/))) {
      out.push('<h3>' + inline(m[1]) + '</h3>');
      pendingQ = section === 'FAQ' ? plain(m[1]) : null;
      continue;
    }
    if (/^\|/.test(line)) {
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i])) rows.push(lines[i++]);
      i--;
      const cells = (r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = cells(rows[0]);
      const body = rows.slice(2).map(cells);
      out.push('<div class="nb-table"><table>\n<thead><tr>' + head.map((c) => '<th scope="col">' + inline(c) + '</th>').join('') + '</tr></thead>\n<tbody>\n' +
        body.map((r) => '<tr>' + r.map((c) => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('\n') + '\n</tbody>\n</table></div>');
      body.forEach((r) => { wordCount += r.join(' ').split(/\s+/).length; });
      continue;
    }
    if (/^(- |\d+\. )/.test(line)) {
      const ordered = /^\d+\. /.test(line);
      const items = [];
      while (i < lines.length && (ordered ? /^\d+\. /.test(lines[i]) : /^- /.test(lines[i]))) {
        items.push(lines[i].replace(/^(- |\d+\. )/, ''));
        i++;
      }
      i--;
      const tag = ordered ? 'ol' : 'ul';
      out.push('<' + tag + '>\n' + items.map((it) => '  <li>' + inline(it) + '</li>').join('\n') + '\n</' + tag + '>');
      items.forEach((it) => { wordCount += it.split(/\s+/).length; });
      continue;
    }
    out.push('<p>' + inline(line) + '</p>');
    wordCount += line.split(/\s+/).length;
    if (pendingQ) { faq.push({ q: pendingQ, a: plain(line) }); pendingQ = null; }
  }
  return { title, html: out.join('\n'), faq, wordCount };
}

function head({ title, description, canonical, ogType, extraMeta = '', jsonLd, css = [] }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="author" content="Vinay Pasricha">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
  <meta name="publisher" content="Vinay Pasricha">

  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:type" content="${ogType}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:site_name" content="vinaypasricha.com">
  <meta property="og:locale" content="en_IN">
  <meta property="og:image" content="${OG_IMAGE}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Vinay Pasricha">
${extraMeta}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${OG_IMAGE}">

  <link rel="canonical" href="${canonical}">

  <link rel="icon" type="image/png" sizes="32x32" href="/assets/images/brand/favicon-32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/assets/images/brand/favicon-16.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/images/brand/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${FONTS}" rel="stylesheet">

  <link rel="stylesheet" href="/css/site.css">
  <link rel="stylesheet" href="/css/watch-library.css">
${css.map((href) => `  <link rel="stylesheet" href="${href}">`).join('\n')}

  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2).replace(/</g, '\\u003c')}
  </script>
</head>`;
}

function topbar() {
  return `<header class="topbar">
  <a href="/" class="brand">
    <span class="name">Vinay <em>Pasricha</em></span>
    <span class="subtitle">Explorer of Emergence</span>
  </a>
  <div class="now-line">
    <span class="key">Now</span>
    <span class="now-rotator">
      <span class="item">Publishing <em style="font-family:var(--serif);font-style:italic;text-transform:none;letter-spacing:0;font-size:13px;margin-left:4px">across languages</em></span>
      <span class="item">Building <em style="font-family:var(--serif);font-style:italic;text-transform:none;letter-spacing:0;font-size:13px;margin-left:4px">GoodSpace AI</em></span>
      <span class="item">Running <em style="font-family:var(--serif);font-style:italic;text-transform:none;letter-spacing:0;font-size:13px;margin-left:4px">a live cohort</em></span>
    </span>
  </div>
  <div class="right">
    <button class="index-btn" aria-label="Open index">
      <span class="lines"><span></span><span></span></span>
      <span>Index</span>
    </button>
  </div>
</header>`;
}

function footer() {
  return `<footer class="site-foot">
  <div class="foot-left">
    <div class="foot-brand">Vinay <em>Pasricha</em></div>
    <div class="foot-tag">"Before power is applied, reality must be examined hard enough to deserve action."</div>
  </div>
  <div class="foot-right">
    © 2026 · <a href="/">Index</a><a href="/books">Books</a><a href="/notebook">Notebook</a><a href="/watch">Watch</a><a href="/paths/connect">Connect</a>
  </div>
</footer>

<script src="/js/site.js"></script>
</body>
</html>
`;
}

const PERSON = { '@type': 'Person', name: 'Vinay Pasricha', url: ORIGIN + '/', sameAs: [YOUTUBE] };

function articlePage(a, parsed) {
  const url = `${ORIGIN}/notebook/${a.slug}`;
  const minutes = Math.max(1, Math.round(parsed.wordCount / 220));
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        headline: parsed.title,
        name: a.seoTitle,
        description: a.description,
        image: [OG_IMAGE],
        datePublished: a.datePublished,
        dateModified: a.dateModified,
        inLanguage: 'en-IN',
        author: PERSON,
        publisher: { '@type': 'Person', name: 'Vinay Pasricha', url: ORIGIN + '/' },
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        url,
        wordCount: parsed.wordCount,
        keywords: a.keywords.join(', '),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Index', item: ORIGIN + '/' },
          { '@type': 'ListItem', position: 2, name: 'Notebook', item: ORIGIN + '/notebook' },
          { '@type': 'ListItem', position: 3, name: parsed.title, item: url },
        ],
      },
      ...(parsed.faq.length ? [{
        '@type': 'FAQPage',
        mainEntity: parsed.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
      }] : []),
    ],
  };
  const extraMeta = [
    `  <meta property="article:published_time" content="${a.datePublished}">`,
    `  <meta property="article:modified_time" content="${a.dateModified}">`,
    `  <meta property="article:author" content="Vinay Pasricha">`,
    `  <meta property="article:section" content="${esc(a.topic)}">`,
  ].join('\n');
  return `${head({ title: a.seoTitle, description: a.description, canonical: url, ogType: 'article', extraMeta, jsonLd, css: ['/css/notebook.css'] })}
<body class="wl-page nb-page">

${topbar()}

<section class="page-hero">
  <div class="breadcrumb">
    <a href="/">Index</a>
    <span class="sep">/</span>
    <a href="/notebook">Notebook</a>
    <span class="sep">/</span>
    <span>${esc(parsed.title)}</span>
  </div>
  <h1 class="brutal">${esc(parsed.title)}</h1>
  <p class="nb-byline">By <a href="/paths/story" rel="author">Vinay Pasricha</a> · <a href="${YOUTUBE}" target="_blank" rel="noopener">YouTube</a></p>
  <ul class="wl-meta">
    <li>${esc(a.topic)}</li>
    <li><time datetime="${a.datePublished}">${formatDate(a.datePublished)}</time></li>
    <li>${minutes} min read</li>
    <li>English</li>
    <li>Article</li>
  </ul>
</section>

<div class="wl-columns">
  <article class="wl-copy nb-article">
${parsed.html}
  </article>
  <aside class="wl-side">
    <section class="wl-book">
      <h2>Related book</h2>
      <a class="wl-book-card" href="/books/ai-for-business-leaders">
        <img src="/assets/images/ai-for-business-leaders-cover-front.jpg" alt="Cover of AI for Business Leaders by Vinay Pasricha" width="800" height="1200" loading="lazy">
        <span>
          <strong>AI for Business Leaders</strong>
          <em>A clear-headed guide to leading with AI without losing the plot.</em>
        </span>
      </a>
      <a class="wl-cta" href="/books/ai-for-business-leaders">About the book <span class="arrow">→</span></a>
    </section>
    <section>
      <h2>Course</h2>
      <p class="nb-side-copy">The AI Leadership Course is a six-week cohort for founders and senior leaders.</p>
      <a class="wl-cta" href="/paths/course">AI Leadership Course <span class="arrow">→</span></a>
    </section>
    <p class="wl-back"><a href="/notebook">All articles</a></p>
  </aside>
</div>

${footer()}`;
}

function hubPage(entries) {
  const url = ORIGIN + '/notebook';
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: HUB.title,
        description: HUB.description,
        url,
        inLanguage: 'en-IN',
        author: PERSON,
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: entries.map((e, i) => ({ '@type': 'ListItem', position: i + 1, url: `${ORIGIN}/notebook/${e.a.slug}`, name: e.parsed.title })),
        },
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Index', item: ORIGIN + '/' },
          { '@type': 'ListItem', position: 2, name: 'Notebook', item: url },
        ],
      },
    ],
  };
  const cards = entries.map(({ a, parsed }) => `    <a class="nb-card" href="/notebook/${a.slug}">
      <span class="nb-card-meta">${esc(a.topic)} · <time datetime="${a.datePublished}">${formatDate(a.datePublished)}</time></span>
      <h2>${esc(parsed.title)}</h2>
      <p>${esc(a.description)}</p>
      <span class="nb-card-more">Read the article →</span>
    </a>`).join('\n');
  return `${head({ title: HUB.title, description: HUB.description, canonical: url, ogType: 'website', jsonLd, css: ['/css/notebook.css'] })}
<body class="wl-hub nb-hub">

${topbar()}

<section class="page-hero">
  <div class="breadcrumb">
    <a href="/">Index</a>
    <span class="sep">/</span>
    <span>Notebook</span>
  </div>
  <h1 class="brutal">Notebook — Articles by Vinay Pasricha</h1>
  <p class="subtitle">Practical articles on AI for business, leadership and hiring, written from running GoodSpace AI and from the books.</p>
  <p class="canonical">Videos are on <a href="/watch">Watch</a> and on YouTube: <a href="${YOUTUBE}">@VinayPasrichauthor</a>.</p>
</section>

<main class="wl-hub-main">
  <div class="nb-list">
${cards}
  </div>
</main>

${footer()}`;
}

const entries = ARTICLES.map((a) => ({ a, parsed: parse(fs.readFileSync(path.join(root, 'scripts', 'notebook', a.file), 'utf8')) }));
fs.mkdirSync(path.join(root, 'notebook'), { recursive: true });
for (const e of entries) {
  fs.writeFileSync(path.join(root, 'notebook', e.a.slug + '.html'), articlePage(e.a, e.parsed));
  console.log('wrote notebook/' + e.a.slug + '.html', e.parsed.wordCount, 'words,', e.parsed.faq.length, 'FAQ');
}
fs.writeFileSync(path.join(root, 'notebook.html'), hubPage(entries));
console.log('wrote notebook.html');
