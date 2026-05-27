/* =============================================================
   watch.js — videos page
   =============================================================
   Single source of truth for the videos. Add a new video by adding
   a new object to VIDEOS at the top. The page renders itself from
   this array.

   ## Topic categories
   Each video belongs to ONE topic. The page filters by topic.
   Topics: 'siv' | 'ai' | 'execution' | 'signal' | 'general'

   ## Platform
   'youtube' | 'youtube-shorts' | 'instagram' | 'linkedin' | 'x'

   ## Auto-pull (future)
   For v1, edit this file directly to add new videos. The shape
   below matches what a future YouTube/Instagram auto-pull job
   will emit, so the switchover is a back-end-only change.

   To populate automatically (later):
   - A server-side job hits the YouTube Data API + Instagram Graph
     API on a schedule
   - It writes a JSON file (assets/data/videos.json) with the same
     shape as VIDEOS below
   - This file then fetches from that JSON instead of using the
     hardcoded array
   ============================================================= */

const TOPICS = [
  { id: 'all',       label: 'All'                   },
  { id: 'siv',       label: 'The SIV Method'        },
  { id: 'ai',        label: 'AI for Business'       },
  { id: 'execution', label: 'Execution'             },
  { id: 'signal',    label: 'The Signal'            },
  { id: 'general',   label: 'Notes & reflections'   },
];

const PLATFORMS = {
  'youtube':         { label: 'YouTube',         badge: 'YT', url_prefix: 'https://www.youtube.com/watch?v=' },
  'youtube-shorts':  { label: 'YouTube Shorts',  badge: 'YT◦', url_prefix: 'https://www.youtube.com/shorts/' },
  'instagram':       { label: 'Instagram',       badge: 'IG', url_prefix: 'https://www.instagram.com/reel/' },
  'linkedin':        { label: 'LinkedIn',        badge: 'LI', url_prefix: 'https://www.linkedin.com/posts/' },
  'x':               { label: 'X',               badge: 'X',  url_prefix: 'https://x.com/' },
};

// Channels — the subscribe footer pulls from here
const CHANNELS = {
  youtube:   'https://www.youtube.com/@vinaypasricha',
  instagram: 'https://www.instagram.com/vinaypasricha',
  linkedin:  'https://www.linkedin.com/in/vinay-pasricha-a264186/',
  x:         'https://x.com/vinaypasricha',
};

/* ============================================================
   VIDEOS DATA
   ============================================================
   Source of truth: assets/data/videos.json
   - Fetched on page load.
   - Studio drafts (localStorage 'studio.videos') take precedence
     so you can preview unpublished changes before exporting.
   The inline DEFAULT_VIDEOS below is the fallback if both fail
   (e.g. opened from file://).
   ============================================================ */

const DEFAULT_VIDEOS = [
  // NOTE: This is the offline-fallback list (used only if videos.json fails
  // to load). The real video catalogue lives in assets/data/videos.json and
  // is edited through Studio → Videos. When a long-form talk is added there,
  // set `featured: true` and it will take the hero slot.
  //
  // YouTube Shorts — 'The Learning Trap'
  {
    id: 'yt-FWknG4jZDUE',
    title: 'The Learning Trap',
    blurb: 'You don’t have a learning problem. You have a thinking problem. Most ambitious people believe the next book, the next course, the next framework will finally unlock things. It won’t.',
    platform: 'youtube-shorts',
    platform_id: 'FWknG4jZDUE',
    duration: '0:26',
    date: '2026-05-22',
    topic: 'siv',
    hashtags: ['leadership', 'decisionmaking', 'thinking', 'criticalthinking', 'selfimprovement'],
  },
  // YouTube Shorts — 'Your Dashboard is Lying to You'
  {
    id: 'yt-9p9KzBxCKD4',
    title: 'Your Dashboard is Lying to You',
    blurb: 'The number on your dashboard is real. The story it tells you isn’t. Most leaders optimise what they can see while the actual constraint hides in a handoff, an approval queue, or one overloaded person.',
    platform: 'youtube-shorts',
    platform_id: '9p9KzBxCKD4',
    duration: '0:26',
    date: '2026-05-22',
    topic: 'execution',
    hashtags: ['leadership', 'execution', 'thinking', 'criticalthinking', 'decisionmaking'],
  },
];


/* ============================================================
   STATE
   ============================================================ */
let watchState = {
  activeTopic: 'all',
  videos: null,
};

function setTopic(topicId) {
  watchState.activeTopic = topicId;
  renderTopicNav();
  renderVideoGrid();
}

function getFilteredVideos() {
  if (watchState.activeTopic === 'all') return getVideos();
  return getVideos().filter(v => v.topic === watchState.activeTopic);
}

function getFeaturedVideo() {
  const videos = getVideos();
  return videos.find(v => v.featured) || videos[0];
}

function getVideos() {
  return watchState.videos || DEFAULT_VIDEOS;
}

async function loadVideos() {
  // 1) Studio drafts in localStorage take precedence
  try {
    const draft = localStorage.getItem('studio.videos');
    if (draft) {
      const parsed = JSON.parse(draft);
      if (Array.isArray(parsed?.videos)) return parsed.videos;
    }
  } catch (e) {}
  // 2) Published videos.json
  try {
    const res = await fetch('../assets/data/videos.json', { cache: 'no-cache' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data?.videos)) return data.videos;
    }
  } catch (e) {}
  // 3) Inline fallback
  return DEFAULT_VIDEOS;
}


/* ============================================================
   RENDER
   ============================================================ */
function renderTopicNav() {
  const host = document.getElementById('topic-nav');
  if (!host) return;
  host.innerHTML = TOPICS.map(t => {
    const all = getVideos();
    const count = t.id === 'all' ? all.length : all.filter(v => v.topic === t.id).length;
    if (count === 0 && t.id !== 'all') return ''; // hide empty topics
    return `
      <button class="topic-pill ${t.id === watchState.activeTopic ? 'active' : ''}" data-topic="${t.id}">
        <span>${escapeHTML(t.label)}</span>
        <span class="count">${count}</span>
      </button>
    `;
  }).join('');
  host.querySelectorAll('.topic-pill').forEach(p => {
    p.addEventListener('click', e => setTopic(e.currentTarget.dataset.topic));
  });
}

function renderFeaturedVideo() {
  const host = document.getElementById('featured-video');
  if (!host) return;
  const v = getFeaturedVideo();
  if (!v) { host.innerHTML = ''; return; }

  const platform = PLATFORMS[v.platform] || PLATFORMS.youtube;
  const isPlaceholder = v.platform_id === '__placeholder__';
  const watchUrl = isPlaceholder
    ? CHANNELS.youtube
    : platform.url_prefix + v.platform_id;
  const ytId = (v.platform === 'youtube' && !isPlaceholder) ? v.platform_id : null;

  host.innerHTML = `
    <div class="fv-flag">
      <span class="fv-flag-dot"></span>
      <span class="fv-flag-text">Featured</span>
    </div>
    <div class="fv-grid">
      <div class="fv-player" id="fv-player" data-yt-id="${ytId || ''}" data-watch-url="${escapeAttr(watchUrl)}" data-title="${escapeAttr(v.title)}">
        ${ytId
          ? renderLiteYouTube(ytId, v.title, watchUrl)
          : renderFeaturedPlaceholder(v, platform, watchUrl)
        }
      </div>
      <div class="fv-info">
        <div class="fv-meta">
          <span class="fv-platform">${platform.label}</span>
          <span class="dot">·</span>
          <span>${formatDate(v.date)}</span>
          <span class="dot">·</span>
          <span>${v.duration}</span>
        </div>
        <h2 class="fv-title">${escapeHTML(v.title)}</h2>
        <p class="fv-blurb">${escapeHTML(v.blurb)}</p>
        ${v.hashtags && v.hashtags.length ? `<div class="fv-tags">${v.hashtags.map(h => `<span class="vc-tag">#${escapeHTML(h)}</span>`).join('')}</div>` : ''}
        <a class="fv-watch" href="${watchUrl}" target="_blank" rel="noopener">
          Watch on ${platform.label} <span class="arrow">↗</span>
        </a>
      </div>
    </div>
  `;
  wireLiteYouTube();
}

function renderLiteYouTube(ytId, title, watchUrl) {
  // Click the thumbnail → open YouTube in a new tab.
  // (Originally tried inline embed, but that breaks in sandboxed previews
  // and means an extra step before the visitor sees the real player.)
  return `
    <a class="lite-yt" href="${watchUrl}" target="_blank" rel="noopener" aria-label="Play on YouTube: ${escapeAttr(title)}">
      <img class="lite-yt-thumb" src="https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg" alt="${escapeAttr(title)} thumbnail" onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${ytId}/hqdefault.jpg'">
      <span class="lite-yt-play" aria-hidden="true">
        <span class="lite-yt-triangle"></span>
      </span>
    </a>
  `;
}

function wireLiteYouTube() {
  // No-op now — the lite-YouTube is a plain anchor.
}

function escapeAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderFeaturedPlaceholder(v, platform, url) {
  const topic = TOPICS.find(t => t.id === v.topic);
  const ytThumb = getYouTubeThumb(v);
  return `
    <a class="fv-placeholder ${ytThumb ? 'has-thumb' : ''}" href="${url}" target="_blank" rel="noopener" aria-label="Watch ${escapeHTML(v.title)} on ${platform.label}">
      ${ytThumb
        ? `<img class="fv-ph-thumb" src="${ytThumb}" alt="${escapeHTML(v.title)} thumbnail" onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${v.platform_id}/hqdefault.jpg'">`
        : `<div class="fv-ph-bg"></div>`
      }
      <div class="fv-ph-content">
        <span class="fv-ph-platform">${platform.label}</span>
        <h3 class="fv-ph-title">${escapeHTML(v.title)}</h3>
        <span class="fv-ph-meta">${topic ? topic.label : ''} · ${v.duration}</span>
        <span class="fv-ph-play">
          <span class="fv-ph-triangle"></span>
          <span>Watch</span>
        </span>
      </div>
    </a>
  `;
}

function getYouTubeThumb(v) {
  if (!v.platform_id || v.platform_id === '__placeholder__') return null;
  if (v.platform !== 'youtube' && v.platform !== 'youtube-shorts') return null;
  return `https://i.ytimg.com/vi/${v.platform_id}/maxresdefault.jpg`;
}

function renderVideoGrid() {
  const host = document.getElementById('video-grid');
  if (!host) return;

  const videos = getFilteredVideos().filter(v => !v.featured || watchState.activeTopic !== 'all');
  // When viewing 'all', skip the featured video in the grid; when filtering, show it inline.

  if (videos.length === 0) {
    host.innerHTML = `
      <div class="vg-empty">
        <p>No videos in this topic <em>yet.</em></p>
        <p class="hint">— Vinay is recording. Check back, or watch what\u2019s already up.</p>
        <button class="vg-empty-reset" type="button" onclick="setTopic('all')">Show all videos</button>
      </div>
    `;
    return;
  }

  host.innerHTML = videos.map(v => renderVideoCard(v)).join('');
}

function renderVideoCard(v) {
  const platform = PLATFORMS[v.platform] || PLATFORMS.youtube;
  const isPlaceholder = v.platform_id === '__placeholder__';
  const watchUrl = isPlaceholder
    ? CHANNELS.youtube
    : platform.url_prefix + v.platform_id;
  const topic = TOPICS.find(t => t.id === v.topic);
  const isShort = v.platform === 'youtube-shorts' || v.platform === 'instagram';
  const ytThumb = getYouTubeThumb(v);

  return `
    <a class="video-card ${isShort ? 'short' : 'long'} ${ytThumb ? 'has-thumb' : ''}" href="${watchUrl}" target="_blank" rel="noopener">
      <div class="vc-thumb">
        ${ytThumb
          ? `<img class="vc-thumb-img" src="${ytThumb}" alt="${escapeHTML(v.title)} thumbnail" loading="lazy" onerror="this.onerror=null;this.src='https://i.ytimg.com/vi/${v.platform_id}/hqdefault.jpg'">`
          : `<div class="vc-thumb-bg topic-${v.topic}"></div>`
        }
        <div class="vc-thumb-content">
          <span class="vc-badge">${platform.badge}</span>
          <span class="vc-duration">${v.duration}</span>
        </div>
        ${!ytThumb ? `<div class="vc-thumb-overlay"><h3 class="vc-thumb-title">${escapeHTML(v.title)}</h3></div>` : ''}
        <div class="vc-thumb-play"><span class="vc-play-triangle"></span></div>
      </div>
      <div class="vc-body">
        <div class="vc-meta">
          ${topic ? `<span class="vc-topic">${escapeHTML(topic.label)}</span><span class="dot">·</span>` : ''}
          <span>${formatDate(v.date)}</span>
          <span class="dot">·</span>
          <span class="vc-platform">${platform.label}</span>
        </div>
        <h3 class="vc-title">${escapeHTML(v.title)}</h3>
        <p class="vc-blurb">${escapeHTML(v.blurb)}</p>
        ${v.hashtags && v.hashtags.length ? `<div class="vc-tags">${v.hashtags.map(h => `<span class="vc-tag">#${escapeHTML(h)}</span>`).join('')}</div>` : ''}
        <span class="vc-watch">Watch <span class="arrow">↗</span></span>
      </div>
    </a>
  `;
}

function renderSubscribe() {
  const host = document.getElementById('subscribe-channels');
  if (!host) return;
  host.innerHTML = `
    <a class="sub-channel" href="${CHANNELS.youtube}" target="_blank" rel="noopener">
      <span class="sc-platform">YouTube</span>
      <span class="sc-handle"><em>@vinaypasricha</em></span>
      <span class="sc-arrow">↗</span>
    </a>
    <a class="sub-channel" href="${CHANNELS.instagram}" target="_blank" rel="noopener">
      <span class="sc-platform">Instagram</span>
      <span class="sc-handle"><em>@vinaypasricha</em></span>
      <span class="sc-arrow">↗</span>
    </a>
    <a class="sub-channel" href="${CHANNELS.linkedin}" target="_blank" rel="noopener">
      <span class="sc-platform">LinkedIn</span>
      <span class="sc-handle"><em>linkedin.com/in/vinay-pasricha</em></span>
      <span class="sc-arrow">↗</span>
    </a>
    <a class="sub-channel" href="${CHANNELS.x}" target="_blank" rel="noopener">
      <span class="sc-platform">X</span>
      <span class="sc-handle"><em>@vinaypasricha</em></span>
      <span class="sc-arrow">↗</span>
    </a>
  `;
}


/* ============================================================
   UTIL
   ============================================================ */
function escapeHTML(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (e) { return iso; }
}


/* ============================================================
   INIT
   ============================================================ */
async function init() {
  watchState.videos = await loadVideos();
  renderTopicNav();
  renderFeaturedVideo();
  renderVideoGrid();
  renderSubscribe();
  // Translate dynamic content if we're not in English
  window.i18n?.refresh();

  // Live-refresh when studio publishes changes in another tab
  window.addEventListener('storage', async (e) => {
    if (e.key === 'studio.videos') {
      watchState.videos = await loadVideos();
      renderTopicNav();
      renderFeaturedVideo();
      renderVideoGrid();
      window.i18n?.refresh();
    }
  });
}

// Expose for empty-state button
window.setTopic = setTopic;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
