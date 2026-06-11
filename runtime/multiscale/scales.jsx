/* =============================================================
   KAIROS·1 — Multi-Scale Systems Chamber · orchestrator
   ============================================================= */

const { useEffect: mUseEffect, useState: mUseState, useRef: mUseRef, useCallback: mUseCallback } = React;

const MS_OPENING = [
  {
    role: 'runtime',
    kind: 'open',
    content:
      "Where does friction at one scale propagate to another?\n\nFour scales nest inside this chamber — individual, team, organization, mission. Name one force at one scale, and its propagation will surface.",
  },
];

async function msLoadGrounding() {
  if (window.kairos && window.kairos._msGrounding) return window.kairos._msGrounding;
  const out = { doctrine: '', nodeSpec: '' };
  try {
    const book = await window.library.getBook('execution-doctrine');
    if (book && book.text) {
      out.doctrine = book.text.slice(0, 28000);
    }
  } catch (e) {}
  try {
    const res = await fetch('../../_brief/runtime-nodes/08-multi-scale-systems-chamber.md', { cache: 'force-cache' });
    if (res.ok) out.nodeSpec = await res.text();
  } catch (e) {}
  window.kairos = window.kairos || {};
  window.kairos._msGrounding = out;
  return out;
}

function msBuildSystemPrompt({ doctrine, nodeSpec }) {
  return [
    "You are the runtime intelligence of THE MULTI-SCALE SYSTEMS CHAMBER — Chamber 08 of KAIROS·1. Foundation stratum.",
    "",
    "You are not a strategy consultant. Not an org-design framework. Not analytics.",
    "You are the chamber's voice: networked, layered, calm, structurally serious.",
    "Your purpose: surface where friction at one scale (individual/team/organization/mission) propagates to another.",
    "",
    "=== THE CHAMBER'S CONSTITUTION (Runtime Node 08) ===",
    nodeSpec || '(spec unavailable)',
    "",
    "=== THE DOCTRINE (relevant excerpt) ===",
    doctrine || '(doctrine unavailable)',
    "",
    "=== DISCIPLINE ===",
    "1. Four scales: individual / team / organization / mission. Each is a layer around the executor.",
    "2. Forces at one scale propagate to others. A solo-scale habit creates org-scale fragmentation. An org-scale ambition exceeds team-scale capacity.",
    "3. One dominant scale governs the current cycle.",
    "4. The 'one intervention' lives at one scale but resolves friction across scales.",
    "5. Brevity. Single short sentences. Foundation rhythm.",
    "6. No hype, no exclamation, no motivation.",
    "",
    "=== PHASES ===",
    "• observe — name forces at each scale. Stay until 3+ exist.",
    "• link    — name cross-scale propagations via add_link.",
    "• surface — identify the dominant scale; mark governing force.",
    "• settled — single 'settle' turn observing structural stillness.",
    "",
    "=== RESPONSE CONTRACT — STRICT JSON ONLY ===",
    "Return one valid JSON object. No prose. No fences.",
    "",
    "Shape:",
    "{",
    '  "kind": "inquiry" | "observation" | "settle",',
    '  "say": "1-2 short sentences.",',
    '  "deltas": [',
    '    { "op": "add_force", "label": "string", "scale": "individual|team|organization|mission", "strain": 0.4 },',
    '    { "op": "update_force", "id": "f1", "strain": 0.6 },',
    '    { "op": "add_link", "from_id": "f1", "to_id": "f2", "friction": 0.6 },',
    '    { "op": "mark_governing", "force_id": "f2" },',
    '    { "op": "set_dominant_scale", "scale": "organization" },',
    '    { "op": "set_one_intervention", "text": "concrete intervention" },',
    '    { "op": "set_phase", "phase": "observe|link|surface|settled" }',
    '  ]',
    "}",
    "",
    "DELTA RULES:",
    "• add_force: pick the scale the reader's language places it at.",
    "• add_link: when the reader describes friction at scale A producing friction at scale B.",
    "• mark_governing + set_dominant_scale + set_one_intervention before settling.",
  ].join('\n');
}

function msBuildUserMessage(ms, readerInput) {
  return [
    "=== CURRENT MULTI-SCALE TOPOLOGY ===",
    window.kairos.state.summarizeMultiscale(ms),
    "",
    "=== RECENT TRANSCRIPT (oldest first) ===",
    window.kairos.state.transcript(ms, 10) || '(none)',
    "",
    "=== READER'S NEW RESPONSE ===",
    readerInput,
    "",
    "Return the JSON object only.",
  ].join('\n');
}

function msExtractJSON(text) {
  if (!text) return null;
  let s = String(text).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try { return JSON.parse(s); } catch (e) {}
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (ch === '\\') { esc = true; continue; }
      if (ch === '"') { inStr = false; continue; }
    } else {
      if (ch === '"') { inStr = true; continue; }
      if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(s.slice(start, i + 1)); } catch (e) { return null; }
        }
      }
    }
  }
  return null;
}

async function msAskRuntime(ms, readerInput) {
  if (!window.claude || typeof window.claude.complete !== 'function') {
    throw new Error('Runtime intelligence unavailable on this page.');
  }
  const grounding = await msLoadGrounding();
  const system = msBuildSystemPrompt(grounding);
  const user = msBuildUserMessage(ms, readerInput);
  const raw = await window.claude.complete({ system, messages: [{ role: 'user', content: user }] });
  const parsed = msExtractJSON(raw);
  if (!parsed || typeof parsed.say !== 'string') {
    return { kind: 'observation', say: 'The runtime did not parse cleanly. Restate that — slower.', deltas: [] };
  }
  parsed.deltas = Array.isArray(parsed.deltas) ? parsed.deltas : [];
  parsed.kind = ['inquiry','observation','settle'].includes(parsed.kind) ? parsed.kind : 'inquiry';
  return parsed;
}

function MultiScale() {
  const stateRef = mUseRef(null);
  const [, force] = mUseState(0);
  const tick = mUseCallback(() => force(x => x + 1), []);

  const [thinking, setThinking] = mUseState(false);
  const [errorNote, setErrorNote] = mUseState(null);
  const [composerLocked, setComposerLocked] = mUseState(false);
  const [resting, setResting] = mUseState(false);
  const lockTimer = mUseRef(null);
  const isFreshEntryRef = mUseRef(false);

  mUseEffect(() => {
    document.body.setAttribute('data-chamber', 'multi-scale');
    const s = window.kairos.state.load();
    window.kairos.state.markChamberVisit && window.kairos.state.markChamberVisit(s, 'multi-scale');
    return () => document.body.removeAttribute('data-chamber');
  }, []);

  mUseEffect(() => {
    const s = window.kairos.state.load();
    if (window.kairos.landmarks && window.kairos.landmarks.maybeSeedDemo) {
      window.kairos.landmarks.maybeSeedDemo(s);
    }
    const ms = window.kairos.state.ensureMultiscaleSession(s);
    const isFresh = !ms.inquiry_log || ms.inquiry_log.length === 0;
    isFreshEntryRef.current = isFresh;
    if (isFresh) {
      MS_OPENING.forEach(o => {
        window.kairos.state.logEntry(ms, o.role, o.content, o.kind);
      });
    }
    window.kairos.state.save(s);
    stateRef.current = s;
    tick();
    msLoadGrounding().catch(() => {});
  }, [tick]);

  mUseEffect(() => () => clearTimeout(lockTimer.current), []);

  mUseEffect(() => {
    if (window.kairos && window.kairos.transition) {
      window.kairos.transition.receive({ slug: 'multi-scale' });
    }
  }, []);

  const spine = (typeof useSpine === 'function') ? useSpine() : { visible: false, open: () => {}, close: () => {}, toggle: () => {} };
  const strata = (typeof useStrata === 'function') ? useStrata() : { visible: false, open: () => {}, close: () => {}, toggle: () => {} };

  const state = stateRef.current;
  const ms = state && state.current_multiscale;

  const handleSubmit = mUseCallback(async (text) => {
    if (!state || !ms) return;
    window.kairos.state.logEntry(ms, 'reader', text);
    window.kairos.state.save(state);
    setThinking(true);
    setErrorNote(null);
    tick();
    try {
      const reply = await msAskRuntime(ms, text);
      window.kairos.state.applyMultiscaleDeltas(ms, reply.deltas);
      window.kairos.state.logEntry(ms, 'runtime', reply.say, reply.kind);
      window.kairos.state.save(state);
      const holdMs = reply.kind === 'observation' ? 4000
                    : reply.kind === 'settle'    ? 5400
                    :                              2800;
      setComposerLocked(true);
      clearTimeout(lockTimer.current);
      lockTimer.current = setTimeout(() => setComposerLocked(false), holdMs);
    } catch (e) {
      setErrorNote('The runtime is not reachable from this page.');
      console.warn('[multiscale] askRuntime failed:', e);
    } finally {
      setThinking(false);
      tick();
    }
  }, [state, ms, tick]);

  const enterRest = mUseCallback(() => { setResting(true); setComposerLocked(false); clearTimeout(lockTimer.current); }, []);
  const leaveRest = mUseCallback(() => setResting(false), []);

  const handleCloseCycle = mUseCallback(() => {
    if (!state || !ms) return;
    if (ms.forces.length > 0) {
      state.history = state.history || [];
      state.history.push({ kind: 'multi-scale', data: ms, closed_at: Date.now() });
    }
    state.current_multiscale = window.kairos.state.emptyMultiscaleSession();
    MS_OPENING.forEach(o => {
      window.kairos.state.logEntry(state.current_multiscale, o.role, o.content, o.kind);
    });
    window.kairos.state.save(state);
    isFreshEntryRef.current = true;
    tick();
  }, [state, ms, tick]);

  const handleReset = mUseCallback(() => {
    if (!window.confirm('Reset this multi-scale session? The topology will be cleared.')) return;
    handleCloseCycle();
  }, [handleCloseCycle]);

  if (!state || !ms) {
    return <div style={{ padding: '80px 48px', fontFamily: 'var(--mono)', color: 'var(--ink-4)', letterSpacing: '0.3em', textTransform: 'uppercase', fontSize: 10 }}>Initialising…</div>;
  }

  const forceCount = ms.forces.length;
  const linkCount = ms.links.length;
  const governing = ms.forces.find(f => f.governs);
  const priorCycles = (state.history || []).filter(h => h.kind === 'multi-scale').length;
  const isFresh = isFreshEntryRef.current && (ms.inquiry_log || []).length <= 1;

  const turnsForUI = (ms.inquiry_log || []).map(t => ({ role: t.role, kind: t.kind, content: t.content }));

  const composerHint = thinking ? 'the runtime is reading'
    : (ms.phase === 'observe' ? 'one force at one scale · cmd/ctrl + enter'
      : (ms.phase === 'link' ? 'how does it propagate? · cmd/ctrl + enter'
        : (ms.phase === 'surface' ? 'which scale governs? · cmd/ctrl + enter'
          : 'cmd/ctrl + enter to submit')));

  const composerPlaceholder = ({
    observe: 'Name one force at one scale — individual, team, organization, or mission.',
    link:    'Where does friction at one scale create friction at another?',
    surface: 'Which scale governs the cross-scale distortion?',
    settled: 'Sit with the topology, or continue probing.',
  })[ms.phase || 'observe'];

  return (
    <main className={'chamber' + (resting ? ' is-resting' : '') + (isFresh ? ' is-fresh-entry' : '') + (ms.phase === 'settled' ? ' is-settled' : '')} data-screen-label="08 Multi-Scale Systems Chamber">

      <header className="c-top">
        <div className="c-breadcrumb">
          <a href="../index.html">KAIROS·1</a>
          <span className="sep">/</span>
          <span>Chamber 08</span>
        </div>
        <div className="c-name">
          Multi-Scale <em>Systems</em>
        </div>
        <div className="c-telemetry">
          <span className="tcell phase">phase · <em>{ms.phase}</em></span>
          <span className="tcell">forces · <em>{forceCount}</em></span>
          <span className="tcell">links · <em>{linkCount}</em></span>
          <button className="c-spine-glyph" type="button" onClick={spine.toggle} aria-label="Open the runtime spine" title="Open the runtime spine (S)"></button>
        </div>
      </header>

      <div className="c-body">

        <InquirySurface
          turns={turnsForUI}
          thinking={thinking}
          phase={ms.phase}
          composerLocked={composerLocked}
          resting={resting}
          onSubmit={handleSubmit}
          onRest={enterRest}
          onResume={leaveRest}
          onCloseCycle={handleCloseCycle}
          composerHint={composerHint}
          composerPlaceholder={composerPlaceholder}
        />

        <section className="c-topology" aria-label="The multi-scale topology">
          <div className="c-topology-head">
            <span>— <em>Nested scales</em></span>
            <span className="right">
              <span>{forceCount} force{forceCount === 1 ? '' : 's'}</span>
              <span>{linkCount} link{linkCount === 1 ? '' : 's'}</span>
              {governing ? <span style={{ color: 'var(--heat)' }}>· governing surfaced</span> : null}
            </span>
          </div>

          <ScaleTopology session={ms} history={state.history || []} />

          <div className="c-topology-foot">
            <div className="cell">
              <div className="label">Dominant scale</div>
              <div className="value">
                {ms.dominant_scale ? <em>{ms.dominant_scale}</em> : <em>not yet surfaced</em>}
              </div>
            </div>
            <div className="cell">
              <div className="label">Governing force</div>
              <div className="value">
                {governing
                  ? <em>{governing.id} · {(governing.label || '').slice(0, 32) || 'unnamed'}</em>
                  : <em>not yet named</em>}
              </div>
            </div>
            <div className="cell">
              <div className="label">Cross-scale links</div>
              <div className="value">
                {linkCount > 0 ? <em>{linkCount}</em> : <em>none yet drawn</em>}
              </div>
            </div>
            <div className="cell">
              <div className="label">One intervention</div>
              <div className="value">
                {ms.one_intervention
                  ? (ms.one_intervention.length > 56 ? ms.one_intervention.slice(0, 55) + '…' : ms.one_intervention)
                  : <em>not yet named</em>}
              </div>
            </div>
          </div>
        </section>

      </div>

      <footer className="c-actions">
        <span>session · multi-scale · started {new Date(ms.started_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
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

      <Spine currentSlug="multi-scale" visible={spine.visible} onDismiss={spine.close} />
      <Strata history={state.history || []} currentChamber="multi-scale" visible={strata.visible} onDismiss={strata.close} />

    </main>
  );
}

const msRoot = ReactDOM.createRoot(document.getElementById('chamber-root'));
msRoot.render(<MultiScale />);
