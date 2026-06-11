/* =============================================================
   KAIROS·1 — Character of the Executor · orchestrator
   The deepest chamber. Slowest rhythm. Monastic.
   ============================================================= */

const { useEffect: chUseEffect, useState: chUseState2, useRef: chUseRef, useCallback: chUseCallback } = React;

const SANCTUARY_OPENING = [
  {
    role: 'runtime',
    kind: 'open',
    content:
      "What holds you steady across years?\n\nNot what motivates you. Not what makes you good. The internal alignment that lets you remain coherent under pressure, complexity, and time.",
  },
];

async function chLoadGrounding() {
  if (window.kairos && window.kairos._chGrounding) return window.kairos._chGrounding;
  const out = { doctrine: '', nodeSpec: '' };
  try {
    const book = await window.library.getBook('execution-doctrine');
    if (book && book.text) {
      const t = book.text;
      const start = Math.max(0, t.indexOf('Character'));
      out.doctrine = start > 0 ? t.slice(start, start + 28000) : t.slice(-28000);
    }
  } catch (e) {}
  try {
    const res = await fetch('../../_brief/runtime-nodes/09-character-of-the-executor-chamber.md', { cache: 'force-cache' });
    if (res.ok) out.nodeSpec = await res.text();
  } catch (e) {}
  window.kairos = window.kairos || {};
  window.kairos._chGrounding = out;
  return out;
}

function chBuildSystemPrompt({ doctrine, nodeSpec }) {
  return [
    "You are the runtime intelligence of THE CHARACTER OF THE EXECUTOR CHAMBER — Chamber 09 of KAIROS·1. The deepest stratum. Foundation.",
    "",
    "You are NOT: a moral teacher, a virtue scorer, a leadership coach, an inspiration system, a self-help guide, a personality analyst, an ethics framework.",
    "You are the chamber's voice: monastic, low-information, deeply settled, geological, structurally serious.",
    "Your purpose: examine long-horizon structural coherence of the executor. What keeps them internally aligned across decades of pressure, complexity, scale, ambiguity.",
    "",
    "Doctrinal laws:",
    "• Fragmentation begins long before visible collapse.",
    "• Long-horizon coherence depends on internal structural alignment.",
    "• Enormous capacity without alignment eventually destabilizes itself.",
    "",
    "=== THE CHAMBER'S CONSTITUTION (Runtime Node 09) ===",
    nodeSpec || '(spec unavailable)',
    "",
    "=== THE DOCTRINE (relevant excerpt) ===",
    doctrine || '(doctrine unavailable)',
    "",
    "=== DISCIPLINE ===",
    "1. The chamber studies structural integrity. Not goodness. Not virtue. Not personality.",
    "2. Pillars are qualities of internal coherence — e.g. truth-action alignment, emotional steadiness under pressure, follow-through under load, consistency of stated value and chosen direction, patience with long horizons, integrity of acknowledgment.",
    "3. States: aligned (plumb), leaning (tilted; integrity weakening), cracked (fracture beginning), buried (unattended, partially sunken).",
    "4. The chamber is the quietest in the runtime. Single short sentences. Often one. Sometimes no acknowledgment — just the next question.",
    "5. Resist any moral, motivational, inspirational, or therapeutic vocabulary. The chamber speaks in geological language about structure.",
    "6. Never use words like 'authentic', 'true self', 'purpose', 'mission-driven', 'best version', 'growth mindset'. Only: aligned, plumb, coherent, structural, integrity-of-form, load-bearing.",
    "7. The chamber may issue only TWO inquiries before a settle becomes possible. The room does not need to fill many turns.",
    "",
    "=== PHASES ===",
    "• observe  — the reader names pillars. State each: aligned, leaning, cracked, or buried. Stay until 2+ pillars exist.",
    "• examine  — narrow to the pillar that, if realigned, would most stabilize the executor across decades. Mark governing.",
    "• settled  — one realignment named. Issue a single settle observation.",
    "",
    "=== RESPONSE CONTRACT — STRICT JSON ONLY ===",
    "Return one valid JSON object. No prose. No fences.",
    "",
    "Shape:",
    "{",
    '  "kind": "inquiry" | "observation" | "settle",',
    '  "say": "1 short sentence.",',
    '  "deltas": [',
    '    { "op": "add_pillar", "label": "string", "state": "aligned|leaning|cracked|buried", "tilt": 0.0 },',
    '    { "op": "update_pillar", "id": "p1", "state": "leaning", "tilt": 0.4 },',
    '    { "op": "mark_governing", "pillar_id": "p2" },',
    '    { "op": "set_one_realignment", "text": "concrete structural realignment" },',
    '    { "op": "set_phase", "phase": "observe|examine|settled" }',
    '  ]',
    "}",
  ].join('\n');
}

function chBuildUserMessage(ch, readerInput) {
  return [
    "=== CURRENT INTEGRITY TOPOLOGY ===",
    window.kairos.state.summarizeCharacter(ch),
    "",
    "=== RECENT TRANSCRIPT ===",
    window.kairos.state.transcript(ch, 10) || '(none)',
    "",
    "=== READER'S NEW RESPONSE ===",
    readerInput,
    "",
    "Return the JSON object only.",
  ].join('\n');
}

function chExtractJSON(text) {
  if (!text) return null;
  let s = String(text).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(s); } catch (e) {}
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) { if (esc) { esc = false; continue; } if (c === '\\') { esc = true; continue; } if (c === '"') { inStr = false; continue; } }
    else { if (c === '"') { inStr = true; continue; } if (c === '{') depth++; else if (c === '}') { depth--; if (depth === 0) { try { return JSON.parse(s.slice(start, i + 1)); } catch (e) { return null; } } } }
  }
  return null;
}

async function chAskRuntime(ch, readerInput) {
  if (!window.claude || typeof window.claude.complete !== 'function') {
    throw new Error('Runtime intelligence unavailable on this page.');
  }
  const grounding = await chLoadGrounding();
  const raw = await window.claude.complete({
    system: chBuildSystemPrompt(grounding),
    messages: [{ role: 'user', content: chBuildUserMessage(ch, readerInput) }],
  });
  const parsed = chExtractJSON(raw);
  if (!parsed || typeof parsed.say !== 'string') {
    return { kind: 'observation', say: 'Restate that — slower.', deltas: [] };
  }
  parsed.deltas = Array.isArray(parsed.deltas) ? parsed.deltas : [];
  parsed.kind = ['inquiry','observation','settle'].includes(parsed.kind) ? parsed.kind : 'inquiry';
  return parsed;
}

function Sanctuary() {
  const stateRef = chUseRef(null);
  const [, force] = chUseState2(0);
  const tick = chUseCallback(() => force(x => x + 1), []);

  const [thinking, setThinking] = chUseState2(false);
  const [errorNote, setErrorNote] = chUseState2(null);
  const [composerLocked, setComposerLocked] = chUseState2(false);
  const [resting, setResting] = chUseState2(false);
  const lockTimer = chUseRef(null);
  const isFreshEntryRef = chUseRef(false);

  chUseEffect(() => {
    document.body.setAttribute('data-chamber', 'character');
    const s = window.kairos.state.load();
    window.kairos.state.markChamberVisit && window.kairos.state.markChamberVisit(s, 'character');
    return () => document.body.removeAttribute('data-chamber');
  }, []);

  chUseEffect(() => {
    const s = window.kairos.state.load();
    if (window.kairos.landmarks && window.kairos.landmarks.maybeSeedDemo) {
      window.kairos.landmarks.maybeSeedDemo(s);
    }
    const ch = window.kairos.state.ensureCharacterSession(s);
    const isFresh = !ch.inquiry_log || ch.inquiry_log.length === 0;
    isFreshEntryRef.current = isFresh;
    if (isFresh) {
      SANCTUARY_OPENING.forEach(o => {
        window.kairos.state.logEntry(ch, o.role, o.content, o.kind);
      });
    }
    window.kairos.state.save(s);
    stateRef.current = s;
    tick();
    chLoadGrounding().catch(() => {});
  }, [tick]);

  chUseEffect(() => () => clearTimeout(lockTimer.current), []);

  chUseEffect(() => {
    if (window.kairos && window.kairos.transition) {
      window.kairos.transition.receive({ slug: 'character' });
    }
  }, []);

  const spine = (typeof useSpine === 'function') ? useSpine() : { visible: false, open: () => {}, close: () => {}, toggle: () => {} };
  const strata = (typeof useStrata === 'function') ? useStrata() : { visible: false, open: () => {}, close: () => {}, toggle: () => {} };

  const state = stateRef.current;
  const ch = state && state.current_character;

  const handleSubmit = chUseCallback(async (text) => {
    if (!state || !ch) return;
    window.kairos.state.logEntry(ch, 'reader', text);
    window.kairos.state.save(state);
    setThinking(true);
    setErrorNote(null);
    tick();
    try {
      const reply = await chAskRuntime(ch, text);
      window.kairos.state.applyCharacterDeltas(ch, reply.deltas);
      window.kairos.state.logEntry(ch, 'runtime', reply.say, reply.kind);
      window.kairos.state.save(state);
      // Deepest chamber: longest holds.
      const holdMs = reply.kind === 'observation' ? 4800
                    : reply.kind === 'settle'    ? 6400
                    :                              3400;
      setComposerLocked(true);
      clearTimeout(lockTimer.current);
      lockTimer.current = setTimeout(() => setComposerLocked(false), holdMs);
    } catch (e) {
      setErrorNote('The runtime is not reachable from this page.');
      console.warn('[sanctuary] askRuntime failed:', e);
    } finally {
      setThinking(false);
      tick();
    }
  }, [state, ch, tick]);

  const enterRest = chUseCallback(() => { setResting(true); setComposerLocked(false); clearTimeout(lockTimer.current); }, []);
  const leaveRest = chUseCallback(() => setResting(false), []);

  const handleCloseCycle = chUseCallback(() => {
    if (!state || !ch) return;
    if (ch.pillars.length > 0) {
      state.history = state.history || [];
      state.history.push({ kind: 'character', data: ch, closed_at: Date.now() });
    }
    state.current_character = window.kairos.state.emptyCharacterSession();
    SANCTUARY_OPENING.forEach(o => {
      window.kairos.state.logEntry(state.current_character, o.role, o.content, o.kind);
    });
    window.kairos.state.save(state);
    isFreshEntryRef.current = true;
    tick();
  }, [state, ch, tick]);

  const handleReset = chUseCallback(() => {
    if (!window.confirm('Reset this character session? The pillars will be cleared.')) return;
    handleCloseCycle();
  }, [handleCloseCycle]);

  if (!state || !ch) {
    return <div style={{ padding: '80px 48px', fontFamily: 'var(--mono)', color: 'var(--ink-4)', letterSpacing: '0.3em', textTransform: 'uppercase', fontSize: 10 }}>Initialising…</div>;
  }

  const pillarCount = ch.pillars.length;
  const alignedCount = ch.pillars.filter(p => p.state === 'aligned').length;
  const fragmentingCount = ch.pillars.filter(p => p.state === 'leaning' || p.state === 'cracked' || p.state === 'buried').length;
  const governing = ch.pillars.find(p => p.governs);
  const priorCycles = (state.history || []).filter(h => h.kind === 'character').length;
  const isFresh = isFreshEntryRef.current && (ch.inquiry_log || []).length <= 1;

  const turnsForUI = (ch.inquiry_log || []).map(t => ({ role: t.role, kind: t.kind, content: t.content }));

  const composerHint = thinking ? 'the runtime is reading'
    : (ch.phase === 'observe' ? 'name one pillar at a time · cmd/ctrl + enter'
      : (ch.phase === 'examine' ? 'which would most stabilize? · cmd/ctrl + enter'
        : 'cmd/ctrl + enter to submit'));

  const composerPlaceholder = ({
    observe:  'Name one quality. What state — aligned, leaning, cracked, buried?',
    examine:  'If realigned, which would most stabilize across decades?',
    settled:  'Sit with the pillars.',
  })[ch.phase || 'observe'];

  return (
    <main className={'chamber' + (resting ? ' is-resting' : '') + (isFresh ? ' is-fresh-entry' : '') + (ch.phase === 'settled' ? ' is-settled' : '')} data-screen-label="09 Character of the Executor Chamber">

      <header className="c-top">
        <div className="c-breadcrumb">
          <a href="../index.html">KAIROS·1</a>
          <span className="sep">/</span>
          <span>Chamber 09</span>
        </div>
        <div className="c-name">
          Character of the <em>Executor</em>
        </div>
        <div className="c-telemetry">
          <span className="tcell phase">phase · <em>{ch.phase}</em></span>
          <span className="tcell">aligned · <em>{alignedCount}</em></span>
          <span className="tcell">fragmenting · <em>{fragmentingCount}</em></span>
          <button className="c-spine-glyph" type="button" onClick={spine.toggle} aria-label="Open the runtime spine" title="Open the runtime spine (S)"></button>
        </div>
      </header>

      <div className="c-body">

        <InquirySurface
          turns={turnsForUI}
          thinking={thinking}
          phase={ch.phase}
          composerLocked={composerLocked}
          resting={resting}
          onSubmit={handleSubmit}
          onRest={enterRest}
          onResume={leaveRest}
          onCloseCycle={handleCloseCycle}
          composerHint={composerHint}
          composerPlaceholder={composerPlaceholder}
        />

        <section className="c-topology" aria-label="The integrity topology">
          <div className="c-topology-head">
            <span>— <em>Pillars</em></span>
            <span className="right">
              <span>{pillarCount} pillar{pillarCount === 1 ? '' : 's'}</span>
              {governing ? <span style={{ color: 'var(--heat)' }}>· governing surfaced</span> : null}
            </span>
          </div>

          <IntegrityTopology session={ch} history={state.history || []} />

          <div className="c-topology-foot">
            <div className="cell">
              <div className="label">Pillars standing</div>
              <div className="value"><em>{alignedCount}</em> of {pillarCount}</div>
            </div>
            <div className="cell">
              <div className={'value' + (fragmentingCount > 0 ? ' high' : '')}>
                <div className="label">Fragmenting</div>
                {fragmentingCount > 0 ? <em>{fragmentingCount}</em> : <em>none</em>}
              </div>
            </div>
            <div className="cell">
              <div className="label">Governing pillar</div>
              <div className="value">
                {governing
                  ? <em>{governing.id} · {(governing.label || '').slice(0, 28) || 'unnamed'}</em>
                  : <em>not yet surfaced</em>}
              </div>
            </div>
            <div className="cell">
              <div className="label">One realignment</div>
              <div className="value">
                {ch.one_realignment
                  ? (ch.one_realignment.length > 56 ? ch.one_realignment.slice(0, 55) + '…' : ch.one_realignment)
                  : <em>not yet named</em>}
              </div>
            </div>
          </div>
        </section>

      </div>

      <footer className="c-actions">
        <span>session · character · started {new Date(ch.started_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
        <span className="c-actions-center">
          {priorCycles > 0 ? (
            <button onClick={strata.toggle} type="button" className="c-strata-link">
              prior cycles · <em>{priorCycles}</em> · H
            </button>
          ) : (
            <span className="c-strata-empty">no prior strata yet</span>
          )}
          {errorNote ? <span style={{ color: 'var(--heat-2)', marginLeft: 18 }}>{errorNote}</span> : null}
        </span>
        <span>
          <button onClick={handleReset} type="button">Reset session</button>
        </span>
      </footer>

      <Spine currentSlug="character" visible={spine.visible} onDismiss={spine.close} />
      <Strata history={state.history || []} currentChamber="character" visible={strata.visible} onDismiss={strata.close} />

    </main>
  );
}

const chRoot = ReactDOM.createRoot(document.getElementById('chamber-root'));
chRoot.render(<Sanctuary />);
