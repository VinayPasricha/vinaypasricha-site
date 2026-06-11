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
        last_chamber: null,    // slug of last chamber the reader was in
        last_chamber_at: null, // ms timestamp
        return_count: 0,       // times the reader has returned from dormancy >= tier 1
      },
      // The slice the Sequence Chamber writes
      current_sequence: null,
      // The slice the Constraint Observatory writes
      current_constraint: null,
      // The slice the Structural Constraint Chamber writes
      current_structural: null,
      // The slice the Capacity Expansion Chamber writes
      current_capacity: null,
      // The slice the Multi-Scale Systems Chamber writes
      current_multiscale: null,
      // The slice the Character of the Executor Chamber writes
      current_character: null,
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

  // Refinement 09: dormancy tiers.
  function dormancyTier(state) {
    if (!state || !state.identity) return 0;
    const last = state.identity.last_visit || 0;
    if (!last) return 0;
    const days = (Date.now() - last) / 86400000;
    if (days < 1) return 0;
    if (days < 14) return 1;
    if (days < 60) return 2;
    return 3;
  }

  function totalVisits(state) {
    return (state && state.identity && state.identity.sessions_count) || 0;
  }

  // Refinement 10: mark which chamber the reader is currently in,
  // so the threshold can carry residue of their last descent.
  function markChamberVisit(state, slug) {
    if (!state || !state.identity) return;
    state.identity.last_chamber = slug;
    state.identity.last_chamber_at = Date.now();
    save(state);
  }

  // Refinement 10: on returning from dormancy >= 1, mark the return.
  // The first page load after absence carries return phenomenology.
  function consumeReturnEvent(state) {
    if (!state || !state.identity) return null;
    const tier = dormancyTier(state);
    if (tier === 0) return null;
    // Has this return already been consumed in this session?
    if (state.identity._return_consumed) return null;
    state.identity._return_consumed = true;
    state.identity.return_count = (state.identity.return_count || 0) + 1;
    save(state);
    return { tier, return_count: state.identity.return_count, last_chamber: state.identity.last_chamber };
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

  // =============================================================
  // CAPACITY EXPANSION CHAMBER — concentric-field ontology
  // =============================================================
  // Each "load" is a kind of complexity / responsibility / ambiguity
  // the executor carries. State: stabilized (inside the field, calm)
  // or active (orbiting; strain 0..1 → distance from center).
  // The carrying-field radius itself expands as loads stabilize.
  function emptyCapacitySession() {
    const now = Date.now();
    return {
      id: 'cap_' + now.toString(36),
      loads: [],                // [{ id, label, state: 'stabilized'|'active'|'overload', strain (0..1), since, evidence_for, evidence_against }]
      field_radius_tier: 1,     // 1..5 — coarse scale of current carrying field
      one_stabilization: '',    // the single widening intervention
      inquiry_log: [],
      phase: 'observe',         // observe → stabilize → widen → settled
      started_at: now,
      last_modified: now,
    };
  }
  function ensureCapacitySession(state) {
    if (!state.current_capacity) state.current_capacity = emptyCapacitySession();
    return state.current_capacity;
  }
  function nextLoadId(cap) {
    const used = new Set((cap.loads || []).map(l => l.id));
    let n = (cap.loads || []).length + 1;
    while (used.has('L' + n)) n++;
    return 'L' + n;
  }
  function applyCapacityDelta(cap, d) {
    if (!d || !d.op) return;
    const VALID_STATES = ['stabilized','active','overload'];
    switch (d.op) {
      case 'add_load': {
        const id = d.id || nextLoadId(cap);
        if (cap.loads.find(l => l.id === id)) break;
        cap.loads.push({
          id,
          label: (d.label || '').trim(),
          state: VALID_STATES.includes(d.state) ? d.state : 'active',
          strain: typeof d.strain === 'number' ? clamp01(d.strain) : 0.5,
          since: Date.now(),
          evidence_for: (d.evidence_for || '').trim(),
          evidence_against: (d.evidence_against || '').trim(),
        });
        break;
      }
      case 'update_load': {
        const l = cap.loads.find(x => x.id === d.id);
        if (!l) break;
        if (typeof d.label === 'string') l.label = d.label.trim();
        if (VALID_STATES.includes(d.state)) l.state = d.state;
        if (typeof d.strain === 'number') l.strain = clamp01(d.strain);
        if (typeof d.evidence_for === 'string') l.evidence_for = d.evidence_for.trim();
        if (typeof d.evidence_against === 'string') l.evidence_against = d.evidence_against.trim();
        break;
      }
      case 'remove_load': {
        cap.loads = cap.loads.filter(l => l.id !== d.id);
        break;
      }
      case 'mark_stabilized': {
        const l = cap.loads.find(x => x.id === d.id);
        if (!l) break;
        l.state = 'stabilized';
        l.strain = 0;
        break;
      }
      case 'set_field_tier': {
        const t = Math.max(1, Math.min(5, parseInt(d.tier, 10) || 1));
        cap.field_radius_tier = t;
        break;
      }
      case 'set_one_stabilization': {
        if (typeof d.text === 'string') cap.one_stabilization = d.text.trim();
        break;
      }
      case 'set_phase': {
        if (['observe','stabilize','widen','settled'].includes(d.phase)) cap.phase = d.phase;
        break;
      }
    }
  }
  function applyCapacityDeltas(cap, deltas) {
    if (!Array.isArray(deltas)) return;
    deltas.forEach(d => applyCapacityDelta(cap, d));
  }
  function summarizeCapacity(cap) {
    const lines = [];
    lines.push('PHASE: ' + cap.phase);
    lines.push('FIELD TIER: ' + cap.field_radius_tier);
    if (cap.one_stabilization) lines.push('ONE STABILIZATION: ' + cap.one_stabilization);
    lines.push('LOADS (' + cap.loads.length + '):');
    cap.loads.forEach(l => {
      const flags = [l.state, 'strain=' + (l.strain || 0).toFixed(2)];
      lines.push('  - ' + l.id + ': ' + (l.label || '(unnamed)') + ' [' + flags.join(', ') + ']');
      if (l.evidence_for) lines.push('      for: ' + l.evidence_for);
      if (l.evidence_against) lines.push('      against: ' + l.evidence_against);
    });
    return lines.join('\n');
  }

  // =============================================================
  // MULTI-SCALE SYSTEMS CHAMBER — nested scale layers ontology
  // =============================================================
  function emptyMultiscaleSession() {
    const now = Date.now();
    return {
      id: 'ms_' + now.toString(36),
      forces: [],
      links: [],
      governing_id: null,
      dominant_scale: null,
      one_intervention: '',
      inquiry_log: [],
      phase: 'observe',
      started_at: now,
      last_modified: now,
    };
  }
  function ensureMultiscaleSession(state) {
    if (!state.current_multiscale) state.current_multiscale = emptyMultiscaleSession();
    return state.current_multiscale;
  }
  function nextForceId(ms) {
    const used = new Set((ms.forces || []).map(f => f.id));
    let n = (ms.forces || []).length + 1;
    while (used.has('f' + n)) n++;
    return 'f' + n;
  }
  function nextLinkId(ms) {
    const used = new Set((ms.links || []).map(l => l.id));
    let n = (ms.links || []).length + 1;
    while (used.has('k' + n)) n++;
    return 'k' + n;
  }
  function applyMultiscaleDelta(ms, d) {
    if (!d || !d.op) return;
    const VALID_SCALES = ['individual','team','organization','mission'];
    switch (d.op) {
      case 'add_force': {
        const id = d.id || nextForceId(ms);
        if (ms.forces.find(f => f.id === id)) break;
        ms.forces.push({
          id,
          label: (d.label || '').trim(),
          scale: VALID_SCALES.includes(d.scale) ? d.scale : 'individual',
          strain: typeof d.strain === 'number' ? clamp01(d.strain) : 0.4,
          governs: !!d.governs,
        });
        break;
      }
      case 'update_force': {
        const f = ms.forces.find(x => x.id === d.id);
        if (!f) break;
        if (typeof d.label === 'string') f.label = d.label.trim();
        if (VALID_SCALES.includes(d.scale)) f.scale = d.scale;
        if (typeof d.strain === 'number') f.strain = clamp01(d.strain);
        break;
      }
      case 'remove_force': {
        ms.forces = ms.forces.filter(f => f.id !== d.id);
        ms.links = ms.links.filter(l => l.from_id !== d.id && l.to_id !== d.id);
        if (ms.governing_id === d.id) ms.governing_id = null;
        break;
      }
      case 'add_link': {
        if (!d.from_id || !d.to_id) break;
        if (!ms.forces.find(f => f.id === d.from_id)) break;
        if (!ms.forces.find(f => f.id === d.to_id)) break;
        if (ms.links.find(l => l.from_id === d.from_id && l.to_id === d.to_id)) break;
        ms.links.push({
          id: nextLinkId(ms),
          from_id: d.from_id,
          to_id: d.to_id,
          friction: typeof d.friction === 'number' ? clamp01(d.friction) : 0.5,
        });
        break;
      }
      case 'mark_governing': {
        if (!d.force_id) break;
        ms.governing_id = d.force_id;
        ms.forces.forEach(f => { f.governs = (f.id === d.force_id); });
        break;
      }
      case 'set_dominant_scale': {
        if (VALID_SCALES.includes(d.scale)) ms.dominant_scale = d.scale;
        break;
      }
      case 'set_one_intervention': {
        if (typeof d.text === 'string') ms.one_intervention = d.text.trim();
        break;
      }
      case 'set_phase': {
        if (['observe','link','surface','settled'].includes(d.phase)) ms.phase = d.phase;
        break;
      }
    }
  }
  function applyMultiscaleDeltas(ms, deltas) {
    if (!Array.isArray(deltas)) return;
    deltas.forEach(d => applyMultiscaleDelta(ms, d));
  }
  function summarizeMultiscale(ms) {
    if (!ms) return '(no multiscale session yet)';
    const lines = [];
    lines.push('PHASE: ' + ms.phase);
    lines.push('DOMINANT SCALE: ' + (ms.dominant_scale || '(undefined)'));
    if (ms.one_intervention) lines.push('ONE INTERVENTION: ' + ms.one_intervention);
    lines.push('FORCES (' + ms.forces.length + '):');
    ms.forces.forEach(f => {
      const flags = [f.scale, 'strain=' + (f.strain || 0).toFixed(2)];
      if (f.governs) flags.unshift('GOVERNING');
      lines.push('  - ' + f.id + ': ' + (f.label || '(unnamed)') + ' [' + flags.join(', ') + ']');
    });
    lines.push('CROSS-SCALE LINKS (' + ms.links.length + '):');
    ms.links.forEach(l => {
      lines.push('  - ' + l.from_id + ' → ' + l.to_id + ' [friction=' + (l.friction || 0).toFixed(2) + ']');
    });
    return lines.join('\n');
  }

  // =============================================================
  // CHARACTER OF THE EXECUTOR — vertical alignment pillars
  // =============================================================
  function emptyCharacterSession() {
    const now = Date.now();
    return {
      id: 'ch_' + now.toString(36),
      pillars: [],          // [{ id, label, state: 'aligned'|'leaning'|'cracked'|'buried', tilt (0..1), governs }]
      governing_id: null,
      one_realignment: '',
      inquiry_log: [],
      phase: 'observe',     // observe → examine → settled
      started_at: now,
      last_modified: now,
    };
  }
  function ensureCharacterSession(state) {
    if (!state.current_character) state.current_character = emptyCharacterSession();
    return state.current_character;
  }
  function nextPillarId(ch) {
    const used = new Set((ch.pillars || []).map(p => p.id));
    let n = (ch.pillars || []).length + 1;
    while (used.has('p' + n)) n++;
    return 'p' + n;
  }
  function applyCharacterDelta(ch, d) {
    if (!d || !d.op) return;
    const VALID_STATES = ['aligned','leaning','cracked','buried'];
    switch (d.op) {
      case 'add_pillar': {
        const id = d.id || nextPillarId(ch);
        if (ch.pillars.find(p => p.id === id)) break;
        ch.pillars.push({
          id,
          label: (d.label || '').trim(),
          state: VALID_STATES.includes(d.state) ? d.state : 'aligned',
          tilt: typeof d.tilt === 'number' ? clamp01(d.tilt) : 0,
          governs: !!d.governs,
        });
        break;
      }
      case 'update_pillar': {
        const p = ch.pillars.find(x => x.id === d.id);
        if (!p) break;
        if (typeof d.label === 'string') p.label = d.label.trim();
        if (VALID_STATES.includes(d.state)) p.state = d.state;
        if (typeof d.tilt === 'number') p.tilt = clamp01(d.tilt);
        break;
      }
      case 'remove_pillar': {
        ch.pillars = ch.pillars.filter(p => p.id !== d.id);
        if (ch.governing_id === d.id) ch.governing_id = null;
        break;
      }
      case 'mark_governing': {
        if (!d.pillar_id) break;
        ch.governing_id = d.pillar_id;
        ch.pillars.forEach(p => { p.governs = (p.id === d.pillar_id); });
        break;
      }
      case 'set_one_realignment': {
        if (typeof d.text === 'string') ch.one_realignment = d.text.trim();
        break;
      }
      case 'set_phase': {
        if (['observe','examine','settled'].includes(d.phase)) ch.phase = d.phase;
        break;
      }
    }
  }
  function applyCharacterDeltas(ch, deltas) {
    if (!Array.isArray(deltas)) return;
    deltas.forEach(d => applyCharacterDelta(ch, d));
  }
  function summarizeCharacter(ch) {
    if (!ch) return '(no character session yet)';
    const lines = [];
    lines.push('PHASE: ' + ch.phase);
    if (ch.one_realignment) lines.push('ONE REALIGNMENT: ' + ch.one_realignment);
    lines.push('PILLARS (' + ch.pillars.length + '):');
    ch.pillars.forEach(p => {
      const flags = [p.state, 'tilt=' + (p.tilt || 0).toFixed(2)];
      if (p.governs) flags.unshift('GOVERNING');
      lines.push('  - ' + p.id + ': ' + (p.label || '(unnamed)') + ' [' + flags.join(', ') + ']');
    });
    return lines.join('\n');
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
    ensureCapacitySession,
    ensureMultiscaleSession,
    ensureCharacterSession,
    emptySequence,
    emptyConstraintSession,
    emptyStructuralSession,
    emptyCapacitySession,
    emptyMultiscaleSession,
    emptyCharacterSession,
    applyDelta, applyDeltas,
    applyConstraintDelta, applyConstraintDeltas,
    applyStructuralDelta, applyStructuralDeltas,
    applyCapacityDelta, applyCapacityDeltas,
    applyMultiscaleDelta, applyMultiscaleDeltas,
    applyCharacterDelta, applyCharacterDeltas,
    logEntry,
    summarize,
    summarizeConstraint,
    summarizeStructural,
    summarizeCapacity,
    summarizeMultiscale,
    summarizeCharacter,
    transcript,
    clamp01,
    dormancyTier,
    totalVisits,
    markChamberVisit,
    consumeReturnEvent,
  };
})();
