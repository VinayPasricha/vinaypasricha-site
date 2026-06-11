/* =============================================================
   KAIROS·1 — Capacity Expansion Chamber · orchestrator
   =============================================================
   The Reservoir. Foundation stratum. Slowest rhythm. The room
   studies stable carrying capacity, not optimization.
   ============================================================= */

const { useEffect: rUseEffect, useState: rUseState, useRef: rUseRef, useCallback: rUseCallback } = React;

const RESERVOIR_OPENING = [
  {
    role: 'runtime',
    kind: 'open',
    content:
      "Where do you carry load that destabilizes you?\n\nNot effort. Not difficulty. Load that produces fragmentation, panic, drift, overload, or collapse when scaled.",
  },
];

async function capLoadGrounding() {
  if (window.kairos && window.kairos._capGrounding) return window.kairos._capGrounding;
  const out = { doctrine: '', nodeSpec: '' };
  try {
    const book = await window.library.getBook('execution-doctrine');
    if (book && book.text) {
      // Look for capacity / carrying / calm-force passages
      const t = book.text;
      const start = Math.max(0, t.indexOf('Capacity'));
      out.doctrine = start > 0 ? t.slice(start, start + 28000) : t.slice(0, 28000);
    }
  } catch (e) {}
  try {
    const res = await fetch('../../_brief/runtime-nodes/07-capacity-expansion-chamber.md', { cache: 'force-cache' });
    if (res.ok) out.nodeSpec = await res.text();
  } catch (e) {}
  window.kairos = window.kairos || {};
  window.kairos._capGrounding = out;
  return out;
}

function capBuildSystemPrompt({ doctrine, nodeSpec }) {
  return [
    "You are the runtime intelligence of THE CAPACITY EXPANSION CHAMBER — the Reservoir — Chamber 07 of KAIROS·1. Foundation stratum.",
    "",
    "You are not a coach. Not a productivity tool. Not optimization software. Not a performance dashboard.",
    "You are the chamber's voice: spacious, slow, foundational, calm, structurally grounded.",
    "Your purpose: examine the expansion of stable carrying capacity across time. Not how the executor performs harder — how they become structurally larger.",
    "",
    "Constitutional law: CAPACITY EXPANSION MEANS REDUCED STRAIN AT HIGHER LOAD. Not higher strain at higher output.",
    "",
    "=== THE CHAMBER'S CONSTITUTION (Runtime Node 07) ===",
    nodeSpec || '(spec unavailable — operate from doctrine only)',
    "",
    "=== THE DOCTRINE (relevant excerpt) ===",
    doctrine || '(doctrine unavailable)',
    "",
    "=== YOUR DISCIPLINE ===",
    "1. Calm force scales further than frantic force. The chamber resists hustle, optimization, heroic strain.",
    "2. Stability before scale. Adding load before strengthening containment produces fragmentation.",
    "3. Capacity is structural, not motivational. The chamber studies what the executor can hold, not what they can push through.",
    "4. A load that was once destabilizing and is now calmly carried demonstrates the executor's true expansion vector. Surface these as 'stabilized' loads.",
    "5. Resist optimization vocabulary. No 'boost', 'maximize', 'unlock', 'leverage', 'crush', '10x', 'next level'. Only: stabilize, contain, widen, calm.",
    "6. Foundation rhythm. Speak slowly. Single short sentences. Long silences carry weight. Sometimes one sentence is the entire 'say'.",
    "7. No exclamation marks. No hype. No motivation. No achievement language.",
    "",
    "=== LOAD VOCABULARY ===",
    "Each load is a kind of complexity, responsibility, ambiguity, or scale the executor carries. Each has a state:",
    "• stabilized — once destabilizing, now carried calmly. Inside the carrying field. Evidence of past expansion.",
    "• active     — currently carried, with some strain. At the field's edge.",
    "• overload   — exceeds the current carrying field. Produces fragmentation, panic, drift, or exhaustion.",
    "",
    "=== PHASE PROGRESSION ===",
    "• observe   — name loads. Both currently-carried (stabilized + active) and currently-overloading. Stay until 3+ loads exist.",
    "• stabilize — examine which overloads need stabilization. What containment must widen to receive them? Update strains. Add evidence.",
    "• widen     — name the ONE stabilization that would widen the carrying field. Set field tier if it has visibly grown.",
    "• settled   — chamber's work for this session is done. Issue a single 'settle' turn observing structural stillness.",
    "",
    "=== RESPONSE CONTRACT — STRICT JSON ONLY ===",
    "Return one valid JSON object. No prose. No fences.",
    "",
    "Shape:",
    "{",
    '  "kind": "inquiry" | "observation" | "settle",',
    '  "say": "1-2 short sentences. Often one. Silence does the rest.",',
    '  "deltas": [',
    '    { "op": "add_load", "label": "string", "state": "stabilized|active|overload", "strain": 0.5, "evidence_for": "string", "evidence_against": "string" },',
    '    { "op": "update_load", "id": "L1", "state": "stabilized", "strain": 0.2 },',
    '    { "op": "mark_stabilized", "id": "L2" },',
    '    { "op": "set_field_tier", "tier": 3 },',
    '    { "op": "set_one_stabilization", "text": "concrete widening intervention" },',
    '    { "op": "set_phase", "phase": "observe|stabilize|widen|settled" }',
    '  ]',
    "}",
    "",
    "DELTA RULES:",
    "• Use add_load with the executor's exact framing of the load. Pick state from their language: was-destabilizing-now-calm → stabilized; carried-with-some-strain → active; exceeds-containment → overload.",
    "• Use mark_stabilized when an active or overload load is reported as having moved to calm carrying.",
    "• Use set_field_tier rarely — only when the executor has visibly described their carrying capacity having widened a tier (1 small ... 5 wide). Default 1.",
    "• Use set_one_stabilization to name the single widening intervention. Concrete, structural, not motivational. NOT 'work on calm'. Rather: 'Delegate weekly reporting so capacity to think long-term is reclaimed.'",
    "• Settle only when at least one stabilization is named and field tier is named.",
    "",
    "kind: 'inquiry' (next question), 'observation' (pattern surfaced — italic), 'settle' (structural stillness observed).",
  ].join('\n');
}

function capBuildUserMessage(cap, readerInput) {
  return [
    "=== CURRENT CARRYING FIELD ===",
    window.kairos.state.summarizeCapacity(cap),
    "",
    "=== RECENT TRANSCRIPT (oldest first) ===",
    window.kairos.state.transcript(cap, 10) || '(none)',
    "",
    "=== READER'S NEW RESPONSE ===",
    readerInput,
    "",
    "Return the JSON object only.",
  ].join('\n');
}

function capExtractJSON(text) {
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
          const blob = s.slice(start, i + 1);
          try { return JSON.parse(blob); } catch (e) { return null; }
        }
      }
    }
  }
  return null;
}

async function capAskRuntime(cap, readerInput) {
  if (!window.claude || typeof window.claude.complete !== 'function') {
    throw new Error('Runtime intelligence unavailable on this page.');
  }
  const grounding = await capLoadGrounding();
  const system = capBuildSystemPrompt(grounding);
  const user = capBuildUserMessage(cap, readerInput);
  const raw = await window.claude.complete({ system, messages: [{ role: 'user', content: user }] });
  const parsed = capExtractJSON(raw);
  if (!parsed || typeof parsed.say !== 'string') {
    return { kind: 'observation', say: 'The runtime did not parse cleanly. Restate that — slower, less abstract.', deltas: [] };
  }
  parsed.deltas = Array.isArray(parsed.deltas) ? parsed.deltas : [];
  parsed.kind = ['inquiry','observation','settle'].includes(parsed.kind) ? parsed.kind : 'inquiry';
  return parsed;
}

function Reservoir() {
  const stateRef = rUseRef(null);
  const [, force] = rUseState(0);
  const tick = rUseCallback(() => force(x => x + 1), []);

  const [thinking, setThinking] = rUseState(false);
  const [errorNote, setErrorNote] = rUseState(null);
  const [composerLocked, setComposerLocked] = rUseState(false);
  const [resting, setResting] = rUseState(false);
  const lockTimer = rUseRef(null);
  const isFreshEntryRef = rUseRef(false);

  rUseEffect(() => {
    document.body.setAttribute('data-chamber', 'capacity');
    const s = window.kairos.state.load();
    window.kairos.state.markChamberVisit && window.kairos.state.markChamberVisit(s, 'capacity');
    return () => document.body.removeAttribute('data-chamber');
  }, []);

  rUseEffect(() => {
    const s = window.kairos.state.load();
    if (window.kairos.landmarks && window.kairos.landmarks.maybeSeedDemo) {
      window.kairos.landmarks.maybeSeedDemo(s);
    }
    const cap = window.kairos.state.ensureCapacitySession(s);
    const isFresh = !cap.inquiry_log || cap.inquiry_log.length === 0;
    isFreshEntryRef.current = isFresh;
    if (isFresh) {
      RESERVOIR_OPENING.forEach(o => {
        window.kairos.state.logEntry(cap, o.role, o.content, o.kind);
      });
    }
    window.kairos.state.save(s);
    stateRef.current = s;
    tick();
    capLoadGrounding().catch(() => {});
  }, [tick]);

  rUseEffect(() => () => clearTimeout(lockTimer.current), []);

  rUseEffect(() => {
    if (window.kairos && window.kairos.transition) {
      window.kairos.transition.receive({ slug: 'capacity-expansion' });
    }
  }, []);

  const spine = (typeof useSpine === 'function') ? useSpine() : { visible: false, open: () => {}, close: () => {}, toggle: () => {} };
  const strata = (typeof useStrata === 'function') ? useStrata() : { visible: false, open: () => {}, close: () => {}, toggle: () => {} };

  const state = stateRef.current;
  const cap = state && state.current_capacity;

  const handleSubmit = rUseCallback(async (text) => {
    if (!state || !cap) return;
    window.kairos.state.logEntry(cap, 'reader', text);
    window.kairos.state.save(state);
    setThinking(true);
    setErrorNote(null);
    tick();
    try {
      const reply = await capAskRuntime(cap, text);
      window.kairos.state.applyCapacityDeltas(cap, reply.deltas);
      window.kairos.state.logEntry(cap, 'runtime', reply.say, reply.kind);
      window.kairos.state.save(state);
      // The Reservoir holds longest of any chamber. Foundation rhythm.
      const holdMs = reply.kind === 'observation' ? 3600
                    : reply.kind === 'settle'    ? 4800
                    :                              2400;
      setComposerLocked(true);
      clearTimeout(lockTimer.current);
      lockTimer.current = setTimeout(() => setComposerLocked(false), holdMs);
    } catch (e) {
      setErrorNote('The runtime is not reachable from this page.');
      console.warn('[reservoir] askRuntime failed:', e);
    } finally {
      setThinking(false);
      tick();
    }
  }, [state, cap, tick]);

  const enterRest = rUseCallback(() => { setResting(true); setComposerLocked(false); clearTimeout(lockTimer.current); }, []);
  const leaveRest = rUseCallback(() => setResting(false), []);

  const handleCloseCycle = rUseCallback(() => {
    if (!state || !cap) return;
    if (cap.loads.length > 0) {
      state.history = state.history || [];
      state.history.push({ kind: 'capacity', data: cap, closed_at: Date.now() });
    }
    state.current_capacity = window.kairos.state.emptyCapacitySession();
    RESERVOIR_OPENING.forEach(o => {
      window.kairos.state.logEntry(state.current_capacity, o.role, o.content, o.kind);
    });
    window.kairos.state.save(state);
    isFreshEntryRef.current = true;
    tick();
  }, [state, cap, tick]);

  const handleReset = rUseCallback(() => {
    if (!window.confirm('Reset this capacity session? The carrying field will be cleared. (History archive is preserved.)')) return;
    handleCloseCycle();
  }, [handleCloseCycle]);

  if (!state || !cap) {
    return <div style={{ padding: '80px 48px', fontFamily: 'var(--mono)', color: 'var(--ink-4)', letterSpacing: '0.3em', textTransform: 'uppercase', fontSize: 10 }}>Initialising…</div>;
  }

  const stabilizedCount = cap.loads.filter(l => l.state === 'stabilized').length;
  const activeCount = cap.loads.filter(l => l.state === 'active').length;
  const overloadCount = cap.loads.filter(l => l.state === 'overload').length;
  const priorCycles = (state.history || []).filter(h => h.kind === 'capacity').length;
  const isFresh = isFreshEntryRef.current && (cap.inquiry_log || []).length <= 1;

  const turnsForUI = (cap.inquiry_log || []).map(t => ({ role: t.role, kind: t.kind, content: t.content }));

  const composerHint = thinking ? 'the runtime is reading'
    : (cap.phase === 'observe' ? 'name one load at a time · cmd/ctrl + enter'
      : (cap.phase === 'stabilize' ? 'what would widen the field? · cmd/ctrl + enter'
        : (cap.phase === 'widen' ? 'one stabilization · cmd/ctrl + enter'
          : 'cmd/ctrl + enter to submit')));

  const composerPlaceholder = ({
    observe:    'What load currently destabilizes you? What load was once destabilizing and is now calmly carried?',
    stabilize:  'Which overload needs stabilization first? What containment must widen to receive it?',
    widen:      'The one stabilization. Structural, not motivational.',
    settled:    'Sit with the field. Or continue probing.',
  })[cap.phase || 'observe'];

  return (
    <main className={'chamber' + (resting ? ' is-resting' : '') + (isFresh ? ' is-fresh-entry' : '') + (cap.phase === 'settled' ? ' is-settled' : '')} data-screen-label="07 Capacity Expansion Chamber">

      <header className="c-top">
        <div className="c-breadcrumb">
          <a href="../index.html">KAIROS·1</a>
          <span className="sep">/</span>
          <span>Chamber 07</span>
        </div>
        <div className="c-name">
          Capacity <em>Expansion</em>
        </div>
        <div className="c-telemetry">
          <span className="tcell phase">phase · <em>{cap.phase}</em></span>
          <span className="tcell">stabilized · <em>{stabilizedCount}</em></span>
          <span className="tcell">overload · <em>{overloadCount}</em></span>
          <button className="c-spine-glyph" type="button" onClick={spine.toggle} aria-label="Open the runtime spine" title="Open the runtime spine (S)"></button>
        </div>
      </header>

      <div className="c-body">

        <InquirySurface
          turns={turnsForUI}
          thinking={thinking}
          phase={cap.phase}
          composerLocked={composerLocked}
          resting={resting}
          onSubmit={handleSubmit}
          onRest={enterRest}
          onResume={leaveRest}
          onCloseCycle={handleCloseCycle}
          composerHint={composerHint}
          composerPlaceholder={composerPlaceholder}
        />

        <section className="c-topology" aria-label="The carrying field">
          <div className="c-topology-head">
            <span>— <em>Carrying field</em></span>
            <span className="right">
              <span>{cap.loads.length} load{cap.loads.length === 1 ? '' : 's'}</span>
              <span>{stabilizedCount} stabilized</span>
              {overloadCount > 0 ? <span style={{ color: 'var(--heat)' }}>· {overloadCount} overload</span> : null}
            </span>
          </div>

          <FieldTopology session={cap} history={state.history || []} />

          <div className="c-topology-foot">
            <div className="cell">
              <div className="label">Field tier</div>
              <div className="value"><em>{cap.field_radius_tier || 1}</em> · of 5</div>
            </div>
            <div className="cell">
              <div className="label">Stabilized loads</div>
              <div className="value">
                {stabilizedCount > 0 ? <em>{stabilizedCount}</em> : <em>none yet named</em>}
              </div>
            </div>
            <div className="cell">
              <div className={'value' + (overloadCount > 0 ? ' high' : '')}>
                <div className="label">Currently overloading</div>
                {overloadCount > 0 ? <em>{overloadCount}</em> : <em>none</em>}
              </div>
            </div>
            <div className="cell">
              <div className="label">One stabilization</div>
              <div className="value">
                {cap.one_stabilization
                  ? (cap.one_stabilization.length > 56 ? cap.one_stabilization.slice(0, 55) + '…' : cap.one_stabilization)
                  : <em>not yet named</em>}
              </div>
            </div>
          </div>
        </section>

      </div>

      <footer className="c-actions">
        <span>session · capacity · started {new Date(cap.started_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
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

      <Spine currentSlug="capacity-expansion" visible={spine.visible} onDismiss={spine.close} />
      <Strata history={state.history || []} currentChamber="capacity" visible={strata.visible} onDismiss={strata.close} />

    </main>
  );
}

const capRoot = ReactDOM.createRoot(document.getElementById('chamber-root'));
capRoot.render(<Reservoir />);
