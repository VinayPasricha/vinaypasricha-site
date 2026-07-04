/* =============================================================
   KAIROS·1 — Constraint Observatory · orchestrator
   =============================================================
   The diagnostic chamber. Identifies the true governing limit.
   Opens with a different question than Sequence Chamber. Builds
   a pressure field rather than an action chain. Holds the same
   atmospheric register, uses the same memory layer, shares the
   spine.
   ============================================================= */

const { useEffect: oUseEffect, useState: oUseState, useRef: oUseRef, useCallback: oUseCallback } = React;

const OBSERVATORY_OPENING = [
  {
    role: 'runtime',
    kind: 'open',
    content:
      "Where does reality repeatedly resist you?\n\nNot emotionally. Operationally — where flow slows, output degrades, sequence destabilizes, recovery fails. Name one such place.",
  },
];

async function obsLoadGrounding() {
  if (window.kairos && window.kairos._obsGrounding) return window.kairos._obsGrounding;
  const out = { doctrine: '', nodeSpec: '' };
  try {
    const book = await window.library.getBook('execution-doctrine');
    if (book && book.text) {
      // Take a slice covering The Governing Limit + Reading the Constraint
      // + Discipline of One Constraint. ~30k chars centered on those chapters.
      const t = book.text;
      // Heuristic: find "Chapter 3" through "Chapter 9" inclusive.
      const start = t.indexOf('Chapter 3');
      const end = t.indexOf('Chapter 10');
      out.doctrine = (start > 0 && end > start)
        ? t.slice(Math.max(0, start - 1500), end + 800)
        : t.slice(0, 28000);
    }
  } catch (e) {}
  try {
    const res = await fetch('../nodes/02-constraint-observatory.md', { cache: 'force-cache' });
    if (res.ok) out.nodeSpec = await res.text();
  } catch (e) {}
  window.kairos = window.kairos || {};
  window.kairos._obsGrounding = out;
  return out;
}

function obsBuildSystemPrompt({ doctrine, nodeSpec }) {
  return [
    "You are the runtime intelligence of THE CONSTRAINT OBSERVATORY — the second chamber of KAIROS·1, the diagnostic heart of the runtime, built from Vinay Pasricha's Execution Doctrine.",
    "",
    "You are not a chatbot. You are not analytics. You are not coaching.",
    "You are the chamber's voice: calm, forensic, low-noise, reality-oriented, structurally revealing.",
    "Your purpose: identify the true governing limit suppressing output. Not the loudest problem. Not the most emotional. The actual constraint.",
    "",
    "=== THE CHAMBER'S CONSTITUTION (Runtime Node 02) ===",
    nodeSpec || '(spec unavailable — operate from doctrine only)',
    "",
    "=== THE DOCTRINE (relevant excerpt — Governing Limit / Reading the Constraint) ===",
    doctrine || '(doctrine unavailable)',
    "",
    "=== YOUR DISCIPLINE ===",
    "1. Symptoms are not constraints. The first visible problem is often downstream noise. Search upstream.",
    "2. Friction is execution evidence. Not annoyance. Diagnostic signal.",
    "3. Difficulty ≠ governing limit. Ask: if strengthened, would total system capacity materially rise?",
    "4. Only ONE constraint governs the current cycle. Resist multiple primary constraints.",
    "5. Diagnosis is probabilistic. Confidence, evidence, contradiction, unresolved uncertainty — preserve all of them.",
    "6. Narrow through elimination, not brainstorming. Ask the reader to test candidates against the doctrine.",
    "7. Prefer brevity. A single question with held silence is heavier than three explanatory sentences. Sometimes the right 'say' is just one short question.",
    "8. No hype, no exclamation marks, no motivation, no praise. Quote the doctrine sparingly when a reader's situation maps directly to it.",
    "9. When governing is named, classification is set, and one_strengthening is defined — issue a single 'settle' turn with a quietly observational say (e.g. 'This cycle appears structurally complete.'). Never declare it closed; the reader decides what to do with the observation.",
    "",
    "=== PHASE PROGRESSION ===",
    "• observe   — capture observations of where reality resists. Add via add_observation. Stay here until 3–5 candidates exist.",
    "• narrow    — eliminate candidates that fail the governing test. Mark eliminated via update_observation(eliminated: true). Adjust weight on remaining.",
    "• classify  — classify the dominant candidate. Issue classify with one of: human, structural, transitional, informational, strategic, resource, sequence, systemic.",
    "• name      — issue mark_governing on the surfaced candidate. Then identify the one_strengthening — the single highest-leverage intervention.",
    "• settled   — the chamber has done its work. The reader can sit with what was surfaced.",
    "",
    "=== ROUTING — when to suggest another chamber ===",
    "• If sequence clarity is the actual prerequisite (reader cannot describe Action 1 → Action N) — say so and recommend the Sequence Chamber.",
    "• If classification = human — recommend the Human Constraint Chamber.",
    "• If classification = structural — recommend the Structural Constraint Chamber.",
    "Recommend doctrinally, in the inquiry stream as a quiet observation. Never as a CTA.",
    "",
    "=== RESPONSE CONTRACT — STRICT JSON ONLY ===",
    "Return a single valid JSON object. No prose before or after. No markdown code fences.",
    "",
    "Shape:",
    "{",
    '  "kind": "inquiry" | "observation" | "settle",',
    '  "say": "1-2 short sentences. The next thing the chamber says.",',
    '  "deltas": [',
    '    { "op": "add_observation", "label": "string", "category": "human|structural|transitional|informational|strategic|resource|sequence|systemic"|null, "weight": 0.5, "evidence_for": "string", "evidence_against": "string" },',
    '    { "op": "update_observation", "id": "o1", "label": "string", "eliminated": false, "weight": 0.0, "evidence_for": "string", "evidence_against": "string" },',
    '    { "op": "mark_governing", "observation_id": "o2" },',
    '    { "op": "classify", "classification": "human|structural|transitional|informational|strategic|resource|sequence|systemic" },',
    '    { "op": "set_one_strengthening", "text": "string" },',
    '    { "op": "set_phase", "phase": "observe|narrow|classify|name|settled" }',
    '  ]',
    "}",
    "",
    "DELTA RULES:",
    "• Use add_observation when the reader names a place reality resists. Keep the label specific to their words. Weight starts at 0.5; raise when evidence accumulates, lower when contradicted.",
    "• Use update_observation(eliminated: true) when an observation fails the governing test (i.e. strengthening it would NOT materially raise system capacity).",
    "• Use mark_governing once narrowing produces a clear front-runner. Sequence the work — narrow, classify, name — but once 3+ observations have been examined and one stands out as the governing limit, you MUST mark_governing, classify it, and set_one_strengthening; the cycle cannot settle until those exist. Do not narrow indefinitely.",
    "• Use classify after narrowing has identified the dominant category.",
    "• Use set_one_strengthening for the single highest-leverage intervention. Phrase it as a concrete action, not a category.",
    "• If no structural change is needed, return deltas: [].",
    "",
    "kind:",
    "• 'inquiry'     — the next diagnostic question",
    "• 'observation' — a structural pattern surfaced (italicized in UI)",
    "• 'settle'      — the chamber observes structural stillness; the reader will decide whether to close. Use sparingly. The say should be hesitant and observational — e.g. 'This cycle appears structurally complete.' Never assume the reader's decision.",
  ].join('\n');
}

function obsBuildUserMessage(cn, readerInput) {
  return [
    "=== CURRENT PRESSURE FIELD ===",
    window.kairos.state.summarizeConstraint(cn),
    "",
    "=== RECENT TRANSCRIPT (oldest first) ===",
    window.kairos.state.transcript(cn, 10) || '(none)',
    "",
    "=== READER'S NEW RESPONSE ===",
    readerInput,
    "",
    "Return the JSON object only. No prose, no fences.",
  ].join('\n');
}

// Robust JSON extraction — same approach as the Sequence Chamber
function obsExtractJSON(text) {
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

async function obsAskRuntime(cn, readerInput) {
  if (!window.claude || typeof window.claude.complete !== 'function') {
    throw new Error('Runtime intelligence unavailable on this page.');
  }
  const grounding = await obsLoadGrounding();
  const system = obsBuildSystemPrompt(grounding);
  const user = obsBuildUserMessage(cn, readerInput);

  const raw = await window.claude.complete({
    system,
    messages: [{ role: 'user', content: user }],
  });

  const parsed = obsExtractJSON(raw);
  if (!parsed || typeof parsed.say !== 'string') {
    return {
      kind: 'observation',
      say: 'The runtime did not parse cleanly. Restate that — slower, more specific.',
      deltas: [],
    };
  }
  parsed.deltas = Array.isArray(parsed.deltas) ? parsed.deltas : [];
  parsed.kind = ['inquiry','observation','settle'].includes(parsed.kind) ? parsed.kind : 'inquiry';
  return parsed;
}

// =============================================================
// OBSERVATORY COMPONENT
// =============================================================
function Observatory() {
  const stateRef = oUseRef(null);
  const [, force] = oUseState(0);
  const tick = oUseCallback(() => force(x => x + 1), []);

  const [thinking, setThinking] = oUseState(false);
  const [errorNote, setErrorNote] = oUseState(null);
  const [composerLocked, setComposerLocked] = oUseState(false);
  const [resting, setResting] = oUseState(false);
  const lockTimer = oUseRef(null);

  oUseEffect(() => {
    const s = window.kairos.state.load();
    if (window.kairos.landmarks && window.kairos.landmarks.maybeSeedDemo) {
      window.kairos.landmarks.maybeSeedDemo(s);
    }
    const cn = window.kairos.state.ensureConstraintSession(s);
    const isFresh = !cn.inquiry_log || cn.inquiry_log.length === 0;
    isFreshEntryRef.current = isFresh;
    if (isFresh) {
      // Soft doctrinal gravity (Refinement 06) — Constraint diagnosis
      // benefits from sequence clarity having first surfaced. If the
      // Sequence Chamber has not been touched, the chamber quietly
      // observes this. Doctrinal warning, not gate.
      // Refinement 07: repeated observations weather into inscription
      // (kind 'doctrine-aged') rather than re-asserting (kind 'observation').
      const seqInhabited =
        (s.current_sequence && (s.current_sequence.inquiry_log || []).length > 1) ||
        (s.history || []).some(h => h.kind === 'sequence' || (!h.kind && h.data && h.data.actions));
      if (!seqInhabited) {
        s.doctrinal_seen = s.doctrinal_seen || {};
        const docKey = 'constraint-without-sequence';
        const isRepeat = !!s.doctrinal_seen[docKey];
        window.kairos.state.logEntry(
          cn, 'runtime',
          'Constraint diagnosis without sequence clarity often produces distortion.\n\nThe Sequence Chamber has not yet been entered. Continue here, or return to begin with the pathway.',
          isRepeat ? 'doctrine-aged' : 'observation'
        );
        s.doctrinal_seen[docKey] = (s.doctrinal_seen[docKey] || 0) + 1;
      }
      OBSERVATORY_OPENING.forEach(o => {
        window.kairos.state.logEntry(cn, o.role, o.content, o.kind);
      });
    }
    window.kairos.state.save(s);
    stateRef.current = s;
    tick();
    obsLoadGrounding().catch(() => {});
  }, [tick]);

  oUseEffect(() => () => clearTimeout(lockTimer.current), []);

  // Receive a transition handshake if we just arrived from another chamber
  oUseEffect(() => {
    if (window.kairos && window.kairos.transition) {
      window.kairos.transition.receive({ slug: 'constraint' });
    }
  }, []);

  // Spine — summonable
  const spine = (typeof useSpine === 'function') ? useSpine() : { visible: false, open: () => {}, close: () => {}, toggle: () => {} };
  const strata = (typeof useStrata === 'function') ? useStrata() : { visible: false, open: () => {}, close: () => {}, toggle: () => {} };
  const isFreshEntryRef = oUseRef(false);

  // Chamber weight — the Constraint Observatory is the denser,
  // more gravitational room. Set body attribute so atmosphere CSS
  // applies the heavier ground + heavier central pressure field.
  oUseEffect(() => {
    document.body.setAttribute('data-chamber', 'constraint');
    const s = window.kairos.state.load();
    window.kairos.state.markChamberVisit(s, 'constraint');
    return () => document.body.removeAttribute('data-chamber');
  }, []);

  const state = stateRef.current;
  const cn = state && state.current_constraint;

  const handleSubmit = oUseCallback(async (text) => {
    if (!state || !cn) return;
    window.kairos.state.logEntry(cn, 'reader', text);
    window.kairos.state.save(state);
    setThinking(true);
    setErrorNote(null);
    tick();
    try {
      const reply = await obsAskRuntime(cn, text);
      window.kairos.state.applyConstraintDeltas(cn, reply.deltas);
      window.kairos.state.logEntry(cn, 'runtime', reply.say, reply.kind);
      window.kairos.state.save(state);
      const holdMs = reply.kind === 'observation' ? 2400
                    : reply.kind === 'settle'    ? 3200
                    :                              1400;
      setComposerLocked(true);
      clearTimeout(lockTimer.current);
      lockTimer.current = setTimeout(() => setComposerLocked(false), holdMs);
    } catch (e) {
      setErrorNote(
        'The runtime is not reachable from this page. ' +
        'Open the chamber from a host that provides the intelligence layer.'
      );
      console.warn('[observatory] askRuntime failed:', e);
    } finally {
      setThinking(false);
      tick();
    }
  }, [state, cn, tick]);

  const enterRest = oUseCallback(() => {
    setResting(true);
    setComposerLocked(false);
    clearTimeout(lockTimer.current);
  }, []);
  const leaveRest = oUseCallback(() => setResting(false), []);

  // Hybrid sovereignty — reader-invoked close.
  const handleCloseCycle = oUseCallback(() => {
    if (!state || !cn) return;
    if (cn.observations.length > 0) {
      state.history = state.history || [];
      state.history.push({ kind: 'constraint', data: cn, closed_at: Date.now() });
    }
    state.current_constraint = window.kairos.state.emptyConstraintSession();
    OBSERVATORY_OPENING.forEach(o => {
      window.kairos.state.logEntry(state.current_constraint, o.role, o.content, o.kind);
    });
    window.kairos.state.save(state);
    isFreshEntryRef.current = true;
    tick();
  }, [state, cn, tick]);

  const handleReset = oUseCallback(() => {
    if (!window.confirm('Reset this constraint session? The pressure field will be cleared. (History archive is preserved.)')) return;
    if (!state || !cn) return;
    if (cn.observations.length > 0) {
      state.history = state.history || [];
      state.history.push({ kind: 'constraint', data: cn, closed_at: Date.now() });
    }
    state.current_constraint = window.kairos.state.emptyConstraintSession();
    OBSERVATORY_OPENING.forEach(o => {
      window.kairos.state.logEntry(state.current_constraint, o.role, o.content, o.kind);
    });
    window.kairos.state.save(state);
    tick();
  }, [state, cn, tick]);

  if (!state || !cn) {
    return (
      <div style={{ padding: '80px 48px', fontFamily: 'var(--mono)', color: 'var(--ink-4)', letterSpacing: '0.3em', textTransform: 'uppercase', fontSize: 10 }}>
        Initialising…
      </div>
    );
  }

  const obsCount = cn.observations.length;
  const eliminatedCount = cn.observations.filter(o => o.eliminated).length;
  const governing = cn.observations.find(o => o.governs);
  const priorCycles = (state.history || []).filter(h => h.kind === 'constraint').length;
  const isFresh = isFreshEntryRef.current && (cn.inquiry_log || []).length <= 1;

  const turnsForUI = (cn.inquiry_log || []).map(t => ({
    role: t.role, kind: t.kind, content: t.content
  }));

  const composerHint = thinking ? 'the runtime is reading'
    : (cn.phase === 'observe' ? 'name one place at a time · cmd/ctrl + enter'
      : (cn.phase === 'narrow' ? 'test against the governing question · cmd/ctrl + enter'
        : (cn.phase === 'classify' ? 'classify · cmd/ctrl + enter'
          : 'cmd/ctrl + enter to submit')));

  const composerPlaceholder = ({
    observe:  'Where does reality repeatedly resist? Be specific. One place at a time.',
    narrow:   'If this were strengthened, would output materially rise? What contradicts the diagnosis?',
    classify: 'What kind of constraint is this — human, structural, transitional, informational, strategic, resource-based, sequence-based, or systemic?',
    name:     'The one strengthening. Concrete, not categorical.',
    settled:  'Sit with what surfaced, or continue probing.',
  })[cn.phase || 'observe'];

  return (
    <main className={'chamber' + (resting ? ' is-resting' : '') + (isFresh ? ' is-fresh-entry' : '') + (cn.phase === 'settled' ? ' is-settled' : '')} data-screen-label="02 Constraint Observatory">

      <header className="c-top">
        <div className="c-breadcrumb">
          <a href="../">KAIROS·1</a>
          <span className="sep">/</span>
          <span>Chamber 02</span>
        </div>
        <div className="c-name">
          Constraint <em>Observatory</em>
        </div>
        <div className="c-telemetry">
          <span className="tcell phase">phase · <em>{cn.phase}</em></span>
          <span className="tcell">observations · <em>{obsCount}</em></span>
          <span className="tcell">eliminated · <em>{eliminatedCount}</em></span>
          <button
            className="c-spine-glyph"
            type="button"
            onClick={spine.toggle}
            aria-label="Open the runtime spine"
            title="Open the runtime spine (S)"
          ></button>
        </div>
      </header>

      <div className="c-body">

        <InquirySurface
          turns={turnsForUI}
          thinking={thinking}
          phase={cn.phase}
          composerLocked={composerLocked}
          resting={resting}
          onSubmit={handleSubmit}
          onRest={enterRest}
          onResume={leaveRest}
          onCloseCycle={handleCloseCycle}
          composerHint={composerHint}
          composerPlaceholder={composerPlaceholder}
        />

        <section className="c-topology" aria-label="The pressure topology">
          <div className="c-topology-head">
            <span>— <em>Pressure topology</em></span>
            <span className="right">
              <span>{obsCount} candidate{obsCount === 1 ? '' : 's'}</span>
              <span>{eliminatedCount} eliminated</span>
              {governing ? <span style={{ color: 'var(--heat)' }}>· governing named</span> : null}
            </span>
          </div>

          <PressureTopology session={cn} history={state.history || []} />

          <div className="c-topology-foot">
            <div className="cell">
              <div className="label">Classification</div>
              <div className="value">
                {cn.classification ? <em>{cn.classification}</em> : <em>not yet classified</em>}
              </div>
            </div>
            <div className="cell">
              <div className="label">Governing limit</div>
              <div className="value">
                {governing
                  ? <em>{governing.id} · {(governing.label || '').slice(0, 32) || 'unnamed'}</em>
                  : <em>not yet surfaced</em>}
              </div>
            </div>
            <div className="cell">
              <div className="label">One strengthening</div>
              <div className="value">
                {cn.one_strengthening
                  ? (cn.one_strengthening.length > 56 ? cn.one_strengthening.slice(0, 55) + '…' : cn.one_strengthening)
                  : <em>not yet named</em>}
              </div>
            </div>
            <div className="cell">
              <div className="label">Diagnostic confidence</div>
              <div className="value">
                <em>{governing ? 'high' : (obsCount >= 3 ? 'narrowing' : 'observing')}</em>
              </div>
            </div>
          </div>
        </section>

      </div>

      <footer className="c-actions">
        <span>session · constraint · started {new Date(cn.started_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
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

      <Spine currentSlug="constraint" visible={spine.visible} onDismiss={spine.close} />
      <Strata history={state.history || []} currentChamber="constraint" visible={strata.visible} onDismiss={strata.close} />

    </main>
  );
}

const obsRoot = ReactDOM.createRoot(document.getElementById('chamber-root'));
obsRoot.render(<Observatory />);
