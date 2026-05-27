/* =============================================================
   KAIROS·1 — Sequence Chamber · state
   =============================================================
   The runtime's memory layer. Plain vanilla JS — no React in
   here so it can be loaded synchronously before the chamber
   mounts. Exposes window.kairos.state.* as a small surface.

   Persistence: localStorage['kairos.runtime.v1'].

   Memory shape — designed for the blueprint's longitudinal
   execution identity model (constraint memory, capacity memory,
   recovery memory, drift memory, systems memory, character
   memory). v1 only fills the slice the Sequence Chamber needs;
   the rest are reserved as null so future chambers slot in.
   ============================================================= */
(function () {
  const KEY = 'kairos.runtime.v1';

  function emptyState() {
    const now = Date.now();
    return {
      version: '0.1',
      identity: {
        first_visit: now,
        last_visit: now,
        sessions_count: 0,
      },
      // The slice the Sequence Chamber writes
      current_sequence: null,
      // The slice the Constraint Observatory writes
      current_constraint: null,
      // The slice the Structural Constraint Chamber writes
      current_structural: null,
      history: [],
      // Reserved for future chambers — kept here so the schema
      // is visible at the top of the file rather than discovered
      // later.
      memory: {
        constraint: null,    // recurring bottlenecks (chamber 02+)
        capacity:   null,    // throughput, overload thresholds
        recovery:   null,    // collapse signatures
        drift:      null,    // diffusion patterns
        systems:    null,    // team / org structures
        character:  null,    // honesty, patience, discipline
      },
      // Doctrinal observations the runtime has shown. Keyed by
      // observation id. Used to weather repeated showings into
      // infrastructural inscriptions rather than active warnings.
      doctrinal_seen: {},
    };
  }

  function emptySequence() {
    const now = Date.now();
    return {
      id: 'seq_' + now.toString(36),
      outcome: '',
      outcome_completion: '',
      outcome_reality_change: '',
      actions: [],         // [{ id, label, completion_criteria, friction, avoided, governs_flow, owner }]
      transitions: [],     // [{ id, from_id, to_id, stability }]
      inquiry_log: [],     // [{ role: 'runtime'|'reader', kind?, content, ts }]
      phase: 'outcome',    // outcome → sequencing → refining → settled
      started_at: now,
      last_modified: now,
    };
  }

  // Constraint Observatory session shape. Distinct from the
  // Sequence session because it's a different chamber with a
  // different topology, but shares the inquiry_log structure
  // so the inquiry UI is reusable.
  function emptyConstraintSession() {
    const now = Date.now();
    return {
      id: 'cn_' + now.toString(36),
      observations: [],    // [{ id, label, category, eliminated, governs, weight, evidence_for, evidence_against, friction_signature }]
      governing_id: null,  // observation id once surfaced
      classification: null,// 'human'|'structural'|'transitional'|'informational'|'strategic'|'resource'|'sequence'|'systemic'
      one_strengthening: '',
      inquiry_log: [],
      phase: 'observe',    // observe → narrow → classify → name → settled
      started_at: now,
      last_modified: now,
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.version) return s;
      }
    } catch (e) {}
    return emptyState();
  }

  function save(state) {
    state.identity.last_visit = Date.now();
    if (state.current_sequence) {
      state.current_sequence.last_modified = Date.now();
    }
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  function ensureSequence(state) {
    if (!state.current_sequence) {
      state.current_sequence = emptySequence();
      state.identity.sessions_count = (state.identity.sessions_count || 0) + 1;
    }
    return state.current_sequence;
  }

  function ensureConstraintSession(state) {
    if (!state.current_constraint) {
      state.current_constraint = emptyConstraintSession();
    }
    return state.current_constraint;
  }

  function nextObservationId(cn) {
    const used = new Set((cn.observations || []).map(o => o.id));
    let n = (cn.observations || []).length + 1;
    while (used.has('o' + n)) n++;
    return 'o' + n;
  }

  function nextActionId(seq) {
    const used = new Set(seq.actions.map(a => a.id));
    let n = seq.actions.length + 1;
    while (used.has('a' + n)) n++;
    return 'a' + n;
  }

  function nextTransitionId(seq) {
    const used = new Set(seq.transitions.map(t => t.id));
    let n = seq.transitions.length + 1;
    while (used.has('t' + n)) n++;
    return 't' + n;
  }

  // Apply a single delta returned by the runtime intelligence.
  function applyDelta(seq, d) {
    if (!d || !d.op) return;
    switch (d.op) {
      case 'set_outcome': {
        if (typeof d.outcome === 'string') seq.outcome = d.outcome.trim();
        if (typeof d.completion === 'string') seq.outcome_completion = d.completion.trim();
        if (typeof d.reality_change === 'string') seq.outcome_reality_change = d.reality_change.trim();
        break;
      }
      case 'add_action': {
        const id = d.id || nextActionId(seq);
        if (seq.actions.find(a => a.id === id)) break;
        seq.actions.push({
          id,
          label: (d.label || '').trim(),
          completion_criteria: (d.completion_criteria || '').trim(),
          friction: typeof d.friction === 'number' ? clamp01(d.friction) : 0,
          avoided: !!d.avoided,
          governs_flow: !!d.governs_flow,
          owner: d.owner || null,
        });
        break;
      }
      case 'update_action': {
        const a = seq.actions.find(x => x.id === d.id);
        if (!a) break;
        if (typeof d.label === 'string') a.label = d.label.trim();
        if (typeof d.completion_criteria === 'string') a.completion_criteria = d.completion_criteria.trim();
        if (typeof d.friction === 'number') a.friction = clamp01(d.friction);
        if (typeof d.avoided === 'boolean') a.avoided = d.avoided;
        if (typeof d.governs_flow === 'boolean') a.governs_flow = d.governs_flow;
        if (typeof d.owner === 'string') a.owner = d.owner;
        break;
      }
      case 'remove_action': {
        seq.actions = seq.actions.filter(a => a.id !== d.id);
        seq.transitions = seq.transitions.filter(t => t.from_id !== d.id && t.to_id !== d.id);
        break;
      }
      case 'add_transition': {
        if (!d.from_id || !d.to_id) break;
        if (!seq.actions.find(a => a.id === d.from_id)) break;
        if (!seq.actions.find(a => a.id === d.to_id)) break;
        if (seq.transitions.find(t => t.from_id === d.from_id && t.to_id === d.to_id)) break;
        seq.transitions.push({
          id: nextTransitionId(seq),
          from_id: d.from_id,
          to_id: d.to_id,
          stability: typeof d.stability === 'number' ? clamp01(d.stability) : 0.5,
        });
        break;
      }
      case 'update_transition': {
        const t = seq.transitions.find(x => x.id === d.id || (x.from_id === d.from_id && x.to_id === d.to_id));
        if (!t) break;
        if (typeof d.stability === 'number') t.stability = clamp01(d.stability);
        break;
      }
      case 'mark_governing': {
        if (!d.action_id) break;
        seq.actions.forEach(a => { a.governs_flow = (a.id === d.action_id); });
        break;
      }
      case 'set_phase': {
        if (['outcome','sequencing','refining','settled'].includes(d.phase)) seq.phase = d.phase;
        break;
      }
    }
  }

  function applyDeltas(seq, deltas) {
    if (!Array.isArray(deltas)) return;
    deltas.forEach(d => applyDelta(seq, d));
  }

  // Constraint-Observatory delta vocabulary. Kept separate from
  // sequence deltas because the chambers have different ontologies.
  function applyConstraintDelta(cn, d) {
    if (!d || !d.op) return;
    switch (d.op) {
      case 'add_observation': {
        const id = d.id || nextObservationId(cn);
        if (cn.observations.find(o => o.id === id)) break;
        cn.observations.push({
          id,
          label: (d.label || '').trim(),
          category: d.category || null,
          eliminated: !!d.eliminated,
          governs: !!d.governs,
          weight: typeof d.weight === 'number' ? clamp01(d.weight) : 0.5,
          evidence_for: (d.evidence_for || '').trim(),
          evidence_against: (d.evidence_against || '').trim(),
        });
        break;
      }
      case 'update_observation': {
        const o = cn.observations.find(x => x.id === d.id);
        if (!o) break;
        if (typeof d.label === 'string') o.label = d.label.trim();
        if (d.category !== undefined) o.category = d.category;
        if (typeof d.eliminated === 'boolean') o.eliminated = d.eliminated;
        if (typeof d.weight === 'number') o.weight = clamp01(d.weight);
        if (typeof d.evidence_for === 'string') o.evidence_for = d.evidence_for.trim();
        if (typeof d.evidence_against === 'string') o.evidence_against = d.evidence_against.trim();
        break;
      }
      case 'remove_observation': {
        cn.observations = cn.observations.filter(o => o.id !== d.id);
        if (cn.governing_id === d.id) cn.governing_id = null;
        break;
      }
      case 'mark_governing': {
        if (!d.observation_id) break;
        cn.governing_id = d.observation_id;
        cn.observations.forEach(o => { o.governs = (o.id === d.observation_id); });
        break;
      }
      case 'classify': {
        const allowed = ['human','structural','transitional','informational','strategic','resource','sequence','systemic'];
        if (allowed.includes(d.classification)) cn.classification = d.classification;
        break;
      }
      case 'set_one_strengthening': {
        if (typeof d.text === 'string') cn.one_strengthening = d.text.trim();
        break;
      }
      case 'set_phase': {
        if (['observe','narrow','classify','name','settled'].includes(d.phase)) cn.phase = d.phase;
        break;
      }
    }
  }

  function applyConstraintDeltas(cn, deltas) {
    if (!Array.isArray(deltas)) return;
    deltas.forEach(d => applyConstraintDelta(cn, d));
  }

  // =============================================================
  // STRUCTURAL CONSTRAINT CHAMBER — layered architecture ontology
  // =============================================================
  function emptyStructuralSession() {
    const now = Date.now();
    return {
      id: 'st_' + now.toString(36),
      elements: [],       // [{ id, label, layer: 'process'|'decision'|'information'|'resource', friction, governs, owner, evidence_for, evidence_against }]
      dependencies: [],   // [{ id, from_id, to_id, friction }]
      governing_id: null,
      classification: null, // process|decision|information|resource|org
      one_strengthening: '',
      inquiry_log: [],
      phase: 'observe',   // observe → narrow → classify → name → settled
      started_at: now,
      last_modified: now,
    };
  }

  function ensureStructuralSession(state) {
    if (!state.current_structural) {
      state.current_structural = emptyStructuralSession();
    }
    return state.current_structural;
  }

  function nextElementId(st) {
    const used = new Set((st.elements || []).map(e => e.id));
    let n = (st.elements || []).length + 1;
    while (used.has('e' + n)) n++;
    return 'e' + n;
  }
  function nextDependencyId(st) {
    const used = new Set((st.dependencies || []).map(d => d.id));
    let n = (st.dependencies || []).length + 1;
    while (used.has('d' + n)) n++;
    return 'd' + n;
  }

  function applyStructuralDelta(st, d) {
    if (!d || !d.op) return;
    const VALID_LAYERS = ['process','decision','information','resource'];
    switch (d.op) {
      case 'add_element': {
        const id = d.id || nextElementId(st);
        if (st.elements.find(e => e.id === id)) break;
        st.elements.push({
          id,
          label: (d.label || '').trim(),
          layer: VALID_LAYERS.includes(d.layer) ? d.layer : 'process',
          friction: typeof d.friction === 'number' ? clamp01(d.friction) : 0.4,
          governs: !!d.governs,
          owner: d.owner || null,
          evidence_for: (d.evidence_for || '').trim(),
          evidence_against: (d.evidence_against || '').trim(),
        });
        break;
      }
      case 'update_element': {
        const e = st.elements.find(x => x.id === d.id);
        if (!e) break;
        if (typeof d.label === 'string') e.label = d.label.trim();
        if (VALID_LAYERS.includes(d.layer)) e.layer = d.layer;
        if (typeof d.friction === 'number') e.friction = clamp01(d.friction);
        if (typeof d.evidence_for === 'string') e.evidence_for = d.evidence_for.trim();
        if (typeof d.evidence_against === 'string') e.evidence_against = d.evidence_against.trim();
        break;
      }
      case 'remove_element': {
        st.elements = st.elements.filter(e => e.id !== d.id);
        st.dependencies = st.dependencies.filter(x => x.from_id !== d.id && x.to_id !== d.id);
        if (st.governing_id === d.id) st.governing_id = null;
        break;
      }
      case 'add_dependency': {
        if (!d.from_id || !d.to_id) break;
        if (!st.elements.find(e => e.id === d.from_id)) break;
        if (!st.elements.find(e => e.id === d.to_id)) break;
        if (st.dependencies.find(x => x.from_id === d.from_id && x.to_id === d.to_id)) break;
        st.dependencies.push({
          id: nextDependencyId(st),
          from_id: d.from_id,
          to_id: d.to_id,
          friction: typeof d.friction === 'number' ? clamp01(d.friction) : 0.4,
        });
        break;
      }
      case 'mark_governing': {
        if (!d.element_id) break;
        st.governing_id = d.element_id;
        st.elements.forEach(e => { e.governs = (e.id === d.element_id); });
        break;
      }
      case 'classify': {
        const allowed = ['process','decision','information','resource','org'];
        if (allowed.includes(d.classification)) st.classification = d.classification;
        break;
      }
      case 'set_one_strengthening': {
        if (typeof d.text === 'string') st.one_strengthening = d.text.trim();
        break;
      }
      case 'set_phase': {
        if (['observe','narrow','classify','name','settled'].includes(d.phase)) st.phase = d.phase;
        break;
      }
    }
  }

  function applyStructuralDeltas(st, deltas) {
    if (!Array.isArray(deltas)) return;
    deltas.forEach(d => applyStructuralDelta(st, d));
  }

  function summarizeStructural(st) {
    if (!st) return '(no structural session yet)';
    const lines = [];
    lines.push('PHASE: ' + st.phase);
    lines.push('CLASSIFICATION: ' + (st.classification || '(undefined)'));
    if (st.one_strengthening) lines.push('ONE STRENGTHENING: ' + st.one_strengthening);
    lines.push('ELEMENTS (' + st.elements.length + '):');
    st.elements.forEach(e => {
      const flags = [];
      if (e.governs) flags.push('GOVERNING');
      flags.push('layer=' + e.layer);
      flags.push('friction=' + (e.friction || 0).toFixed(2));
      lines.push('  - ' + e.id + ': ' + (e.label || '(unnamed)') + ' [' + flags.join(', ') + ']');
      if (e.evidence_for) lines.push('      for: ' + e.evidence_for);
      if (e.evidence_against) lines.push('      against: ' + e.evidence_against);
    });
    lines.push('DEPENDENCIES (' + st.dependencies.length + '):');
    st.dependencies.forEach(d => {
      lines.push('  - ' + d.from_id + ' → ' + d.to_id + ' [friction=' + (d.friction || 0).toFixed(2) + ']');
    });
    return lines.join('\n');
  }

  function clamp01(n) {
    n = +n;
    if (isNaN(n)) return 0;
    return Math.max(0, Math.min(1, n));
  }

  // Append a single inquiry log entry. Used by both the runtime
  // (questions, observations) and the reader (responses).
  function logEntry(seq, role, content, kind) {
    seq.inquiry_log.push({
      role,
      kind: kind || (role === 'runtime' ? 'inquiry' : 'response'),
      content: String(content || '').trim(),
      ts: Date.now(),
    });
  }

  // Compact, model-readable summary of the constraint session.
  function summarizeConstraint(cn) {
    if (!cn) return '(no constraint session yet)';
    const lines = [];
    lines.push('PHASE: ' + cn.phase);
    lines.push('CLASSIFICATION: ' + (cn.classification || '(undefined)'));
    if (cn.one_strengthening) lines.push('ONE STRENGTHENING: ' + cn.one_strengthening);
    lines.push('OBSERVATIONS (' + cn.observations.length + '):');
    cn.observations.forEach(o => {
      const flags = [];
      if (o.governs) flags.push('GOVERNING');
      if (o.eliminated) flags.push('ELIMINATED');
      flags.push('weight=' + (o.weight || 0).toFixed(2));
      if (o.category) flags.push('cat=' + o.category);
      lines.push('  - ' + o.id + ': ' + (o.label || '(unnamed)') + ' [' + flags.join(', ') + ']');
      if (o.evidence_for) lines.push('      for: ' + o.evidence_for);
      if (o.evidence_against) lines.push('      against: ' + o.evidence_against);
    });
    return lines.join('\n');
  }

  // Compact, model-readable summary of the sequence state.
  // Used as part of the runtime intelligence prompt so Claude
  // has the current topology in front of it on every turn.
  function summarize(seq) {
    if (!seq) return '(no sequence yet)';
    const lines = [];
    lines.push('OUTCOME: ' + (seq.outcome || '(undefined)'));
    if (seq.outcome_completion) lines.push('COMPLETION: ' + seq.outcome_completion);
    if (seq.outcome_reality_change) lines.push('REALITY CHANGE: ' + seq.outcome_reality_change);
    lines.push('PHASE: ' + seq.phase);
    lines.push('ACTIONS (' + seq.actions.length + '):');
    seq.actions.forEach(a => {
      const flags = [];
      if (a.governs_flow) flags.push('GOVERNING');
      if (a.avoided) flags.push('AVOIDED');
      if (a.friction > 0) flags.push('friction=' + a.friction.toFixed(2));
      lines.push('  - ' + a.id + ': ' + (a.label || '(unnamed)')
        + (a.completion_criteria ? ' [done: ' + a.completion_criteria + ']' : '')
        + (flags.length ? ' [' + flags.join(', ') + ']' : ''));
    });
    lines.push('TRANSITIONS (' + seq.transitions.length + '):');
    seq.transitions.forEach(t => {
      lines.push('  - ' + t.from_id + ' → ' + t.to_id + ' [stability=' + t.stability.toFixed(2) + ']');
    });
    return lines.join('\n');
  }

  // Recent inquiry log as a transcript the runtime can read.
  function transcript(seq, n) {
    if (!seq) return '';
    const turns = (seq.inquiry_log || []).slice(-(n || 12));
    return turns.map(t => {
      const tag = t.role === 'runtime' ? 'RUNTIME' : 'READER';
      return '[' + tag + (t.kind && t.kind !== 'inquiry' && t.kind !== 'response' ? ':' + t.kind : '') + '] ' + t.content;
    }).join('\n\n');
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  window.kairos = window.kairos || {};
  window.kairos.state = {
    load, save, reset,
    ensureSequence,
    ensureConstraintSession,
    ensureStructuralSession,
    emptySequence,
    emptyConstraintSession,
    emptyStructuralSession,
    applyDelta, applyDeltas,
    applyConstraintDelta, applyConstraintDeltas,
    applyStructuralDelta, applyStructuralDeltas,
    logEntry,
    summarize,
    summarizeConstraint,
    summarizeStructural,
    transcript,
    clamp01,
  };
})();
