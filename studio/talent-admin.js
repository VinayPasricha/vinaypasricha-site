/* =============================================================
   talent-admin.js — Studio · Talent Graph Connector Layer  (2E)
   ============================================================= */
(function () {
  'use strict';
  var OF = window.OF;
  var TG = OF.talent;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function ttl(s) { return (s || '').replace(/_/g, ' '); }
  function mandates() { var st = OF.load(); return (st.mandates || []).map(function (m) { var r = (st.roles || []).filter(function (x) { return x.role_id === m.role_id; })[0]; var o = (st.organizations || []).filter(function (x) { return x.organization_id === m.organization_id; })[0]; return { id: m.mandate_id, label: (r ? r.role_name : 'role') + ' · ' + (o ? o.organization_name : 'org') }; }); }

  function render() {
    var s = TG.snapshot();
    $('tg-tiles').innerHTML =
      tile('', s.counts.sources_configured, 'Sources configured') + tile('prof', s.counts.profiles, 'Profiles') +
      tile('dup', s.counts.duplicates, 'Duplicates') + tile('intel', s.counts.with_intel, 'With intelligence') + tile('cand', s.counts.candidates, 'Candidates');

    $('tg-sources').innerHTML = s.sources.map(function (src) {
      var conn = s.connectors.filter(function (c) { return c.source_id === src.source_id; })[0];
      var act = src.status === 'configured'
        ? (src.source_type === 'manual_import' ? '<span class="tg-mini" style="opacity:.5;cursor:default">always on</span>' : '<button class="tg-mini warn" data-unconfig="' + esc(src.source_type) + '">Set not configured</button>')
        : '<button class="tg-mini" data-config="' + esc(src.source_type) + '">Mark configured</button>';
      return '<div class="tg-src"><div><div class="sn">' + esc(src.source_name) + '</div><div class="sd">' + esc(ttl(src.source_type)) + ' · ' + (conn ? esc(ttl(conn.connector_type)) : '—') + ' · ' + (src.record_count || 0) + ' records</div></div>' +
        '<div class="sd">' + esc(src.provider) + '</div>' +
        '<span class="tg-st ' + esc(src.status) + '">' + esc(ttl(src.status)) + '</span>' + act + '</div>';
    }).join('');

    var srcOpts = TG.SOURCE_TYPES.filter(function (t) { return t !== 'future'; }).map(function (t) { return '<option value="' + t + '">' + esc(ttl(t)) + '</option>'; }).join('');
    $('tg-import').innerHTML =
      '<div class="row"><select id="tg-imp-src">' + srcOpts + '</select><input id="tg-imp-name" placeholder="Name"><input id="tg-imp-title" placeholder="Current title"></div>' +
      '<div class="row"><input id="tg-imp-company" placeholder="Company"><input id="tg-imp-li" placeholder="LinkedIn URL"><input id="tg-imp-email" placeholder="Email"></div>' +
      '<textarea id="tg-imp-resume" placeholder="Resume / profile text (becomes Person Intelligence evidence)…"></textarea>' +
      '<button class="tg-act" id="tg-imp-go" type="button">Import talent profile</button>';

    $('tg-dups').innerHTML = s.duplicates.filter(function (d) { return d.status === 'detected' || d.status === 'review_required'; }).length
      ? s.duplicates.filter(function (d) { return d.status === 'detected' || d.status === 'review_required'; }).map(function (d) {
          return '<div class="tg-dup"><div><div class="dt">Possible duplicate · ' + esc(d.reason) + '</div><div class="dm">' + esc(d.status) + '</div></div>' +
            '<div style="display:flex;gap:6px"><button class="tg-mini" data-merge="' + esc(d.duplicate_id) + '">Merge</button><button class="tg-mini warn" data-ignore="' + esc(d.duplicate_id) + '">Keep both</button></div></div>';
        }).join('')
      : '<div class="tg-empty">No duplicates to review.</div>';

    var mopts = mandates();
    $('tg-profiles').innerHTML = s.profiles.filter(function (p) { return p.status !== 'archived'; }).length
      ? s.profiles.filter(function (p) { return p.status !== 'archived'; }).map(function (p) {
          var det = TG.getProfile(p.talent_profile_id);
          var hasIntel = det.research && det.research.brief;
          var hasCand = !!p.candidate_discovery_id;
          var res = det.candidate && det.candidate.resonance;
          var msel = '<select class="tg-msel" data-mfor="' + esc(p.talent_profile_id) + '"><option value="">— mandate —</option>' + mopts.map(function (m) { return '<option value="' + esc(m.id) + '">' + esc(m.label) + '</option>'; }).join('') + '</select>';
          var act = '';
          if (!hasIntel) act += '<button class="tg-mini" data-intel="' + esc(p.talent_profile_id) + '">Generate intelligence</button>';
          if (!hasCand && mopts.length) act += msel + '<button class="tg-mini" data-resonance="' + esc(p.talent_profile_id) + '">Generate resonance</button>';
          if (res && res.next_action === 'approve_outreach' && !(det.candidate && det.candidate.draft)) act += '<button class="tg-mini" data-outreach="' + esc(p.talent_profile_id) + '">Queue outreach</button>';
          return '<div class="tg-prof"><div class="tg-prof-top"><div><div class="pn">' + esc(p.name || 'Unnamed') + (p.current_title ? ' <span class="r">· ' + esc(p.current_title) + (p.current_company ? ', ' + esc(p.current_company) : '') + '</span>' : '') + '</div>' +
            '<div class="pm">source: ' + esc(ttl(sourceName(p.source_id, s))) + ' · confidence ' + esc(p.source_confidence) + (p.linkedin_url ? ' · LinkedIn' : '') + '</div></div>' +
            '<span class="tg-pst ' + esc(p.status) + '">' + esc(p.status) + '</span></div>' +
            '<div class="tg-chain">' +
              '<span class="tg-chip ' + (hasIntel ? 'on' : '') + '">person intelligence' + (hasIntel ? ' ✓' : '') + '</span>' +
              '<span class="tg-chip ' + (res ? 'on' : '') + '">resonance' + (res ? ' · ' + esc(ttl(res.next_action)) : '') + '</span>' +
              '<span class="tg-chip ' + (det.candidate && det.candidate.draft ? 'on' : '') + '">outreach' + (det.candidate && det.candidate.draft ? ' · ' + esc(ttl(det.candidate.draft.status)) : '') + '</span>' +
            '</div>' +
            (act ? '<div class="tg-prof-act">' + act + '</div>' : '') +
          '</div>';
        }).join('')
      : '<div class="tg-empty">No talent profiles yet. Import one above, or connect a source.</div>';
  }
  function tile(cls, n, label) { return '<div class="tg-tile ' + cls + '"><div class="tn">' + n + '</div><div class="tl">' + label + '</div></div>'; }
  function sourceName(id, s) { var src = s.sources.filter(function (x) { return x.source_id === id; })[0]; return src ? src.source_type : 'manual_import'; }
  function v(id) { var e = document.getElementById(id); return e ? e.value.trim() : ''; }

  document.addEventListener('click', function (e) {
    var t = e.target, id = t.id;
    var cfg = t.getAttribute && t.getAttribute('data-config'); if (cfg) { TG.configureSource(cfg, TG.source(cfg).source_name); render(); return; }
    var unc = t.getAttribute && t.getAttribute('data-unconfig'); if (unc) { TG.setSourceStatus(unc, 'not_configured'); render(); return; }
    if (id === 'tg-imp-go') {
      if (!v('tg-imp-name') && !v('tg-imp-li') && !v('tg-imp-email')) { alert('Add a name, LinkedIn URL, or email.'); return; }
      var r = TG.importProfile(v('tg-imp-src'), { name: v('tg-imp-name'), current_title: v('tg-imp-title'), current_company: v('tg-imp-company'), linkedin_url: v('tg-imp-li'), email: v('tg-imp-email'), resume_text: (document.getElementById('tg-imp-resume') || {}).value || '' });
      if (r && r.error) alert(r.error); else if (r.duplicate) alert('Imported, but flagged as a possible duplicate — review below.');
      render(); return;
    }
    var mg = t.getAttribute && t.getAttribute('data-merge'); if (mg) { TG.resolveDuplicate(mg, 'merge'); render(); return; }
    var ig = t.getAttribute && t.getAttribute('data-ignore'); if (ig) { TG.resolveDuplicate(ig, 'ignore'); render(); return; }
    var intel = t.getAttribute && t.getAttribute('data-intel'); if (intel) { var ri = TG.toPersonIntelligence(intel, {}); if (ri && ri.error) alert(ri.error); else if (ri.needs_paste) alert('Research request opened — add a résumé to the profile or paste material in Person Research to generate a brief.'); render(); return; }
    var rs = t.getAttribute && t.getAttribute('data-resonance');
    if (rs) {
      var msel = document.querySelector('[data-mfor="' + rs + '"]'); var mid = msel ? msel.value : '';
      if (!mid) { alert('Pick a mandate to screen resonance against.'); return; }
      var rr = TG.toCandidateDiscovery(rs, mid, {}); if (rr && rr.error) alert(rr.error); render(); return;
    }
    var ou = t.getAttribute && t.getAttribute('data-outreach');
    if (ou) {
      var p = TG.getProfile(ou); var mid2 = p.candidate ? (OF.load().cd_candidates.filter(function (c) { return c.candidate_discovery_id === p.profile.candidate_discovery_id; })[0] || {}).mandate_id : null;
      var rr2 = TG.toCandidateDiscovery(ou, mid2, { queue_outreach: true }); if (rr2 && rr2.error) alert(rr2.error); else if (rr2.outreach_queued) alert('Outreach draft queued (pending approval) in Outreach.');
      render(); return;
    }
    if (id === 'tg-reset') { if (confirm('Reset talent sources, profiles and duplicates?')) { TG.resetTalent(); render(); } return; }
  });

  render();
})();
