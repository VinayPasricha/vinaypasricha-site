/* =============================================================
   Studio · Runtime Outputs
   Person-centric view of the live runtime (Firestore). For every
   visitor: name, company, email, phone, the runtimes they used,
   and — on click — their chats and generated outputs per runtime.
   ============================================================= */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function lc(s) { return String(s == null ? '' : s).trim().toLowerCase(); }
  function ts(v) {
    if (!v) return 0;
    if (typeof v === 'string' || typeof v === 'number') return new Date(v).getTime() || 0;
    if (v._seconds != null) return v._seconds * 1000;
    if (v.seconds != null) return v.seconds * 1000;
    return 0;
  }
  function fmtDate(v) {
    var t = ts(v); if (!t) return '';
    var d = new Date(t); if (isNaN(d.getTime())) return '';
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
  }
  var STAGES = ['Outside-in', 'Mission captured', 'Tier-0 research', 'Deep discovery', 'Validated'];
  function byRecent(a, b) { return ts(b.updatedAt) - ts(a.updatedAt); }

  async function getJSON(path) {
    var r = await fetch(path, { headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(path + ' → ' + r.status);
    return r.json();
  }

  // ---- runtime identity ----------------------------------------
  function runtimeKey(c) {
    var rt = c.runtime || 'site';
    var page = c.page || '';
    if (rt === 'of' || rt === 'frequency') rt = 'mission';
    if (rt === 'library') {
      var m = page.match(/\/runtime\/([a-z]+)/i);
      return m ? 'kairos:' + m[1].toLowerCase() : 'library';
    }
    if (rt === 'mission' && /\/person/i.test(page)) return 'person';
    return rt;
  }
  var RUNTIME_LABELS = {
    mission: 'Mission Capture · Organizational Frequency',
    person: 'Person Discovery',
    signal: 'The Signal',
    library: 'KAIROS·1 Runtime',
    'kairos:sequence': 'KAIROS·1 · Sequence',
    'kairos:constraint': 'KAIROS·1 · Constraint',
    'kairos:structural': 'KAIROS·1 · Structural',
    'kairos:capacity': 'KAIROS·1 · Capacity',
    'kairos:multiscale': 'KAIROS·1 · Multiscale',
    'kairos:character': 'KAIROS·1 · Character',
    siv: 'SIV · Decisions',
    aion: 'AION1 · Connect',
    civilization: 'Civilization',
    studio: 'Studio',
    site: 'Site (other)',
  };
  function runtimeLabel(k) { return RUNTIME_LABELS[k] || k; }

  // The site-wide capture logs EVERY AI call wrapped in its runtime's own
  // prompt/JSON envelope (topology dumps, extraction prompts, JSON deltas).
  // We don't show that plumbing — we EXTRACT the human-facing layer from it:
  // the visitor's actual words, and the line the runtime actually spoke back.
  function stripFences(s) { return String(s == null ? '' : s).replace(/```json/gi, '').replace(/```/g, '').trim(); }

  // Pull everything after `marker`, stopped at the first of `enders` (or end).
  function afterMarker(raw, marker, enders) {
    var i = raw.indexOf(marker);
    if (i < 0) return null;
    var rest = raw.slice(i + marker.length).replace(/^[=\s]+/, '');
    (enders || []).forEach(function (e) {
      var j = rest.indexOf(e);
      if (j >= 0) rest = rest.slice(0, j);
    });
    return rest.trim();
  }

  // If the assistant replied with a JSON object, surface only the spoken text.
  function humanFromJSON(t) {
    var obj;
    try { obj = JSON.parse(t); } catch (e) { return null; }
    if (!obj || typeof obj !== 'object') return null;
    var fields = ['say', 'public', 'public_text', 'reply', 'message', 'reflection', 'response', 'spoken', 'question', 'next_question'];
    for (var i = 0; i < fields.length; i++) {
      if (typeof obj[fields[i]] === 'string' && obj[fields[i]].trim()) return obj[fields[i]].trim();
    }
    return null;
  }

  // Internal prompt walls that carry no visitor-facing layer at all.
  function isPromptWall(raw) {
    if (/Return ONLY a JSON|Return STRICT JSON|Output STRICT JSON|Produce the JSON profile|WHAT THE ORGANIZATION TOLD US|dimension_estimates|Research this company on the web|=== YOUR DISCIPLINE ===|You read a five-answer mission intake/i.test(raw)) return true;
    if (/^\s*Q1 What organization are you from\?/i.test(raw)) return true;
    if (/^\s*ORG:\s[\s\S]*\bMISSION:/i.test(raw)) return true;
    if (/^\s*(COMPANY|WEBSITE):\s/i.test(raw) && /profile|research/i.test(raw)) return true;
    if (/===\s*CURRENT TOPOLOGY\s*===/i.test(raw)) return true; // topology dump w/o a reader response
    return false;
  }

  // Reduce one stored message to just its clean human text ('' = drop it).
  function cleanText(m) {
    var raw = String(m && m.content == null ? '' : m.content);
    if (!raw.trim()) return '';

    // Chamber prompt → the reader's actual words
    var reader = afterMarker(raw, "READER'S NEW RESPONSE", ['Return the JSON']);
    if (reader != null) return reader;

    // Signal prompt → the reader's answer
    if (/READER'S ANSWER:/i.test(raw) && /BEAT:|QUESTION ASKED:|reflection/i.test(raw)) {
      var ans = afterMarker(raw, "READER'S ANSWER:", ['Now produce your reflection']);
      if (ans != null) return ans;
    }

    // JSON payload → spoken line only, else drop (structured output lives elsewhere)
    var t = stripFences(raw);
    if (t.charAt(0) === '{' || t.charAt(0) === '[') return humanFromJSON(t) || '';

    // Internal prompt wall with no human layer → drop
    if (isPromptWall(raw)) return '';

    // Genuine conversation (mission chat, signal reflections) → keep as-is
    return raw.trim();
  }

  function messageHTML(m) {
    var text = cleanText(m);
    if (!text) return '';
    return '<div class="ro-msg ' + (m.role === 'assistant' ? 'assistant' : 'user') + '">' +
      '<div class="role">' + (m.role === 'assistant' ? 'Runtime' : 'Visitor') + '</div>' +
      esc(text) + '</div>';
  }

  // How many human-readable turns survive the cleaner (0 = pure plumbing).
  function cleanCount(c) {
    var all = Array.isArray(c && c.messages) ? c.messages : [];
    var n = 0;
    for (var i = 0; i < all.length; i++) if (cleanText(all[i])) n++;
    return n;
  }

  // ---- a single chat transcript (cleaned to human-readable only) ----
  function convoHTML(c) {
    var all = Array.isArray(c.messages) ? c.messages : [];
    var htmls = all.map(messageHTML).filter(Boolean);
    var body = htmls.length
      ? htmls.join('')
      : '<div class="ro-msg"><span class="muted">System exchange — no visitor-facing chat.</span></div>';
    return '<details class="ro-convo">' +
      '<summary>' +
        '<span class="who">Session</span>' +
        '<span class="sub">' + htmls.length + ' msg · ' + esc(c.status || 'open') + ' · ' + esc(fmtDate(c.updatedAt)) + '</span>' +
      '</summary>' +
      '<div class="ro-msgs">' + body + '</div>' +
      '</details>';
  }

  // ---- headline: every generated frequency page ----------------
  function renderPages(profiles, personBySession) {
    var box = $('pages');
    $('pages-count').textContent = profiles.length + (profiles.length === 1 ? ' page' : ' pages');
    if (!profiles.length) { box.innerHTML = '<div class="empty-state">No frequency pages generated yet.</div>'; return; }
    profiles.sort(function (a, b) { return ts(b.updatedAt) - ts(a.updatedAt); });
    box.innerHTML = profiles.map(function (p) {
      var est = (p.store && p.store.pub_estimates && p.store.pub_estimates[0]) || {};
      var essence = (p.research && p.research.essence) || est.confidence_reasoning || '';
      var stageLabel = STAGES[p.stage] || ('stage ' + (p.stage == null ? '?' : p.stage));
      var pr = p.sessionId && personBySession[p.sessionId];
      var by = pr ? (pr.name || pr.email || '') : '';
      return '<div class="ro-card">' +
        '<div class="nm">' + esc(p.name || p.slug) + '</div>' +
        '<div class="meta"><span class="pill">' + esc(stageLabel) + '</span>' +
          (p.domain ? '<span>' + esc(p.domain) + '</span>' : '') +
          (p.updatedAt ? '<span>' + esc(fmtDate(p.updatedAt)) + '</span>' : '') +
          (by ? '<span>· by ' + esc(by) + '</span>' : '') + '</div>' +
        (essence ? '<div class="ess">' + esc(essence.length > 220 ? essence.slice(0, 219) + '…' : essence) + '</div>' : '') +
        '<a class="lk" href="/frequency/company/' + encodeURIComponent(p.slug) + '" target="_blank" rel="noopener">Open the page →</a>' +
        '</div>';
    }).join('');
  }

  // ---- one person: details → runtimes → chats + outputs --------
  function personHTML(pr) {
    // Keep only sessions that carry real conversation; drop runtimes that end up
    // with no chats and no outputs (pure internal plumbing).
    var groups = Object.keys(pr.runtimes).map(function (rk) {
      var g = pr.runtimes[rk];
      return { rk: rk, pages: g.pages || [], sessions: g.sessions.filter(function (c) { return cleanCount(c) > 0; }).sort(byRecent) };
    }).filter(function (g) { return g.sessions.length || g.pages.length; });
    groups.sort(function (a, b) {
      function recent(g) {
        var s = g.sessions.reduce(function (mx, c) { return Math.max(mx, ts(c.updatedAt)); }, 0);
        return g.pages.reduce(function (mx, p) { return Math.max(mx, ts(p.updatedAt)); }, s);
      }
      return recent(b) - recent(a);
    });
    var rtKeys = groups.map(function (g) { return g.rk; });
    var totalSessions = groups.reduce(function (n, g) { return n + g.sessions.length; }, 0);

    var runtimesHTML = groups.length ? groups.map(function (g) {
      var rk = g.rk;
      var pages = g.pages;
      var sessions = g.sessions;
      return '<details class="rt-item">' +
        '<summary><span class="rt-name">' + esc(runtimeLabel(rk)) + '</span>' +
          '<span class="rt-meta">' + sessions.length + ' chat' + (sessions.length === 1 ? '' : 's') +
            (pages.length ? ' · ' + pages.length + ' output' + (pages.length === 1 ? '' : 's') : '') + '</span></summary>' +
        '<div class="rt-body">' +
          pages.map(function (p) {
            return '<a class="page-link" href="/frequency/company/' + encodeURIComponent(p.slug) + '" target="_blank" rel="noopener">Output → ' +
              esc(p.name || p.slug) + ' · ' + esc(STAGES[p.stage] || '') + '</a>';
          }).join('') +
          (sessions.length ? sessions.map(convoHTML).join('') : '<div class="muted" style="font-family:var(--serif);font-size:13px">No stored chat for this runtime.</div>') +
        '</div>' +
        '</details>';
    }).join('') : '<div class="none">No runtime activity recorded for this person.</div>';

    return '<details class="person">' +
      '<summary>' +
        '<span class="p-name">' + esc(pr.name || 'Anonymous') + (pr.company ? ' <span class="p-co">· ' + esc(pr.company) + '</span>' : '') + '</span>' +
        '<span class="p-contact">' + (pr.email ? esc(pr.email) : '<span class="muted">no email</span>') + '</span>' +
        '<span class="p-contact">' + (pr.phone ? esc(pr.phone) : '<span class="muted">no phone</span>') + '</span>' +
        '<span class="p-meta">' + rtKeys.length + ' runtime' + (rtKeys.length === 1 ? '' : 's') + ' · ' + totalSessions + ' session' + (totalSessions === 1 ? '' : 's') + '</span>' +
      '</summary>' +
      '<div class="p-body">' + runtimesHTML + '</div>' +
      '</details>';
  }

  // ---- build people from leads + conversations + pages ---------
  function buildPeople(profiles, leads, convos) {
    var people = {};              // key (email | sess:<id>) → person
    var sessToEmail = {};         // sessionId → email
    var nameToEmail = {};         // lc(name) → email  (links clean "of" chats, which carry a name but no email)
    function ensure(key) {
      if (!people[key]) people[key] = { key: key, name: '', email: '', phone: '', company: '', runtimes: {}, lastAt: 0 };
      return people[key];
    }
    function fill(pr, o) {
      if (o.name && !pr.name) pr.name = o.name;
      if (o.email && !pr.email) pr.email = o.email;
      if (o.phone && !pr.phone) pr.phone = o.phone;
      if (o.organizationName && !pr.company) pr.company = o.organizationName;
    }
    function learn(sessionId, email, name) {
      if (sessionId && email) sessToEmail[sessionId] = lc(email);
      if (name && email) { var n = lc(name); if (n.length > 2 && !nameToEmail[n]) nameToEmail[n] = lc(email); }
    }
    leads.forEach(function (l) { learn(l.sessionId, l.email, l.name); });
    convos.forEach(function (c) { learn(c.sessionId, c.email, c.name); });

    // Resolve an identity: explicit email → email for this session → email for this name → anonymous session.
    function keyFor(sessionId, email, name) {
      var em = lc(email) || (sessionId && sessToEmail[sessionId]) || (name && nameToEmail[lc(name)]) || '';
      return em || ('sess:' + (sessionId || 'unknown'));
    }

    leads.forEach(function (l) {
      var pr = ensure(keyFor(l.sessionId, l.email, l.name));
      fill(pr, l); pr.lastAt = Math.max(pr.lastAt, ts(l.updatedAt || l.createdAt));
    });
    convos.forEach(function (c) {
      var pr = ensure(keyFor(c.sessionId, c.email, c.name));
      fill(pr, c);
      var rk = runtimeKey(c);
      (pr.runtimes[rk] = pr.runtimes[rk] || { sessions: [], pages: [] }).sessions.push(c);
      pr.lastAt = Math.max(pr.lastAt, ts(c.updatedAt));
    });
    // attach generated pages to the person who made them, under Mission Capture
    var personBySession = {};
    Object.keys(people).forEach(function (k) { /* placeholder */ });
    profiles.forEach(function (p) {
      var pr = ensure(keyFor(p.sessionId, null, p.name));
      // if this profile carried a name and the person is otherwise unknown, don't overwrite a real name with a company name
      var g = (pr.runtimes.mission = pr.runtimes.mission || { sessions: [], pages: [] });
      g.pages.push(p);
      pr.lastAt = Math.max(pr.lastAt, ts(p.updatedAt));
      if (p.sessionId) personBySession[p.sessionId] = pr;
    });
    return { people: people, personBySession: personBySession };
  }

  function renderPeople(people) {
    var box = $('people');
    var list = Object.keys(people).map(function (k) { return people[k]; });
    $('people-count').textContent = list.length + (list.length === 1 ? ' person' : ' people');
    if (!list.length) { box.innerHTML = '<div class="empty-state">No visitors yet.</div>'; return; }
    // identified people (with email) first, then by recency
    list.sort(function (a, b) {
      var ae = a.email ? 1 : 0, be = b.email ? 1 : 0;
      if (ae !== be) return be - ae;
      return b.lastAt - a.lastAt;
    });
    box.innerHTML = list.map(personHTML).join('');
  }

  async function load() {
    var status = $('editor-status');
    try {
      var res = await Promise.allSettled([getJSON('/api/company-profiles'), getJSON('/api/leads'), getJSON('/api/conversations')]);
      var profiles = res[0].status === 'fulfilled' ? (res[0].value.profiles || []) : [];
      var leads = res[1].status === 'fulfilled' ? (res[1].value.leads || []) : [];
      var convos = res[2].status === 'fulfilled' ? (res[2].value.conversations || []) : [];

      var built = buildPeople(profiles, leads, convos);
      renderPages(profiles, built.personBySession);
      renderPeople(built.people);

      var failed = res.filter(function (r) { return r.status === 'rejected'; });
      var nPeople = Object.keys(built.people).length;
      status.textContent = failed.length
        ? (failed.length + ' source(s) failed — check admin access')
        : ('live · ' + nPeople + ' people · ' + profiles.length + ' pages · ' + convos.length + ' sessions');
    } catch (e) {
      status.textContent = 'Could not load runtime outputs.';
      $('people').innerHTML = '<div class="empty-state">Failed to reach the server. Are you signed in?</div>';
    }
  }

  document.addEventListener('studio:authed', load);
  if (document.getElementById('studio-main') && document.getElementById('studio-main').style.display !== 'none') load();
})();
