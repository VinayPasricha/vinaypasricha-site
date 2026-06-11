/* =============================================================
   KAIROS·1 — Shared LANDMARKS utility
   =============================================================
   Topology landmarks are the runtime's deepest commitment to
   inhabited terrain. Prior cycles persist as faded glyphs at
   the periphery of the current chamber. Recurring constraints
   surface as lineage threads — faint amber lines connecting
   a current node to the prior landmark it echoes.

   This file provides extraction, scoring, and demo-seeding.
   Layout is chamber-specific (handled inside each topology
   component) because chambers have different geometries.

   Per the refinement: detection logic is intentionally minimal.
   What we are pressure-testing first is the *phenomenology* of
   recurrence, not analytic precision. String overlap is enough
   to seed the visual prototype.
   ============================================================= */

(function () {

  // Extract landmark candidates from history, filtered by
  // chamber kind. Returns most-recent-first, with a geological
  // tier (1..4) assigned by position in the ordering.
  function extract(history, kind) {
    if (!Array.isArray(history)) return [];
    const filtered = history
      .filter(h => {
        if (kind === 'sequence')   return h.kind === 'sequence' || (!h.kind && h.data && h.data.actions);
        if (kind === 'constraint') return h.kind === 'constraint';
        if (kind === 'structural') return h.kind === 'structural';
        if (kind === 'capacity')   return h.kind === 'capacity';
        if (kind === 'multi-scale') return h.kind === 'multi-scale';
        if (kind === 'character')   return h.kind === 'character';
        return false;
      })
      .map((entry) => {
        const data = entry.data || entry;
        if (kind === 'sequence') {
          const governing = (data.actions || []).find(a => a.governs_flow);
          const label = governing
            ? governing.label
            : (data.outcome || '(unnamed)');
          return {
            id: 'lm-' + (data.id || ('s' + Math.random().toString(36).slice(2, 7))),
            label: String(label || '').trim(),
            sub_label: governing ? (data.outcome || '') : '',
            cycle_id: data.id,
            closed_at: entry.closed_at || data.last_modified || 0,
            origin: governing ? 'governing' : 'outcome',
            kind: 'sequence',
          };
        }
        if (kind === 'constraint') {
          const governing = (data.observations || []).find(o => o.governs);
          const label = governing
            ? governing.label
            : (data.one_strengthening || '(no governing surfaced)');
          return {
            id: 'lm-' + (data.id || ('c' + Math.random().toString(36).slice(2, 7))),
            label: String(label || '').trim(),
            sub_label: data.classification || '',
            classification: data.classification,
            cycle_id: data.id,
            closed_at: entry.closed_at || data.last_modified || 0,
            origin: governing ? 'governing' : 'strengthening',
            kind: 'constraint',
          };
        }
        if (kind === 'structural') {
          const governing = (data.elements || []).find(e => e.governs);
          const label = governing
            ? governing.label
            : (data.one_strengthening || '(no structural element surfaced)');
          return {
            id: 'lm-' + (data.id || ('x' + Math.random().toString(36).slice(2, 7))),
            label: String(label || '').trim(),
            sub_label: data.classification || '',
            classification: data.classification,
            layer: governing ? governing.layer : null,
            cycle_id: data.id,
            closed_at: entry.closed_at || data.last_modified || 0,
            origin: governing ? 'governing' : 'strengthening',
            kind: 'structural',
          };
        }
        if (kind === 'capacity') {
          const stabilized = (data.loads || []).filter(l => l.state === 'stabilized');
          const featured = stabilized[0] || (data.loads || [])[0];
          const label = featured
            ? featured.label
            : (data.one_stabilization || '(no carrying field surfaced)');
          return {
            id: 'lm-' + (data.id || ('k' + Math.random().toString(36).slice(2, 7))),
            label: String(label || '').trim(),
            sub_label: 'tier ' + (data.field_radius_tier || 1),
            cycle_id: data.id,
            closed_at: entry.closed_at || data.last_modified || 0,
            origin: stabilized.length > 0 ? 'governing' : 'strengthening',
            kind: 'capacity',
          };
        }
        if (kind === 'multi-scale') {
          const governing = (data.forces || []).find(f => f.governs);
          const label = governing
            ? governing.label
            : (data.one_intervention || '(no scale surfaced)');
          return {
            id: 'lm-' + (data.id || ('m' + Math.random().toString(36).slice(2, 7))),
            label: String(label || '').trim(),
            sub_label: data.dominant_scale || '',
            cycle_id: data.id,
            closed_at: entry.closed_at || data.last_modified || 0,
            origin: governing ? 'governing' : 'strengthening',
            kind: 'multi-scale',
          };
        }
        if (kind === 'character') {
          const governing = (data.pillars || []).find(p => p.governs);
          const label = governing
            ? governing.label
            : (data.one_realignment || '(no pillar surfaced)');
          return {
            id: 'lm-' + (data.id || ('e' + Math.random().toString(36).slice(2, 7))),
            label: String(label || '').trim(),
            sub_label: governing ? governing.state : '',
            cycle_id: data.id,
            closed_at: entry.closed_at || data.last_modified || 0,
            origin: governing ? 'governing' : 'strengthening',
            kind: 'character',
          };
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => b.closed_at - a.closed_at);

    // Geological tiers — 1 = surface (newest, brightest); 4 = ancient stratum (oldest, dimmest)
    return filtered.map((lm, i, all) => {
      const total = all.length;
      const r = total > 1 ? i / (total - 1) : 0;
      let tier;
      if (r < 0.25) tier = 1;
      else if (r < 0.5) tier = 2;
      else if (r < 0.75) tier = 3;
      else tier = 4;
      return { ...lm, tier };
    });
  }

  // String overlap detection — Jaccard similarity on filtered tokens.
  // Intentionally simple. Phenomenology > precision at this stage.
  const STOPWORDS = new Set([
    'the','a','an','of','to','in','on','at','for','with','from','by','as','is','are','was','were','be','been','being',
    'and','or','but','if','then','so','because','that','this','these','those','it','its',
    'our','their','my','his','her','your','we','they','you','me','us','them',
    'do','does','did','done','make','made','have','has','had','get','got',
    'will','would','can','could','should','must','may','might',
    'not','no','any','all','some','more','most','many','one','two','three',
    'into','onto','out','over','under','about','than','also','very','just','still','only',
  ]);

  function tokens(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !STOPWORDS.has(w));
  }

  function lineageScore(a, b) {
    const ta = new Set(tokens(a));
    const tb = new Set(tokens(b));
    if (ta.size === 0 || tb.size === 0) return 0;
    let intersect = 0;
    ta.forEach(t => { if (tb.has(t)) intersect++; });
    const union = ta.size + tb.size - intersect;
    return union > 0 ? intersect / union : 0;
  }

  // Returns array of { landmark, score } sorted high → low for
  // landmarks that share lineage with the given current label.
  function findLineage(currentLabel, landmarks, minScore) {
    const min = minScore == null ? 0.28 : minScore;
    return landmarks
      .map(lm => ({ landmark: lm, score: lineageScore(currentLabel, lm.label) }))
      .filter(x => x.score >= min)
      .sort((a, b) => b.score - a.score);
  }

  // Demo seeding — when ?demo=1 is in the URL and state.history
  // is empty, inject a small set of plausible mock cycles so the
  // phenomenology can be pressure-tested before real accumulation.
  // Designed so the seeded cycles share recurring language with
  // typical inputs (sales enablement, structural restructuring, etc.)
  // so lineage threads have something to attach to.
  function maybeSeedDemo(state) {
    try {
      const url = new URL(window.location.href);
      if (url.searchParams.get('demo') !== '1') return false;
      if (state.history && state.history.length > 0) return false;
      const now = Date.now();
      const day = 86400000;
      state.history = [
        {
          kind: 'sequence',
          closed_at: now - 5 * day,
          data: {
            id: 'seq_demo1',
            outcome: 'Ship the enterprise pricing tier',
            outcome_completion: 'Signed contracts at the new rate',
            outcome_reality_change: '',
            actions: [
              { id: 'a1', label: 'Draft pricing model',          completion_criteria: 'CFO sign-off', friction: 0.2, governs_flow: false },
              { id: 'a2', label: 'Sales enablement training',    completion_criteria: 'Reps certified', friction: 0.75, governs_flow: true },
              { id: 'a3', label: 'Enterprise customer rollout',  completion_criteria: 'First 3 signed', friction: 0.3, governs_flow: false },
            ],
            transitions: [
              { id: 't1', from_id: 'a1', to_id: 'a2', stability: 0.6 },
              { id: 't2', from_id: 'a2', to_id: 'a3', stability: 0.35 },
            ],
            phase: 'settled',
            inquiry_log: [],
            started_at: now - 25 * day,
            last_modified: now - 5 * day,
          },
        },
        {
          kind: 'constraint',
          closed_at: now - 30 * day,
          data: {
            id: 'cn_demo1',
            observations: [
              { id: 'o1', label: 'Sales enablement is slow',                    weight: 0.85, governs: true,  eliminated: false },
              { id: 'o2', label: 'Onboarding documentation incomplete',         weight: 0.4,  governs: false, eliminated: true  },
              { id: 'o3', label: 'Pricing complexity confuses reps',            weight: 0.55, governs: false, eliminated: false },
            ],
            governing_id: 'o1',
            classification: 'human',
            one_strengthening: 'Hire a dedicated sales enablement lead',
            phase: 'settled',
            inquiry_log: [],
            started_at: now - 45 * day,
            last_modified: now - 30 * day,
          },
        },
        {
          kind: 'sequence',
          closed_at: now - 90 * day,
          data: {
            id: 'seq_demo2',
            outcome: 'Launch Series B fundraise',
            outcome_completion: 'Term sheet executed',
            outcome_reality_change: '',
            actions: [
              { id: 'a1', label: 'Investor narrative on sales enablement', completion_criteria: 'Deck approved', friction: 0.6, governs_flow: true },
              { id: 'a2', label: 'Term sheet outreach',                    completion_criteria: 'Three sheets', friction: 0.4, governs_flow: false },
            ],
            transitions: [{ id: 't1', from_id: 'a1', to_id: 'a2', stability: 0.5 }],
            phase: 'settled',
            inquiry_log: [],
            started_at: now - 110 * day,
            last_modified: now - 90 * day,
          },
        },
        {
          kind: 'constraint',
          closed_at: now - 180 * day,
          data: {
            id: 'cn_demo2',
            observations: [
              { id: 'o1', label: 'Engineering velocity decreasing under scale', weight: 0.7, governs: true,  eliminated: false },
              { id: 'o2', label: 'Test coverage gaps',                          weight: 0.35, governs: false, eliminated: true },
            ],
            governing_id: 'o1',
            classification: 'structural',
            one_strengthening: 'Restructure team boundaries around domains',
            phase: 'settled',
            inquiry_log: [],
            started_at: now - 200 * day,
            last_modified: now - 180 * day,
          },
        },
      ];
      return true;
    } catch (e) { return false; }
  }

  window.kairos = window.kairos || {};
  window.kairos.landmarks = {
    extract,
    findLineage,
    lineageScore,
    tokens,
    maybeSeedDemo,
  };
})();
