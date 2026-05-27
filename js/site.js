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

  // ---------- "Now" rotator ----------
  // Cycles through Vinay's current preoccupations on a slow loop.
  // Items load from assets/data/now.json (Studio → Now editor); the
  // hardcoded items in each page's HTML remain as offline fallback.
  initNowRotator();

  async function initNowRotator() {
    const rotator = document.querySelector('.now-rotator');
    if (!rotator) return;

    // Try to load items from Studio drafts → published now.json → fallback to inline
    const items = await loadNowItems();
    if (items && items.length) {
      // Replace inline items with the loaded ones
      const inPaths = /\/paths\//.test(window.location.pathname) || /\/signal\//.test(window.location.pathname) || /\/studio\//.test(window.location.pathname);
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
      const inPaths = /\/paths\//.test(window.location.pathname) || /\/signal\//.test(window.location.pathname) || /\/studio\//.test(window.location.pathname);
      const url = (inPaths ? '../' : '') + 'assets/data/now.json';
      const res = await fetch(url, { cache: 'no-cache' });
      if (res.ok) {
        const d = await res.json();
        if (Array.isArray(d.items)) return d.items;
      }
    } catch (e) {}
    return null;
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
    // Pages under /paths/ need '../' to reach root; everything else uses './'.
    const inPaths = /\/paths\//.test(window.location.pathname);
    const root = inPaths ? '../' : '';
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
              <li><a href="${root}books.html"><em>All books</em> &middot; 13 languages</a></li>
              <li><a href="${root}paths/ai-for-business.html">AI for <em>Business Leaders</em></a></li>
              <li><a href="${root}paths/decisions.html">The <em>SIV Method</em></a></li>
              <li><a href="${root}paths/execute.html">The <em>Execution Doctrine</em></a></li>
              <li><a href="${root}paths/hire.html"><em>Organizational Frequency</em></a></li>
              <li><a href="${root}paths/evolve.html">The <em>Signal</em> &middot; upcoming</a></li>
            </ul>
          </div>
          <div>
            <h5>Watch &middot; Read &middot; Try</h5>
            <ul>
              <li><a href="${root}paths/watch.html"><em>Watch</em> &middot; videos &amp; talks</a></li>
              <li><a href="${root}paths/decisions.html#begin">Try <em>SIV</em> on a decision</a></li>
              <li><a href="${root}books.html"><em>The bookshelf</em></a></li>
            </ul>
          </div>
          <div>
            <h5>Vinay</h5>
            <ul>
              <li><a href="${root}paths/story.html">The <em>story</em></a></li>
              <li><a href="${root}paths/connect.html">Connect <em>directly</em></a></li>
              <li><a href="${root}paths/course.html">AI Leadership <em>Course</em></a></li>
              <li><a href="${root}paths/blog.html">Monthly <em>notebook</em></a></li>
              <li><a href="${root}paths/career.html">Career <em>inflection</em></a></li>
              <li><a href="${root}paths/find-work.html">Find <em>work</em></a></li>
              <li><a href="${root}paths/now.html"><em>Now</em> &middot; what I'm doing</a></li>
              <li><a href="${root}paths/faq.html"><em>FAQ</em></a></li>
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
})();
