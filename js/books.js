/* =============================================================
   books.js — book matrix landing page
   =============================================================
   Single source of truth for the books. Add a new book by adding
   a new object to BOOKS. The page renders itself from this array.

   Conversion intent:
   - Default language is English.
   - A global language picker at the top sets the language label
     across all "Buy on Amazon" CTAs.
   - Each book card has a per-book override (small chip) for
     readers who want a different language than the global default.
   - The "lead" book (set via ?lead=<slug>) gets featured treatment
     at the top — for routing video traffic to a specific book.

   Update workflow:
   - Edit BOOKS below to add/remove/reorder books.
   - Edit LANGUAGES to add/remove available languages.
   - Edit the Amazon URL per book when a new edition is released.
   ============================================================= */

const LANGUAGES = [
  { code: 'en', native: 'English',    english: 'English'    },
  { code: 'hi', native: 'हिंदी',        english: 'Hindi'      },
  { code: 'bn', native: 'বাংলা',        english: 'Bengali'    },
  { code: 'ta', native: 'தமிழ்',        english: 'Tamil'      },
  { code: 'te', native: 'తెలుగు',        english: 'Telugu'     },
  { code: 'kn', native: 'ಕನ್ನಡ',         english: 'Kannada'    },
  { code: 'mr', native: 'मराठी',         english: 'Marathi'    },
  { code: 'es', native: 'Español',    english: 'Spanish'    },
  { code: 'fr', native: 'Français',   english: 'French'     },
  { code: 'de', native: 'Deutsch',    english: 'German'     },
  { code: 'nl', native: 'Nederlands', english: 'Dutch'      },
  { code: 'pt', native: 'Português',  english: 'Portuguese' },
  { code: 'ja', native: '日本語',       english: 'Japanese'   },
  { code: 'zh', native: '中文',         english: 'Chinese'    },
  { code: 'ko', native: '한국어',        english: 'Korean'     },
  { code: 'ru', native: 'Русский',    english: 'Russian'    },
];

const DEFAULT_BOOKS = [
  {
    slug: 'ai-for-business-leaders',
    volume: 'I',
    title: 'AI for Business Leaders',
    subtitle: 'A clear-headed guide to leading with AI without losing the plot.',
    cover: 'assets/images/ai-for-business-leaders-cover-front.jpg',
    year: '2025',
    pages: 208,
    isbn: '978-0-9978459-1-4',
    status: 'published',
    pitch: 'Most leadership advice on AI is either a sales pitch or a panic attack. This is neither — a structured way of thinking for executives who must move now but want to move clearly.',
    topics: [
      'When to deploy AI — and when not to',
      'The leader\u2019s real responsibility in an AI-native company',
      'What changes inside teams once AI joins them',
      'Strategy without hype: questions before answers',
    ],
    amazon: 'https://www.amazon.in/dp/B0GFXXPGP7',
    excerpt_path: 'paths/ai-for-business',
  },
  {
    slug: 'siv-method',
    volume: 'II',
    title: 'The SIV Method',
    subtitle: 'A Brutal Framework for Understanding Reality Before Execution.',
    cover: 'assets/images/siv-method-cover-front.jpg',
    year: '2026',
    pages: 96,
    isbn: '978-0-9978459-2-1',
    status: 'published',
    pitch: 'Most failure begins not in action but in misunderstanding. SIV is a structured method for examining reality through multiple lenses, applying Socratic pressure to every claim, and converging toward an integrated understanding strong enough to support action.',
    topics: [
      'Why most decisions fail before they begin',
      'Eight steps from premature conviction to earned understanding',
      'How to generate lenses fresh from the issue, not from a checklist',
      'The discipline of separating confidence from certainty',
    ],
    amazon: 'https://www.amazon.in/dp/B0GX27LGJX',
    amazon_by_lang: {
      en: 'https://www.amazon.in/dp/B0GX27LGJX',
      pt: 'https://www.amazon.com.br/dp/B0H2YW65Q5',
      de: 'https://www.amazon.nl/dp/B0H2Z5KCD9',
      fr: 'https://www.amazon.fr/dp/B0GZJ3TC55',
      nl: 'https://www.amazon.nl/dp/B0H2Z27YNL',
      ja: 'https://www.amazon.co.jp/dp/B0H2Z2VX5K',
      mr: 'https://www.amazon.in/dp/B0H2Z9MM8Q',
      ta: 'https://www.amazon.in/dp/B0H2Z9CZHX',
    },
    excerpt_path: 'paths/decisions',
    try_it: { label: 'Try the method', url: 'paths/decisions#begin' },
  },
  {
    slug: 'execution-doctrine',
    volume: 'III',
    title: 'The Execution Doctrine',
    subtitle: 'From understanding to applied force in the world.',
    cover: 'assets/images/execution-doctrine-cover-front.jpg',
    year: '2026',
    pages: 128,
    isbn: '978-0-9978459-3-8',
    status: 'published',
    pitch: 'SIV produces understanding. The Execution Doctrine applies it. Most execution failures are not failures of will — they are failures of design. A field manual for operators who want to be apt rather than merely fast.',
    topics: [
      'How to detect the real constraint, not the loudest one',
      'Why momentum is more valuable than motivation',
      'Sequencing actions when everything feels urgent',
      'The handoff from thinking to doing — and back',
    ],
    amazon: 'https://www.amazon.in/dp/B0GXVLX2G9',
    amazon_by_lang: {
      en: 'https://www.amazon.in/dp/B0GXVLX2G9',
      es: 'https://www.amazon.es/dp/B0GX2XVYP6',
      pt: 'https://www.amazon.com.br/dp/B0H2XZBSFF',
      de: 'https://www.amazon.nl/dp/B0H2Z2TN9K',
      fr: 'https://www.amazon.fr/dp/B0H2XFJW4M',
      hi: 'https://www.amazon.in/dp/B0GX8F2CPX',
      ta: 'https://www.amazon.in/dp/B0H26GYQD2',
    },
    excerpt_path: 'paths/execute',
  },
  {
    slug: 'organizational-frequency',
    volume: 'IV',
    title: 'Organizational Frequency',
    subtitle: 'A new doctrine for hiring in the age of intelligent discovery.',
    cover: 'assets/images/organizational-frequency-cover-front.jpg',
    year: '2026',
    pages: null,
    isbn: '978-1-7385942-0-3',
    status: 'published',
    pitch: 'Hiring is not convincing people to fit somewhere. It is discovering where they already belong. Every company carries a frequency. Every person carries their own. Great performance happens when the two resonate — most bad hires are not bad people; they are mismatched frequencies, miscast in the wrong environment.',
    topics: [
      'Why the resume-and-interview model is structurally broken',
      'Understand \u2014 discover \u2014 validate \u2014 grow: the four-stage doctrine',
      'How intelligent discovery replaces gut-feel hiring',
      'Building a frequency-aware talent operating system',
    ],
    amazon: 'https://www.amazon.in/dp/B0H2NTL3XS',
    amazon_by_lang: {
      en: 'https://www.amazon.in/dp/B0H2NTL3XS',
    },
    excerpt_path: 'paths/hire',
    series: 'A Doctrine for the Future of Work · 01',
  },
  {
    slug: 'the-signal',
    volume: 'V',
    title: 'The Signal',
    subtitle: 'A Practice for Clearer Reception.',
    cover: 'assets/images/the-signal-cover-front.jpg',
    year: '2026',
    pages: null,
    isbn: null,
    status: 'published',
    pitch: 'We live inside an information density no prior generation has had to navigate. The Signal is a cognitive instrument for sustained attention in noisy environments — recursive, longitudinal, the most personal of the books. A practice for clearer reception of what is actually being signalled, beneath the noise.',
    topics: [
      'How signal degrades and where to find it again',
      'Building a personal information diet that compounds',
      'Long-form attention in short-form attention environments',
      'The reader\u2019s discipline in an age of the feed',
    ],
    amazon: 'https://www.amazon.in/dp/B0H3WJJH3S',
    excerpt_path: 'signal/',
  },
  {
    slug: 'civilization',
    volume: 'VI',
    title: 'Civilization',
    subtitle: 'A framework for evaluating the direction of intelligent civilizations.',
    cover: 'assets/images/civilization-cover-front.jpg',
    year: '2026',
    pages: null,
    isbn: null,
    status: 'published',
    pitch: 'Intelligence does not evolve at random. Beneath the chaos of history runs a hidden order — eight directions every enduring civilization is pulled along. Civilization builds a compass, not a map: a reference frame for telling progress from mere motion, and for measuring any serious vision of the future.',
    topics: [
      'The four tests every candidate direction had to survive',
      'Four Foundations and four Frontiers — the eight directions of intelligence',
      'Why a compass outlasts every map of the future',
      'Reading Rome, China, modernity, and AI through one framework',
    ],
    amazon: 'https://www.amazon.in/dp/B0H4GWZND6',
    excerpt_path: 'paths/civilization',
    series: 'Civilization',
    publisher: 'The Meridian Press',
  },
  // To add more upcoming books, copy a book object above and edit.
  // Example:
  // {
  //   slug: 'civilisation-lab',
  //   volume: 'V',
  //   title: 'Civilisation Lab',
  //   subtitle: '...',
  //   status: 'upcoming',
  //   year: '2027',
  //   ...
  // },
];

let BOOKS = DEFAULT_BOOKS;

async function loadBooks() {
  // Studio drafts (localStorage 'studio.books') take precedence so you can preview.
  try {
    const draft = localStorage.getItem('studio.books');
    if (draft) {
      const d = JSON.parse(draft);
      if (Array.isArray(d.books)) return d.books;
    }
  } catch (e) {}
  // Published file
  try {
    const res = await fetch('assets/data/books.json', { cache: 'no-cache' });
    if (res.ok) {
      const d = await res.json();
      if (Array.isArray(d.books)) return d.books;
    }
  } catch (e) {}
  return DEFAULT_BOOKS;
}


/* ============================================================
   STATE
   ============================================================ */
const LANG_KEY = 'preferredBookLang';

let pageState = {
  globalLang: 'en',
  bookLangs: {},   // per-book override: { 'siv-method': 'hi' }
  leadSlug: null,
};

function loadPageState() {
  try {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored && LANGUAGES.find(l => l.code === stored)) {
      pageState.globalLang = stored;
    }
  } catch (e) {}
  // Lead book from ?lead= param
  const params = new URLSearchParams(window.location.search);
  const lead = params.get('lead');
  if (lead && BOOKS.find(b => b.slug === lead)) {
    pageState.leadSlug = lead;
  }
}

function setGlobalLang(code) {
  if (!LANGUAGES.find(l => l.code === code)) return;
  pageState.globalLang = code;
  try { localStorage.setItem(LANG_KEY, code); } catch (e) {}
  renderAll();
}

function setBookLang(slug, code) {
  if (!LANGUAGES.find(l => l.code === code)) return;
  pageState.bookLangs[slug] = code;
  renderBookCards(); // local re-render is enough
}

function getBookLang(slug) {
  return pageState.bookLangs[slug] || pageState.globalLang;
}

// Per-language Amazon URL with English/canonical fallback.
function amazonURL(book, lang) {
  if (!book) return null;
  if (book.amazon_by_lang && book.amazon_by_lang[lang]) return book.amazon_by_lang[lang];
  return book.amazon;
}

function langInfo(code) {
  return LANGUAGES.find(l => l.code === code) || LANGUAGES[0];
}


/* ============================================================
   RENDER
   ============================================================ */
function renderAll() {
  renderGlobalLangPicker();
  renderBookCards();
  // Translate dynamic content if we're not in English
  window.i18n?.refresh();
}

function renderGlobalLangPicker() {
  const host = document.getElementById('global-lang-picker');
  if (!host) return;
  const current = langInfo(pageState.globalLang);
  host.innerHTML = `
    <span class="gl-label">Show buy links in</span>
    <div class="gl-select-wrap">
      <select id="global-lang-select" class="gl-select" aria-label="Choose language for all buy links">
        ${LANGUAGES.map(l => `
          <option value="${l.code}" ${l.code === pageState.globalLang ? 'selected' : ''}>
            ${l.native}${l.code !== 'en' ? ' · ' + l.english : ''}
          </option>
        `).join('')}
      </select>
      <span class="gl-display">
        <span class="gl-native">${current.native}</span>
        <span class="gl-caret">▾</span>
      </span>
    </div>
  `;
  document.getElementById('global-lang-select').addEventListener('change', e => {
    setGlobalLang(e.target.value);
  });
}

function orderedBooks() {
  if (!pageState.leadSlug) return BOOKS.slice();
  const lead = BOOKS.find(b => b.slug === pageState.leadSlug);
  if (!lead) return BOOKS.slice();
  const rest = BOOKS.filter(b => b.slug !== pageState.leadSlug);
  return [lead, ...rest];
}

function renderBookCards() {
  const host = document.getElementById('books-matrix');
  if (!host) return;

  const books = orderedBooks();
  const leadBook = pageState.leadSlug ? books[0] : null;
  const restBooks = leadBook ? books.slice(1) : books;

  let html = '';

  // Featured (lead) book
  if (leadBook) {
    html += renderFeaturedBook(leadBook);
  }

  // Section heading for the rest
  if (restBooks.length > 0) {
    html += `
      <div class="books-grid-head">
        <span class="bgh-label">${leadBook ? '— Also available' : `— The ${numToWord(BOOKS.length)} books`}</span>
      </div>
    `;
    html += '<div class="books-grid">';
    restBooks.forEach(book => {
      html += renderBookCard(book);
    });
    html += '</div>';
  }

  host.innerHTML = html;
  wireBookCards();
}

function renderFeaturedBook(book) {
  const lang = getBookLang(book.slug);
  const langData = langInfo(lang);
  const isUpcoming = book.status === 'upcoming';

  return `
    <article class="book-featured" data-slug="${book.slug}">
      <div class="bf-flag">
        <span class="bf-flag-dot"></span>
        <span class="bf-flag-text">Featured</span>
      </div>
      <div class="bf-grid">
        <div class="bf-cover">
          ${book.cover
            ? `<img src="${book.cover}" alt="${escapeHTML(book.title)} cover">`
            : `<div class="bf-cover-placeholder">
                 <span class="bcp-status">Upcoming</span>
                 <span class="bcp-title">${escapeHTML(book.title)}</span>
               </div>`
          }
        </div>
        <div class="bf-info">
          <div class="bf-meta">
            <span>${book.year}</span>
            ${book.pages ? `<span class="dot">·</span><span>${book.pages} pages</span>` : ''}
            ${book.isbn ? `<span class="dot">·</span><span>ISBN ${book.isbn}</span>` : ''}
          </div>
          <h2 class="bf-title">${escapeHTML(book.title)}<em>.</em></h2>
          <p class="bf-subtitle">${escapeHTML(book.subtitle)}</p>
          <p class="bf-pitch">${escapeHTML(book.pitch)}</p>
          <ul class="bf-topics">
            ${book.topics.map(t => `<li>${escapeHTML(t)}</li>`).join('')}
          </ul>
          <div class="bf-actions">
            ${isUpcoming
              ? renderNotifyButton(book)
              : (book.amazon
                ? `<a class="bf-buy" href="${amazonURL(book, lang)}" target="_blank" rel="noopener" data-slug="${book.slug}">
                   <span class="bf-buy-main">Buy on Amazon</span>
                   <span class="bf-buy-lang">in ${langData.native}</span>
                   <span class="bf-buy-arrow">↗</span>
                 </a>`
                : '')}
            ${book.try_it
              ? `<a class="bf-try" href="${book.try_it.url}">
                   ${escapeHTML(book.try_it.label)} <span class="arrow">→</span>
                 </a>`
              : (book.excerpt_path
                ? `<a class="bf-try" href="${book.excerpt_path}">
                     Read the chapter on this <span class="arrow">→</span>
                   </a>` : '')
            }
          </div>
          ${!isUpcoming && book.amazon ? renderBookLangChip(book) : ''}
        </div>
      </div>
    </article>
  `;
}

function renderBookCard(book) {
  const lang = getBookLang(book.slug);
  const langData = langInfo(lang);
  const isUpcoming = book.status === 'upcoming';

  return `
    <article class="book-card-v2 ${isUpcoming ? 'upcoming' : ''}" data-slug="${book.slug}">
      <div class="bc-cover">
        ${book.cover
          ? `<img src="${book.cover}" alt="${escapeHTML(book.title)} cover">`
          : `<div class="bc-cover-placeholder">
               <span class="bcp-status">Upcoming</span>
               <span class="bcp-title">${escapeHTML(book.title)}</span>
             </div>`
        }
      </div>
      <div class="bc-body">
        <div class="bc-meta">
          <span>${book.year}</span>
          ${book.pages ? `<span class="dot">·</span><span>${book.pages}p</span>` : ''}
        </div>
        <h3 class="bc-title">${escapeHTML(book.title)}<em>.</em></h3>
        <p class="bc-subtitle">${escapeHTML(book.subtitle)}</p>
        <p class="bc-pitch">${escapeHTML(book.pitch)}</p>
        <div class="bc-actions">
          ${isUpcoming
            ? renderNotifyButton(book)
            : (book.amazon
              ? `<a class="bc-buy" href="${amazonURL(book, lang)}" target="_blank" rel="noopener" data-slug="${book.slug}">
                 <span>Buy on Amazon</span>
                 <span class="bc-buy-lang">${langData.native}</span>
                 <span class="bc-buy-arrow">↗</span>
               </a>`
              : '')}
          ${book.excerpt_path && !isUpcoming
            ? `<a class="bc-excerpt" href="${book.excerpt_path}">Read about this book <span class="arrow">→</span></a>`
            : ''
          }
        </div>
        ${!isUpcoming && book.amazon ? renderBookLangChip(book) : ''}
      </div>
    </article>
  `;
}

function renderBookLangChip(book) {
  const lang = getBookLang(book.slug);
  const isOverridden = pageState.bookLangs[book.slug] && pageState.bookLangs[book.slug] !== pageState.globalLang;
  return `
    <div class="bc-lang-chip" data-slug="${book.slug}">
      <label>
        <span class="chip-label">Language:</span>
        <select class="chip-select" data-slug="${book.slug}" aria-label="Language for ${escapeHTML(book.title)} purchase">
          ${LANGUAGES.map(l => `
            <option value="${l.code}" ${l.code === lang ? 'selected' : ''}>${l.native}</option>
          `).join('')}
        </select>
      </label>
      ${isOverridden ? `<button class="chip-reset" data-slug="${book.slug}" type="button" aria-label="Reset to global language">reset</button>` : ''}
    </div>
  `;
}

function renderNotifyButton(book) {
  return `
    <button class="bc-notify" type="button" data-slug="${book.slug}">
      <span>Notify me when published</span>
      <span class="arrow">→</span>
    </button>
  `;
}

function wireBookCards() {
  // Per-book language overrides
  document.querySelectorAll('.chip-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      setBookLang(e.target.dataset.slug, e.target.value);
    });
  });
  document.querySelectorAll('.chip-reset').forEach(btn => {
    btn.addEventListener('click', (e) => {
      delete pageState.bookLangs[e.target.dataset.slug];
      renderBookCards();
    });
  });
  // Notify buttons (upcoming books)
  document.querySelectorAll('.bc-notify').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const slug = e.currentTarget.dataset.slug;
      handleNotify(slug, e.currentTarget);
    });
  });
}

function handleNotify(slug, btn) {
  const email = prompt('Drop your email — we\u2019ll let you know when this book is available.');
  if (!email) return;
  // For v1 — store locally. Backend can ship it to a real list later.
  // Shape: notifyEmails = { <slug>: [{ email, capturedAt, source }, ...] }
  // Legacy plain-string entries are normalised on read.
  try {
    const key = 'notifyEmails';
    const existing = JSON.parse(localStorage.getItem(key) || '{}');
    existing[slug] = (existing[slug] || []).map(e => typeof e === 'string' ? { email: e, capturedAt: null, source: 'books.js' } : e);
    if (!existing[slug].find(e => e.email === email)) {
      existing[slug].push({ email, capturedAt: Date.now(), source: 'books.js · ' + slug });
    }
    localStorage.setItem(key, JSON.stringify(existing));
  } catch (e) {}
  btn.innerHTML = '<span>You\u2019re on the list ✓</span>';
  btn.disabled = true;
  btn.classList.add('notified');
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

// Small integers → English words, so section labels read naturally
// regardless of how the bookshelf grows over the years.
function numToWord(n) {
  const words = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
  return words[n] || String(n);
}


/* ============================================================
   INIT
   ============================================================ */
function init() {
  loadPageState();
  loadBooks().then(books => {
    BOOKS = books;
    renderAll();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
