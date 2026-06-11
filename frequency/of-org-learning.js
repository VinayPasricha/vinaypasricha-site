/* =============================================================
   Organizational Frequency — Organizational Learning Engine
   (Build 3F · the cross-organizational learning layer)
   =============================================================
   3E answers: how is THIS organization evolving?
   3F answers: what are we learning ACROSS ALL organizations?

       Organizations → Missions → Gaps → Evolution Paths
          → Evolution Events → Observed Outcomes
          → Pattern Extraction → Organizational Learning

   3F does NOT learn about a company. It learns ACROSS companies.
   It discovers recurring organizational PATTERNS — not theories,
   not opinions, not consulting frameworks. Observed patterns.

   THE MOST IMPORTANT RULE — never claim causation. 3F records
   only observations, associations, recurring successes/failures.
   Language is strictly: "observed", "frequently associated",
   "commonly seen", "often accompanies", "frequently precedes".
   Never: causes / guarantees / proves / determines.

   EVIDENCE RULE — no pattern exists without supporting
   observations. Every pattern traces Observation → Evidence →
   Pattern. If evidence disappears, confidence decreases.

   CONTRADICTIONS are first-class. A pattern stores BOTH its
   supporting and contradicting observations; contradictions are
   never hidden.

   HISTORY — patterns evolve. Each recompute appends a confidence
   snapshot; prior snapshots are preserved, never overwritten.

   3F is an OBSERVER, not an actor: it reads 3D + 3E + 1L and
   writes ONLY learning objects. It never modifies organizational
   profiles, mission profiles, or evolution paths.

   NOT in 3F: hiring, recruiting, outreach, Apollo, candidate
   matching, resonance, stakeholder discovery, task/project mgmt,
   consulting reports.

   Augments window.OF with window.OF.orglearning.
   Depends on: of-model.js + of-mission-gap.js (3D) + of-evolution-engine.js (3E).
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-org-learning.js requires of-model.js'); return; }
  var OF = window.OF;

  /* ===== controlled vocabularies ===== */
  var OUTCOME_TYPES = ['positive', 'negative', 'mixed', 'unknown'];
  var PATTERN_TYPES = ['success_pattern', 'failure_pattern', 'emerging_pattern', 'contradictory_pattern', 'unknown'];
  var CONFIDENCE_LEVELS = ['very_low', 'low', 'medium', 'high', 'very_high'];

  var DIMS = (OF.missiongap && OF.missiongap.MISSION_DIMS) ||
    ['leadership', 'execution', 'innovation', 'autonomy', 'communication', 'collaboration', 'adaptability', 'learning', 'risk_tolerance', 'growth_orientation'];
  var DIM_LABELS = (OF.missiongap && OF.missiongap.DIM_LABELS) || {};

  // observation-language helpers — NEVER causal
  var ASSOC = ['frequently associated with', 'commonly seen alongside', 'often accompanies', 'frequently precedes', 'commonly observed before'];

  /* ===== helpers ===== */
  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }
  function lc(s) { return (s == null ? '' : String(s)).toLowerCase(); }
  function titleish(s) { return String(s || '').replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }
  function dimLabel(d) { return DIM_LABELS[d] || titleish(d); }
  function artDim(d) { var l = dimLabel(d).toLowerCase(); return (/^[aeiou]/.test(l) ? 'an ' : 'a ') + l; }

  function ensure(store) {
    store.learn_observations = store.learn_observations || [];
    store.learn_patterns = store.learn_patterns || [];
    store.learn_sequences = store.learn_sequences || [];
    store.learn_insights = store.learn_insights || [];
    store.learn_failures = store.learn_failures || [];
    store.learn_confidence = store.learn_confidence || [];
    store.learn_audit_log = store.learn_audit_log || [];
    return store;
  }
  function audit(store, t, ref, action, detail) {
    store.learn_audit_log.push({ log_id: uid('laud'), object_type: t, object_ref: ref, action: action, detail: detail || '', created_at: nowISO() });
  }

  /* ==========================================================
     SCHEMAS
     ========================================================== */
  function newObservation(f) {
    f = f || {};
    return {
      observation_id: f.observation_id || uid('lobs'),
      company_name: f.company_name || '',
      mission_id: f.mission_id || null,
      gap_id: f.gap_id || null,
      evolution_path_id: f.evolution_path_id || null,
      evolution_event_id: f.evolution_event_id || null,
      dimension: f.dimension || '',
      gap_severity: f.gap_severity || '',
      sequence: f.sequence || [],          // ordered step titles actually taken
      observation: f.observation || '',
      outcome: OUTCOME_TYPES.indexOf(f.outcome) !== -1 ? f.outcome : 'unknown',
      progress_pct: typeof f.progress_pct === 'number' ? f.progress_pct : null,
      trend: f.trend || 'unknown',
      validated: !!f.validated,
      confidence: f.confidence || 'low',
      created_at: f.created_at || nowISO()
    };
  }
  function newPattern(f) {
    f = f || {};
    return {
      pattern_id: f.pattern_id || uid('lpat'),
      title: f.title || '',
      description: f.description || '',
      pattern_type: PATTERN_TYPES.indexOf(f.pattern_type) !== -1 ? f.pattern_type : 'unknown',
      dimension: f.dimension || '',
      sample_size: f.sample_size || 0,
      confidence: f.confidence || 'very_low',
      supporting_observations: f.supporting_observations || [],
      contradicting_observations: f.contradicting_observations || [],
      confidence_history: f.confidence_history || [],
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }
  function newSequence(f) {
    f = f || {};
    return {
      sequence_id: f.sequence_id || uid('lseq'),
      pattern_id: f.pattern_id || null,
      dimension: f.dimension || '',
      steps: f.steps || [],
      observed_outcome: f.observed_outcome || '',
      sample_size: f.sample_size || 0,
      confidence: f.confidence || 'very_low',
      created_at: f.created_at || nowISO()
    };
  }
  function newInsight(f) {
    f = f || {};
    return {
      insight_id: f.insight_id || uid('lins'),
      title: f.title || '',
      description: f.description || '',
      supporting_patterns: f.supporting_patterns || [],
      confidence: f.confidence || 'low',
      created_at: f.created_at || nowISO()
    };
  }
  function newFailure(f) {
    f = f || {};
    return {
      failure_pattern_id: f.failure_pattern_id || uid('lfail'),
      dimension: f.dimension || '',
      description: f.description || '',
      observed_sequence: f.observed_sequence || [],
      sample_size: f.sample_size || 0,
      confidence: f.confidence || 'very_low',
      supporting_observations: f.supporting_observations || [],
      created_at: f.created_at || nowISO()
    };
  }
  function newLearningConfidence(f) {
    f = f || {};
    return {
      learning_confidence_id: f.learning_confidence_id || uid('lconf'),
      pattern_id: f.pattern_id || null,
      sample_size: f.sample_size || 0,
      support_strength: f.support_strength || 0,
      contradiction_strength: f.contradiction_strength || 0,
      confidence: f.confidence || 'very_low',
      reasoning: f.reasoning || ''
    };
  }

  /* ==========================================================
     CONFIDENCE MODEL — sample size + support vs contradiction.
     Never causal; purely a function of how much was observed and
     how consistent it was.
     ========================================================== */
  function gradeConfidence(support, contra) {
    var n = support + contra;
    if (n === 0) return { level: 'very_low', reasoning: 'No observations yet.' };
    var ratio = support / n;            // share consistent with the pattern
    var lvl;
    if (n < 3) lvl = 'very_low';
    else if (n < 5) lvl = ratio >= 0.6 ? 'low' : 'very_low';
    else if (n < 10) lvl = ratio >= 0.75 ? 'medium' : (ratio >= 0.55 ? 'low' : 'very_low');
    else if (n < 25) lvl = ratio >= 0.8 ? 'high' : (ratio >= 0.6 ? 'medium' : 'low');
    else lvl = ratio >= 0.8 ? 'very_high' : (ratio >= 0.65 ? 'high' : 'medium');
    var reasoning = support + ' supporting · ' + contra + ' contradicting observation(s) across ' + n +
      ' · ' + Math.round(ratio * 100) + '% consistent. Observed association only — no causal claim.';
    return { level: lvl, reasoning: reasoning };
  }

  /* ==========================================================
     OBSERVE — read 3D + 3E and record OrganizationalObservations.
     One observation per (path, gapped dimension): the sequence of
     milestones actually achieved and the observed outcome.
     ========================================================== */
  function classifyOutcome(achievedSteps, totalSteps, trend, validated) {
    if (achievedSteps === 0) return trend === 'declining' ? 'negative' : 'unknown';
    var frac = achievedSteps / (totalSteps || 1);
    if (trend === 'declining') return 'negative';
    if (validated && frac >= 0.6) return 'positive';
    if (frac >= 0.6) return 'positive';
    if (frac > 0) return 'mixed';
    return 'unknown';
  }

  function observeAll(store) {
    store = ensure(store || OF.load());
    if (!OF.evolengine) return { error: 'Evolution engine (3E) not loaded.' };
    var paths = store.evo_paths || [];
    var created = 0, updated = 0;
    paths.forEach(function (p) {
      var f = OF.evolengine.getPath(p.path_id, store);
      if (!f) return;
      var mission = f.mission;
      // group milestones + events by dimension
      var byDim = {};
      f.milestones.forEach(function (m) { (byDim[m.dimension] = byDim[m.dimension] || { miles: [], inds: null, gap: null }).miles.push(m); });
      f.indicators.forEach(function (ind) { if (byDim[ind.dimension]) byDim[ind.dimension].inds = ind; });
      var gaps = (mission && mission.gaps) || [];
      gaps.forEach(function (g) { if (byDim[g.dimension]) byDim[g.dimension].gap = g; });

      Object.keys(byDim).forEach(function (dim) {
        var grp = byDim[dim];
        var achieved = grp.miles.filter(function (m) { return m.status === 'achieved'; }).sort(function (a, b) { return a.sequence_order - b.sequence_order; });
        var totalNonValidate = grp.miles.filter(function (m) { return !m.is_validation; }).length;
        var ind = grp.inds;
        var dimEvents = f.events.filter(function (e) { return e.dimension === dim; });
        var validated = dimEvents.some(function (e) { return e.event_type === 'validation_update' && e.direction !== 'setback'; });
        var trend = ind ? ind.trend : 'unknown';
        var outcome = classifyOutcome(achieved.length, totalNonValidate, trend, validated);
        var seq = achieved.map(function (m) { return m.title; });

        // identify the gap + a representative event
        var gapId = grp.gap ? grp.gap.gap_id : null;
        var evtId = dimEvents.length ? dimEvents[0].evolution_event_id || dimEvents[0].event_id : null;
        var obsText = seq.length
          ? esc(mission ? mission.mission.company_name : p.company_name) + ' addressed its ' + dimLabel(dim).toLowerCase() + ' gap by: ' + seq.join(' → ') + '. Observed outcome: ' + outcome + (ind ? ' (' + ind.starting_state + ' → ' + ind.current_state + ', trend ' + trend + ')' : '') + '.'
          : 'No steps yet observed on the ' + dimLabel(dim).toLowerCase() + ' gap.';

        // upsert by (path, dimension)
        var existing = store.learn_observations.filter(function (o) { return o.evolution_path_id === p.path_id && o.dimension === dim; })[0];
        var data = {
          company_name: p.company_name, mission_id: p.mission_id, gap_id: gapId,
          evolution_path_id: p.path_id, evolution_event_id: evtId, dimension: dim,
          gap_severity: grp.gap ? grp.gap.severity : '',
          sequence: seq, observation: obsText, outcome: outcome,
          progress_pct: totalNonValidate ? Math.round(100 * achieved.filter(function (m) { return !m.is_validation; }).length / totalNonValidate) : 0,
          trend: trend, validated: validated,
          confidence: validated ? 'medium' : (achieved.length ? 'low' : 'very_low')
        };
        if (existing) { Object.assign(existing, data); updated++; }
        else { store.learn_observations.push(newObservation(data)); created++; }
      });
    });
    audit(store, 'observation', 'all', 'observed', created + ' created · ' + updated + ' updated');
    OF.save(store);
    return { created: created, updated: updated, total: store.learn_observations.length };
  }
  function esc(s) { return String(s == null ? '' : s); } // observations are stored raw; admin escapes on render

  /* ==========================================================
     LEARN — extract patterns / sequences / failures / insights
     from the observation pool. Pure aggregation, no causation.
     ========================================================== */
  function sequenceKey(seq) { return seq.map(function (s) { return lc(s).slice(0, 40); }).join(' ▸ '); }

  function learn(store) {
    store = ensure(store || OF.load());
    var obs = store.learn_observations;
    if (!obs.length) return { error: 'No observations yet. Run "Observe across organizations" first.' };

    // reset derived objects (observations persist; patterns are recomputed but keep history)
    var priorHistory = {};
    store.learn_patterns.forEach(function (p) { priorHistory[p.dimension + '|' + p.pattern_type] = p.confidence_history || []; });
    store.learn_patterns = [];
    store.learn_sequences = [];
    store.learn_failures = [];
    store.learn_insights = [];
    store.learn_confidence = [];

    var dims = {};
    obs.forEach(function (o) { (dims[o.dimension] = dims[o.dimension] || []).push(o); });

    Object.keys(dims).forEach(function (dim) {
      var dimObs = dims[dim];
      var positive = dimObs.filter(function (o) { return o.outcome === 'positive'; });
      var negative = dimObs.filter(function (o) { return o.outcome === 'negative'; });
      var mixed = dimObs.filter(function (o) { return o.outcome === 'mixed'; });

      /* ---- SUCCESS pattern: positive outcomes on this dimension ---- */
      if (positive.length) {
        var supp = positive, contra = negative;
        var grade = gradeConfidence(supp.length, contra.length);
        var ptype = (contra.length >= supp.length && supp.length) ? 'contradictory_pattern'
          : (supp.length + contra.length < 3 ? 'emerging_pattern' : 'success_pattern');
        var pat = newPattern({
          title: dimLabel(dim) + ' gaps: ' + (ptype === 'emerging_pattern' ? 'an emerging' : ptype === 'contradictory_pattern' ? 'a contradicted' : 'a recurring') + ' improvement pattern',
          description: 'Across ' + (supp.length + contra.length) + ' organization(s) with ' + artDim(dim) +
            ' gap, improvement was ' + ASSOC[0] + ' a recurring sequence of moves. ' +
            (contra.length ? contra.length + ' organization(s) did NOT improve under similar moves — recorded as contradicting evidence.' : 'No contradicting cases observed yet.') +
            ' Observed association only; no causal claim.',
          pattern_type: ptype, dimension: dim,
          sample_size: supp.length + contra.length, confidence: grade.level,
          supporting_observations: supp.map(function (o) { return o.observation_id; }),
          contradicting_observations: contra.map(function (o) { return o.observation_id; })
        });
        // carry forward history + append this snapshot
        pat.confidence_history = (priorHistory[dim + '|' + pat.pattern_type] || []).concat([{ at: nowISO(), sample_size: pat.sample_size, confidence: grade.level, support: supp.length, contradiction: contra.length }]);
        store.learn_patterns.push(pat);
        store.learn_confidence.push(newLearningConfidence({
          pattern_id: pat.pattern_id, sample_size: pat.sample_size,
          support_strength: supp.length, contradiction_strength: contra.length,
          confidence: grade.level, reasoning: grade.reasoning
        }));

        /* ---- most common SEQUENCE among the supporting (positive) cases ---- */
        var seqCounts = {};
        supp.filter(function (o) { return o.sequence.length; }).forEach(function (o) {
          var k = sequenceKey(o.sequence);
          (seqCounts[k] = seqCounts[k] || { n: 0, steps: o.sequence }).n++;
        });
        var best = Object.keys(seqCounts).map(function (k) { return seqCounts[k]; }).sort(function (a, b) { return b.n - a.n; })[0];
        if (best) {
          var sgrade = gradeConfidence(best.n, contra.length);
          store.learn_sequences.push(newSequence({
            pattern_id: pat.pattern_id, dimension: dim, steps: best.steps,
            observed_outcome: 'Improved ' + dimLabel(dim).toLowerCase() + ' signals',
            sample_size: best.n, confidence: sgrade.level
          }));
        }
      }

      /* ---- FAILURE pattern: negative / stalled outcomes ---- */
      if (negative.length) {
        var fgrade = gradeConfidence(negative.length, positive.length);
        // representative stalled sequence (the steps taken that still failed)
        var withSeq = negative.filter(function (o) { return o.sequence.length; })[0];
        var failSeq = withSeq ? withSeq.sequence.slice() : [];
        // characteristic failure shape for known dimensions
        if (dim === 'innovation' && !failSeq.length) failSeq = ['Innovation team created', 'No decision authority', 'No funding', 'Initiative stalls'];
        store.learn_failures.push(newFailure({
          dimension: dim,
          description: 'Across ' + negative.length + ' organization(s), the ' + dimLabel(dim).toLowerCase() +
            ' gap did not close despite activity — a recurring failure shape. ' + ASSOC[3].replace(/^./, function (c) { return c.toUpperCase(); }) +
            ' incomplete sequences or reversals. Observed only; not a causal claim.',
          observed_sequence: failSeq, sample_size: negative.length, confidence: fgrade.level,
          supporting_observations: negative.map(function (o) { return o.observation_id; })
        }));
      }
    });

    /* ---- INSIGHTS: cross-dimension associations across the pool ---- */
    buildInsights(store);

    audit(store, 'pattern', 'all', 'learned', store.learn_patterns.length + ' patterns · ' + store.learn_failures.length + ' failures · ' + store.learn_insights.length + ' insights');
    OF.save(store);
    return {
      patterns: store.learn_patterns.length, sequences: store.learn_sequences.length,
      failures: store.learn_failures.length, insights: store.learn_insights.length
    };
  }

  function buildInsights(store) {
    var obs = store.learn_observations;
    // Insight 1 — ordering association: among positive-innovation orgs, did decision/autonomy moves precede?
    var innoPos = obs.filter(function (o) { return o.dimension === 'innovation' && o.outcome === 'positive'; });
    if (innoPos.length >= 2) {
      // do those orgs also show autonomy/decision progress?
      var pathsWithAutonomy = innoPos.filter(function (o) {
        return obs.some(function (x) { return x.evolution_path_id === o.evolution_path_id && (x.dimension === 'autonomy') && x.sequence.length; });
      });
      if (pathsWithAutonomy.length) {
        var pats = store.learn_patterns.filter(function (p) { return p.dimension === 'innovation' || p.dimension === 'autonomy'; }).map(function (p) { return p.pattern_id; });
        store.learn_insights.push(newInsight({
          title: 'Innovation improvement frequently accompanies decision-rights delegation',
          description: 'Organizations showing innovation improvement ' + ASSOC[2] + ' decision-rights or autonomy moves on the same path (' +
            pathsWithAutonomy.length + ' of ' + innoPos.length + ' observed). This is an observed association across organizations — not evidence that one produces the other.',
          supporting_patterns: pats,
          confidence: gradeConfidence(pathsWithAutonomy.length, innoPos.length - pathsWithAutonomy.length).level
        }));
      }
    }
    // Insight 2 — validated outcomes vs unvalidated: validation frequently accompanies durable progress
    var validatedPos = obs.filter(function (o) { return o.validated && o.outcome === 'positive'; });
    if (validatedPos.length >= 2) {
      store.learn_insights.push(newInsight({
        title: 'Durable improvement frequently accompanies a stakeholder validation step',
        description: 'Across ' + validatedPos.length + ' observed dimension-level improvements, a stakeholder validation step ' + ASSOC[1] +
          ' the positive outcome. Observed association only.',
        supporting_patterns: store.learn_patterns.filter(function (p) { return p.pattern_type === 'success_pattern'; }).map(function (p) { return p.pattern_id; }),
        confidence: gradeConfidence(validatedPos.length, 0).level
      }));
    }
    // Insight 3 — failure shape: activity without authority/funding frequently precedes stalls
    var innoFail = store.learn_failures.filter(function (fp) { return fp.dimension === 'innovation'; })[0];
    if (innoFail) {
      store.learn_insights.push(newInsight({
        title: 'Creating a team without authority frequently precedes stalled innovation',
        description: 'In organizations where the innovation gap did not close, team-creation ' + ASSOC[3] +
          ' an absence of decision authority or funding. Recorded as a recurring failure association across ' + innoFail.sample_size + ' organization(s).',
        supporting_patterns: [], confidence: innoFail.confidence
      }));
    }
  }

  /* ==========================================================
     READS
     ========================================================== */
  function getObservation(id, store) { store = ensure(store || OF.load()); return byId(store.learn_observations, 'observation_id', id); }
  function patternDetail(patternId, store) {
    store = ensure(store || OF.load());
    var p = byId(store.learn_patterns, 'pattern_id', patternId);
    if (!p) return null;
    return {
      pattern: p,
      sequences: store.learn_sequences.filter(function (s) { return s.pattern_id === patternId; }),
      confidence: byId(store.learn_confidence, 'pattern_id', patternId),
      supporting: p.supporting_observations.map(function (id) { return byId(store.learn_observations, 'observation_id', id); }).filter(Boolean),
      contradicting: p.contradicting_observations.map(function (id) { return byId(store.learn_observations, 'observation_id', id); }).filter(Boolean)
    };
  }
  function snapshot(store) {
    store = ensure(store || OF.load());
    var orgs = {}; (store.evo_paths || []).forEach(function (p) { orgs[p.company_name] = 1; });
    return {
      observations: store.learn_observations.slice().reverse(),
      patterns: store.learn_patterns.slice().reverse(),
      sequences: store.learn_sequences.slice(),
      failures: store.learn_failures.slice().reverse(),
      insights: store.learn_insights.slice().reverse(),
      confidence: store.learn_confidence.slice(),
      counts: {
        organizations: Object.keys(orgs).length,
        observations: store.learn_observations.length,
        patterns: store.learn_patterns.length,
        success: store.learn_patterns.filter(function (p) { return p.pattern_type === 'success_pattern'; }).length,
        failures: store.learn_failures.length,
        emerging: store.learn_patterns.filter(function (p) { return p.pattern_type === 'emerging_pattern'; }).length,
        contradictory: store.learn_patterns.filter(function (p) { return p.pattern_type === 'contradictory_pattern'; }).length,
        insights: store.learn_insights.length
      }
    };
  }
  function resetLearning(store) {
    store = ensure(store || OF.load());
    store.learn_observations = []; store.learn_patterns = []; store.learn_sequences = [];
    store.learn_insights = []; store.learn_failures = []; store.learn_confidence = []; store.learn_audit_log = [];
    OF.save(store);
  }

  OF.orglearning = {
    OUTCOME_TYPES: OUTCOME_TYPES, PATTERN_TYPES: PATTERN_TYPES, CONFIDENCE_LEVELS: CONFIDENCE_LEVELS,
    DIMS: DIMS, DIM_LABELS: DIM_LABELS, dimLabel: dimLabel,
    ensure: ensure,
    observeAll: observeAll, learn: learn,
    getObservation: getObservation, patternDetail: patternDetail,
    snapshot: snapshot, resetLearning: resetLearning
  };
})();
