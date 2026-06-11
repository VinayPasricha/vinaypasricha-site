/* =============================================================
   search-admin.js — Studio · Real Search Layer  (2D)
   ============================================================= */
(function () {
  'use strict';
  var OF = window.OF;
  var S = OF.search;

  function $(id) { return document.getElementById(id); }
  function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function ttl(s) { return (s || '').replace(/_/g, ' '); }

  function render() {
    var s = S.snapshot();
    $('se-tiles').innerHTML =
      tile('', s.counts.missions, 'Missions') + tile('blocked', s.counts.blocked, 'Blocked') +
      tile('art', s.counts.artifacts, 'Artifacts') + tile('cfg', s.counts.configured, 'Providers configured');

    $('se-providers').innerHTML = s.providers.map(function (p) {
      var act = p.status === 'configured'
        ? (p.provider_type === 'manual_import' ? '<span class="se-mini" style="opacity:.5;cursor:default">always on</span>' : '<button class="se-mini warn" data-unconfig="' + esc(p.provider_type) + '">Set not configured</button>')
        : '<button class="se-mini" data-config="' + esc(p.provider_type) + '">Mark configured</button>';
      return '<div class="se-prov"><div><div class="pn">' + esc(p.provider_name) + '</div><div class="pd">' + esc(ttl(p.provider_type)) + (p.daily_limit ? ' · ' + p.daily_limit + '/day' : '') + '</div></div>' +
        '<div class="pd">' + (p.configuration && p.configuration.wired ? 'wired' : '—') + '</div>' +
        '<span class="se-st ' + esc(p.status) + '">' + esc(ttl(p.status)) + '</span>' + act + '</div>';
    }).join('');

    $('se-missions').innerHTML = s.missions.length ? s.missions.map(function (m) {
      var arts = s.artifacts.filter(function (a) { return a.search_mission_id === m.search_mission_id; });
      var isCand = m.mission_type === 'candidate_discovery';
      var sendBtn = arts.some(function (a) { return a.status === 'retrieved'; })
        ? (isCand ? '<button class="se-act pos" data-sendperson="' + esc(m.search_mission_id) + '">Send to Person Intelligence →</button>'
                  : '<button class="se-act pos" data-sendorg="' + esc(m.search_mission_id) + '">Send to Organization Intelligence →</button>') : '';
      var artHtml = arts.length ? '<div class="se-arts">' + arts.map(function (a) {
        return '<div class="se-art"><div class="at">' + esc(a.title || a.source_type) + '</div><div class="am">' + esc(ttl(a.source_type)) + ' · ' + esc(a.status) + ' · ' + esc(a.provider || 'manual_import') + (a.used_for ? ' · <span class="uf">→ ' + esc(ttl(a.used_for)) + '</span>' : '') + '</div></div>';
      }).join('') + '</div>' : '';
      var imp = '<div class="se-imp">' +
        '<div class="row"><select data-imp-type="' + esc(m.search_mission_id) + '">' + S.SOURCE_TYPES.map(function (t) { return '<option value="' + t + '">' + esc(ttl(t)) + '</option>'; }).join('') + '</select>' +
          '<input data-imp-title="' + esc(m.search_mission_id) + '" placeholder="Title"><input data-imp-url="' + esc(m.search_mission_id) + '" placeholder="URL (optional)"></div>' +
        '<textarea data-imp-text="' + esc(m.search_mission_id) + '" placeholder="Paste the real source text (e.g. LinkedIn profile / job description / review)…"></textarea>' +
        '<div class="se-msn-act"><button class="se-act" data-import="' + esc(m.search_mission_id) + '">Manual import artifact</button>' +
          (m.status === 'draft' ? '<button class="se-act" data-run="' + esc(m.search_mission_id) + '">Run search</button>' : '') + sendBtn + '</div>' +
      '</div>';
      return '<div class="se-msn"><div class="se-msn-top"><div><div class="mt">' + esc(ttl(m.mission_type)) + ' · ' + esc(m.query) + '</div>' +
        '<div class="mq">queries: ' + (m.queries || []).map(esc).join(' · ') + '</div></div>' +
        '<span class="se-mst ' + esc(m.status) + '">' + esc(ttl(m.status)) + '</span></div>' +
        (m.block_reason ? '<div class="blk">⚠ ' + esc(m.block_reason) + '</div>' : '') +
        artHtml + imp + '</div>';
    }).join('') : '<div class="se-empty">No search missions yet. Create an organization or candidate search above, or let an agent create one.</div>';

    $('se-audit').innerHTML = s.audit.length ? s.audit.slice(0, 24).map(function (l) {
      return '<div class="se-aud"><div class="aa">' + esc(ttl(l.action)) + '</div><div class="as ' + esc(l.status) + '">' + esc(l.provider) + ' · ' + esc(ttl(l.status)) + '</div><div class="ar">' + esc(l.reason) + '</div></div>';
    }).join('') : '<div class="se-empty">No search attempts yet.</div>';
  }
  function tile(cls, n, label) { return '<div class="se-tile ' + cls + '"><div class="tn">' + n + '</div><div class="tl">' + label + '</div></div>'; }
  function attrVal(name, id) { var e = document.querySelector('[' + name + '="' + id + '"]'); return e ? e.value.trim() : ''; }

  document.addEventListener('click', function (e) {
    var t = e.target, id = t.id;
    if (id === 'se-neworg') { var nm = prompt('Company name to research:'); if (nm) { S.createOrgSearch({ company_name: nm }); render(); } return; }
    if (id === 'se-newcand') { var rt = prompt('Role title to search candidates for:'); if (rt) { S.createCandidateSearch({ role_title: rt }); render(); } return; }
    if (id === 'se-reset') { if (confirm('Reset search providers, missions and artifacts?')) { S.resetSearch(); render(); } return; }
    var cfg = t.getAttribute && t.getAttribute('data-config'); if (cfg) { S.configureProvider(cfg); render(); return; }
    var unc = t.getAttribute && t.getAttribute('data-unconfig'); if (unc) { S.setProviderStatus(unc, 'not_configured'); render(); return; }
    var run = t.getAttribute && t.getAttribute('data-run'); if (run) { var r = S.runSearch(run); if (r && (r.reason)) alert(ttl(r.status) + ': ' + r.reason); render(); return; }
    var imp = t.getAttribute && t.getAttribute('data-import');
    if (imp) {
      var txt = attrVal('data-imp-text', imp); if (!txt) { alert('Paste the source text.'); return; }
      S.manualImport(imp, { source_type: attrVal('data-imp-type', imp), title: attrVal('data-imp-title', imp), url: attrVal('data-imp-url', imp), raw_text: txt });
      render(); return;
    }
    var so = t.getAttribute && t.getAttribute('data-sendorg'); if (so) { var ro = S.sendToOrgIntelligence(so); if (ro && ro.error) alert(ro.error); else alert('Sent ' + ro.artifacts + ' artifact(s) → Organization Intelligence' + (ro.brief ? ' · brief generated' : '')); render(); return; }
    var sp = t.getAttribute && t.getAttribute('data-sendperson'); if (sp) { var nm2 = prompt('Candidate name for this person brief:') || 'Candidate'; var rp = S.sendToPersonIntelligence(sp, { person_name: nm2 }); if (rp && rp.error) alert(rp.error); else alert('Sent ' + rp.artifacts + ' artifact(s) → Person Intelligence' + (rp.brief ? ' · preliminary brief created' : '')); render(); return; }
  });

  render();
})();
