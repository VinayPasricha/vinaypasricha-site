/* =============================================================
   civilization-runtime.js — v1 conversational layer over the
   book "Civilization" (Vinay Pasricha · The Meridian Press).
   =============================================================
   A small, dependency-free retrieval layer + chat controller.

   How it works (see also the book page's "How this works" note):
     1. Loads a pre-built index: library/civilization/chunks.json
        (each chunk carries part / chapter / section for citations).
     2. Builds a lightweight TF-IDF model over the chunks in the
        browser — no server, no embeddings.
     3. On a question, scores every chunk against the query terms
        (with a boost for matches in chapter/section titles) and
        keeps the top few.
     4. Sends ONLY those chunks to window.claude.complete with a
        strict, grounded system prompt + guardrails.
     5. Renders the answer plus source citations (chapter · section
        + a short quoted passage).

   It is intentionally simple. No accounts, memory, or analytics.
   ============================================================= */
(function () {
  'use strict';

  // ---- locate site root from THIS script's own URL -----------------
  // (robust whether served at site root or under a deep /serve/ path —
  //  more reliable than counting pathname segments.)
  function rootURL() {
    var s = document.currentScript;
    if (!s) {
      var all = document.getElementsByTagName('script');
      for (var i = 0; i < all.length; i++) {
        if (/civilization-runtime\.js(\?|$)/.test(all[i].src || '')) { s = all[i]; break; }
      }
    }
    if (s && s.src) return s.src.replace(/js\/civilization-runtime\.js.*$/, '');
    return '';
  }
  const ROOT = rootURL();
  const INDEX_URL = ROOT + 'library/civilization/chunks.json';

  // ---- tiny English stopword set ------------------------------------
  const STOP = new Set(('a an the of to in on at by for and or but if is are was were be been being ' +
    'this that these those it its as with from into about over under then than so such not no nor ' +
    'do does did done has have had having will would can could should may might must shall ' +
    'i you he she we they them his her their our your my me us who whom which what when where why how ' +
    'there here also more most some any each every all both few many much one two three out up down ' +
    'book books does say says said mean means what\'s whats').split(/\s+/));

  function tokenize(str) {
    return (str || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, ' ')
      .split(/\s+/)
      .map(w => w.replace(/^['-]+|['-]+$/g, ''))
      .filter(w => w.length >= 3 && !STOP.has(w))
      .map(w => w.endsWith('s') && w.length > 4 ? w.slice(0, -1) : w); // crude singularise
  }

  // ---- index state --------------------------------------------------
  let indexPromise = null;
  let MODEL = null; // { chunks, idf }

  function buildModel(chunks) {
    const df = Object.create(null);
    const docs = chunks.map(c => {
      const bodyTokens = tokenize(c.text);
      const titleTokens = tokenize((c.chapter || '') + ' ' + (c.section || ''));
      const tf = Object.create(null);
      bodyTokens.forEach(t => { tf[t] = (tf[t] || 0) + 1; });
      const titleSet = new Set(titleTokens);
      const sectionSet = new Set(tokenize(c.section || ''));
      const seen = new Set();
      Object.keys(tf).forEach(t => { if (!seen.has(t)) { df[t] = (df[t] || 0) + 1; seen.add(t); } });
      titleSet.forEach(t => { if (!(t in tf)) { df[t] = (df[t] || 0) + 1; } });
      return { chunk: c, tf, titleSet, sectionSet, len: bodyTokens.length || 1 };
    });
    const N = chunks.length;
    const idf = Object.create(null);
    Object.keys(df).forEach(t => { idf[t] = Math.log(1 + N / df[t]); });
    return { docs, idf, N };
  }

  function loadIndex() {
    if (indexPromise) return indexPromise;
    indexPromise = fetch(INDEX_URL, { cache: 'force-cache' })
      .then(r => { if (!r.ok) throw new Error('index ' + r.status); return r.json(); })
      .then(data => { MODEL = buildModel(Array.isArray(data) ? data : (data.chunks || [])); return MODEL; });
    return indexPromise;
  }

  // ---- retrieval ----------------------------------------------------
  function retrieve(query, k) {
    k = k || 7;
    const qTokens = Array.from(new Set(tokenize(query)));
    if (!qTokens.length || !MODEL) return [];
    const qLower = query.toLowerCase();
    const scored = MODEL.docs.map(d => {
      let score = 0, covered = 0;
      qTokens.forEach(t => {
        const idf = MODEL.idf[t] || 0;
        if (d.tf[t]) score += (d.tf[t] / d.len) * idf * 10;     // body match (length-normalised)
        if (d.titleSet.has(t)) { score += idf * 6; covered++; }  // chapter/section title match
      });
      // title coverage: a section whose title answers the query (e.g. "The
      // Eight Directions" for "what are the eight directions") should win.
      score += (covered / qTokens.length) * 7;
      // decisive section-title match: when the query essentially names a
      // section, that section's chunks should rank first (Jaccard overlap).
      if (d.sectionSet.size) {
        let secHit = 0; qTokens.forEach(t => { if (d.sectionSet.has(t)) secHit++; });
        if (secHit) {
          const union = new Set(qTokens); d.sectionSet.forEach(t => union.add(t));
          score += (secHit / union.size) * 24;
        }
      }
      // exact phrase presence boost
      if (query.length > 6 && d.chunk.text.toLowerCase().indexOf(qLower) !== -1) score += 5;
      return { chunk: d.chunk, score };
    }).filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score);

    // diversify: at most 2 chunks per section
    const perSection = Object.create(null);
    const out = [];
    for (const s of scored) {
      const key = s.chunk.chapter + '|' + s.chunk.section;
      perSection[key] = (perSection[key] || 0) + 1;
      if (perSection[key] > 2) continue;
      out.push(s);
      if (out.length >= k) break;
    }
    return out;
  }

  // pick the most query-relevant sentence as a short quote
  function pickQuote(chunk, qTokens) {
    const sents = (chunk.text.match(/[^.?!]+[.?!]+["”’]?|\S[^.?!]*$/g) || [chunk.text])
      .map(s => s.trim()).filter(s => s.length > 20);
    if (!sents.length) return chunk.text.slice(0, 160);
    const qset = new Set(qTokens);
    let best = sents[0], bestScore = -1;
    for (const s of sents) {
      const toks = tokenize(s);
      let sc = 0; toks.forEach(t => { if (qset.has(t)) sc++; });
      if (sc > bestScore) { bestScore = sc; best = s; }
    }
    let q = best.trim();
    if (q.length > 180) q = q.slice(0, 177).replace(/\s+\S*$/, '') + '…';
    return q;
  }

  // ---- the grounded prompt -----------------------------------------
  const SYSTEM_RULES =
    'You are "The Civilization Companion" — a reading companion to the book "Civilization" by Vinay Pasricha (published by The Meridian Press). ' +
    'A reader on the author\'s website is asking about the book.\n\n' +
    'RULES — follow exactly:\n' +
    '1. You are NOT Vinay Pasricha. You are a companion to his book. If asked who you are, say so plainly.\n' +
    '2. Answer ONLY using the numbered EXCERPTS below, taken from the book\'s manuscript. Use no outside knowledge.\n' +
    '3. If the excerpts do not contain the answer, set grounded=false and say plainly that the book — as far as the available text shows — does not address it. Never invent an answer.\n' +
    '4. Never invent chapters, sections, quotes, figures, or claims that are not in the excerpts. Do not reference unpublished or future chapters.\n' +
    '5. Distinguish what the book STATES from what it IMPLIES. If you extrapolate, write "the book implies" or "this suggests" rather than asserting it as stated.\n' +
    '6. Do not give personal, legal, medical, financial, or policy advice unless it is explicitly grounded in an excerpt — and then attribute it clearly to the book.\n' +
    '7. Quote sparingly (25 words maximum), in quotation marks, and only from the excerpts.\n' +
    '8. Match the book\'s voice: clear, structured, unhurried, no hype. Keep to 1–3 short paragraphs.\n\n' +
    'OUTPUT FORMAT — reply with ONLY a JSON object, no prose around it:\n' +
    '{"grounded": boolean, "answer": "string", "used": [integers]}\n' +
    '"used" lists the excerpt numbers you actually relied on (may be empty if grounded is false).';

  function buildExcerpts(retrieved) {
    return retrieved.map((r, i) =>
      '[' + (i + 1) + '] (' + r.chunk.chapter + (r.chunk.section && r.chunk.section !== r.chunk.chapter ? ' — ' + r.chunk.section : '') + ')\n' + r.chunk.text
    ).join('\n\n');
  }

  function parseModelJSON(text) {
    if (!text) return null;
    let t = String(text).trim().replace(/^```(?:json)?/i, '').replace(/```$/,'').trim();
    const a = t.indexOf('{'), b = t.lastIndexOf('}');
    if (a !== -1 && b !== -1 && b > a) t = t.slice(a, b + 1);
    try { return JSON.parse(t); } catch (e) { /* fall through to lenient extraction */ }
    // The model sometimes leaves inner double-quotes unescaped inside the
    // "answer" value, which breaks JSON.parse. Recover by anchoring on the
    // known keys and pulling the fields out directly.
    const m = t.match(/"answer"\s*:\s*"([\s\S]*?)"\s*,\s*"used"/) || t.match(/"answer"\s*:\s*"([\s\S]*)"\s*\}?\s*$/);
    if (m) {
      const groundedM = /"grounded"\s*:\s*(true|false)/.exec(t);
      const usedM = t.match(/"used"\s*:\s*\[([^\]]*)\]/);
      const used = usedM ? usedM[1].split(',').map((x) => parseInt(x, 10)).filter((n) => !isNaN(n)) : [];
      const answer = m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n').trim();
      return { grounded: groundedM ? groundedM[1] === 'true' : true, answer, used };
    }
    return null;
  }

  // ---- public ask ---------------------------------------------------
  async function ask(query) {
    await loadIndex();
    const qTokens = Array.from(new Set(tokenize(query)));
    const retrieved = retrieve(query, 7);

    if (!retrieved.length) {
      return {
        grounded: false,
        answer: 'I couldn\u2019t find anything in the manuscript of Civilization that speaks to that. I can only answer from the book itself — try rephrasing, or ask about the eight directions, the four tests, or the case studies (Rome, China, Modernity, AI).',
        sources: []
      };
    }

    if (!window.claude || typeof window.claude.complete !== 'function') {
      // Graceful fallback when the AI layer is unavailable: surface the
      // most relevant passages directly so the reader still gets value.
      return {
        grounded: true,
        offline: true,
        answer: 'The live answer layer isn\u2019t available here, but these are the passages from the book most relevant to your question:',
        sources: retrieved.slice(0, 3).map(r => ({
          chapter: r.chunk.chapter, section: r.chunk.section, quote: pickQuote(r.chunk, qTokens)
        }))
      };
    }

    const system = SYSTEM_RULES + '\n\n--- EXCERPTS ---\n' + buildExcerpts(retrieved);
    let raw;
    try {
      raw = await window.claude.complete({
        system,
        messages: [{ role: 'user', content: 'Reader question: ' + String(query || '').trim() }]
      });
    } catch (e) {
      return {
        grounded: true, offline: true,
        answer: 'I hit an error reaching the answer layer. Here are the most relevant passages from the book:',
        sources: retrieved.slice(0, 3).map(r => ({ chapter: r.chunk.chapter, section: r.chunk.section, quote: pickQuote(r.chunk, qTokens) }))
      };
    }

    const parsed = parseModelJSON(raw);
    if (!parsed || typeof parsed.answer !== 'string') {
      // couldn't parse JSON — show the raw text + top sources
      return {
        grounded: true,
        answer: String(raw || '').trim() || 'I wasn\u2019t able to compose an answer. Please try rephrasing.',
        sources: retrieved.slice(0, 3).map(r => ({ chapter: r.chunk.chapter, section: r.chunk.section, quote: pickQuote(r.chunk, qTokens) }))
      };
    }

    let used = Array.isArray(parsed.used) ? parsed.used : [];
    let usedChunks = used.map(n => retrieved[n - 1]).filter(Boolean);
    if (parsed.grounded !== false && !usedChunks.length) usedChunks = retrieved.slice(0, 2);

    return {
      grounded: parsed.grounded !== false,
      answer: parsed.answer.trim(),
      sources: usedChunks.map(r => ({ chapter: r.chunk.chapter, section: r.chunk.section, quote: pickQuote(r.chunk, qTokens) }))
    };
  }

  window.civilizationRuntime = { ask, applyFramework: applyFramework, preload: loadIndex };

  // ---- Framework Application Mode ----------------------------------
  // Applies the book's framework to a user-named subject (country,
  // company, institution, technology, era). Reuses the SAME retrieval
  // layer to ground the METHOD in the book, then asks the model to
  // apply it — returning BOOK CONTENT and FRAMEWORK APPLICATION as two
  // clearly separated parts so the reader always knows which is which.
  var METHOD_QUERY = 'how to read a civilization locate position tension surplus neglect trajectory ' +
    'eight directions foundations frontiers Continuity Truth Capability Cooperation Expansion Creation Recursion Purpose ' +
    'possibility space alignment';

  var APPLY_RULES =
    'You are "The Civilization Companion", a companion to the book "Civilization" by Vinay Pasricha. ' +
    'A reader wants to APPLY the book\'s framework to a subject of their choosing.\n\n' +
    'Produce TWO clearly separated parts:\n' +
    '1. BOOK — using ONLY the numbered EXCERPTS, state briefly the parts of the framework you will use ' +
    '(the relevant directions and/or the reading procedure). This is grounded in the book. Keep it tight.\n' +
    '2. APPLICATION — apply the eight directions to the subject as an explicit INTERPRETATION. ' +
    'This is NOT in the book: present it as a reasoned illustration USING the framework, not as the book\'s ' +
    'claims and not as established fact. Hedge ("appears to", "one reading"). Touch the directions briefly ' +
    '(a phrase or sentence each) — do not write an essay. Do NOT invent specific facts, numbers, dates, or ' +
    'quotes about the subject; reason qualitatively. Do not claim the book discusses this subject unless the ' +
    'excerpts show it does.\n\n' +
    'RULES: You are not Vinay. Never invent chapters/quotes. If the excerpts do not contain enough of the ' +
    'framework to apply, set grounded=false and say so.\n\n' +
    'OUTPUT — reply with ONLY a JSON object:\n' +
    '{"grounded": boolean, "book": "string", "application": "string", "used": [integers]}';

  async function applyFramework(target) {
    target = String(target || '').trim();
    await loadIndex();
    const qTokens = Array.from(new Set(tokenize(METHOD_QUERY + ' ' + target)));
    const retrieved = retrieve(METHOD_QUERY + ' ' + target, 8);

    if (!retrieved.length) {
      return { mode: 'apply', target: target, grounded: false,
        book: '', application: 'I could not load the framework from the manuscript to apply it. Please try again.', sources: [] };
    }
    if (!window.claude || typeof window.claude.complete !== 'function') {
      return { mode: 'apply', target: target, grounded: true, offline: true,
        book: 'The live answer layer isn\u2019t available here. These passages describe the framework you would apply to "' + target + '":',
        application: '', sources: retrieved.slice(0, 3).map(r => ({ chapter: r.chunk.chapter, section: r.chunk.section, quote: pickQuote(r.chunk, qTokens) })) };
    }

    const system = APPLY_RULES + '\n\n--- EXCERPTS ---\n' + buildExcerpts(retrieved);
    let raw;
    try {
      raw = await window.claude.complete({
        system,
        messages: [{ role: 'user', content: 'Apply the framework to: ' + target }]
      });
    } catch (e) {
      return { mode: 'apply', target: target, grounded: true, offline: true,
        book: 'I hit an error reaching the answer layer. These passages describe the framework:',
        application: '', sources: retrieved.slice(0, 3).map(r => ({ chapter: r.chunk.chapter, section: r.chunk.section, quote: pickQuote(r.chunk, qTokens) })) };
    }

    const parsed = parseModelJSON(raw);
    if (!parsed || (typeof parsed.book !== 'string' && typeof parsed.application !== 'string')) {
      return { mode: 'apply', target: target, grounded: true,
        book: '', application: String(raw || '').trim() || 'I wasn\u2019t able to compose an application. Please try rephrasing the subject.',
        sources: retrieved.slice(0, 3).map(r => ({ chapter: r.chunk.chapter, section: r.chunk.section, quote: pickQuote(r.chunk, qTokens) })) };
    }

    let used = Array.isArray(parsed.used) ? parsed.used : [];
    let usedChunks = used.map(n => retrieved[n - 1]).filter(Boolean);
    if (parsed.grounded !== false && !usedChunks.length) usedChunks = retrieved.slice(0, 3);

    return {
      mode: 'apply', target: target,
      grounded: parsed.grounded !== false,
      book: (parsed.book || '').trim(),
      application: (parsed.application || '').trim(),
      sources: usedChunks.map(r => ({ chapter: r.chunk.chapter, section: r.chunk.section, quote: pickQuote(r.chunk, qTokens) }))
    };
  }
})();
