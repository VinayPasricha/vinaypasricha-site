/* =============================================================
   Organizational Frequency — Mission Spine model  (Build 1A)
   =============================================================
   The first part of the OF hierarchy:

       Mission → Organization → Person → (Resonance, later)

   This module is the single source of truth for the Mission
   Spine. It owns:
     • the schemas (Mission, Organization, OF-User extension)
     • the relationship model (org owns mission; user describes it)
     • the MEMORY SEAM contract (Evidence → Transformation →
       Essence) that every future runtime record must pass through
     • memory-seed generation on mission-capture completion
     • localStorage persistence  (key: of.runtime.v1)

   NOT in this build (placeholders only):
     • frequency computation / resonance
     • candidate discovery / hiring workflow
     • research execution (Tier 0/1/2 are attach points only)

   Plain vanilla JS, no framework, loaded synchronously so the
   capture flow and the Studio admin can both read window.OF.
   ============================================================= */
(function () {
  'use strict';

  var STORE_KEY = 'of.runtime.v1';
  var SCHEMA_VERSION = '0.1-1A';

  /* ----------------------------------------------------------
     ENUMS — the controlled vocabularies of the spine.
     Kept as arrays so the admin can render them and the
     extractor can validate against them.
     ---------------------------------------------------------- */
  var ENUMS = {
    mission_type: [
      'expansion', 'new_geography', 'new_office', 'new_product',
      'technology', 'sales', 'operations', 'customer_support',
      'fundraising', 'hiring', 'culture', 'transformation', 'unknown'
    ],
    mission_stage: [
      'emerging', 'defined', 'active', 'urgent', 'blocked', 'completed'
    ],
    hiring_relevance: [
      'none', 'possible', 'likely', 'central'
    ],
    research_status: [
      'unknown', 'not_started', 'tier0', 'tier1', 'tier2', 'complete'
    ],
    primary_role: [
      'founder', 'ceo', 'hr_head', 'hiring_manager', 'team_lead',
      'employee', 'consultant', 'unknown'
    ],
    relationship_to_mission: [
      'owner', 'leader', 'participant', 'observer', 'unknown'
    ]
  };

  /* ----------------------------------------------------------
     ID helpers — short, sortable, human-greppable.
     ---------------------------------------------------------- */
  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }
  function nowISO() {
    return new Date().toISOString();
  }

  /* ==========================================================
     BUILD OBJECT 1 — MISSION
     A first-class object. Mission comes first; hiring is only
     one possible intervention, never assumed.
     ========================================================== */
  function newMission(fields) {
    fields = fields || {};
    return {
      mission_id:          fields.mission_id || uid('mis'),
      mission_name:        fields.mission_name || '',
      mission_description: fields.mission_description || '',
      mission_type:        validEnum('mission_type', fields.mission_type, 'unknown'),
      mission_stage:       validEnum('mission_stage', fields.mission_stage, 'emerging'),
      desired_outcome:     fields.desired_outcome || '',
      time_horizon:        fields.time_horizon || '',          // free text e.g. "this quarter", "12 months"
      obstacles:           fields.obstacles || [],             // string[]
      people_dependency:   fields.people_dependency || '',     // how much the mission depends on people/talent
      hiring_relevance:    validEnum('hiring_relevance', fields.hiring_relevance, 'possible'),
      confidence:          typeof fields.confidence === 'number' ? fields.confidence : 0.5,
      source:              fields.source || 'mission_capture', // where this mission came from
      // relationships (see Build Object 3)
      organization_id:     fields.organization_id || null,     // org that OWNS the mission
      described_by_user_id: fields.described_by_user_id || null, // user who DESCRIBES the mission
      // research attach points (Build Object: placeholders only)
      research:            fields.research || newResearchPlaceholder(),
      created_at:          fields.created_at || nowISO(),
      updated_at:          nowISO()
    };
  }

  /* ==========================================================
     BUILD OBJECT 2 — ORGANIZATION
     First-class. Frequency is NOT computed here — placeholder
     only. The org is the owner of one or more missions.
     ========================================================== */
  function newOrganization(fields) {
    fields = fields || {};
    return {
      organization_id:    fields.organization_id || uid('org'),
      organization_name:  fields.organization_name || '',
      website:            fields.website || '',
      industry:           fields.industry || '',
      size:               fields.size || '',                  // free text e.g. "9 people", "200-500"
      location:           fields.location || '',
      mission_ids:        fields.mission_ids || [],           // missions this org owns
      // FREQUENCY PLACEHOLDERS — do not compute in 1A.
      preliminary_essence:   fields.preliminary_essence || null,   // org Essence seed (text), filled by seam later
      preliminary_frequency: fields.preliminary_frequency || null, // org Frequency object — null until the frequency build
      frequency_confidence:  typeof fields.frequency_confidence === 'number' ? fields.frequency_confidence : 0,
      research_status:    validEnum('research_status', fields.research_status, 'not_started'),
      created_at:         fields.created_at || nowISO(),
      updated_at:         nowISO()
    };
  }

  /* Research placeholders — Tier 0/1/2 attach points. No
     research is executed in 1A; the mission is merely made
     ready to attach to these later. */
  function newResearchPlaceholder() {
    return {
      status: 'not_started',                 // mirrors org.research_status at mission scope
      tier0: { label: 'Public research',        status: 'not_started', ran_at: null, notes: '' },
      tier1: { label: 'Guided research',        status: 'not_started', ran_at: null, notes: '' },
      tier2: { label: 'Paid deep research',     status: 'not_started', ran_at: null, notes: '' }
    };
  }

  /* ==========================================================
     BUILD OBJECT 4 — OF USER (extends the existing person)
     The same per-being entity the Studio memory model knows,
     extended with its place in the Mission Spine.
     ========================================================== */
  function newUser(fields) {
    fields = fields || {};
    return {
      user_id:                uid('usr'),
      name:                   fields.name || '',
      // --- existing-shape fields kept so this can merge with the
      //     Studio per-being model later (essence/method live there) ---
      email:                  fields.email || '',
      language:               fields.language || 'en',
      // --- BUILD 1A EXTENSION ---
      organization_id:        fields.organization_id || null,
      active_mission_ids:     fields.active_mission_ids || [],
      primary_role:           validEnum('primary_role', fields.primary_role, 'unknown'),
      relationship_to_mission: validEnum('relationship_to_mission', fields.relationship_to_mission, 'unknown'),
      created_at:             fields.created_at || nowISO(),
      updated_at:             nowISO()
    };
  }

  function validEnum(name, value, fallback) {
    var list = ENUMS[name] || [];
    return list.indexOf(value) !== -1 ? value : fallback;
  }

  /* ==========================================================
     THE MEMORY SEAM  —  Evidence → Transformation → Essence
     ==========================================================
     This is the contract, not the full pipeline. The audit
     found two memory systems that do not connect (reader-side
     localStorage vs Studio per-being model). Rather than merge
     them now, we define ONE abstraction every future memory
     record must be expressible in. Any runtime conversation —
     a chamber session, a mission capture, a frequency interview
     — ultimately deposits records onto this path:

        Evidence       an atomic observed fact from a conversation
           │           (cheap, plentiful, low-commitment)
           ▼
        Transformation a candidate shift inferred from >=1 Evidence
           │           (clustered, weighed, confidence-scored)
           ▼
        Essence        the slow, rewritten model of a subject
                       (person OR organization). Revised, never
                       appended. This is what the Studio model
                       calls essence / preliminary_essence.

     Build 1A implements ONLY the seed end of this path
     (Evidence/Transformation/Essence *seeds*). Clustering and
     promotion are documented in _brief/of-memory-seam.md and
     left as explicit stubs below.
     ---------------------------------------------------------- */
  var seam = {
    KINDS: ['evidence', 'transformation', 'essence', 'open_question', 'mission_summary'],

    // Normalize anything a runtime produces into a seam record.
    // subject_type: 'person' | 'organization' | 'mission'
    makeSeed: function (kind, subject_type, subject_id, payload) {
      return {
        seed_id:       uid('seed'),
        kind:          kind,
        seam_stage:    seam._stageOf(kind),  // where on the Evidence→Essence path it sits
        subject_type:  subject_type,
        subject_id:    subject_id,
        payload:       payload || {},
        status:        'seed',               // seed → confirmed (promotion not implemented in 1A)
        origin:        'mission_capture',
        created_at:    nowISO()
      };
    },

    _stageOf: function (kind) {
      if (kind === 'evidence') return 'evidence';
      if (kind === 'transformation') return 'transformation';
      if (kind === 'essence') return 'essence';
      // open_question and mission_summary are evidence-adjacent context
      return 'evidence';
    },

    /* CONTRACT STUBS — declared so callers can see the full path
       even though 1A does not execute them. Documented in the
       seam markdown. These are intentionally inert. */
    clusterIntoTransformations: function (/* evidenceSeeds */) {
      // FUTURE: group evidence by subject + linked attribute,
      // score confidence, emit Transformation records.
      return { implemented: false, note: 'Build 1B+: cluster evidence → transformations' };
    },
    promoteIntoEssence: function (/* transformations */) {
      // FUTURE: when a transformation verifies, rewrite the
      // subject's Essence paragraph (org preliminary_essence or
      // person essence). Revised, never appended.
      return { implemented: false, note: 'Build 1B+: promote verified transformation → essence revision' };
    }
  };

  /* ----------------------------------------------------------
     MEMORY SEEDS on capture completion.
     Lightweight. Generated from the captured spine objects.
     Produces exactly the five seed types the build calls for:
       • Evidence Seed
       • Mission Summary
       • Open Question
       • Transformation Candidate
       • Essence Seed
     ---------------------------------------------------------- */
  function generateMemorySeeds(ctx) {
    // ctx = { user, organization, mission, raw } (raw = captured answers)
    var org = ctx.organization, mis = ctx.mission, usr = ctx.user;
    var seeds = [];

    // 1 — Evidence Seed: the atomic fact that a mission was described.
    seeds.push(seam.makeSeed('evidence', 'mission', mis.mission_id, {
      summary: (usr.name || 'A person') + ' from ' + (org.organization_name || 'an organization') +
               ' described a mission: "' + (mis.mission_name || mis.desired_outcome || mis.mission_description).slice(0, 140) + '".',
      linked_attribute: 'mission_described',
      source_ref: 'mission_capture'
    }));

    // 2 — Mission Summary (context record).
    seeds.push(seam.makeSeed('mission_summary', 'mission', mis.mission_id, {
      summary: missionOneLine(mis, org),
      type: mis.mission_type,
      stage: mis.mission_stage,
      hiring_relevance: mis.hiring_relevance
    }));

    // 3 — Open Question (the canonical frequency question, unanswered in 1A).
    seeds.push(seam.makeSeed('open_question', 'organization', org.organization_id, {
      question: 'Does ' + (org.organization_name || 'the organization') +
                ' currently possess the frequency required for this mission?',
      opened_for_mission: mis.mission_id,
      status: 'open'
    }));

    // 4 — Transformation Candidate (a possible shift in the user).
    seeds.push(seam.makeSeed('transformation', 'person', usr.user_id, {
      description: candidateShift(mis),
      evidence_seed_ids: [seeds[0].seed_id],
      confidence: 0.3,
      status: 'candidate'
    }));

    // 5 — Essence Seed (a first, low-confidence read of the org).
    seeds.push(seam.makeSeed('essence', 'organization', org.organization_id, {
      core_paragraph: orgEssenceSeed(mis, org),
      confidence: 0.25,
      note: 'First read from a single mission conversation. To be rewritten, not appended.'
    }));

    return seeds;
  }

  function missionOneLine(mis, org) {
    var who = org && org.organization_name ? org.organization_name : 'The organization';
    var what = mis.desired_outcome || mis.mission_name || mis.mission_description || 'an undescribed outcome';
    return who + ' is working toward: ' + what +
           (mis.time_horizon ? ' (' + mis.time_horizon + ')' : '') + '.';
  }

  function candidateShift(mis) {
    if (mis.hiring_relevance === 'central' || mis.hiring_relevance === 'likely') {
      return 'User arrived oriented to talent/hiring; may be holding the mission and the hiring question as the same thing. Watch whether they separate mission from intervention.';
    }
    return 'User may be shifting from hiring-thinking to mission-thinking — describing an outcome rather than a role to fill.';
  }

  function orgEssenceSeed(mis, org) {
    var frag = [];
    frag.push((org.organization_name || 'The organization') + ' appears mission-driven');
    if (mis.obstacles && mis.obstacles.length) {
      frag.push('but constrained by ' + mis.obstacles[0].toLowerCase().replace(/\.$/, ''));
    } else {
      frag.push('with its governing constraint not yet named');
    }
    return frag.join(' ') + '. Provisional — one conversation deep.';
  }

  /* ==========================================================
     PERSISTENCE  (localStorage: of.runtime.v1)
     The shared store both the capture flow (write) and the
     Studio admin (read) use. This makes the capture→admin
     path REAL — the first wire across the memory seam at the
     spine level — while the deeper reader↔Studio merge stays
     a documented contract.
     ========================================================== */
  function emptyStore() {
    return {
      version: SCHEMA_VERSION,
      organizations: [],
      missions: [],
      users: [],
      seeds: [],            // all seam seeds across captures
      updated_at: nowISO()
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        // shallow shape guard
        s.organizations = s.organizations || [];
        s.missions = s.missions || [];
        s.users = s.users || [];
        s.seeds = s.seeds || [];
        return s;
      }
    } catch (e) {}
    return emptyStore();
  }

  function save(store) {
    store.updated_at = nowISO();
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (e) {}
    return store;
  }

  function reset() {
    try { localStorage.removeItem(STORE_KEY); } catch (e) {}
  }

  /* ==========================================================
     COMMIT A CAPTURE
     Takes a structured capture result and writes the full spine:
       Organization + Mission + User + relationships + seeds.
     This is the single mutation the front-end calls when an
     Aeon1 mission conversation completes.

     capture = {
       organization: {...partial org fields...},
       mission:      {...partial mission fields...},
       user:         {...partial user fields...},
       raw:          { q1..q5 raw answers }
     }
     ========================================================== */
  function commitCapture(capture) {
    var store = load();

    // 1 — Organization (dedupe by name, case-insensitive)
    var org = findOrgByName(store, capture.organization && capture.organization.organization_name);
    if (!org) {
      org = newOrganization(capture.organization || {});
      store.organizations.push(org);
    } else {
      // light merge of newly-learned fields
      mergeDefined(org, capture.organization, ['website', 'industry', 'size', 'location']);
      org.updated_at = nowISO();
    }

    // 2 — User (describes the mission)
    var usr = newUser(Object.assign({}, capture.user || {}, { organization_id: org.organization_id }));
    store.users.push(usr);

    // 3 — Mission (owned by org, described by user)
    var mis = newMission(Object.assign({}, capture.mission || {}, {
      organization_id: org.organization_id,
      described_by_user_id: usr.user_id,
      source: 'mission_capture'
    }));
    store.missions.push(mis);

    // 4 — Relationships
    if (org.mission_ids.indexOf(mis.mission_id) === -1) org.mission_ids.push(mis.mission_id);
    if (usr.active_mission_ids.indexOf(mis.mission_id) === -1) usr.active_mission_ids.push(mis.mission_id);
    // default the describer to 'owner' unless the role implies otherwise
    if (usr.relationship_to_mission === 'unknown') {
      usr.relationship_to_mission = inferRelationship(usr.primary_role);
    }

    // 5 — Memory seeds (Evidence → Transformation → Essence path)
    var seeds = generateMemorySeeds({ user: usr, organization: org, mission: mis, raw: capture.raw });
    // attach the org essence seed as the org's preliminary_essence (first read)
    var essenceSeed = seeds.filter(function (s) { return s.kind === 'essence'; })[0];
    if (essenceSeed && !org.preliminary_essence) {
      org.preliminary_essence = essenceSeed.payload.core_paragraph;
    }
    seeds.forEach(function (s) { store.seeds.push(s); });

    save(store);
    return { store: store, organization: org, user: usr, mission: mis, seeds: seeds };
  }

  function inferRelationship(role) {
    if (role === 'founder' || role === 'ceo') return 'owner';
    if (role === 'hr_head' || role === 'hiring_manager' || role === 'team_lead') return 'leader';
    if (role === 'consultant') return 'observer';
    if (role === 'employee') return 'participant';
    return 'owner'; // the person who first describes the mission is treated as its owner by default
  }

  function findOrgByName(store, name) {
    if (!name) return null;
    var n = name.trim().toLowerCase();
    return store.organizations.filter(function (o) {
      return (o.organization_name || '').trim().toLowerCase() === n;
    })[0] || null;
  }
  function mergeDefined(target, src, keys) {
    if (!src) return;
    keys.forEach(function (k) { if (src[k]) target[k] = src[k]; });
  }

  /* Convenience read accessors for the admin. */
  function getMissionGraph(store) {
    store = store || load();
    return store.missions.map(function (m) {
      var org = store.organizations.filter(function (o) { return o.organization_id === m.organization_id; })[0] || null;
      var usr = store.users.filter(function (u) { return u.user_id === m.described_by_user_id; })[0] || null;
      var seeds = store.seeds.filter(function (s) {
        return (s.subject_type === 'mission' && s.subject_id === m.mission_id) ||
               (org && s.subject_type === 'organization' && s.subject_id === org.organization_id && seedBelongsToMission(s, m)) ||
               (usr && s.subject_type === 'person' && s.subject_id === usr.user_id);
      });
      return { mission: m, organization: org, user: usr, seeds: seeds };
    });
  }
  function seedBelongsToMission(seed, mission) {
    // org-scoped seeds reference the mission they were opened for, when relevant
    return !seed.payload || !seed.payload.opened_for_mission ||
           seed.payload.opened_for_mission === mission.mission_id;
  }

  /* Next Recommended Action — a pure read of the spine. In 1A this
     is deliberately simple: the spine exists, so the next action
     is always to research the org's frequency (the next build),
     never to source candidates. This encodes "mission first". */
  function nextRecommendedAction(node) {
    var m = node.mission, o = node.organization;
    if (!o) return 'Attach an organization to this mission.';
    if ((o.research_status === 'not_started' || o.research_status === 'unknown')) {
      return 'Run Tier 0 public research on ' + (o.organization_name || 'the organization') +
             ' to begin a preliminary frequency read. (Not built yet — attach point ready.)';
    }
    if (m.hiring_relevance === 'none') {
      return 'Mission is not talent-dependent. Hold — hiring is not the intervention here.';
    }
    return 'Awaiting the Frequency build before resonance can be computed.';
  }

  /* ----------------------------------------------------------
     PUBLIC SURFACE
     ---------------------------------------------------------- */
  window.OF = {
    STORE_KEY: STORE_KEY,
    SCHEMA_VERSION: SCHEMA_VERSION,
    ENUMS: ENUMS,
    // factories
    newMission: newMission,
    newOrganization: newOrganization,
    newUser: newUser,
    newResearchPlaceholder: newResearchPlaceholder,
    // seam
    seam: seam,
    generateMemorySeeds: generateMemorySeeds,
    // persistence
    load: load,
    save: save,
    reset: reset,
    emptyStore: emptyStore,
    // mutations / reads
    commitCapture: commitCapture,
    getMissionGraph: getMissionGraph,
    nextRecommendedAction: nextRecommendedAction,
    // helpers exposed for the admin
    missionOneLine: missionOneLine,
    uid: uid
  };
})();
