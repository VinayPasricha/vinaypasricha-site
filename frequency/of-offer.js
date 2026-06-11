/* =============================================================
   Organizational Frequency — Offer Orchestration  (Build 2F)
   =============================================================
   Closes the execution gap after interviews: OfferPackage →
   OfferApproval → OfferResponse → JoinOutcome (1M) → Learning.

   DOCTRINE:
     • An offer is the human acting on a future-state read. The
       OfferPackage LINKS to the EmergentOutcome that justifies it —
       never a score, never a rank.
     • No offer may proceed if resonance is STALE — the system warns
       "Regenerate resonance before offer."
     • Employer approval is required. The system NEVER approves
       autonomously and NEVER accepts on the candidate's behalf.
     • Candidate interview observations about the ORGANIZATION never
       update org frequency directly — they become mediated
       OrganizationLearningSignals for human review (→ possible
       discovery question → 1K → 1L). Always mediated, never direct.

   Augments window.OF with window.OF.offer.
   ============================================================= */
(function () {
  'use strict';
  if (!window.OF) { console.warn('of-offer.js requires of-model.js'); return; }
  var OF = window.OF;

  var OFFER_STATUS = ['draft', 'pending_approval', 'approved', 'sent', 'accepted', 'declined', 'expired', 'withdrawn'];
  var APPROVAL_DECISIONS = ['approved', 'rejected', 'needs_revision'];
  var RESPONSES = ['accepted', 'declined', 'negotiate'];
  var ORG_SIGNAL_STATUS = ['captured', 'review_needed', 'converted_to_discovery_question', 'ignored', 'resolved'];

  function nowISO() { return new Date().toISOString(); }
  function uid(p) { return OF.uid(p); }
  function byId(arr, key, val) { return (arr || []).filter(function (x) { return x[key] === val; })[0] || null; }

  function ensure(store) {
    store.offer_packages = store.offer_packages || [];
    store.offer_approvals = store.offer_approvals || [];
    store.offer_responses = store.offer_responses || [];
    store.org_learning_signals = store.org_learning_signals || [];
    return store;
  }

  /* ===== SCHEMAS ===== */
  function newOffer(f) {
    f = f || {};
    return { offer_id: f.offer_id || uid('offer'), mandate_id: f.mandate_id || null, candidate_id: f.candidate_id || null, organization_id: f.organization_id || null, role_id: f.role_id || null, emergent_outcome_id: f.emergent_outcome_id || null, status: OFFER_STATUS.indexOf(f.status) !== -1 ? f.status : 'draft', terms: f.terms || '', confidence_basis: f.confidence_basis || '', created_at: f.created_at || nowISO(), updated_at: nowISO() };
  }
  function newApproval(f) {
    f = f || {};
    return { approval_id: f.approval_id || uid('appr'), offer_id: f.offer_id || null, approver_name: f.approver_name || '', approver_role: f.approver_role || '', decision: APPROVAL_DECISIONS.indexOf(f.decision) !== -1 ? f.decision : 'needs_revision', reason: f.reason || '', created_at: f.created_at || nowISO() };
  }
  function newResponse(f) {
    f = f || {};
    return { response_id: f.response_id || uid('oresp'), offer_id: f.offer_id || null, candidate_id: f.candidate_id || null, response: RESPONSES.indexOf(f.response) !== -1 ? f.response : 'negotiate', reason: f.reason || '', created_at: f.created_at || nowISO() };
  }
  function newOrgSignal(f) {
    f = f || {};
    return { signal_id: f.signal_id || uid('osig'), organization_id: f.organization_id || null, candidate_id: f.candidate_id || null, interview_id: f.interview_id || null, statement: f.statement || '', source: f.source || 'candidate_observation', dimension: f.dimension || null, confidence: f.confidence || 'low', status: ORG_SIGNAL_STATUS.indexOf(f.status) !== -1 ? f.status : 'captured', created_at: f.created_at || nowISO() };
  }

  /* ===== resonance freshness gate ===== */
  function resonanceState(candidateId, store) {
    // fresh emergent outcome justifying this candidate?
    var c = byId(store.cd_candidates, 'candidate_discovery_id', candidateId);
    var res = byId(store.cd_resonance, 'candidate_discovery_id', candidateId);
    var outcome = res && res.emergent_outcome_id ? byId(store.emergent_outcomes, 'outcome_id', res.emergent_outcome_id) : null;
    var stale = (res && res.stale) || (outcome && outcome.stale);
    return { resonance: res, outcome: outcome, fresh: !!res && !stale, stale: !!stale, candidate: c };
  }

  /* ===== draft an offer — only against FRESH resonance ===== */
  function draftOffer(candidateId, fields, store) {
    store = ensure(store || OF.load());
    var rs = resonanceState(candidateId, store);
    if (!rs.resonance) return { error: 'No resonance screen for this candidate — generate one before drafting an offer.' };
    if (rs.stale) return { error: 'Regenerate resonance before offer — the underlying frequency changed since the last screen.', stale: true };
    var c = rs.candidate;
    var mandate = c && c.mandate_id ? byId(store.mandates, 'mandate_id', c.mandate_id) : null;
    fields = fields || {};
    var offer = newOffer({
      mandate_id: mandate ? mandate.mandate_id : null, candidate_id: candidateId,
      organization_id: rs.resonance.organization_id || (mandate ? mandate.organization_id : null),
      role_id: rs.resonance.role_id || (mandate ? mandate.role_id : null),
      emergent_outcome_id: rs.resonance.emergent_outcome_id || null,
      terms: fields.terms || '', status: 'draft',
      confidence_basis: 'Justified by emergent-outcome ' + (rs.resonance.emergent_outcome_id || 'n/a') + ' (resonance confidence ' + (rs.resonance.confidence || 'unknown') + '). Future-state analysis, not a score.'
    });
    store.offer_packages.push(offer);
    OF.save(store);
    return { offer: offer };
  }
  function submitForApproval(offerId, store) {
    store = ensure(store || OF.load());
    var o = byId(store.offer_packages, 'offer_id', offerId);
    if (!o) return { error: 'Offer not found.' };
    o.status = 'pending_approval'; o.updated_at = nowISO(); OF.save(store);
    return { offer: o };
  }
  /* employer approval — required, never autonomous */
  function recordApproval(offerId, fields, store) {
    store = ensure(store || OF.load());
    var o = byId(store.offer_packages, 'offer_id', offerId);
    if (!o) return { error: 'Offer not found.' };
    var a = newApproval(Object.assign({}, fields, { offer_id: offerId }));
    store.offer_approvals.push(a);
    if (a.decision === 'approved') o.status = 'approved';
    else if (a.decision === 'rejected') o.status = 'withdrawn';
    else o.status = 'draft';
    o.updated_at = nowISO(); OF.save(store);
    return { offer: o, approval: a };
  }
  /* send through transport if configured — else honest block */
  function sendOffer(offerId, store) {
    store = ensure(store || OF.load());
    var o = byId(store.offer_packages, 'offer_id', offerId);
    if (!o) return { error: 'Offer not found.' };
    if (o.status !== 'approved') return { error: 'Offer must be approved before sending.' };
    var c = byId(store.cd_candidates, 'candidate_discovery_id', o.candidate_id);
    if (OF.capabilities) {
      var msg = OF.capabilities.queueOutbound({ recipient_type: 'candidate', recipient_id: o.candidate_id, channel: 'email', subject: 'Your offer', body: o.terms || 'Offer details enclosed.' }, store);
      var sr = OF.capabilities.sendEmail(msg.message_id, {}, store); store = ensure(OF.load());
      o = byId(store.offer_packages, 'offer_id', offerId);
      if (sr.status === 'blocked') { o.status = 'approved'; o.updated_at = nowISO(); OF.save(store); return { status: 'blocked', reason: sr.reason + ' Offer stays approved for a human to send.' }; }
      o.status = 'sent'; o.updated_at = nowISO(); OF.save(store);
      return { status: 'sent', offer: o };
    }
    return { status: 'blocked', reason: 'transport_not_implemented — no email provider. Offer stays approved for a human to send.' };
  }
  /* candidate response — system NEVER accepts on their behalf */
  function recordResponse(offerId, response, reason, store) {
    store = ensure(store || OF.load());
    var o = byId(store.offer_packages, 'offer_id', offerId);
    if (!o) return { error: 'Offer not found.' };
    var r = newResponse({ offer_id: offerId, candidate_id: o.candidate_id, response: response, reason: reason });
    store.offer_responses.push(r);
    if (response === 'accepted') o.status = 'accepted';
    else if (response === 'declined') o.status = 'declined';
    o.updated_at = nowISO();
    var join = null, signal = null;
    if (response === 'accepted' && OF.hiring) {
      OF.save(store);
      join = OF.hiring.recordJoin(o.candidate_id, { joined: true, join_date: nowISO().slice(0, 10), notes: 'Offer ' + offerId + ' accepted.' }, OF.load());
      store = ensure(OF.load());
      var s = OF.hiring.captureSignal('join_outcome', { mandate_id: o.mandate_id, candidate_id: o.candidate_id, signal: 'Offer accepted — candidate joining. First reality signal opened.', confidence: 'high' }, store);
      store = ensure(OF.load()); signal = s ? s.signal_id : null;
    } else {
      OF.save(store);
    }
    return { offer: o, response: r, join: join, learning_signal: signal };
  }
  function setTerms(offerId, terms, store) { store = ensure(store || OF.load()); var o = byId(store.offer_packages, 'offer_id', offerId); if (o) { o.terms = terms; o.updated_at = nowISO(); OF.save(store); } return o; }

  /* ===== ORGANIZATION LEARNING SIGNAL (mediated, never direct) ===== */
  function captureOrgSignal(fields, store) {
    store = ensure(store || OF.load());
    var s = newOrgSignal(Object.assign({}, fields, { status: 'review_needed' }));
    store.org_learning_signals.push(s);
    OF.save(store);
    return s;
  }
  function setOrgSignalStatus(signalId, status, store) {
    store = ensure(store || OF.load());
    var s = byId(store.org_learning_signals, 'signal_id', signalId);
    if (s && ORG_SIGNAL_STATUS.indexOf(status) !== -1) { s.status = status; OF.save(store); }
    return s;
  }

  /* ===== reads ===== */
  function getForCandidate(candidateId, store) {
    store = ensure(store || OF.load());
    var o = (store.offer_packages || []).filter(function (x) { return x.candidate_id === candidateId; }).sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); })[0];
    if (!o) return { offer: null, resonance: resonanceState(candidateId, store) };
    return { offer: o, approvals: store.offer_approvals.filter(function (a) { return a.offer_id === o.offer_id; }), response: byId(store.offer_responses, 'offer_id', o.offer_id), resonance: resonanceState(candidateId, store) };
  }
  function getOffers(store) { store = ensure(store || OF.load()); return store.offer_packages.slice().sort(function (a, b) { return (b.created_at || '').localeCompare(a.created_at || ''); }); }
  function getOrgSignals(orgId, store) { store = ensure(store || OF.load()); var sigs = store.org_learning_signals.slice().reverse(); return orgId ? sigs.filter(function (s) { return s.organization_id === orgId; }) : sigs; }
  function resetOffers(store) { store = ensure(store || OF.load()); store.offer_packages = []; store.offer_approvals = []; store.offer_responses = []; store.org_learning_signals = []; OF.save(store); }

  OF.offer = {
    OFFER_STATUS: OFFER_STATUS, APPROVAL_DECISIONS: APPROVAL_DECISIONS, RESPONSES: RESPONSES, ORG_SIGNAL_STATUS: ORG_SIGNAL_STATUS,
    ensure: ensure, resonanceState: resonanceState,
    draftOffer: draftOffer, submitForApproval: submitForApproval, recordApproval: recordApproval, sendOffer: sendOffer, recordResponse: recordResponse, setTerms: setTerms,
    captureOrgSignal: captureOrgSignal, setOrgSignalStatus: setOrgSignalStatus,
    getForCandidate: getForCandidate, getOffers: getOffers, getOrgSignals: getOrgSignals, resetOffers: resetOffers
  };
})();
