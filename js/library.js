/* =============================================================
   library.js — in-page access to book manuscripts
   =============================================================
   Lets any page on the site ask Vinay's books a question on
   behalf of a reader. The full manuscript of each book lives in
   /library/<slug>/full-text.txt; the manifest in
   /library/manifest.json says which slug maps to which file.

   Usage:
     const book = await window.library.getBook('execution-doctrine');
     // -> { slug, title, text, chars, pages, chapters, ... }

     const answer = await window.library.ask('execution-doctrine',
       'What does the doctrine say about strengthening the human bottleneck?');
     // -> string (Claude's reply, grounded in the manuscript)

   The "ask" helper feeds the manuscript to window.claude.complete as
   context, so AI replies stay grounded in what Vinay actually wrote
   rather than the model's training. Output is capped at 1024 tokens
   by the host — keep questions focused.

   Path-aware: works from /books.html, /paths/*.html, /signal/*.html
   without changes — figures out the relative prefix at load time.
   ============================================================= */
(function () {
  // Walk up from the current page to find the site root (the folder
  // that contains library/manifest.json). Cap at 4 hops.
  function rootPrefix() {
    // Count directory levels deep from the site root. Clean URLs can be either
    // a file (/paths/decisions) or a directory (/runtime/sequence/), so the last
    // path segment only counts as a "directory" when the path ends in a slash.
    const path = window.location.pathname;
    const segs = path.split('/').filter(Boolean);
    const depth = path.endsWith('/') ? segs.length : Math.max(0, segs.length - 1);
    if (depth <= 0) return '';
    return '../'.repeat(Math.min(depth, 4));
  }
  const ROOT = rootPrefix();

  let manifestPromise = null;
  const textCache = {};

  function loadManifest() {
    if (manifestPromise) return manifestPromise;
    manifestPromise = fetch(ROOT + 'library/manifest.json', { cache: 'no-cache' })
      .then(r => r.ok ? r.json() : { books: {} })
      .catch(() => ({ books: {} }));
    return manifestPromise;
  }

  async function getBook(slug) {
    const mf = await loadManifest();
    const entry = mf.books && mf.books[slug];
    if (!entry) return null;
    if (!entry.text_path) {
      // Manuscript not yet uploaded — return metadata only
      return { ...entry, text: null };
    }
    if (textCache[slug]) {
      return { ...entry, text: textCache[slug] };
    }
    try {
      const res = await fetch(ROOT + entry.text_path, { cache: 'force-cache' });
      if (!res.ok) return { ...entry, text: null };
      const text = await res.text();
      textCache[slug] = text;
      return { ...entry, text };
    } catch (e) {
      return { ...entry, text: null };
    }
  }

  async function listBooks() {
    const mf = await loadManifest();
    return Object.values(mf.books || {});
  }

  // Ground a question against a book's manuscript via window.claude.complete.
  // The book text is large (~24k tokens for the Execution Doctrine) — fine
  // for Haiku's 200k input, but we still try to focus the model with a
  // discipline-driven system message in the spirit of the doctrines.
  async function ask(slug, question, opts = {}) {
    if (!window.claude || typeof window.claude.complete !== 'function') {
      throw new Error('library.ask: window.claude.complete not available on this page.');
    }
    const book = await getBook(slug);
    if (!book) throw new Error('library.ask: unknown book "' + slug + '".');
    if (!book.text) {
      return (
        'The manuscript for "' + (book.title || slug) + '" has not been uploaded ' +
        'into the library yet — so I can\'t answer from the actual text. ' +
        'Once Vinay adds it, this question will get a grounded reply.'
      );
    }

    const system =
      'You are a careful reading companion to Vinay Pasricha\'s book "' + book.title + '"' +
      (book.subtitle ? ' (' + book.subtitle + ')' : '') + '. ' +
      'A reader is on Vinay\'s website and has asked a question. ' +
      'Answer ONLY from the manuscript provided below. ' +
      'Quote sparingly, in quotation marks, never more than ~25 words at a time. ' +
      'If the manuscript does not address the question, say so plainly rather than inventing. ' +
      'Match the book\'s voice — clear, structured, unhurried, no hype. ' +
      'Keep replies to 1–3 short paragraphs unless the reader asked for more.' +
      '\n\n--- BEGIN MANUSCRIPT ---\n' + book.text + '\n--- END MANUSCRIPT ---';

    const messages = [
      { role: 'user', content: 'Reader question: ' + String(question || '').trim() },
    ];

    return window.claude.complete({
      system,
      messages,
      ...(opts.extra || {}),
    });
  }

  window.library = { getBook, listBooks, ask };
})();
