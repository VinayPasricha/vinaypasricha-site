/* =============================================================
   runtime-data.js — seeded runtime memory for the admin room.

   This is MOCK data. In a real deployment these records are the
   output of the post-conversation job writing to the five layers.
   Here they are hand-authored to exercise every orchestrator path:

     Maya Iyer     → Trigger 1 (left a chamber mid-way, 18 days)
     Daniel Cho    → Trigger 2 (transformation just verified)
     Priya Nair    → Trigger 3 (open question dormant 6+ weeks)
     Tomas Reyes   → Trigger 4 (silent 16 days, no other trigger)
     Lena Ford     → silenced, now returned → Return Ritual
     Arun Mehta    → erased → tombstone

   "today" for the seeded narrative is 2026-05-29.
   ============================================================= */

window.RM_TODAY = '2026-05-29';

window.RM_SEED = {
  users: [

  /* ====================================================== MAYA */
  {
    user_id: 'u_maya',
    name: 'Maya Iyer',
    email: 'maya.iyer@hyphae.studio',
    whatsapp: '+91 98••• ••412',
    language: 'en',
    joined_date: '2025-09-02',
    status: 'active',
    erased_tombstone: false,
    pointer: {
      current_book: 'The Execution Doctrine',
      current_chamber: 'Constraint Observatory',
      current_concept: 'The loudest constraint is rarely the governing one',
      chamber_status: 'mid',
      last_touched: '2026-05-11',
      next_natural_step: 'Name the one constraint that, if removed, releases the others'
    },
    essence: {
      core_paragraph:
        'A founder who thinks in systems and moves faster than her own clarity. She is most alive when building, and most distorted when the building outruns her diagnosis — she mistakes motion for progress under pressure. She is learning, slowly, that her real constraint is not capacity but the refusal to stop and name what is actually governing the work. Honest when asked directly; evasive when allowed to stay busy.',
      core_attributes: [
        { attribute: 'orientation', value: 'systems-builder', source: 'inferred', confidence: 0.86, first_seen: '2025-09-02', last_confirmed: '2026-04-30' },
        { attribute: 'failure_mode', value: 'motion mistaken for progress', source: 'told', confidence: 1, first_seen: '2025-11-18', last_confirmed: '2026-04-30' },
        { attribute: 'under_pressure', value: 'accelerates rather than diagnoses', source: 'inferred', confidence: 0.74, first_seen: '2025-12-04', last_confirmed: '2026-05-11' },
        { attribute: 'honesty', value: 'direct when asked, evasive when busy', source: 'inferred', confidence: 0.68, first_seen: '2026-02-10', last_confirmed: '2026-04-30' },
        { attribute: 'cadence', value: 'works in long sprints, recovers poorly', source: 'told', confidence: 1, first_seen: '2026-03-22', last_confirmed: '2026-03-22' }
      ],
      contextual_essences: [
        { name: 'Professional', paragraph: 'Runs a 9-person design studio. Her constraint at work is delegation — she still holds the highest-leverage decisions herself and calls it standards.', attributes: ['holds leverage too tightly', 'high standards as a cover for control'] },
        { name: 'Intellectual', paragraph: 'Reads structurally, not for pleasure. Wants frameworks she can operationalise within a day or she discards them.', attributes: ['operational reader', 'low tolerance for abstraction'] }
      ],
      last_revised: '2026-04-30',
      revisions: [
        { date: '2026-04-30', note: 'Added "refusal to stop and name what is governing" as the spine. Prior paragraph framed her constraint as time; corroborated across 3 transformations that it is diagnosis avoidance, not capacity.' },
        { date: '2026-01-15', note: 'First contextual essence (Professional) earned after delegation pattern appeared in two separate cycles.' },
        { date: '2025-09-02', note: 'Genesis paragraph from intake. Mostly inferred, low confidence.' }
      ]
    },
    method: {
      evolution_modes: ['structural challenge', 'reflection after action', 'books as scaffolding'],
      updated_date: '2026-04-30'
    },
    transformations: [
      { transformation_id: 't_maya_1', description: 'Began separating "I am busy" from "I am making progress" in her own language — first unprompted use of the distinction.', evidence_ids: ['e_maya_2', 'e_maya_3'], confidence: 0.78, date: '2026-04-30', linked_essence_attributes: ['failure_mode', 'under_pressure'], just_verified: false },
      { transformation_id: 't_maya_2', description: 'Held a single constraint in view for a full cycle instead of diffusing across five.', evidence_ids: ['e_maya_1'], confidence: 0.55, date: '2026-03-22', linked_essence_attributes: ['under_pressure'], just_verified: false }
    ],
    evidence: [
      { evidence_id: 'e_maya_1', summary: 'Closed a cycle naming exactly one bottleneck, when prior cycles always named three or more.', date: '2026-03-22', source_conversation_id: 'c_0312', linked_transformation_id: 't_maya_2', linked_essence_attribute: 'under_pressure' },
      { evidence_id: 'e_maya_2', summary: '"I think I was just moving so I didn\'t have to look at it." — unprompted.', date: '2026-04-22', source_conversation_id: 'c_0408', linked_transformation_id: 't_maya_1', linked_essence_attribute: 'failure_mode' },
      { evidence_id: 'e_maya_3', summary: 'Described a week of intense work as "expensive motion" without being given the phrase.', date: '2026-04-30', source_conversation_id: 'c_0419', linked_transformation_id: 't_maya_1', linked_essence_attribute: 'failure_mode' }
    ],
    signals: [
      { signal_id: 's_maya_1', kind: 'message', summary: 'Entered the Constraint Observatory, described three competing bottlenecks, then went quiet mid-session.', date: '2026-05-11', promoted: false },
      { signal_id: 's_maya_2', kind: 'aside', summary: 'Mentioned a launch is two weeks out — likely the pressure source.', date: '2026-05-11', promoted: true },
      { signal_id: 's_maya_3', kind: 'message', summary: 'Asked whether she could "come back to this later." No return since.', date: '2026-05-11', promoted: false }
    ],
    open_questions: [
      { question_id: 'q_maya_1', question: 'Is her delegation constraint the same constraint as her diagnosis-avoidance, wearing a different coat?', opened_date: '2026-04-30', status: 'open', last_touched: '2026-04-30', resolution_transformation_id: null },
      { question_id: 'q_maya_2', question: 'Does the launch pressure produce the acceleration, or merely reveal it?', opened_date: '2026-05-11', status: 'open', last_touched: '2026-05-11', resolution_transformation_id: null }
    ],
    conversation_notes: {
      running_summary: 'Maya is mid-way through the Constraint Observatory and stalled at the exact moment the chamber asked her to name the single governing constraint — which is also her documented failure mode. A launch in ~2 weeks is the likely pressure source. The work is precisely at her edge; she left rather than stayed.',
      notes: [
        { note_id: 'n_maya_1', date: '2026-05-11', short_note: 'Left mid-diagnosis. Asked to "come back later." This is the avoidance, live.' },
        { note_id: 'n_maya_2', date: '2026-04-30', short_note: 'Strong session. Named expensive motion herself. Essence revised same day.' },
        { note_id: 'n_maya_3', date: '2026-04-22', short_note: 'Breakthrough phrasing. First crack in the busyness.' }
      ]
    },
    chase: { active: false, day: 0, last_contact_date: '2026-04-30' },
    events: [
      { event_id: 'ev_maya_3', event_type: 'silence_detected', channel: '—', date: '2026-05-25', content_summary: 'Two weeks since mid-chamber exit. Flag raised for next orchestrator pass.' },
      { event_id: 'ev_maya_2', event_type: 'shift_detected', channel: '—', date: '2026-04-30', content_summary: 'Transformation t_maya_1 verified; essence revised.' },
      { event_id: 'ev_maya_1', event_type: 'response_received', channel: 'web', date: '2026-04-30', content_summary: 'Session c_0419 — "expensive motion".' }
    ]
  },

  /* ===================================================== DANIEL */
  {
    user_id: 'u_daniel',
    name: 'Daniel Cho',
    email: 'd.cho@meridian-labs.io',
    whatsapp: '+1 415 ••• ••88',
    language: 'en',
    joined_date: '2025-06-14',
    status: 'active',
    erased_tombstone: false,
    pointer: {
      current_book: 'The Execution Doctrine',
      current_chamber: 'Capacity Expansion Chamber',
      current_concept: 'Sustainable load vs. heroic load',
      chamber_status: 'complete',
      last_touched: '2026-05-28',
      next_natural_step: 'Design the next cycle at 80% load and measure whether output holds'
    },
    essence: {
      core_paragraph:
        'An operator who has spent a decade proving he can carry more than anyone around him, and is only now asking what that has cost. His strength — absorbing load others drop — is also the structure that keeps his organisation fragile, because it never has to build real capacity. He responds to being shown the cost, not to being told to slow down. Recently, and for the first time, he chose to design for sustainability over heroics.',
      core_attributes: [
        { attribute: 'identity', value: 'the one who carries it', source: 'told', confidence: 1, first_seen: '2025-06-14', last_confirmed: '2026-05-28' },
        { attribute: 'strength_as_trap', value: 'absorbs load the system should build', source: 'inferred', confidence: 0.88, first_seen: '2025-10-02', last_confirmed: '2026-05-28' },
        { attribute: 'responds_to', value: 'cost made visible, not exhortation', source: 'inferred', confidence: 0.81, first_seen: '2026-01-20', last_confirmed: '2026-05-28' },
        { attribute: 'recovery', value: 'historically none; improving', source: 'told', confidence: 1, first_seen: '2026-02-11', last_confirmed: '2026-05-28' }
      ],
      contextual_essences: [
        { name: 'Professional', paragraph: 'VP of Engineering. His team has learned to let things fall, because Daniel always catches them. The dependency is mutual and invisible to him until shown.', attributes: ['catches what the team drops', 'invisible single point of failure'] },
        { name: 'Relational', paragraph: 'The same carrying pattern shows up at home. He has named it once, quietly, and not returned to it.', attributes: ['carries domestically too', 'named once, avoided since'] }
      ],
      last_revised: '2026-05-28',
      revisions: [
        { date: '2026-05-28', note: 'Final clause rewritten: "chose to design for sustainability over heroics" — the shift is now strong enough to enter essence, not just transformation.' },
        { date: '2026-01-20', note: 'Added "responds to cost made visible" after exhortation failed twice and a single cost-accounting exercise moved him.' },
        { date: '2025-06-14', note: 'Genesis paragraph.' }
      ]
    },
    method: {
      evolution_modes: ['cost made visible', 'measurement over advice', 'long reflection cycles'],
      updated_date: '2026-05-28'
    },
    transformations: [
      { transformation_id: 't_daniel_1', description: 'Chose, deliberately, to design his next cycle at sustainable load rather than absorbing the overflow himself — the first structural break in a decade-long pattern.', evidence_ids: ['e_daniel_1', 'e_daniel_2'], confidence: 0.83, date: '2026-05-28', linked_essence_attributes: ['strength_as_trap', 'recovery'], just_verified: true },
      { transformation_id: 't_daniel_2', description: 'Began measuring the gap between heroic and sustainable load instead of dismissing the distinction.', evidence_ids: ['e_daniel_3'], confidence: 0.7, date: '2026-03-09', linked_essence_attributes: ['responds_to'], just_verified: false }
    ],
    evidence: [
      { evidence_id: 'e_daniel_1', summary: 'Wrote out the next quarter assigning the overflow work to roles that do not yet exist — and left it there instead of taking it back.', date: '2026-05-28', source_conversation_id: 'c_0521', linked_transformation_id: 't_daniel_1', linked_essence_attribute: 'strength_as_trap' },
      { evidence_id: 'e_daniel_2', summary: '"If I catch it again, it never gets built." — his sentence, unprompted.', date: '2026-05-28', source_conversation_id: 'c_0521', linked_transformation_id: 't_daniel_1', linked_essence_attribute: 'strength_as_trap' },
      { evidence_id: 'e_daniel_3', summary: 'Logged two weeks of actual vs. intended load. The gap surprised him into silence.', date: '2026-03-09', source_conversation_id: 'c_0288', linked_transformation_id: 't_daniel_2', linked_essence_attribute: 'responds_to' }
    ],
    signals: [
      { signal_id: 's_daniel_1', kind: 'message', summary: 'Closed the Capacity Expansion Chamber with a concrete next-cycle design.', date: '2026-05-28', promoted: true },
      { signal_id: 's_daniel_2', kind: 'aside', summary: 'Asked, almost in passing, whether the same logic applies at home.', date: '2026-05-28', promoted: true }
    ],
    open_questions: [
      { question_id: 'q_daniel_1', question: 'Will the sustainable-load design survive contact with the first real overflow, or will he quietly catch it?', opened_date: '2026-05-28', status: 'open', last_touched: '2026-05-28', resolution_transformation_id: null },
      { question_id: 'q_daniel_2', question: 'Is the relational carrying pattern in scope, or does he need to be the one to open it?', opened_date: '2026-02-11', status: 'open', last_touched: '2026-05-28', resolution_transformation_id: null }
    ],
    conversation_notes: {
      running_summary: 'Daniel just verified the most significant shift of his arc: choosing structural sustainability over personal heroics. The next step is unusually clear — run one cycle at 80% load and see whether output holds. This is the moment to reach back, while the decision is warm and before the first overflow tests it.',
      notes: [
        { note_id: 'n_daniel_1', date: '2026-05-28', short_note: 'The shift landed. Essence revised. Next step is obvious and time-sensitive.' },
        { note_id: 'n_daniel_2', date: '2026-03-09', short_note: 'Measurement worked where advice never did. Method updated.' }
      ]
    },
    chase: { active: false, day: 0, last_contact_date: '2026-05-28' },
    events: [
      { event_id: 'ev_daniel_2', event_type: 'shift_detected', channel: '—', date: '2026-05-28', content_summary: 'Transformation t_daniel_1 verified (confidence 0.83). Clear next step opened.' },
      { event_id: 'ev_daniel_1', event_type: 'response_received', channel: 'web', date: '2026-05-28', content_summary: 'Session c_0521 — sustainable-load design.' }
    ]
  },

  /* ====================================================== PRIYA */
  {
    user_id: 'u_priya',
    name: 'Priya Nair',
    email: 'priya@nair.associates',
    whatsapp: '+44 7••• ••6 209',
    language: 'en',
    joined_date: '2025-03-08',
    status: 'active',
    erased_tombstone: false,
    pointer: {
      current_book: 'The SIV Method',
      current_chamber: 'Output Reality Chamber',
      current_concept: 'Separating confidence from certainty',
      chamber_status: 'complete',
      last_touched: '2026-05-20',
      next_natural_step: 'Re-run the lens generation on the decision she has been circling'
    },
    essence: {
      core_paragraph:
        'A strategist whose intelligence is also her hiding place. She can construct a defensible analysis for any position, which means she rarely has to feel the discomfort of not knowing. Her evolution depends on being caught in the gap between how confident she sounds and how certain she actually is. She is patient, precise, and quietly afraid of being wrong in front of people who matter.',
      core_attributes: [
        { attribute: 'gift', value: 'can defend any position', source: 'inferred', confidence: 0.84, first_seen: '2025-03-08', last_confirmed: '2026-04-15' },
        { attribute: 'shadow', value: 'analysis as a place to hide from not-knowing', source: 'inferred', confidence: 0.79, first_seen: '2025-07-19', last_confirmed: '2026-04-15' },
        { attribute: 'fear', value: 'being wrong in front of people who matter', source: 'told', confidence: 1, first_seen: '2026-01-30', last_confirmed: '2026-01-30' },
        { attribute: 'pace', value: 'patient, will wait years', source: 'inferred', confidence: 0.72, first_seen: '2025-09-01', last_confirmed: '2026-04-15' }
      ],
      contextual_essences: [
        { name: 'Intellectual', paragraph: 'Reads widely and deeply, but uses the reading to stay one step ahead of any challenge rather than to be changed by it.', attributes: ['reads to armor, not to open'] }
      ],
      last_revised: '2026-04-15',
      revisions: [
        { date: '2026-04-15', note: 'Sharpened "analysis as hiding place" — was previously framed as a strength only.' },
        { date: '2025-03-08', note: 'Genesis paragraph.' }
      ]
    },
    method: {
      evolution_modes: ['Socratic pressure', 'being caught in a contradiction', 'slow reflection'],
      updated_date: '2026-04-15'
    },
    transformations: [
      { transformation_id: 't_priya_1', description: 'Admitted, once, that a "strategic recommendation" was actually a guess she had dressed up. First separation of confidence from certainty.', evidence_ids: ['e_priya_1'], confidence: 0.6, date: '2026-04-15', linked_essence_attributes: ['shadow', 'fear'], just_verified: false }
    ],
    evidence: [
      { evidence_id: 'e_priya_1', summary: '"I sounded certain because I could not afford to look unsure. I wasn\'t sure at all."', date: '2026-04-15', source_conversation_id: 'c_0402', linked_transformation_id: 't_priya_1', linked_essence_attribute: 'shadow' }
    ],
    signals: [
      { signal_id: 's_priya_1', kind: 'message', summary: 'Returned briefly on 2026-05-20, did surface work in the Output Reality Chamber, did not reopen the dormant question.', date: '2026-05-20', promoted: false }
    ],
    open_questions: [
      { question_id: 'q_priya_1', question: 'What is the specific decision she keeps circling but will not name? It has appeared, unnamed, in four sessions.', opened_date: '2026-04-15', status: 'open', last_touched: '2026-04-15', resolution_transformation_id: null }
    ],
    conversation_notes: {
      running_summary: 'Priya made one real admission in April — that confidence was covering for uncertainty — and has not advanced it since. There is a specific decision she circles without naming; the open question about it has gone dormant for six weeks. She visits, does surface work, and routes around the live question. The dormancy is itself the signal.',
      notes: [
        { note_id: 'n_priya_1', date: '2026-05-20', short_note: 'Visited. Stayed on the surface. Did not touch the open question. Sixth week dormant.' },
        { note_id: 'n_priya_2', date: '2026-04-15', short_note: 'Real admission. Essence sharpened. The named decision is still unnamed.' }
      ]
    },
    chase: { active: false, day: 0, last_contact_date: '2026-05-20' },
    events: [
      { event_id: 'ev_priya_2', event_type: 'website_visit', channel: 'web', date: '2026-05-20', content_summary: 'Surface session. Open question untouched.' },
      { event_id: 'ev_priya_1', event_type: 'shift_detected', channel: '—', date: '2026-04-15', content_summary: 'Transformation t_priya_1 verified (confidence 0.60).' }
    ]
  },

  /* ====================================================== TOMAS */
  {
    user_id: 'u_tomas',
    name: 'Tomas Reyes',
    email: 'tomas.reyes@costa-verde.mx',
    whatsapp: '+52 55 ••• ••71',
    language: 'es',
    joined_date: '2025-11-21',
    status: 'active',
    erased_tombstone: false,
    pointer: {
      current_book: 'AI for Business Leaders',
      current_chamber: 'The Sequence Chamber',
      current_concept: 'Dependencies before deadlines',
      chamber_status: 'complete',
      last_touched: '2026-05-13',
      next_natural_step: 'Bring a live sequence — the next quarter\'s rollout — into the chamber'
    },
    essence: {
      core_paragraph:
        'Early in the work. A pragmatic operator who came for AI strategy and is discovering, slowly, that his real question is about sequencing under uncertainty. Not yet revealed enough for a confident reading — much of this is provisional. He engages in bursts, then disappears, in a rhythm that does not yet look like avoidance, only like a busy life.',
      core_attributes: [
        { attribute: 'entry_reason', value: 'came for AI strategy', source: 'told', confidence: 1, first_seen: '2025-11-21', last_confirmed: '2025-11-21' },
        { attribute: 'emerging_question', value: 'sequencing under uncertainty', source: 'inferred', confidence: 0.52, first_seen: '2026-04-02', last_confirmed: '2026-05-13' },
        { attribute: 'rhythm', value: 'bursts then silence', source: 'inferred', confidence: 0.61, first_seen: '2026-02-15', last_confirmed: '2026-05-13' }
      ],
      contextual_essences: [],
      last_revised: '2026-05-13',
      revisions: [
        { date: '2026-05-13', note: 'Lowered confidence on emerging_question; still mostly inferred. Resisting over-reading early data.' },
        { date: '2025-11-21', note: 'Genesis paragraph from intake.' }
      ]
    },
    method: {
      evolution_modes: ['concrete examples from his own work', 'short sessions'],
      updated_date: '2026-05-13'
    },
    transformations: [],
    evidence: [
      { evidence_id: 'e_tomas_1', summary: 'Reframed his own "deadline problem" as a "dependency problem" by the end of a session.', date: '2026-05-13', source_conversation_id: 'c_0498', linked_transformation_id: null, linked_essence_attribute: 'emerging_question' }
    ],
    signals: [
      { signal_id: 's_tomas_1', kind: 'message', summary: 'Completed the Sequence Chamber cleanly. Said he would "bring a real one next time."', date: '2026-05-13', promoted: true },
      { signal_id: 's_tomas_2', kind: 'aside', summary: 'Mentioned travel for the next couple of weeks.', date: '2026-05-13', promoted: false }
    ],
    open_questions: [
      { question_id: 'q_tomas_1', question: 'Is "sequencing under uncertainty" his actual question, or a polite proxy for something he has not surfaced?', opened_date: '2026-05-13', status: 'open', last_touched: '2026-05-13', resolution_transformation_id: null }
    ],
    conversation_notes: {
      running_summary: 'Tomas completed the Sequence Chamber on a good note and went quiet — 16 days now, consistent with his burst-then-silence rhythm. No chamber left mid-way, no fresh transformation, no dormant question. There is no structural trigger; only the silence itself. A light heartbeat, in his language, is appropriate — not a chase.',
      notes: [
        { note_id: 'n_tomas_1', date: '2026-05-13', short_note: 'Clean completion. Travel mentioned. Expect a gap. Nothing wrong.' }
      ]
    },
    chase: { active: false, day: 0, last_contact_date: '2026-05-13' },
    events: [
      { event_id: 'ev_tomas_1', event_type: 'response_received', channel: 'web', date: '2026-05-13', content_summary: 'Session c_0498 — completed Sequence Chamber.' }
    ]
  },

  /* ======================================================= LENA */
  {
    user_id: 'u_lena',
    name: 'Lena Ford',
    email: 'lena.ford@gmail.com',
    whatsapp: '+1 312 ••• ••03',
    language: 'en',
    joined_date: '2024-02-17',
    status: 'silenced',
    erased_tombstone: false,
    returned: true,
    returned_after_days: 1184,
    pointer: {
      current_book: 'The SIV Method',
      current_chamber: 'Human Constraint Chamber',
      current_concept: 'Role mismatch is not a character flaw',
      chamber_status: 'mid',
      last_touched: '2024-12-30',
      next_natural_step: 'Resume the examination of whether the role was ever hers to hold'
    },
    essence: {
      core_paragraph:
        'A capable person who spent years in a role shaped for someone else and concluded the misfit was a personal failing. The work, before she vanished, was just beginning to separate role mismatch from character. Wherever she has been since, the essence is preserved exactly as she left it — that was the promise.',
      core_attributes: [
        { attribute: 'misread', value: 'role mismatch read as character flaw', source: 'inferred', confidence: 0.77, first_seen: '2024-06-04', last_confirmed: '2024-12-30' },
        { attribute: 'capability', value: 'high, in the wrong frequency', source: 'inferred', confidence: 0.7, first_seen: '2024-08-12', last_confirmed: '2024-12-30' }
      ],
      contextual_essences: [
        { name: 'Professional', paragraph: 'Was a head of operations in an environment that rewarded a kind of aggression she had to manufacture daily.', attributes: ['manufactured aggression', 'wrong-frequency role'] }
      ],
      last_revised: '2024-12-30',
      revisions: [
        { date: '2024-12-30', note: 'Last revision before silence. Preserved untouched through the entire silenced period — per the permanence promise.' },
        { date: '2024-02-17', note: 'Genesis paragraph.' }
      ]
    },
    method: {
      evolution_modes: ['gentle reframing', 'permission to not-know', 'slow pacing'],
      updated_date: '2024-12-30'
    },
    transformations: [
      { transformation_id: 't_lena_1', description: 'Began, just once, to consider that the misfit was structural rather than personal.', evidence_ids: ['e_lena_1'], confidence: 0.5, date: '2024-12-30', linked_essence_attributes: ['misread'], just_verified: false }
    ],
    evidence: [
      { evidence_id: 'e_lena_1', summary: '"Maybe I wasn\'t bad at it. Maybe it was never mine to do." Then she stopped coming.', date: '2024-12-30', source_conversation_id: 'c_0061', linked_transformation_id: 't_lena_1', linked_essence_attribute: 'misread' }
    ],
    signals: [
      { signal_id: 's_lena_now', kind: 'visit', summary: 'Returned to the website today after 3 years and 3 months of silence. Has not spoken yet — only arrived.', date: '2026-05-29', promoted: true }
    ],
    open_questions: [
      { question_id: 'q_lena_1', question: 'Was the role ever hers to hold, or was she cast into the wrong frequency from the start?', opened_date: '2024-12-30', status: 'open', last_touched: '2024-12-30', resolution_transformation_id: null }
    ],
    conversation_notes: {
      running_summary: 'Lena went fully silent at the end of 2024, mid-way through the Human Constraint Chamber, right after the first crack in her self-blame. The full chase ladder ran and completed; she was marked silenced in early 2026. Today she returned — a single website visit, no words yet. The return ritual applies: acknowledge the gap, restate the permanence promise, resume from her pointer. Do not re-threshold her.',
      notes: [
        { note_id: 'n_lena_2', date: '2026-05-29', short_note: 'She came back. Three years. Hold the return ritual; do not start over.' },
        { note_id: 'n_lena_1', date: '2024-12-30', short_note: 'First crack, then gone. Left exactly here.' }
      ]
    },
    chase: { active: false, day: 999, last_contact_date: '2025-01-13', silenced_date: '2026-01-20' },
    events: [
      { event_id: 'ev_lena_5', event_type: 'website_visit', channel: 'web', date: '2026-05-29', content_summary: 'Returned after 1184 days. Return ritual pending.' },
      { event_id: 'ev_lena_4', event_type: 'chase_complete', channel: '—', date: '2026-01-20', content_summary: '12 months of monthly silence-emails elapsed with no response. Marked silenced.' },
      { event_id: 'ev_lena_3', event_type: 'reachout_sent', channel: 'whatsapp', date: '2025-01-13', content_summary: 'Second WhatsApp (Day 21). No response.' },
      { event_id: 'ev_lena_2', event_type: 'reachout_sent', channel: 'email', date: '2025-01-06', content_summary: 'Second email (Day 7). No response.' },
      { event_id: 'ev_lena_1', event_type: 'reachout_sent', channel: 'email', date: '2024-12-30', content_summary: 'First reach-out (Day 0), left-mid-chamber trigger. No response.' }
    ]
  },

  /* ======================================================= ARUN */
  {
    user_id: 'u_arun',
    name: 'Arun Mehta',
    email: '— erased —',
    whatsapp: '— erased —',
    language: 'en',
    joined_date: '2025-04-30',
    status: 'erased',
    erased_tombstone: true,
    erased_date: '2026-05-04',
    pointer: null,
    essence: null,
    method: null,
    transformations: [],
    evidence: [],
    signals: [],
    open_questions: [],
    conversation_notes: null,
    chase: { active: false, day: 0, last_contact_date: null },
    events: [
      { event_id: 'ev_arun_1', event_type: 'chase_complete', channel: '—', date: '2026-05-04', content_summary: '"erase me" received on WhatsApp. All layers, pointer, and notes erased. Tombstone left so the system will not chase.' }
    ]
  }

  ]
};
