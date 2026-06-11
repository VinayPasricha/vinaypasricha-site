/* =============================================================
   Organizational Frequency — Person Frequency Engine  (Build 1G)
   =============================================================
   Builds on 1A–1F WITHOUT changing the architecture.

   The runtime already understands:

       Mission → Organization → Gap → Role → Role Frequency

   It does NOT yet understand a PERSON. This build introduces the
   person side — and builds it the same way, with the same rigor,
   IN ISOLATION. The person is never compared to a mission, an
   organization, or a role here. No matching. No resonance.

   The object is PERSON, not "candidate" — a candidate is only one
   kind of person. The same abstraction must serve job seekers,
   employees, founders, managers, students and professionals.

   The promotion path is the doctrine, and it has no shortcuts:

       Person Evidence
          ↓
       Person Hypothesis
          ↓
       Person Validation
          ↓
       Validated Person Understanding
          ↓
       Person Frequency

   Evidence may NEVER become Frequency directly. Discovery is
   reflective, never an assessment, never a personality test.
   Nothing becomes truth automatically.

   MEMORY GATING (per 1G): this engine updates ONLY the Person
   Understanding and Person Frequency. It does NOT touch Essence,
   Transformation or Resonance — none of those are written here.

   Augments window.OF with window.OF.person.
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-person.js requires of-model.js'); return; }
  var OF = window.OF;

  // The same ten dimensions used on the organization / role side.
  var DIMENSIONS = (OF.frequency && OF.frequency.DIMENSIONS) || [
    'Pace', 'Execution Discipline', 'Communication Style', 'Pressure Tolerance',
    'Leadership Style', 'Autonomy Level', 'Innovation Requirement',
    'Process Maturity', 'Trust / Goodness Layer', 'People Development Orientation'
  ];
  var LEVELS = ['low', 'moderate', 'high', 'very_high'];

  var CAREER_STAGES = ['student', 'early_career', 'mid_career', 'senior', 'executive', 'founder', 'unknown'];
  // Architecture only — no integrations are built. 'future' is the
  // explicit placeholder for sources that do not exist yet.
  var EVIDENCE_SOURCES = ['conversation', 'resume', 'linkedin', 'assessment', 'public_profile', 'future'];
  var HYPOTHESIS_STATUS = ['untested', 'supported', 'contradicted', 'mixed'];
  var VALIDATION_STATUS = ['untested', 'supported', 'contradicted', 'mixed', 'retired'];
  var VALIDATION_SOURCES = ['self', 'conversation', 'reference', 'assessment', 'future'];

  // Mirrors the organization side (of-validation.js): a hypothesis
  // becomes a Validated Person Understanding only when a validation
  // is 'supported' AND confidence_after reaches this value.
  var UNDERSTANDING_THRESHOLD = 0.6;

  var human = (OF.frequency && OF.frequency.human) || function (l) { return l === 'very_high' ? 'very high' : l; };
  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function round(n) { return Math.round(n * 100) / 100; }
  function clamp01(n) { return Math.max(0.02, Math.min(0.95, n)); }
  function lcfirst(s) { return s ? s.charAt(0).toLowerCase() + s.slice(1) : s; }

  function ensure(store) {
    store.persons = store.persons || [];
    store.person_evidence = store.person_evidence || [];
    store.person_hypotheses = store.person_hypotheses || [];
    store.person_validations = store.person_validations || [];
    store.validated_person_understandings = store.validated_person_understandings || [];
    store.person_frequencies = store.person_frequencies || [];
    return store;
  }

  /* ==========================================================
     BUILD OBJECT 1 — PERSON
     A complete entity, understood in isolation. NOT a candidate.
     ========================================================== */
  function newPerson(f) {
    f = f || {};
    return {
      person_id: f.person_id || uid('per'),
      name: f.name || '',
      email: f.email || '',
      phone: f.phone || '',
      current_title: f.current_title || '',
      current_company: f.current_company || '',
      location: f.location || '',
      career_stage: CAREER_STAGES.indexOf(f.career_stage) !== -1 ? f.career_stage : 'unknown',
      source: f.source || 'discovery',
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 2 — PERSON EVIDENCE
     An atomic observed thing the person expressed. Cheap,
     plentiful, low-commitment. Architecture only — no source
     integration is built; 'conversation' is the live source.
     ========================================================== */
  function newPersonEvidence(f) {
    f = f || {};
    return {
      evidence_id: f.evidence_id || uid('pev'),
      person_id: f.person_id || null,
      source: EVIDENCE_SOURCES.indexOf(f.source) !== -1 ? f.source : 'conversation',
      statement: f.statement || '',
      // dimensions this evidence speaks to (grounds hypothesis generation)
      dimensions: f.dimensions || [],
      confidence: typeof f.confidence === 'number' ? round(f.confidence) : 0.4,
      created_at: f.created_at || nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 3 — PERSON HYPOTHESIS
     A candidate read on one dimension, inferred from >=1
     evidence. Holds a `level` (internal — see assumptions) so the
     Person Frequency can be derived from validated understanding.
     ========================================================== */
  function newPersonHypothesis(f) {
    f = f || {};
    return {
      hypothesis_id: f.hypothesis_id || uid('phyp'),
      person_id: f.person_id || null,
      dimension: f.dimension || null,
      statement: f.statement || '',
      level: LEVELS.indexOf(f.level) !== -1 ? f.level : 'moderate', // internal read, not a score
      confidence: typeof f.confidence === 'number' ? round(f.confidence) : 0.35,
      status: HYPOTHESIS_STATUS.indexOf(f.status) !== -1 ? f.status : 'untested',
      evidence_ids: f.evidence_ids || [],
      promoted_understanding_id: f.promoted_understanding_id || null,
      created_at: f.created_at || nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 4 — PERSON VALIDATION
     A reflective test of a hypothesis, put to the person.
     Nothing becomes truth automatically.
     ========================================================== */
  function newPersonValidation(f) {
    f = f || {};
    return {
      validation_id: f.validation_id || uid('pval'),
      person_id: f.person_id || null,
      hypothesis_id: f.hypothesis_id || null,
      response: f.response || '',   // accurate | partially | inaccurate | unsure
      validation_status: VALIDATION_STATUS.indexOf(f.validation_status) !== -1 ? f.validation_status : 'untested',
      confidence_before: typeof f.confidence_before === 'number' ? round(f.confidence_before) : 0.35,
      confidence_after: typeof f.confidence_after === 'number' ? round(f.confidence_after) : (typeof f.confidence_before === 'number' ? round(f.confidence_before) : 0.35),
      source: VALIDATION_SOURCES.indexOf(f.source) !== -1 ? f.source : 'self',
      history: f.history || [],
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 5 — VALIDATED PERSON UNDERSTANDING
     The earned read on a dimension. Mirrors the organization
     side's promotion philosophy exactly.
     ========================================================== */
  function newUnderstanding(f) {
    f = f || {};
    return {
      understanding_id: f.understanding_id || uid('pund'),
      person_id: f.person_id || null,
      dimension: f.dimension || null,
      statement: f.statement || '',
      level: LEVELS.indexOf(f.level) !== -1 ? f.level : 'moderate', // internal — drives Person Frequency
      confidence: typeof f.confidence === 'number' ? round(f.confidence) : 0.6,
      supporting_validations: f.supporting_validations || [],
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 6 — PERSON FREQUENCY
     Derived ONLY from validated understanding — never from
     evidence directly. Per-dimension, explainable, no score.
     ========================================================== */
  function newPersonFrequency(f) {
    f = f || {};
    return {
      person_frequency_id: f.person_frequency_id || uid('pfreq'),
      person_id: f.person_id || null,
      frequency_summary: f.frequency_summary || '',
      dimensions: f.dimensions || [],   // [{dimension, level, confidence, evidence}]
      confidence: typeof f.confidence === 'number' ? round(f.confidence) : 0,
      created_at: f.created_at || nowISO(),
      updated_at: nowISO()
    };
  }

  /* ==========================================================
     DISCOVERY — the reflective questions Aeon1 asks.
     The goal is discovery, not assessment. Each question is
     tagged with the dimensions its answer can speak to, so the
     evidence it produces is grounded, not free-floating.
     ========================================================== */
  var DISCOVERY = [
    { key: 'energy', q: 'What kind of work makes you lose track of time?',
      placeholder: 'The work that pulls you in and energises you…',
      dimensions: ['Innovation Requirement', 'Pace'] },
    { key: 'structure', q: 'How much structure do you want around you to do your best work?',
      placeholder: 'Clear process and rhythm, or open space — and why…',
      dimensions: ['Process Maturity', 'Execution Discipline'] },
    { key: 'autonomy', q: 'How much room to decide things for yourself do you need?',
      placeholder: 'Ownership and freedom, or direction and guidance…',
      dimensions: ['Autonomy Level'] },
    { key: 'pressure', q: 'When timelines compress and the pressure is on, what happens to you?',
      placeholder: 'How fast and hard environments tend to affect you…',
      dimensions: ['Pressure Tolerance', 'Pace'] },
    { key: 'friction', q: 'What kinds of teams or people frustrate you to work with?',
      placeholder: 'What grinds against how you like to work…',
      dimensions: ['Communication Style', 'Execution Discipline'] },
    { key: 'leadership', q: 'What kind of leader helps you flourish — and how do you lead others?',
      placeholder: 'The leadership that brings out your best, and your own way of leading…',
      dimensions: ['Leadership Style', 'People Development Orientation'] },
    { key: 'trust', q: 'What do you need to be able to trust in a place before you give it your best?',
      placeholder: 'What earns your trust and your full effort…',
      dimensions: ['Trust / Goodness Layer'] }
  ];

  /* ---- create / find a person ------------------------------- */
  function createPerson(fields, store) {
    store = ensure(store || OF.load());
    var p = newPerson(fields || {});
    if (!p.career_stage || p.career_stage === 'unknown') p.career_stage = inferStage(p.current_title);
    store.persons.push(p);
    OF.save(store);
    return p;
  }

  function inferStage(title) {
    var s = (title || '').toLowerCase();
    if (/\b(founder|co-?founder)\b/.test(s)) return 'founder';
    if (/\b(chief|ceo|cto|cfo|coo|vp|vice president|head of|partner)\b/.test(s)) return 'executive';
    if (/\b(student|intern|undergrad|graduate student|phd candidate)\b/.test(s)) return 'student';
    if (/\b(senior|staff|principal|lead|director)\b/.test(s)) return 'senior';
    if (/\b(junior|associate|assistant|entry|graduate)\b/.test(s)) return 'early_career';
    if (s.trim()) return 'mid_career';
    return 'unknown';
  }

  /* ---- ingest one piece of evidence ------------------------- */
  function ingestEvidence(personId, fields, store) {
    store = ensure(store || OF.load());
    var ev = newPersonEvidence(Object.assign({}, fields || {}, { person_id: personId }));
    store.person_evidence.push(ev);
    OF.save(store);
    return ev;
  }

  /* ==========================================================
     EVIDENCE → HYPOTHESES
     For each dimension that has evidence speaking to it and does
     not yet have a hypothesis, read a level from the evidence
     text and form a reflective hypothesis. Idempotent per
     (person, dimension). Evidence never becomes frequency here —
     only a hypothesis.
     ========================================================== */
  function syncHypotheses(personId, store) {
    store = ensure(store || OF.load());
    var evidence = store.person_evidence.filter(function (e) { return e.person_id === personId; });
    if (!evidence.length) return [];

    var existing = {};
    store.person_hypotheses.forEach(function (h) {
      if (h.person_id === personId) existing[h.dimension] = true;
    });

    var created = [];
    DIMENSIONS.forEach(function (dim) {
      if (existing[dim]) return;
      var relevant = evidence.filter(function (e) { return (e.dimensions || []).indexOf(dim) !== -1; });
      if (!relevant.length) return;
      var text = relevant.map(function (e) { return e.statement; }).join(' ');
      var read = readDimension(dim, text);
      var conf = round(Math.min(0.55, avg(relevant.map(function (e) { return e.confidence; })) + 0.05));
      var h = newPersonHypothesis({
        person_id: personId,
        dimension: dim,
        level: read.level,
        statement: read.statement,
        confidence: conf,
        evidence_ids: relevant.map(function (e) { return e.evidence_id; })
      });
      store.person_hypotheses.push(h);
      created.push(h);
    });
    if (created.length) OF.save(store);
    return created;
  }

  /* ==========================================================
     RECORD A VALIDATION RESPONSE
     response: 'accurate' | 'partially' | 'inaccurate' | 'unsure'
     Mirrors of-validation.recordValidation. Past the threshold a
     Validated Person Understanding is promoted, then the Person
     Frequency is re-derived (ONLY from validated understanding).
     ========================================================== */
  function recordValidation(hypothesisId, response, source, note, store) {
    store = ensure(store || OF.load());
    var h = byId(store.person_hypotheses, 'hypothesis_id', hypothesisId);
    if (!h) return null;
    source = VALIDATION_SOURCES.indexOf(source) !== -1 ? source : 'self';

    var map = {
      accurate:   { status: 'supported',    delta: +0.3 },
      partially:  { status: 'mixed',        delta: +0.05 },
      inaccurate: { status: 'contradicted', delta: -0.3 },
      unsure:     { status: 'untested',     delta: 0 }
    };
    var m = map[response] || map.unsure;

    var v = newPersonValidation({
      person_id: h.person_id,
      hypothesis_id: h.hypothesis_id,
      response: response,
      validation_status: m.status,
      confidence_before: h.confidence,
      confidence_after: round(clamp01(h.confidence + m.delta)),
      source: source
    });
    v.history.push({ date: nowISO(), status: m.status, source: source, response: response, note: note || '' });
    store.person_validations.push(v);

    // the hypothesis carries the running read
    h.status = m.status;
    h.confidence = v.confidence_after;

    var understanding = maybePromote(store, h, v);

    // Person Frequency is re-derived from validated understanding only.
    var pf = derivePersonFrequency(h.person_id, store);

    OF.save(store);
    return { validation: v, hypothesis: h, understanding: understanding, person_frequency: pf };
  }

  function maybePromote(store, h, v) {
    if (v.validation_status !== 'supported') return null;
    if (v.confidence_after < UNDERSTANDING_THRESHOLD) return null;
    var existing = store.validated_person_understandings.filter(function (u) {
      return u.person_id === h.person_id && u.dimension === h.dimension;
    })[0];
    if (existing) {
      existing.confidence = Math.max(existing.confidence, v.confidence_after);
      existing.level = h.level;
      existing.statement = restate(h.statement);
      if (existing.supporting_validations.indexOf(v.validation_id) === -1) existing.supporting_validations.push(v.validation_id);
      existing.updated_at = nowISO();
      h.promoted_understanding_id = existing.understanding_id;
      return existing;
    }
    var u = newUnderstanding({
      person_id: h.person_id,
      dimension: h.dimension,
      statement: restate(h.statement),
      level: h.level,
      confidence: v.confidence_after,
      supporting_validations: [v.validation_id]
    });
    store.validated_person_understandings.push(u);
    h.promoted_understanding_id = u.understanding_id;
    return u;
  }

  /* ==========================================================
     DERIVE PERSON FREQUENCY  (the gated write)
     ONLY validated understanding feeds this. A dimension with no
     validated understanding reads 'unknown'. Supersedes any prior
     person frequency for this person.
     ========================================================== */
  function derivePersonFrequency(personId, store) {
    store = ensure(store || OF.load());
    var unds = store.validated_person_understandings.filter(function (u) { return u.person_id === personId; });
    var byDim = index(unds, 'dimension');

    var dims = DIMENSIONS.map(function (name) {
      var u = byDim[name];
      if (!u) {
        return { dimension: name, level: 'unknown', confidence: 0.1,
          evidence: 'Not yet validated — no understanding maps to ' + name.toLowerCase() + ' yet.' };
      }
      return {
        dimension: name,
        level: u.level,
        confidence: round(Math.min(0.9, u.confidence)),
        evidence: 'From validated understanding (' + u.supporting_validations.length + ' validation' +
          (u.supporting_validations.length === 1 ? '' : 's') + '): ' + u.statement
      };
    });

    var known = dims.filter(function (d) { return d.level !== 'unknown'; });
    var conf = known.length ? round(avg(known.map(function (d) { return d.confidence; })) * Math.min(1, known.length / 4)) : 0.05;
    var person = byId(store.persons, 'person_id', personId);
    var who = person && person.name ? person.name : 'This person';
    var summary = known.length
      ? 'From validated understanding only, ' + who + ' reads as: ' +
        known.slice(0, 5).map(function (d) { return d.dimension.toLowerCase() + ' ' + human(d.level); }).join('; ') +
        '. ' + (DIMENSIONS.length - known.length) + ' of ' + DIMENSIONS.length + ' dimensions remain unknown — not yet validated.'
      : 'No validated understanding yet maps to a frequency dimension — this person\u2019s frequency is almost entirely unknown. Validate more hypotheses to populate it.';

    var prev = store.person_frequencies.filter(function (x) { return x.person_id === personId; })[0];
    store.person_frequencies = store.person_frequencies.filter(function (x) { return x.person_id !== personId; });
    var pf = newPersonFrequency({
      person_frequency_id: prev ? prev.person_frequency_id : undefined,
      person_id: personId,
      dimensions: dims,
      confidence: conf,
      frequency_summary: summary,
      created_at: prev ? prev.created_at : undefined
    });
    store.person_frequencies.push(pf);
    return pf;
  }

  /* ==========================================================
     DIMENSION READING — text → {level, statement}
     Per-dimension, second-person, reflective. NOT a personality
     test: it is a provisional read to be validated, never a type.
     ========================================================== */
  function readDimension(dim, text) {
    var s = (' ' + (text || '').toLowerCase() + ' ');
    var hi = function (re) { return re.test(s); };
    var level = 'moderate';

    switch (dim) {
      case 'Pace':
        if (hi(/\b(fast|quick|rapid|speed|momentum|urgenc|high.?energy|sprint|move fast)\b/)) level = 'high';
        if (hi(/\b(very fast|relentless|breakneck|thrive on speed|love the pace)\b/)) level = 'very_high';
        if (hi(/\b(slow|steady|deliberate|measured|unhurried|calm pace|space to think)\b/)) level = 'low';
        break;
      case 'Execution Discipline':
        if (hi(/\b(disciplin|rigor|follow.?through|finish|reliab|consisten|on time|deliver|detail)\b/)) level = 'high';
        if (hi(/\b(loose|wing it|figure it out|improvis|chaotic is fine|hate process)\b/)) level = 'low';
        break;
      case 'Communication Style':
        if (hi(/\b(direct|candid|blunt|open|transparen|say what|honest|straight)\b/)) level = 'high';
        if (hi(/\b(reserved|quiet|listen more|indirect|diplomatic|careful with words)\b/)) level = 'low';
        break;
      case 'Pressure Tolerance':
        if (hi(/\b(thrive|calm under|rise to|focus|sharpen|love pressure|perform under|steady under)\b/)) level = 'high';
        if (hi(/\b(thrive under real pressure|unshak|nothing rattles)\b/)) level = 'very_high';
        if (hi(/\b(overwhelm|stress|anxious|burn ?out|freeze|crack|too much pressure|drain)\b/)) level = 'low';
        break;
      case 'Leadership Style':
        if (hi(/\b(lead|mentor|set direction|take charge|own the room|guide the team|rally|vision)\b/)) level = 'high';
        if (hi(/\b(prefer to follow|not a leader|rather contribute|behind the scenes|don.?t want to manage)\b/)) level = 'low';
        break;
      case 'Autonomy Level':
        if (hi(/\b(autonom|own|freedom|independ|space|trust me|decide|self.?direct|no micromanag)\b/)) level = 'high';
        if (hi(/\b(full ownership|complete freedom|leave me to it|run my own)\b/)) level = 'very_high';
        if (hi(/\b(guidance|direction|check.?in|structure|told what|clear instruction|support|mentor)\b/)) level = 'low';
        break;
      case 'Innovation Requirement':
        if (hi(/\b(new|novel|invent|create|build|explore|ambigu|0.?to.?1|greenfield|ideas|experiment)\b/)) level = 'high';
        if (hi(/\b(invent|research|push boundaries|love the unknown|net new)\b/)) level = 'very_high';
        if (hi(/\b(established|proven|refine|optimis|run things|maintain|steady state|known problems)\b/)) level = 'low';
        break;
      case 'Process Maturity':
        if (hi(/\b(structure|process|system|clear|organis|rhythm|plan|framework|defined)\b/)) level = 'high';
        if (hi(/\b(loose|flexible|little structure|no process|open space|unstructured|chaos|adapt)\b/)) level = 'low';
        break;
      case 'Trust / Goodness Layer':
        if (hi(/\b(trust|integrity|honest|fair|values|good people|psychological safety|respect|care|do the right)\b/)) level = 'high';
        if (hi(/\b(deep trust|safety is everything|won.?t work without trust)\b/)) level = 'very_high';
        if (hi(/\b(transactional|don.?t need to trust|just the work|results only)\b/)) level = 'low';
        break;
      case 'People Development Orientation':
        if (hi(/\b(develop|grow people|coach|mentor|teach|bring others|build the team|see people grow|nurtur)\b/)) level = 'high';
        if (hi(/\b(rather focus on my own|not into managing|prefer individual|don.?t want to develop)\b/)) level = 'low';
        break;
    }
    return { level: level, statement: STATEMENTS[dim][level] };
  }

  // Second-person, reflective hypothesis statements. Each begins
  // with "You ..." so the validation question reads naturally:
  // "We currently believe " + lcfirst(statement) + " Does that feel accurate?"
  var STATEMENTS = {
    'Pace': {
      low: 'You do your best work at a steady, deliberate pace with space to think.',
      moderate: 'You are comfortable with a balanced pace — fast when it counts, measured otherwise.',
      high: 'Fast-paced environments energise you more than they overwhelm you.',
      very_high: 'You are at your best in relentlessly fast, high-momentum environments.'
    },
    'Execution Discipline': {
      low: 'You prefer to stay loose and improvisational rather than tightly disciplined.',
      moderate: 'You bring enough discipline to deliver without needing rigid control.',
      high: 'You hold strong execution discipline — you follow through and finish what you start.',
      very_high: 'Reliability and rigorous follow-through are central to how you work.'
    },
    'Communication Style': {
      low: 'You communicate in a reserved, considered way, listening more than you assert.',
      moderate: 'You adapt your communication to the room — direct or diplomatic as needed.',
      high: 'You communicate directly and candidly, valuing openness over diplomacy.',
      very_high: 'Radical directness and transparency are core to how you communicate.'
    },
    'Pressure Tolerance': {
      low: 'You do your best work when pressure is low and the environment is calm.',
      moderate: 'You hold up reasonably well under pressure without seeking it out.',
      high: 'You stay steady and focused under pressure rather than rattled by it.',
      very_high: 'High pressure sharpens you — you thrive when the stakes are highest.'
    },
    'Leadership Style': {
      low: 'You prefer to contribute and follow strong direction rather than lead.',
      moderate: 'You can lead when needed, but it is not what you reach for first.',
      high: 'You naturally take direction-setting, leadership roles with a team.',
      very_high: 'Leading and setting the vision for others is central to how you operate.'
    },
    'Autonomy Level': {
      low: 'You do your best work with clear direction and regular support rather than open-ended freedom.',
      moderate: 'You like a balance of ownership and guidance.',
      high: 'You thrive with a high degree of autonomy and room to decide for yourself.',
      very_high: 'You are at your best with full ownership and the freedom to run your own work.'
    },
    'Innovation Requirement': {
      low: 'You are energised by refining and running proven, established things well.',
      moderate: 'You enjoy a mix of new building and improving what exists.',
      high: 'You are energised by new, ambiguous, build-from-scratch problems.',
      very_high: 'Inventing and working at the edge of the unknown is what pulls you in most.'
    },
    'Process Maturity': {
      low: 'You do your best work with loose structure and room to adapt as you go.',
      moderate: 'You like enough structure to stay oriented without it boxing you in.',
      high: 'You do your best work inside clear structure, systems and rhythm.',
      very_high: 'Well-defined process and systems are essential to how you operate.'
    },
    'Trust / Goodness Layer': {
      low: 'You can work effectively in transactional settings without needing deep trust first.',
      moderate: 'You value trust and fairness as part of a healthy place to work.',
      high: 'You need genuine trust, integrity and good people around you to give your best.',
      very_high: 'Deep trust and psychological safety are non-negotiable for you.'
    },
    'People Development Orientation': {
      low: 'You prefer to focus on your own work rather than developing others.',
      moderate: 'You help others grow when it arises, alongside your own work.',
      high: 'You are strongly oriented toward developing, coaching and growing other people.',
      very_high: 'Growing other people is one of the things that most motivates you.'
    }
  };

  /* ---- reads ------------------------------------------------ */
  function getForPerson(personId, store) {
    store = ensure(store || OF.load());
    return {
      person: byId(store.persons, 'person_id', personId),
      evidence: store.person_evidence.filter(function (e) { return e.person_id === personId; }),
      hypotheses: store.person_hypotheses.filter(function (h) { return h.person_id === personId; }),
      validations: store.person_validations.filter(function (v) { return v.person_id === personId; }),
      understandings: store.validated_person_understandings.filter(function (u) { return u.person_id === personId; }),
      person_frequency: store.person_frequencies.filter(function (x) { return x.person_id === personId; })[0] || null
    };
  }
  function getPeople(store) {
    store = ensure(store || OF.load());
    return store.persons.slice().sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); });
  }
  // Untested hypotheses for a person, strongest first — what Aeon1 reflects back next.
  function nextToValidate(personId, limit, store) {
    store = ensure(store || OF.load());
    var untested = store.person_hypotheses.filter(function (h) {
      return h.person_id === personId && h.status === 'untested';
    }).sort(function (a, b) { return b.confidence - a.confidence; });
    return typeof limit === 'number' ? untested.slice(0, limit) : untested;
  }
  // Remove a person and everything derived from them.
  function deletePerson(personId, store) {
    store = ensure(store || OF.load());
    store.persons = store.persons.filter(function (p) { return p.person_id !== personId; });
    store.person_evidence = store.person_evidence.filter(function (e) { return e.person_id !== personId; });
    store.person_hypotheses = store.person_hypotheses.filter(function (h) { return h.person_id !== personId; });
    store.person_validations = store.person_validations.filter(function (v) { return v.person_id !== personId; });
    store.validated_person_understandings = store.validated_person_understandings.filter(function (u) { return u.person_id !== personId; });
    store.person_frequencies = store.person_frequencies.filter(function (x) { return x.person_id !== personId; });
    OF.save(store);
  }

  /* ---- helpers ---------------------------------------------- */
  function restate(s) {
    // "You appear to ..." → "You ..." once validated. The statements
    // are already declarative, so this is mostly a passthrough.
    return (s || '').replace(/\byou appear to\b/i, 'You').replace(/\byou seem to\b/i, 'You');
  }
  function avg(a) { return a.reduce(function (x, y) { return x + y; }, 0) / (a.length || 1); }
  function index(arr, key) { var o = {}; (arr || []).forEach(function (x) { o[x[key]] = x; }); return o; }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }

  OF.person = {
    DIMENSIONS: DIMENSIONS,
    LEVELS: LEVELS,
    CAREER_STAGES: CAREER_STAGES,
    EVIDENCE_SOURCES: EVIDENCE_SOURCES,
    HYPOTHESIS_STATUS: HYPOTHESIS_STATUS,
    VALIDATION_STATUS: VALIDATION_STATUS,
    VALIDATION_SOURCES: VALIDATION_SOURCES,
    UNDERSTANDING_THRESHOLD: UNDERSTANDING_THRESHOLD,
    DISCOVERY: DISCOVERY,
    ensure: ensure,
    newPerson: newPerson,
    newPersonEvidence: newPersonEvidence,
    newPersonHypothesis: newPersonHypothesis,
    newPersonValidation: newPersonValidation,
    newUnderstanding: newUnderstanding,
    newPersonFrequency: newPersonFrequency,
    createPerson: createPerson,
    ingestEvidence: ingestEvidence,
    syncHypotheses: syncHypotheses,
    recordValidation: recordValidation,
    derivePersonFrequency: derivePersonFrequency,
    readDimension: readDimension,
    getForPerson: getForPerson,
    getPeople: getPeople,
    nextToValidate: nextToValidate,
    deletePerson: deletePerson,
    human: human,
    inferStage: inferStage
  };
})();
