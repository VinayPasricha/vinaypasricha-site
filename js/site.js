/* Vinay Pasricha — site.js
   Minimal JS:
   - Topbar shadow on scroll
   - Language switcher open/close
   - "Now" line rotator — cycles through current preoccupations
   - Index overlay open/close
   - Analytics — opt-in, see ANALYTICS config below
*/

/* ============================================================
   ANALYTICS — opt-in, privacy-respecting by default
   ============================================================
   To enable analytics on the live site, set ANALYTICS.provider
   to one of: 'plausible' | 'umami' | 'fathom' | 'ga4'.
   Then fill in the matching id/domain. The script tag is
   injected automatically; no per-page changes needed.

   See _brief/analytics-setup.md for step-by-step setup of each
   provider. Recommendation: Plausible. Privacy-respecting,
   read API for the Progress dashboard, ~$9/mo.
   ============================================================ */
const ANALYTICS = {
  provider: 'none',                       // 'none' | 'plausible' | 'umami' | 'fathom' | 'ga4'
  plausibleDomain: 'vinaypasricha.com',   // your domain in Plausible
  umamiWebsiteId: '',                     // your Umami website UUID
  fathomSiteId: '',                       // your Fathom site ID
  ga4MeasurementId: '',                   // your GA4 measurement ID (G-XXXXXXX)
};

(function injectAnalytics() {
  if (ANALYTICS.provider === 'plausible' && ANALYTICS.plausibleDomain) {
    const s = document.createElement('script');
    s.defer = true;
    s.dataset.domain = ANALYTICS.plausibleDomain;
    s.src = 'https://plausible.io/js/script.js';
    document.head.appendChild(s);
  } else if (ANALYTICS.provider === 'umami' && ANALYTICS.umamiWebsiteId) {
    const s = document.createElement('script');
    s.defer = true;
    s.dataset.websiteId = ANALYTICS.umamiWebsiteId;
    s.src = 'https://cloud.umami.is/script.js';
    document.head.appendChild(s);
  } else if (ANALYTICS.provider === 'fathom' && ANALYTICS.fathomSiteId) {
    const s = document.createElement('script');
    s.defer = true;
    s.dataset.site = ANALYTICS.fathomSiteId;
    s.src = 'https://cdn.usefathom.com/script.js';
    document.head.appendChild(s);
  } else if (ANALYTICS.provider === 'ga4' && ANALYTICS.ga4MeasurementId) {
    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + ANALYTICS.ga4MeasurementId;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    function gtag() { window.dataLayer.push(arguments); }
    gtag('js', new Date());
    gtag('config', ANALYTICS.ga4MeasurementId);
  }
})();

// A lightweight, private return loop. Browser-local history is enough to make
// the public site feel continuous without requiring an account or transmitting
// reading behaviour to the server.
(() => {
  const KEY = 'vp_returning_home_v1';
  const HOME_PATHS = new Set(['/', '/index.html']);
  const FRIENDLY_TITLES = {
    '/books': 'The full bookshelf',
    '/paths/ai-for-business': 'AI for Business Leaders',
    '/paths/decisions': 'The SIV Method',
    '/paths/execute': 'The Execution Doctrine',
    '/paths/hire': 'Organizational Frequency',
    '/paths/evolve': 'The Signal',
    '/paths/civilization': 'Civilization',
    '/paths/blog': 'The Notebook',
    '/paths/story': 'The story of Vinay',
    '/paths/connect': 'Your conversation with AION1',
    '/paths/course': 'The AI Leadership Course',
    '/paths/find-work': 'GoodSpace for candidates',
    '/paths/career': 'Career Management',
    '/paths/fiction': 'Between Two Dawns'
  };

  const normalisePath = (value) => {
    let path = String(value || '/').split('?')[0].split('#')[0] || '/';
    if (path.length > 1) path = path.replace(/\/+$/, '').replace(/\.html$/, '');
    return path;
  };

  const readState = () => {
    try { return JSON.parse(localStorage.getItem(KEY) || 'null'); }
    catch (e) { return null; }
  };

  const readCourseAccess = () => {
    try { return JSON.parse(localStorage.getItem('abl_participant_access_v1') || 'null'); }
    catch (e) { return null; }
  };

  const safeInternalHref = (value) => {
    try {
      const url = new URL(String(value || ''), window.location.origin);
      return url.origin === window.location.origin ? url.pathname + url.search + url.hash : '';
    } catch (e) { return ''; }
  };

  const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);

  const previous = readState();
  const currentPath = normalisePath(window.location.pathname);
  const now = Date.now();

  if (document.body.classList.contains('home-redesign') && previous?.seenAt) {
    const panel = document.getElementById('returning-home');
    const grid = document.getElementById('returning-home-grid');
    const updated = document.getElementById('returning-home-updated');
    const cards = [];

    const lastPath = normalisePath(previous.lastMeaningfulPath);
    if (lastPath && !HOME_PATHS.has(lastPath)) {
      cards.push({
        label: 'Continue where you left off',
        title: previous.lastMeaningfulTitle || FRIENDLY_TITLES[lastPath] || 'Return to your last page',
        action: 'Continue →',
        href: safeInternalHref(lastPath)
      });
    }

    const course = readCourseAccess();
    const courseHref = safeInternalHref(course?.workspace);
    if (course?.token && courseHref) {
      cards.push({
        label: 'Your private course',
        title: 'Resume your AI Leadership Workspace',
        action: 'Resume →',
        href: courseHref
      });
    }

    const signalPublishedAt = Date.parse('2026-07-30T00:00:00+05:30');
    cards.push(lastPath === '/paths/evolve' ? {
      label: 'Continue exploring',
      title: 'The Notebook — essays written to be read more than once',
      action: 'Open →',
      href: '/paths/blog'
    } : {
      label: previous.seenAt < signalPublishedAt ? 'New since your last visit' : 'Latest from Vinay',
      title: 'The Signal — a field guide for thinking clearly',
      action: 'Open →',
      href: '/paths/evolve'
    });

    if (cards.length === 1 && !lastPath) {
      cards.unshift({
        label: 'Continue exploring',
        title: 'Choose the conversation closest to where you are',
        action: 'Explore →',
        href: '/#paths'
      });
    }

    if (panel && grid) {
      grid.innerHTML = cards.slice(0, 3).map((card) => `
        <a class="returning-card" href="${escapeHtml(card.href)}">
          <span class="returning-card-label">${escapeHtml(card.label)}</span>
          <strong>${escapeHtml(card.title)}</strong>
          <span class="returning-card-action">${escapeHtml(card.action)}</span>
        </a>
      `).join('');
      const elapsedDays = Math.max(0, Math.floor((now - previous.seenAt) / 86400000));
      if (updated) updated.textContent = elapsedDays > 0
        ? `Last visit ${elapsedDays} day${elapsedDays === 1 ? '' : 's'} ago`
        : 'Your place has been saved';
      panel.hidden = false;
    }
  }

  const nextState = {
    firstSeenAt: previous?.firstSeenAt || now,
    seenAt: now,
    lastMeaningfulPath: previous?.lastMeaningfulPath || '',
    lastMeaningfulTitle: previous?.lastMeaningfulTitle || ''
  };

  if (!HOME_PATHS.has(currentPath) && !currentPath.startsWith('/studio') && !currentPath.startsWith('/ai-business-leaders/login')) {
    nextState.lastMeaningfulPath = currentPath;
    nextState.lastMeaningfulTitle = FRIENDLY_TITLES[currentPath] || document.title.replace(/\s+[—|-]\s+Vinay Pasricha.*$/i, '').trim();
  }

  try { localStorage.setItem(KEY, JSON.stringify(nextState)); } catch (e) {}
})();

(function(){

  // ---------- Skip-to-content link ----------
  // Inject a hidden skip link as the first focusable element on every page,
  // so keyboard users can jump past the topbar to the main content.
  // The CSS for .skip-link is in css/site.css.
  injectSkipLink();
  function injectSkipLink() {
    if (document.querySelector('.skip-link')) return;
    // Find a sensible target: <main>, the first <section> after the topbar,
    // or fall back to the topbar itself.
    let target = document.querySelector('main, [role="main"]');
    if (!target) target = document.querySelector('.page-hero, .hero, .essay-page, .now-page, .colophon-stage, .field-stage, .s-stage');
    if (!target) return;
    if (!target.id) target.id = 'main';
    const link = document.createElement('a');
    link.className = 'skip-link';
    link.href = '#' + target.id;
    link.textContent = 'Skip to content';
    link.setAttribute('data-no-translate', 'true');
    document.body.insertBefore(link, document.body.firstChild);
  }

  // ---------- Legacy language link handler ----------
  // i18n.js now owns the language switcher and intercepts clicks
  // (sets ?lang=X and reloads). This block stays as a fallback in
  // case i18n.js fails to load, so the language menu still does
  // SOMETHING.
  const SUPPORTED = ['en','hi','bn','ta','te','kn','es','fr','pt','ja','zh','ko','ru'];
  const langLinks = document.querySelectorAll('.lang-menu a');
  langLinks.forEach(a => a.addEventListener('click', () => {
    try {
      const code = a.querySelector('.code')?.textContent?.toLowerCase();
      if (code && SUPPORTED.includes(code)) localStorage.setItem('preferredLang', code);
    } catch (e) {}
  }));

  // ---------- Topbar shadow on scroll ----------
  const topbar = document.querySelector('.topbar');
  if (topbar) {
    const update = () => topbar.classList.toggle('scrolled', window.scrollY > 8);
    update();
    window.addEventListener('scroll', update, { passive: true });
  }

  // ---------- Signal × Spacetime amber section dividers ----------
  // Each separator receives one left-to-right pulse the first time it enters
  // view. Reduced-motion visitors keep the static amber hairline.
  const amberDividers = document.querySelectorAll('.brand-section-divider');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (amberDividers.length && !reduceMotion.matches) {
    const dividerObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-pulsing');
        dividerObserver.unobserve(entry.target);
      });
    }, { threshold: 0.15 });
    amberDividers.forEach((divider) => dividerObserver.observe(divider));
  }

  // ---------- Language switcher ----------
  const langSwitch = document.querySelector('.lang-switch');
  if (langSwitch) {
    const btn = langSwitch.querySelector('.lang-btn');
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      langSwitch.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (!langSwitch.contains(e.target)) langSwitch.classList.remove('open');
    });
  }

  // ---------- Site-root resolver ----------
  // Returns the relative prefix ('', '../', '../../', …) from the current
  // page back to the site root, based on the known first-level directories.
  // Works from /paths/, /signal/, /studio/, /frequency/, /library/ and
  // nested dirs like /runtime/sequence/.
  function siteRootPrefix() {
    const KNOWN = ['paths', 'signal', 'studio', 'frequency', 'runtime', 'library'];
    const dir = window.location.pathname.replace(/[^/]*$/, '');
    const segs = dir.split('/').filter(Boolean);
    for (let i = 0; i < segs.length; i++) {
      if (KNOWN.includes(segs[i])) return '../'.repeat(segs.length - i);
    }
    return '';
  }

  // ---------- "Now" rotator ----------
  // Cycles through Vinay's current preoccupations on a slow loop.
  // Items load from assets/data/now.json (Studio → Now editor); the
  // hardcoded items in each page's HTML remain as offline fallback.
  initNowRotator();
  injectPrivacyLink();

  // ---------- Privacy link ----------
  // Add a discreet "Privacy" link to every page footer (footers are static
  // per page, so we inject site-wide here rather than editing each one).
  function injectPrivacyLink() {
    const href = siteRootPrefix() + 'privacy';
    document.querySelectorAll('.foot-right').forEach((fr) => {
      if (fr.querySelector('.foot-privacy')) return;
      const a = document.createElement('a');
      a.className = 'foot-privacy';
      a.href = href;
      a.textContent = 'Privacy';
      fr.appendChild(a);
    });
  }

  async function initNowRotator() {
    const rotator = document.querySelector('.now-rotator');
    if (!rotator) return;

    // Try to load items from Studio drafts → published now.json → fallback to inline
    const items = await loadNowItems();
    if (items && items.length) {
      // Replace inline items with the loaded ones
      rotator.innerHTML = items.map(it => {
        const verb = String(it.verb || '').trim();
        const subject = String(it.subject || '').trim();
        return `<span class="item">${escNow(verb)} <em style="font-family:var(--serif);font-style:italic;text-transform:none;letter-spacing:0;font-size:13px;margin-left:4px">${escNow(subject)}</em></span>`;
      }).join('');
    }

    const itemEls = rotator.querySelectorAll('.item');
    if (!itemEls.length) return;
    let i = 0;
    itemEls[0].classList.add('active');
    if (itemEls.length === 1) return;
    setInterval(() => {
      itemEls[i].classList.remove('active');
      i = (i + 1) % itemEls.length;
      itemEls[i].classList.add('active');
    }, 3800);
  }

  function escNow(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function loadNowItems() {
    try {
      const draft = localStorage.getItem('studio.now');
      if (draft) {
        const d = JSON.parse(draft);
        if (Array.isArray(d.items)) return d.items;
      }
    } catch (e) {}
    try {
      // Path-resolve assets/data/now.json from any depth
      const url = siteRootPrefix() + 'assets/data/now.json';
      const res = await fetch(url, { cache: 'no-cache' });
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d.items)) return d.items;
      }
    } catch (e) {}
    return null;
  }

  // ---------- Course ribbon ----------
  // A live cohort is running: participants must find their workspace door
  // above the fold on every page. Injected site-wide; hidden inside the
  // workspace itself. The [data-course-entry] hook below routes returning
  // participants straight to their saved workspace.
  injectCourseRibbon();

  function injectCourseRibbon() {
    if (/^\/(ai-business-leaders|studio)(\/|$)/.test(window.location.pathname)) return;
    if (document.querySelector('.course-ribbon')) return;
    const root = siteRootPrefix();
    const ribbon = document.createElement('a');
    ribbon.className = 'course-ribbon';
    ribbon.href = root + 'ai-business-leaders/login';
    ribbon.setAttribute('data-course-entry', '');
    ribbon.innerHTML =
      '<span class="cr-dot" aria-hidden="true"></span>' +
      '<span class="cr-cohort">Live cohort · AI for Business Leaders</span>' +
      '<strong data-course-entry-label>Course participants — enter your workspace </strong>' +
      '<span class="cr-arrow" aria-hidden="true">→</span>';
    document.body.insertBefore(ribbon, document.body.firstChild);
  }

  // ---------- Topbar nav ----------
  // The five primary destinations, visible on every page without opening the
  // Index. Injected so each static page stays single-source.
  injectTopbarNav();

  function injectTopbarNav() {
    const right = document.querySelector('.topbar .right');
    if (!right || right.querySelector('.topbar-nav')) return;
    const root = siteRootPrefix();
    const links = [
      { href: root + 'books', match: /^\/books/, label: 'Books' },
      { href: root + 'paths/course', match: /\/paths\/course/, label: 'Course' },
      { href: root + 'paths/blog', match: /\/paths\/(blog|essay)/, label: 'Notebook' },
      { href: root + 'paths/story', match: /\/paths\/story/, label: 'Story' },
      { href: root + 'paths/connect', match: /\/paths\/connect/, label: 'Connect' },
    ];
    const nav = document.createElement('nav');
    nav.className = 'topbar-nav';
    nav.setAttribute('aria-label', 'Primary');
    nav.innerHTML = links.map((l) => {
      const active = l.match.test(window.location.pathname);
      return '<a href="' + l.href + '"' + (active ? ' aria-current="page"' : '') + '>' + l.label + '</a>';
    }).join('');
    right.insertBefore(nav, right.firstChild);
  }

  // ---------- Index overlay ----------
  // Inject the overlay markup if the page didn't include it.
  injectIndexOverlay();
  const indexBtn = document.querySelector('.index-btn');
  const indexOverlay = document.querySelector('.index-overlay');
  const indexClose = document.querySelector('.ix-close');
  if (indexBtn && indexOverlay) {
    indexBtn.addEventListener('click', () => {
      indexOverlay.classList.add('open');
      document.body.style.overflow = 'hidden';
    });
    indexClose?.addEventListener('click', () => {
      indexOverlay.classList.remove('open');
      document.body.style.overflow = '';
    });
    // Click outside the columns to close
    indexOverlay.addEventListener('click', (e) => {
      if (e.target === indexOverlay) {
        indexOverlay.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  }

  function injectIndexOverlay() {
    if (document.querySelector('.index-overlay')) return; // already present
    // Resolve the relative prefix back to the site root from any depth.
    const root = siteRootPrefix();
    const html = `
      <div class="index-overlay">
        <div class="ix-top">
          <div style="font-family:var(--mono);font-size:10px;letter-spacing:0.22em;text-transform:uppercase;color:var(--ink-3)">Everything on this site</div>
          <button class="ix-close" aria-label="Close index">
            <span>Close</span><span class="x">×</span>
          </button>
        </div>
        <div class="ix-cols">
          <div>
            <h5>The books</h5>
            <ul>
              <li><a href="${root}books"><em>All books</em> &middot; the shelf</a></li>
              <li><a href="${root}paths/ai-for-business">AI for <em>Business Leaders</em></a></li>
              <li><a href="${root}paths/decisions">The <em>SIV Method</em></a></li>
              <li><a href="${root}paths/execute">The <em>Execution Doctrine</em></a></li>
              <li><a href="${root}paths/hire"><em>Organizational Frequency</em></a></li>
              <li><a href="${root}paths/evolve">The <em>Signal</em></a></li>
              <li><a href="${root}paths/civilization"><em>Civilization</em></a></li>
            </ul>
          </div>
          <div>
            <h5>The runtimes</h5>
            <ul>
              <li><a href="${root}frequency/"><em>Organizational Frequency</em> &middot; capture a mission</a></li>
              <li><a href="${root}frequency/company"><em>Company Frequency</em> &middot; public profile</a></li>
              <li><a href="${root}frequency/person"><em>Discover a person</em></a></li>
              <li><a href="${root}runtime/"><em>KAIROS</em> &middot; the runtime</a></li>
              <li><a href="${root}runtime/architecture">KAIROS <em>architecture</em></a></li>
              <li><a href="${root}signal/">The <em>Signal</em> field</a></li>
            </ul>
          </div>
          <div>
            <h5>Read &middot; Watch &middot; Try</h5>
            <ul>
              <li><a href="${root}paths/watch"><em>Watch</em> &middot; videos &amp; talks</a></li>
              <li><a href="${root}paths/decisions#begin">Try <em>SIV</em> on a decision</a></li>
              <li><a href="${root}paths/blog">Monthly <em>notebook</em></a></li>
              <li><a href="${root}paths/essay">The <em>essay</em></a></li>
              <li><a href="${root}paths/fiction"><em>Fiction</em></a></li>
              <li><a href="${root}paths/faq"><em>FAQ</em></a></li>
            </ul>
          </div>
          <div>
            <h5>Vinay</h5>
            <ul>
              <li><a href="${root}paths/story">The <em>story</em></a></li>
              <li><a href="${root}paths/connect">Connect <em>directly</em></a></li>
              <li><a href="${root}paths/course">AI Leadership <em>Course</em></a></li>
              <li><a href="${root}paths/career">Career <em>inflection</em></a></li>
              <li><a href="${root}paths/find-work">Find <em>work</em></a></li>
              <li><a href="${root}paths/now"><em>Now</em> &middot; what I'm doing</a></li>
            </ul>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
  }

  // Esc closes whatever is open
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      langSwitch?.classList.remove('open');
      if (indexOverlay?.classList.contains('open')) {
        indexOverlay.classList.remove('open');
        document.body.style.overflow = '';
      }
    }
  });

  // The course banner is a single stable doorway. Returning participants go
  // straight back to their saved workspace; everyone else sees passwordless
  // email sign-in. The login page revalidates expired access.
  document.querySelectorAll('[data-course-entry]').forEach((entry) => {
    try {
      const saved = JSON.parse(localStorage.getItem('abl_participant_access_v1') || 'null');
      if (saved?.token && saved?.workspace) {
        entry.href = saved.workspace;
        const label = entry.querySelector('[data-course-entry-label]');
        if (label) label.childNodes[0].nodeValue = 'Return to Your Course Workspace ';
      }
    } catch (e) {}
  });
})();
