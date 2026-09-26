#!/usr/bin/env node
// Builds the static Watch hub (watch.html → /watch) and one page per
// video (watch/<slug>.html → /watch/<slug>) from assets/data/videos-library.json.
// Also injects Watch sections into the path pages listed in watch-embeds.mjs
// and refreshes the /watch entries in sitemap.xml.
// Book pages are rebuilt by scripts/build-book-pages.mjs, which uses the same renderer.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PATH_EMBEDS, TOPIC_ORDER } from './lib/watch-embeds.mjs';
import {
  badge,
  displayTitle,
  esc,
  formatDate,
  formatDuration,
  jsonLdScript,
  languageLabel,
  loadLibrary,
  relatedVideos,
  renderCard,
  renderFacade,
  renderRelatedBook,
  renderWatchSection,
  topicAnchor,
} from './lib/watch-render.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ORIGIN = 'https://vinaypasricha.com';
const LANGS = ['en', 'hi', 'bn', 'ta', 'te', 'kn', 'es', 'fr', 'pt', 'ja', 'zh', 'ko', 'ru'];
const HUB_TITLE = 'Watch — Videos by Vinay Pasricha';
const HUB_DESCRIPTION = 'Videos by Vinay Pasricha on AI for business, the SIV Method, execution, hiring, career, civilization, learning, and India and systems.';
const FONTS = 'https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,300;0,6..72,400;0,6..72,500;1,6..72,400&family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&family=Noto+Serif:ital,wght@0,400;0,500;1,400&family=Noto+Sans:wght@400;500;600&family=Noto+Sans+Devanagari:wght@400;500&family=Noto+Sans+Bengali:wght@400;500&family=Noto+Sans+Tamil:wght@400;500&family=Noto+Sans+Telugu:wght@400;500&family=Noto+Sans+Kannada:wght@400;500&family=Noto+Sans+SC:wght@400;500&family=Noto+Sans+KR:wght@400;500&display=swap';

function hreflang(urlPath) {
  const base = ORIGIN + urlPath;
  const lines = [
    `<link rel="alternate" hreflang="x-default" href="${base}">`,
    ...LANGS.map((code) => {
      const href = code === 'en' ? base : `${base}?lang=${code}`;
      return `<link rel="alternate" hreflang="${code}" href="${href}">`;
    }),
  ];
  return lines.map((line) => '  ' + line).join('\n');
}

function chrome() {
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
    <div class="lang-switch">
      <button class="lang-btn" aria-haspopup="listbox" aria-expanded="false">
        <span class="label">EN</span>
        <span class="caret">▾</span>
      </button>
      <div class="lang-menu" role="listbox">
        <div class="heading">Choose a language</div>
        <a href="?" class="current"><span class="code">EN</span><span class="native">English</span></a>
        <a href="?lang=hi"><span class="code">HI</span><span class="native">हिंदी</span></a>
        <a href="?lang=bn"><span class="code">BN</span><span class="native">বাংলা</span></a>
        <a href="?lang=ta"><span class="code">TA</span><span class="native">தமிழ்</span></a>
        <a href="?lang=te"><span class="code">TE</span><span class="native">తెలుగు</span></a>
        <a href="?lang=kn"><span class="code">KN</span><span class="native">ಕನ್ನಡ</span></a>
        <a href="?lang=es"><span class="code">ES</span><span class="native">Español</span></a>
        <a href="?lang=fr"><span class="code">FR</span><span class="native">Français</span></a>
        <a href="?lang=pt"><span class="code">PT</span><span class="native">Português</span></a>
        <a href="?lang=ja"><span class="code">JA</span><span class="native">日本語</span></a>
        <a href="?lang=zh"><span class="code">ZH</span><span class="native">中文</span></a>
        <a href="?lang=ko"><span class="code">KO</span><span class="native">한국어</span></a>
        <a href="?lang=ru"><span class="code">RU</span><span class="native">Русский</span></a>
      </div>
    </div>
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
    © 2026 · <a href="/">Index</a><a href="/books">Books</a><a href="/watch">Watch</a><a href="/paths/connect">Connect</a>
  </div>
</footer>`;
}

function scripts() {
  return `<script src="/js/site.js"></script>
<script src="/js/watch-facade.js"></script>
<script src="/js/i18n.js"></script>
<script src="/js/claude-bridge.js"></script>`;
}

function headIcons() {
  return `  <link rel="icon" type="image/png" sizes="32x32" href="/assets/images/brand/favicon-32.png">
  <link rel="icon" type="image/png" sizes="16x16" href="/assets/images/brand/favicon-16.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/images/brand/apple-touch-icon.png">
  <link rel="manifest" href="/site.webmanifest">`;
}

function documentShell({ bodyClass, title, description, urlPath, image, imageAlt, ogType, jsonLd, body }) {
  const url = ORIGIN + urlPath;
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
  <meta property="og:url" content="${url}">
  <meta property="og:site_name" content="vinaypasricha.com">
  <meta property="og:locale" content="en_US">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:image:alt" content="${esc(imageAlt)}">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(image)}">

  <link rel="canonical" href="${url}">
${hreflang(urlPath)}

${headIcons()}

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://i.ytimg.com">
  <link href="${FONTS}" rel="stylesheet">

  <link rel="stylesheet" href="/css/site.css">
  <link rel="stylesheet" href="/css/i18n.css">
  <link rel="stylesheet" href="/css/watch-library.css">

  ${jsonLd}
</head>
<body class="${bodyClass}">

${chrome()}

${body}

${footer()}

${scripts()}
</body>
</html>
`;
}

function videoPage(video, library) {
  const title = displayTitle(video);
  const urlPath = `/watch/${video.slug}`;
  const keywords = [video.primary_keyword, ...(video.secondary_keywords || [])];
  const others = relatedVideos(video, library);
  const meta = [
    video.topic,
    `<time datetime="${esc(video.upload_date)}">${esc(formatDate(video.upload_date))}</time>`,
    formatDuration(video.duration_iso),
    languageLabel(video),
    video.type === 'short' ? 'Short' : 'Video',
  ];
  if (video.playlist) meta.push(video.playlist);
  const points = (video.key_points || []).map((point) => `        <li>${esc(point)}</li>`).join('\n');
  const quote = video.notable_quote && String(video.notable_quote).trim()
    ? `\n      <blockquote class="wl-quote"><p>${esc(video.notable_quote)}</p></blockquote>`
    : '';
  const hindi = video.summary_hi
    ? `\n      <h2>Hindi summary</h2>\n      <div class="wl-hi" lang="hi" translate="no" data-no-translate>\n        <p>${esc(video.summary_hi)}</p>\n      </div>`
    : '';
  const related = others.length
    ? `\n    <section>\n      <h2>More in ${esc(video.topic)}</h2>\n      <div class="wl-related">\n        ${others.map((item) => renderCard(item)).join('\n        ')}\n      </div>\n    </section>`
    : '';
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'VideoObject',
        name: video.title,
        ...(video.suggested_title && video.suggested_title !== video.title
          ? { alternateName: video.suggested_title }
          : {}),
        description: video.summary,
        thumbnailUrl: video.thumbnail,
        uploadDate: video.upload_date,
        duration: video.duration_iso,
        embedUrl: `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.id)}`,
        contentUrl: video.url,
        inLanguage: video.language,
        url: ORIGIN + urlPath,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Index', item: `${ORIGIN}/` },
          { '@type': 'ListItem', position: 2, name: 'Watch', item: `${ORIGIN}/watch` },
          { '@type': 'ListItem', position: 3, name: title, item: ORIGIN + urlPath },
        ],
      },
    ],
  };
  const playlistClass = (label) => (label === video.playlist ? ' class="wl-playlist"' : '');
  const body = `<section class="page-hero">
  <div class="breadcrumb">
    <a href="/">Index</a>
    <span class="sep">/</span>
    <a href="/watch">Watch</a>
    <span class="sep">/</span>
    <span>${esc(title)}</span>
  </div>
  <h1 class="brutal">${esc(title)}</h1>
  <ul class="wl-meta">
    ${meta.map((item) => `<li${playlistClass(item)}>${typeof item === 'string' && item.startsWith('<time') ? item : esc(item)}</li>`).join('\n    ')}
  </ul>
</section>

<div class="wl-stage">
  ${renderFacade(video, { priority: true, hideTitle: true })}
</div>

<div class="wl-columns">
  <article class="wl-copy">
    <h2>Summary</h2>
    <p>${esc(video.summary)}</p>
    <h2>Key points</h2>
    <ul class="wl-points">
${points}
    </ul>${quote}${hindi}
    <h2>Topics</h2>
    <ul class="wl-tags" data-no-translate>
      ${keywords.map((keyword) => `<li>${esc(keyword)}</li>`).join('\n      ')}
    </ul>
  </article>
  <aside class="wl-side">
    ${renderRelatedBook(video.related_book)}${related}
    <p class="wl-back"><a href="/watch">All videos</a></p>
  </aside>
</div>`;

  return documentShell({
    bodyClass: 'wl-page',
    title: video.seo_title,
    description: video.meta_description,
    urlPath,
    image: video.thumbnail,
    imageAlt: title,
    ogType: 'video.other',
    jsonLd: jsonLdScript(graph),
    body,
  });
}

function hubPage(library) {
  const groups = TOPIC_ORDER.map((topic) => ({
    topic,
    videos: library.videos
      .filter((video) => video.topic === topic)
      .slice()
      .sort((a, b) => (a.upload_date < b.upload_date ? 1 : a.upload_date > b.upload_date ? -1 : 0)),
  }));
  const missing = library.videos.filter((video) => !TOPIC_ORDER.includes(video.topic));
  if (missing.length) {
    throw new Error(`Videos with topics outside the hub order: ${missing.map((video) => video.slug).join(', ')}`);
  }
  const ordered = groups.flatMap((group) => group.videos);
  if (ordered.length !== library.videos.length) {
    throw new Error(`Hub lists ${ordered.length} videos, library has ${library.videos.length}`);
  }
  const lastmod = ordered.reduce((max, video) => (video.upload_date > max ? video.upload_date : max), '2026-01-01');
  const jump = groups
    .filter((group) => group.videos.length)
    .map((group) => `<a href="#${topicAnchor(group.topic)}">${esc(group.topic)}</a>`)
    .join('\n  ');
  const sections = groups.filter((group) => group.videos.length).map((group) => {
    const note = group.topic === 'India & Systems'
      ? '\n    <p class="wl-topic-note">Justice Delayed</p>'
      : '';
    return `<section class="wl-topic" id="${topicAnchor(group.topic)}">
  <div class="wl-topic-head">
    <h2>${esc(group.topic)}</h2>${note}
  </div>
  <div class="wl-grid">
    ${group.videos.map((video) => renderCard(video)).join('\n    ')}
  </div>
</section>`;
  }).join('\n\n');
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        name: HUB_TITLE,
        description: HUB_DESCRIPTION,
        url: `${ORIGIN}/watch`,
        inLanguage: 'en',
      },
      {
        '@type': 'ItemList',
        name: HUB_TITLE,
        numberOfItems: ordered.length,
        itemListElement: ordered.map((video, index) => ({
          '@type': 'ListItem',
          position: index + 1,
          name: displayTitle(video),
          url: `${ORIGIN}/watch/${video.slug}`,
        })),
      },
    ],
  };
  const body = `<section class="page-hero">
  <div class="breadcrumb">
    <a href="/">Index</a>
    <span class="sep">/</span>
    <span>Watch</span>
  </div>
  <h1 class="brutal">${esc(HUB_TITLE)}</h1>
  <p class="subtitle">Talks and short reflections by Vinay Pasricha, grouped by subject: AI for business, decisions and the SIV Method, execution, hiring and organizational frequency, career and finding work, civilization and the future, learning and thinking, and India and systems.</p>
  <p class="canonical">The India and systems videos are the Justice Delayed playlist. On YouTube: <a href="https://www.youtube.com/@VinayPasrichauthor">@VinayPasrichauthor</a>.</p>
</section>

<nav class="wl-jump" aria-label="Topics">
  ${jump}
</nav>

<main class="wl-hub-main">
${sections}
</main>`;

  return {
    html: documentShell({
      bodyClass: 'wl-hub',
      title: HUB_TITLE,
      description: HUB_DESCRIPTION,
      urlPath: '/watch',
      image: `${ORIGIN}/assets/images/brand/og-image.png`,
      imageAlt: HUB_TITLE,
      ogType: 'website',
      jsonLd: jsonLdScript(graph),
      body,
    }),
    ordered,
    lastmod,
  };
}

function sitemapBlock(loc, lastmod, changefreq, priority) {
  const alternates = [
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${loc}" />`,
    ...LANGS.map((code) => {
      const href = code === 'en' ? loc : `${loc}?lang=${code}`;
      return `    <xhtml:link rel="alternate" hreflang="${code}" href="${href}" />`;
    }),
  ].join('\n');
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
${alternates}
  </url>`;
}

function updateSitemap(ordered, hubLastmod) {
  const file = path.join(root, 'sitemap.xml');
  let xml = fs.readFileSync(file, 'utf8');
  xml = xml.replace(/\n  <url>[\s\S]*?<\/url>/g, (block) => {
    const loc = block.match(/<loc>([^<]+)<\/loc>/);
    if (!loc) return block;
    const url = loc[1];
    if (url === `${ORIGIN}/paths/watch` || url === `${ORIGIN}/watch` || url.startsWith(`${ORIGIN}/watch/`)) return '';
    return block;
  });
  const blocks = [
    sitemapBlock(`${ORIGIN}/watch`, hubLastmod, 'weekly', '0.8'),
    ...ordered.map((video) => sitemapBlock(`${ORIGIN}/watch/${video.slug}`, video.upload_date, 'monthly', '0.6')),
  ].join('\n\n');
  if (!xml.includes('</urlset>')) throw new Error('sitemap.xml has no urlset close');
  xml = xml.replace('</urlset>', `\n${blocks}\n</urlset>\n`);
  fs.writeFileSync(file, xml);
}

const EMBED_START = '<!-- watch-embeds:start -->';
const EMBED_END = '<!-- watch-embeds:end -->';

function injectPathEmbeds() {
  for (const [slug, spec] of Object.entries(PATH_EMBEDS)) {
    const file = path.join(root, 'paths', `${slug}.html`);
    let html = fs.readFileSync(file, 'utf8');
    const section = `${EMBED_START}\n${renderWatchSection(spec)}\n${EMBED_END}`;
    if (html.includes(EMBED_START)) {
      html = html.replace(new RegExp(`${EMBED_START}[\\s\\S]*?${EMBED_END}`), section);
    } else if (html.includes('<section class="continuations">')) {
      html = html.replace('<section class="continuations">', `${section}\n\n<section class="continuations">`);
    } else if (html.includes('<footer class="site-foot">')) {
      html = html.replace('<footer class="site-foot">', `${section}\n\n<footer class="site-foot">`);
    } else {
      throw new Error(`No insertion point on paths/${slug}.html`);
    }
    if (!html.includes('/css/watch-library.css')) {
      html = html.replace('</head>', '  <link rel="stylesheet" href="/css/watch-library.css">\n</head>');
    }
    if (!html.includes('/js/watch-facade.js')) {
      html = html.replace('</body>', '<script src="/js/watch-facade.js"></script>\n</body>');
    }
    fs.writeFileSync(file, html);
    console.log(`paths/${slug}.html  videos ${spec.ids.length}`);
  }
}

function assertPages(library) {
  const hub = fs.readFileSync(path.join(root, 'watch.html'), 'utf8');
  if ((hub.match(/<h1\b/g) || []).length !== 1) throw new Error('hub h1 count');
  if (hub.includes('<iframe')) throw new Error('hub shipped an iframe');
  for (const video of library.videos) {
    const file = path.join(root, 'watch', `${video.slug}.html`);
    const html = fs.readFileSync(file, 'utf8');
    if ((html.match(/<h1\b/g) || []).length !== 1) throw new Error(`${video.slug} h1 count`);
    if (!html.includes(`<h1 class="brutal">${esc(displayTitle(video))}</h1>`)) {
      throw new Error(`${video.slug} h1 is not the display title`);
    }
    if (html.includes('<iframe')) throw new Error(`${video.slug} shipped an iframe`);
    if (!html.includes('youtube-nocookie.com/embed/')) throw new Error(`${video.slug} missing nocookie embed`);
    if (!html.includes(video.summary.slice(0, 80))) throw new Error(`${video.slug} summary missing`);
    const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    if (!blocks.length) throw new Error(`${video.slug} missing json-ld`);
    for (const block of blocks) JSON.parse(block[1]);
    if (html.includes('/paths/india') || html.includes('editor_notes')) {
      throw new Error(`${video.slug} leaked editorial notes`);
    }
  }
}

const library = loadLibrary();
const slugs = new Set();
for (const video of library.videos) {
  if (!/^[a-z0-9-]+$/.test(video.slug)) throw new Error(`Unsafe slug: ${video.slug}`);
  if (slugs.has(video.slug)) throw new Error(`Duplicate slug: ${video.slug}`);
  slugs.add(video.slug);
  for (const field of ['id', 'url', 'title', 'summary', 'seo_title', 'meta_description', 'thumbnail', 'topic', 'duration_iso', 'upload_date', 'primary_keyword']) {
    if (!video[field]) throw new Error(`${video.slug} missing ${field}`);
  }
}

const outDir = path.join(root, 'watch');
fs.mkdirSync(outDir, { recursive: true });
for (const existing of fs.readdirSync(outDir)) {
  if (existing.endsWith('.html')) fs.unlinkSync(path.join(outDir, existing));
}
for (const video of library.videos) {
  fs.writeFileSync(path.join(outDir, `${video.slug}.html`), videoPage(video, library));
}
const hub = hubPage(library);
fs.writeFileSync(path.join(root, 'watch.html'), hub.html);
updateSitemap(hub.ordered, hub.lastmod);
injectPathEmbeds();
assertPages(library);
console.log(`watch hub + ${library.videos.length} video pages`);
