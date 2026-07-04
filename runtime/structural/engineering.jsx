/* =============================================================
   KAIROS·1 — Structural Constraint Chamber · orchestrator
   =============================================================
   The Engineering Layer. Where structural — not human —
   constraints are diagnosed. Atmosphere is heavier, slower,
   denser than the Constraint Observatory. The reader is
   descending into the bones of execution systems.
   ============================================================= */

const { useEffect: eUseEffect, useState: eUseState, useRef: eUseRef, useCallback: eUseCallback } = React;

const ENGINEERING_OPENING = [
  {
    role: 'runtime',
    kind: 'open',
    content:
      "Where is the system itself slowing execution?\n\nNot the people inside it — the architecture they operate inside. Name one place where the structure of work suppresses output.",
  },
];

async function engLoadGrounding() {
  if (window.kairos && window.kairos._engGrounding) return window.kairos._engGrounding;
  const out = { doctrine: '', nodeSpec: '' };
  try {
    const book = await window.library.getBook('execution-doctrine');
    if (book && book.text) {
      const t = book.text;
      // Chapter 11 — When the Bottleneck Is Structural — plus surrounding chapters
      const start = t.indexOf('Chapter 9');
      const end = t.indexOf('Chapter 13');
      out.doctrine = (start > 0 && end > start)
        ? t.slice(Math.max(0, start - 800), end + 800)
        : t.slice(0, 30000);
    }
  } catch (e) {}
  try {
    const res = await fetch('../nodes/06-structural-constraint-chamber.md', { cache: 'force-cache' });
    if (res.ok) out.nodeSpec = await res.text();
  } catch (e) {}
  window.kairos = window.kairos || {};
  window.kairos._engGrounding = out;
  return out;
}

function engBuildSystemPrompt({ doctrine, nodeSpec }) {
  return [
    "You are the runtime intelligence of THE STRUCTURAL CONSTRAINT CHAMBER — the engineering layer of KAIROS·1, built from Vinay Pasricha's Execution Doctrine.",
    "",
    "You are not a chatbot. You are not management consulting. You are not analytics.",
    "You are the chamber's voice: forensic, low-noise, architecturally precise, structurally serious.",
    "Your purpose: identify where the architecture of the system itself — process, decision, information, resource, org — suppresses execution. Not people. Structures.",
    "",
    "=== THE CHAMBER'S CONSTITUTION (Runtime Node 06) ===",
    nodeSpec || '(spec unavailable — operate from doctrine only)',
    "",
    "=== THE DOCTRINE (relevant excerpt — Governing Limit / When the Bottleneck Is Structural) ===",
    doctrine || '(doctrine unavailable)',
    "",
    "=== YOUR DISCIPLINE ===",
    "1. Structures are slower than they look. Old structure often persists for years because nobody traces friction to architecture. Search there first.",
    "2. Humans mask structural failure. If a system requires heroic effort to function, the architecture is weak. Heroic effort = low-capacity structure.",
    "3. One layer governs. Process, decision, information, or resource. Identify which is the dominant constraint right now.",
    "4. Tooling is not always the answer. Resist the SaaS reflex of solving structural problems with more tools. Often the structural change is *removing* a layer.",
    "5. Flow is the diagnostic. Watch where work accumulates, where handoffs break, where decisions wait.",
    "6. Distinguish structural from human. If the friction is about a specific person, route to the Human Constraint Chamber. If it's about the system they operate inside, stay here.",
    "7. Prefer brevity. Single questions with held silence. Sometimes the right 'say' is one sentence.",
    "8. No hype, no praise, no motivation, no exclamation. Architectural seriousness.",
    "",
    "=== LAYER VOCABULARY ===",
    "Each structural element belongs to one of these layers:",
    "• process     — how work flows: sequencing, parallelism, serialization, handoff topology",
    "• decision    — who decides, when, with what authority and visibility",
    "• information — what data the work needs, when, in what form",
    "• resource    — resources, headcount, allocation, org boundaries, reporting structure",
    "",
    "=== PHASE PROGRESSION ===",
    "• observe   — capture structural elements that suppress output. Use add_element with the correct layer. Stay here until 2–4 candidates exist.",
    "• narrow    — test elements against the governing question (would removing it materially lift output?). Update friction. Add dependencies to show how elements interact.",
    "• classify  — identify the dominant layer. Issue classify with process/decision/information/resource/org.",
    "• name      — mark_governing on the dominant element. Define the one_strengthening — the single structural intervention.",
    "• settled   — chamber's work for this session is done. Issue a single 'settle' turn.",
    "",
    "=== RESPONSE CONTRACT — STRICT JSON ONLY ===",
    "Return a single valid JSON object. No prose. No fences.",
    "",
    "Shape:",
    "{",
    '  "kind": "inquiry" | "observation" | "settle",',
    '  "say": "1-2 short sentences.",',
    '  "deltas": [',
    '    { "op": "add_element", "label": "string", "layer": "process|decision|information|resource", "friction": 0.4, "evidence_for": "string", "evidence_against": "string" },',
    '    { "op": "update_element", "id": "e1", "label": "string", "layer": "process", "friction": 0.7 },',
    '    { "op": "add_dependency", "from_id": "e1", "to_id": "e2", "friction": 0.5 },',
    '    { "op": "mark_governing", "element_id": "e2" },',
    '    { "op": "classify", "classification": "process|decision|information|resource|org" },',
    '    { "op": "set_one_strengthening", "text": "concrete intervention" },',
    '    { "op": "set_phase", "phase": "observe|narrow|classify|name|settled" }',
    '  ]',
    "}",
    "",
    "DELTA RULES:",
    "• Use add_element when the reader names a structural element (a process step, a decision pattern, an information gap, a resource constraint). Pick the right layer.",
    "• Use add_dependency when two elements visibly depend on each other (process step requires decision; decision waits on information).",
    "• Use mark_governing once one element has surfaced as the structural governing limit. Once 2-4 elements exist and one clearly suppresses output most, you MUST mark_governing, classify the layer, and set_one_strengthening — do not keep adding elements indefinitely.",
    "• Issue 'settle' as soon as governing + classification + one_strengthening are all defined; do not keep probing past that point.",
    "",
    "kind: 'inquiry' (next question), 'observation' (pattern surfaced — italic), 'settle' (stillness observed — never declarative).",
  ].join('\n');
}

function engBuildUserMessage(st, readerInput) {
  return [
    "=== CURRENT ARCHITECTURE ===",
    window.kairos.state.summarizeStructural(st),
    "",
    "=== RECENT TRANSCRIPT (oldest first) ===",
    window.kairos.state.transcript(st, 10) || '(none)',
    "",
    "=== READER'S NEW RESPONSE ===",
    readerInput,
    "",
    "Return the JSON object only.",
  ].join('\n');
}

function engExtractJSON(text) {
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

async function engAskRuntime(st, readerInput) {
  if (!window.claude || typeof window.claude.complete !== 'function') {
    throw new Error('Runtime intelligence unavailable on this page.');
  }
  const grounding = await engLoadGrounding();
  const system = engBuildSystemPrompt(grounding);
  const user = engBuildUserMessage(st, readerInput);

  const raw = await window.claude.complete({
    system,
    messages: [{ role: 'user', content: user }],
  });

  const parsed = engExtractJSON(raw);
  if (!parsed || typeof parsed.say !== 'string') {
    return {
      kind: 'observation',
      say: 'The runtime did not parse cleanly. Restate that — slower, more structural.',
      deltas: [],
    };
  }
  parsed.deltas = Array.isArray(parsed.deltas) ? parsed.deltas : [];
  parsed.kind = ['inquiry','observation','settle'].includes(parsed.kind) ? parsed.kind : 'inquiry';
  return parsed;
}

function Engineering() {
  const stateRef = eUseRef(null);
  const [, force] = eUseState(0);
  const tick = eUseCallback(() => force(x => x + 1), []);

  const [thinking, setThinking] = eUseState(false);
  const [errorNote, setErrorNote] = eUseState(null);
  const [composerLocked, setComposerLocked] = eUseState(false);
  const [resting, setResting] = eUseState(false);
  const lockTimer = eUseRef(null);
  const isFreshEntryRef = eUseRef(false);

  // Chamber weight — structural is the densest of the three open
  // chambers. The body attribute drives the atmospheric CSS.
  eUseEffect(() => {
    document.body.setAttribute('data-chamber', 'structural');
    const s = window.kairos.state.load();
    window.kairos.state.markChamberVisit(s, 'structural');
    return () => document.body.removeAttribute('data-chamber');
  }, []);

  eUseEffect(() => {
    const s = window.kairos.state.load();
    if (window.kairos.landmarks && window.kairos.landmarks.maybeSeedDemo) {
      window.kairos.landmarks.maybeSeedDemo(s);
    }
    const st = window.kairos.state.ensureStructuralSession(s);
    const isFresh = !st.inquiry_log || st.inquiry_log.length === 0;
    isFreshEntryRef.current = isFresh;
    if (isFresh) {
      // Soft doctrinal gravity (Refinement 06) — Structural diagnosis
      // benefits from constraint diagnosis having first surfaced.
      // If the Constraint Observatory has not been touched, the
      // chamber quietly observes. Doctrinal warning, not gate.
      // Refinement 07: repeated showings weather into inscription.
      const cnInhabited =
        (s.current_constraint && (s.current_constraint.inquiry_log || []).length > 1) ||
        (s.history || []).some(h => h.kind === 'constraint');
      if (!cnInhabited) {
        s.doctrinal_seen = s.doctrinal_seen || {};
        const docKey = 'structural-without-constraint';
        const isRepeat = !!s.doctrinal_seen[docKey];
        window.kairos.state.logEntry(
          st, 'runtime',
          'Structural diagnosis without constraint diagnosis often misattributes the governing limit.\n\nThe Constraint Observatory has not yet been entered. Continue here, or return there first.',
          isRepeat ? 'doctrine-aged' : 'observation'
        );
        s.doctrinal_seen[docKey] = (s.doctrinal_seen[docKey] || 0) + 1;
      }
      ENGINEERING_OPENING.forEach(o => {
        window.kairos.state.logEntry(st, o.role, o.content, o.kind);
      });
    }
    window.kairos.state.save(s);
    stateRef.current = s;
    tick();
    engLoadGrounding().catch(() => {});
  }, [tick]);

  eUseEffect(() => () => clearTimeout(lockTimer.current), []);

  eUseEffect(() => {
    if (window.kairos && window.kairos.transition) {
      window.kairos.transition.receive({ slug: 'structural-constraint' });
    }
  }, []);

  const spine = (typeof useSpine === 'function') ? useSpine() : { visible: false, open: () => {}, close: () => {}, toggle: () => {} };
  const strata = (typeof useStrata === 'function') ? useStrata() : { visible: false, open: () => {}, close: () => {}, toggle: () => {} };

  const state = stateRef.current;
  const st = state && state.current_structural;

  const handleSubmit = eUseCallback(async (text) => {
    if (!state || !st) return;
    window.kairos.state.logEntry(st, 'reader', text);
    window.kairos.state.save(state);
    setThinking(true);
    setErrorNote(null);
    tick();
    try {
      const reply = await engAskRuntime(st, text);
      window.kairos.state.applyStructuralDeltas(st, reply.deltas);
      window.kairos.state.logEntry(st, 'runtime', reply.say, reply.kind);
      window.kairos.state.save(state);
      // Structural chamber holds its composer slightly longer —
      // architectural change is patient. Per Refinement 05.
      const holdMs = reply.kind === 'observation' ? 2800
                    : reply.kind === 'settle'    ? 3600
                    :                              1800;
      setComposerLocked(true);
      clearTimeout(lockTimer.current);
      lockTimer.current = setTimeout(() => setComposerLocked(false), holdMs);
    } catch (e) {
      setErrorNote('The runtime is not reachable from this page.');
      console.warn('[engineering] askRuntime failed:', e);
    } finally {
      setThinking(false);
      tick();
    }
  }, [state, st, tick]);

  const enterRest = eUseCallback(() => {
    setResting(true);
    setComposerLocked(false);
    clearTimeout(lockTimer.current);
  }, []);
  const leaveRest = eUseCallback(() => setResting(false), []);

  const handleCloseCycle = eUseCallback(() => {
    if (!state || !st) return;
    if (st.elements.length > 0) {
      state.history = state.history || [];
      state.history.push({ kind: 'structural', data: st, closed_at: Date.now() });
    }
    state.current_structural = window.kairos.state.emptyStructuralSession();
    ENGINEERING_OPENING.forEach(o => {
      window.kairos.state.logEntry(state.current_structural, o.role, o.content, o.kind);
    });
    window.kairos.state.save(state);
    isFreshEntryRef.current = true;
    tick();
  }, [state, st, tick]);

  const handleReset = eUseCallback(() => {
    if (!window.confirm('Reset this structural session? The architecture diagram will be cleared. (History archive is preserved.)')) return;
    handleCloseCycle();
  }, [handleCloseCycle]);

  if (!state || !st) {
    return (
      <div style={{ padding: '80px 48px', fontFamily: 'var(--mono)', color: 'var(--ink-4)', letterSpacing: '0.3em', textTransform: 'uppercase', fontSize: 10 }}>
        Initialising…
      </div>
    );
  }

  const elemCount = st.elements.length;
  const depCount = st.dependencies.length;
  const governing = st.elements.find(e => e.governs);
  const priorCycles = (state.history || []).filter(h => h.kind === 'structural').length;
  const isFresh = isFreshEntryRef.current && (st.inquiry_log || []).length <= 1;

  const turnsForUI = (st.inquiry_log || []).map(t => ({
    role: t.role, kind: t.kind, content: t.content
  }));

  const composerHint = thinking ? 'the runtime is reading'
    : (st.phase === 'observe' ? 'one structural element at a time · cmd/ctrl + enter'
      : (st.phase === 'narrow' ? 'test against the governing test · cmd/ctrl + enter'
        : (st.phase === 'classify' ? 'identify the dominant layer · cmd/ctrl + enter'
          : 'cmd/ctrl + enter to submit')));

  const composerPlaceholder = ({
    observe:  'Where does the system itself slow execution? Process, decision, information, resource, org.',
    narrow:   'If this structural element were redesigned, would output materially rise? What contradicts?',
    classify: 'Which layer governs — process, decision, information, resource, or org design?',
    name:     'The one structural intervention. Concrete, not categorical.',
    settled:  'Sit with the architecture, or continue probing.',
  })[st.phase || 'observe'];

  return (
    <main className={'chamber' + (resting ? ' is-resting' : '') + (isFresh ? ' is-fresh-entry' : '') + (st.phase === 'settled' ? ' is-settled' : '')} data-screen-label="06 Structural Constraint Chamber">

      <header className="c-top">
        <div className="c-breadcrumb">
          <a href="../">KAIROS·1</a>
          <span className="sep">/</span>
          <span>Chamber 06</span>
        </div>
        <div className="c-name">
          Structural <em>Constraint</em>
        </div>
        <div className="c-telemetry">
          <span className="tcell phase">phase · <em>{st.phase}</em></span>
          <span className="tcell">elements · <em>{elemCount}</em></span>
          <span className="tcell">dependencies · <em>{depCount}</em></span>
          <button className="c-spine-glyph" type="button" onClick={spine.toggle} aria-label="Open the runtime spine" title="Open the runtime spine (S)"></button>
        </div>
      </header>

      <div className="c-body">

        <InquirySurface
          turns={turnsForUI}
          thinking={thinking}
          phase={st.phase}
          composerLocked={composerLocked}
          resting={resting}
          onSubmit={handleSubmit}
          onRest={enterRest}
          onResume={leaveRest}
          onCloseCycle={handleCloseCycle}
          composerHint={composerHint}
          composerPlaceholder={composerPlaceholder}
        />

        <section className="c-topology" aria-label="The architecture">
          <div className="c-topology-head">
            <span>— <em>Structural architecture</em></span>
            <span className="right">
              <span>{elemCount} element{elemCount === 1 ? '' : 's'}</span>
              <span>{depCount} dependenc{depCount === 1 ? 'y' : 'ies'}</span>
              {governing ? <span style={{ color: 'var(--heat)' }}>· governing layer surfaced</span> : null}
            </span>
          </div>

          <StructuralTopology session={st} history={state.history || []} />

          <div className="c-topology-foot">
            <div className="cell">
              <div className="label">Dominant layer</div>
              <div className="value">
                {st.classification ? <em>{st.classification}</em> : <em>not yet classified</em>}
              </div>
            </div>
            <div className="cell">
              <div className="label">Governing element</div>
              <div className="value">
                {governing
                  ? <em>{governing.id} · {(governing.label || '').slice(0, 32) || 'unnamed'}</em>
                  : <em>not yet surfaced</em>}
              </div>
            </div>
            <div className="cell">
              <div className="label">One structural intervention</div>
              <div className="value">
                {st.one_strengthening
                  ? (st.one_strengthening.length > 56 ? st.one_strengthening.slice(0, 55) + '…' : st.one_strengthening)
                  : <em>not yet named</em>}
              </div>
            </div>
            <div className="cell">
              <div className="label">Architectural integrity</div>
              <div className="value">
                <em>{governing ? 'governing surfaced' : (elemCount >= 3 ? 'narrowing' : 'observing')}</em>
              </div>
            </div>
          </div>
        </section>

      </div>

      <footer className="c-actions">
        <span>session · structural · started {new Date(st.started_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
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

      <Spine currentSlug="structural-constraint" visible={spine.visible} onDismiss={spine.close} />
      <Strata history={state.history || []} currentChamber="structural" visible={strata.visible} onDismiss={strata.close} />

    </main>
  );
}

const engRoot = ReactDOM.createRoot(document.getElementById('chamber-root'));
engRoot.render(<Engineering />);
