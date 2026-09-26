// Shared HTML for /watch pages and the Watch sections on books and paths.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const LANG_LABEL = { en: 'English', hi: 'Hindi' };

let libraryCache;
let booksCache;

export function loadLibrary() {
  if (!libraryCache) {
    const file = path.join(root, 'assets', 'data', 'videos-library.json');
    libraryCache = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  return libraryCache;
}

export function loadBooks() {
  if (!booksCache) {
    const file = path.join(root, 'assets', 'data', 'books.json');
    booksCache = JSON.parse(fs.readFileSync(file, 'utf8')).books;
  }
  return booksCache;
}

export function esc(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function jsonLdScript(value) {
  const json = JSON.stringify(value, null, 2).replace(/</g, '\\u003c');
  return `<script type="application/ld+json">\n${json}\n  </script>`;
}

export function displayTitle(video) {
  return video.suggested_title || video.title;
}

export function formatDuration(iso) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!match) return iso || '';
  const hours = Number(match[1] || 0);
  const minutes = Number(match[2] || 0);
  const seconds = String(Number(match[3] || 0)).padStart(2, '0');
  if (hours) return `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`;
  return `${minutes}:${seconds}`;
}

export function formatDate(iso) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!match) return iso || '';
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

export function typeLabel(video) {
  return video.type === 'short' ? 'Short' : 'Video';
}

export function languageLabel(video) {
  return LANG_LABEL[video.language] || video.language;
}

export function badge(video) {
  return `${formatDuration(video.duration_iso)} · ${typeLabel(video)}`;
}

export function topicAnchor(topic) {
  return 'topic-' + topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function embedUrl(id, autoplay) {
  const base = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0`;
  return autoplay ? `${base}&autoplay=1` : base;
}

export function renderFacade(video, options = {}) {
  const title = displayTitle(video);
  const kind = video.type === 'short' ? 'is-short' : 'is-video';
  const loading = options.priority ? 'fetchpriority="high"' : 'loading="lazy"';
  const caption = options.caption
    ? `\n      <span class="wl-caption">${esc(options.caption)}</span>`
    : '';
  const titleLink = options.hideTitle
    ? ''
    : `\n      <a href="/watch/${esc(video.slug)}">${esc(title)}</a>`;
  return `<figure class="wl-facade ${kind}">
    <div class="wl-frame ${kind}">
      <a class="wl-lite" href="${esc(embedUrl(video.id, false))}" data-embed="${esc(embedUrl(video.id, true))}" data-title="${esc(title)}" aria-label="Play: ${esc(title)}">
        <img src="${esc(video.thumbnail)}" alt="" width="1280" height="720" ${loading} decoding="async" referrerpolicy="no-referrer">
        <span class="wl-play" aria-hidden="true"></span>
      </a>
    </div>
    <figcaption>${titleLink}
      <span class="wl-badge">${esc(badge(video))}</span>${caption}
    </figcaption>
  </figure>`;
}

export function renderCard(video, options = {}) {
  const title = displayTitle(video);
  const caption = options.caption
    ? `\n    <p class="wl-caption">${esc(options.caption)}</p>`
    : '';
  return `<a class="wl-card" href="/watch/${esc(video.slug)}">
    <div class="wl-card-media">
      <img src="${esc(video.thumbnail)}" alt="" width="1280" height="720" loading="lazy" decoding="async" referrerpolicy="no-referrer">
      <span class="wl-badge">${esc(badge(video))}</span>
    </div>
    <div class="wl-card-body">
      <h3>${esc(title)}</h3>
      <p>${esc(video.meta_description)}</p>${caption}
    </div>
  </a>`;
}

export function renderWatchSection(spec) {
  const ids = spec.ids || [];
  if (!ids.length) return '';
  const byId = new Map(loadLibrary().videos.map((video) => [video.id, video]));
  const videos = ids.map((id) => {
    const video = byId.get(id);
    if (!video) throw new Error(`Unknown video id in embed list: ${id}`);
    return video;
  });
  const facades = videos.slice(0, 2);
  const rest = videos.slice(2);
  const captions = spec.captions || {};
  const flag = spec.related ? '\n  <p class="wl-flag">Related</p>' : '';
  const more = rest.length
    ? `\n  <div class="wl-more">\n    ${rest.map((video) => renderCard(video, { caption: captions[video.id] })).join('\n    ')}\n  </div>`
    : '';
  return `<section class="wl-embed" id="watch">
  <h2>Watch</h2>${flag}
  <div class="wl-facades">
    ${facades.map((video, index) => renderFacade(video, { priority: index === 0, caption: captions[video.id] })).join('\n    ')}
  </div>${more}
  <p class="wl-all"><a href="/watch">All videos</a></p>
</section>`;
}

export function renderRelatedBook(slug) {
  if (!slug) return '';
  const book = loadBooks().find((item) => item.slug === slug);
  if (!book) throw new Error(`Unknown related book: ${slug}`);
  const cover = book.cover.startsWith('/') ? book.cover : `/${book.cover}`;
  const amazon = book.amazon
    ? `\n    <a class="wl-cta" href="${esc(book.amazon)}" target="_blank" rel="noopener">Buy on Amazon <span class="arrow">↗</span></a>`
    : '';
  return `<section class="wl-book">
    <h2>Related book</h2>
    <a class="wl-book-card" href="/books/${esc(book.slug)}">
      <img src="${esc(cover)}" alt="${esc(`Cover of ${book.title} by Vinay Pasricha`)}" width="800" height="1200">
      <span>
        <strong>${esc(book.title)}</strong>
        <em>${esc(book.subtitle)}</em>
      </span>
    </a>${amazon}
  </section>`;
}

export function relatedVideos(video, library) {
  return library.videos
    .filter((item) => item.topic === video.topic && item.slug !== video.slug)
    .slice()
    .sort((a, b) => (a.upload_date < b.upload_date ? 1 : a.upload_date > b.upload_date ? -1 : 0))
    .slice(0, 4);
}
