// Search-ready Notebook article pages and sitemap generation.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ESSAY_TEMPLATE = path.resolve(here, '..', '..', 'paths', 'essay.html');
const STATIC_SITEMAP = path.resolve(here, '..', '..', 'sitemap.xml');
const PUBLIC_ORIGIN = 'https://vinaypasricha.com';

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function absolutePublicUrl(value) {
  const url = String(value || '');
  if (/^https:\/\//i.test(url)) return url;
  return PUBLIC_ORIGIN + (url.startsWith('/') ? url : '/' + url);
}

export function renderNotebookMarkdown(markdown) {
  let html = escapeHtml(String(markdown || '').trim());
  html = html.replace(/&lt;(\/?(?:em|strong|i|b|br))&gt;/g, '<$1>');
  html = html.replace(/&lt;(\/?(?:em|strong|i|b|br))\s*\/?&gt;/g, '<$1>');
  html = html.replace(/^### +(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## +(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# +(.+)$/gm, '<h1>$1</h1>');
  html = html.replace(/^&gt; +(.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/^---+\s*$/gm, '<hr>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  html = html.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (match, label, href) {
    const safe = /^(?:https?:\/\/|mailto:|\/|#)/i.test(href);
    return safe ? '<a href="' + href + '">' + label + '</a>' : label;
  });
  return html.split(/\n\s*\n/).map(function (block) {
    const value = block.trim();
    if (!value) return '';
    if (/^<(h\d|blockquote|hr|ul|ol|pre)/.test(value)) return value;
    return '<p>' + value.replace(/\n/g, '<br>') + '</p>';
  }).join('\n');
}

function validImage(image) {
  return image && /^\/api\/notebook\/images\/[a-f0-9-]{36}\.(?:png|jpg|webp)$/.test(String(image.url || ''));
}

function essayFigure(image) {
  return '<figure><img src="' + escapeHtml(image.url) + '" alt="' +
    escapeHtml(image.alt || 'Essay image') + '" loading="lazy">' +
    (image.alt ? '<figcaption>' + escapeHtml(image.alt) + '</figcaption>' : '') + '</figure>';
}

function articleUrl(essay) {
  return '/paths/essay/' + encodeURIComponent(essay.slug);
}

function essayArticleHtml(essay, published) {
  const index = published.findIndex(function (item) { return item.slug === essay.slug; });
  const older = published[index + 1];
  const newer = published[index - 1];
  const images = (essay.images || []).filter(validImage);
  const lead = images[0] ? essayFigure(images[0]) : '';
  const trailing = images.slice(1).map(essayFigure).join('');
  const tags = (essay.tags || []).map(function (tag) {
    return '<span class="essay-tag">' + escapeHtml(tag) + '</span>';
  }).join('');

  return [
    '<article class="essay-page" data-screen-label="Essay">',
    '<div class="essay-crumbs"><a href="/">Index</a><span class="sep">/</span><a href="/paths/blog">Notebook</a><span class="sep">/</span><span class="num">' + escapeHtml(essay.monthLabel || essay.date || '') + '</span></div>',
    '<div class="essay-meta-top"><span>' + escapeHtml(essay.monthLabel || essay.date || '') + '</span><span class="dot">&middot;</span><span>' + escapeHtml(String(essay.readingMin || 1)) + ' min read</span></div>',
    '<h1 class="essay-title">' + escapeHtml(essay.title) + '</h1>',
    essay.dek ? '<p class="essay-dek">' + escapeHtml(essay.dek) + '</p>' : '',
    '<div class="essay-body" id="essay-body">' + lead + renderNotebookMarkdown(essay.body) + trailing + '</div>',
    tags ? '<div class="essay-tags-bottom">' + tags + '</div>' : '',
    '</article>',
    '<nav class="essay-nav">',
    older
      ? '<a href="' + articleUrl(older) + '"><div class="label">&larr; Older</div><div class="title">' + escapeHtml(older.title) + '</div></a>'
      : '<div class="placeholder" style="padding:24px 28px;border:1px dashed var(--rule);border-radius:2px"><div class="label">&larr; Older</div><div class="title">&mdash; The Notebook begins here.</div></div>',
    newer
      ? '<a href="' + articleUrl(newer) + '" class="next-card"><div class="label">Newer &rarr;</div><div class="title">' + escapeHtml(newer.title) + '</div></a>'
      : '<div class="placeholder next-card" style="padding:24px 28px;border:1px dashed var(--rule);border-radius:2px"><div class="label">Newer &rarr;</div><div class="title">&mdash; Next essay, first weekend of next month.</div></div>',
    '</nav>',
  ].join('\n');
}

export function renderNotebookEssayHtml(template, essay, published) {
  published = published || [essay];
  const canonical = PUBLIC_ORIGIN + articleUrl(essay);
  const description = essay.dek || essay.title;
  const leadImage = essay.images && essay.images[0]
    ? absolutePublicUrl(essay.images[0].url)
    : PUBLIC_ORIGIN + '/assets/images/brand/og-image.png';
  const structured = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: essay.title,
    description: description,
    image: (essay.images || []).filter(validImage).map(function (image) { return absolutePublicUrl(image.url); }),
    datePublished: essay.date,
    dateModified: essay.updated_at || essay.date,
    author: { '@type': 'Person', name: 'Vinay Pasricha', url: PUBLIC_ORIGIN },
    publisher: { '@type': 'Person', name: 'Vinay Pasricha', url: PUBLIC_ORIGIN },
    mainEntityOfPage: canonical,
    keywords: (essay.tags || []).join(', '),
  };
  if (!structured.image.length) structured.image = [PUBLIC_ORIGIN + '/assets/images/brand/og-image.png'];

  const social = [
    '<meta property="og:title" content="' + escapeHtml(essay.title) + '">',
    '<meta property="og:description" content="' + escapeHtml(description) + '">',
    '<meta property="og:url" content="' + escapeHtml(canonical) + '">',
    '<meta property="article:published_time" content="' + escapeHtml(essay.date) + '">',
    '<meta property="article:modified_time" content="' + escapeHtml(essay.updated_at || essay.date) + '">',
    '<meta property="article:author" content="Vinay Pasricha">',
    '<meta name="twitter:title" content="' + escapeHtml(essay.title) + '">',
    '<meta name="twitter:description" content="' + escapeHtml(description) + '">',
    '<script type="application/ld+json">' + JSON.stringify(structured).replace(/</g, '\\u003c') + '</script>',
  ].join('\n  ');

  return template
    .replace(/<title>[\s\S]*?<\/title>/i, '<title>' + escapeHtml(essay.title) + ' · The Monthly Notebook</title>')
    .replace(/<meta name="description" content="[^"]*">/i, '<meta name="description" content="' + escapeHtml(description) + '">')
    .replace(/<link rel="canonical" id="link-canonical" href="[^"]*">/i, '<link rel="canonical" id="link-canonical" href="' + canonical + '">')
    .replace(/<meta property="og:image" content="[^"]*">/i, '<meta property="og:image" content="' + escapeHtml(leadImage) + '">')
    .replace(/<meta name="twitter:image" content="[^"]*">/i, '<meta name="twitter:image" content="' + escapeHtml(leadImage) + '">')
    .replace('</head>', '  ' + social + '\n</head>')
    .replace(/<div id="essay-host">[\s\S]*?<\/div>\s*<\/main>/i, '<div id="essay-host">' + essayArticleHtml(essay, published) + '</div>\n</main>');
}

export function renderNotebookSitemap(staticXml, essays) {
  const withoutGenericEssay = staticXml.replace(/\s*<url>\s*<loc>https:\/\/vinaypasricha\.com\/paths\/essay<\/loc>[\s\S]*?<\/url>/i, '');
  const urls = essays.filter(function (essay) { return essay.status === 'published'; }).map(function (essay) {
    return [
      '  <url>',
      '    <loc>' + PUBLIC_ORIGIN + articleUrl(essay) + '</loc>',
      '    <lastmod>' + escapeHtml(String(essay.updated_at || essay.date || '').slice(0, 10)) + '</lastmod>',
      '    <changefreq>monthly</changefreq>',
      '    <priority>0.7</priority>',
      '  </url>',
    ].join('\n');
  }).join('\n');
  return withoutGenericEssay.replace(/\s*<\/urlset>\s*$/i, '\n' + urls + '\n</urlset>\n');
}

export function registerNotebookSeoRoutes(app, options) {
  const listEssays = options.listEssays;
  const notebookSlug = options.notebookSlug;

  app.get(['/paths/essay', '/paths/essay.html'], function (req, res) {
    const requested = String(req.query && req.query.slug || '').trim();
    if (!requested) return res.redirect(302, '/paths/blog');
    return res.redirect(301, '/paths/essay/' + encodeURIComponent(notebookSlug(requested)));
  });

  app.get('/paths/essay/:slug', async function (req, res) {
    try {
      const published = await listEssays({ publishedOnly: true });
      const essay = published.find(function (item) { return item.slug === notebookSlug(req.params.slug); });
      if (!essay) return res.status(404).send('That essay is not available.');
      const template = fs.readFileSync(ESSAY_TEMPLATE, 'utf8');
      res.set('Content-Type', 'text/html; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return res.send(renderNotebookEssayHtml(template, essay, published));
    } catch (error) {
      console.error('[notebook] article render failed:', error.message);
      return res.status(503).send('The Notebook is temporarily unavailable.');
    }
  });

  app.get('/sitemap.xml', async function (req, res) {
    const sitemap = fs.readFileSync(STATIC_SITEMAP, 'utf8');
    try {
      const published = await listEssays({ publishedOnly: true });
      res.set('Content-Type', 'application/xml; charset=utf-8');
      res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600');
      return res.send(renderNotebookSitemap(sitemap, published));
    } catch (error) {
      console.error('[notebook] dynamic sitemap failed:', error.message);
      res.set('Content-Type', 'application/xml; charset=utf-8');
      return res.send(sitemap);
    }
  });
}
