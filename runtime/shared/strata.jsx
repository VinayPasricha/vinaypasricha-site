/* =============================================================
   KAIROS·1 — Shared STRATA panel
   =============================================================
   Geological memory, made visible. Past cycles archived by the
   chamber (when the reader resets) sink into strata. The reader
   can summon the panel via `H` (history) and descend into prior
   cycles — read-only. Cycles cannot be re-entered; they are
   terrain, not state. They are remembered, not resumed.

   Per the meta-layer's geological-layering commitment: recent
   cycles sit near the surface (brighter, more interactive);
   older cycles sink into deeper strata (dimmer, requiring
   deliberate descent to read).
   ============================================================= */

const { useEffect: strUseEffect, useState: strUseState } = React;

function strFmtDate(ms) {
  if (!ms) return '—';
  try {
    return new Date(ms).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) { return '—'; }
}

function strTrim(s, n) {
  s = String(s || '').trim();
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trim() + '…';
}

// Returns a tier (1..4) for visual depth — 1 = surface (newest),
// 4 = ancient stratum (oldest).
function strDepthTier(idx, total) {
  if (total <= 1) return 1;
  const r = idx / Math.max(1, total - 1);
  if (r < 0.25) return 1;
  if (r < 0.5) return 2;
  if (r < 0.75) return 3;
  return 4;
}

function Strata({ history, currentChamber, visible, onDismiss }) {
  strUseEffect(() => {
    if (!visible) return;
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); onDismiss && onDismiss(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onDismiss]);

  // Filter to cycles of the relevant kind for this chamber, OR
  // show all if no filter. For sequence chamber: kind 'sequence'.
  // For constraint observatory: kind 'constraint'.
  const filtered = (history || []).filter(h => {
    if (!currentChamber) return true;
    if (currentChamber === 'sequence')   return h.kind === 'sequence' || (!h.kind && h.actions);
    if (currentChamber === 'constraint') return h.kind === 'constraint';
    return true;
  });

  // Sort by last_modified descending (newest first)
  const sorted = filtered.slice().sort((a, b) => {
    const ad = (a.data ? a.data.last_modified : a.last_modified) || 0;
    const bd = (b.data ? b.data.last_modified : b.last_modified) || 0;
    return bd - ad;
  });

  const hasCycles = sorted.length > 0;

  return (
    <div className={'strata-overlay' + (visible ? ' is-open' : '')} aria-hidden={!visible}>
      <div className="strata-veil" onClick={onDismiss}></div>
      <div className="strata-stage" role="dialog" aria-label="Strata — prior cycles">
        <div className="strata-head">
          <div className="strata-eyebrow">— <em>Strata</em> · prior cycles</div>
          <div className="strata-title">Execution archaeology</div>
          <div className="strata-sub">
            {hasCycles
              ? <>Cycles you have closed in this chamber. Newer strata sit near the surface; older sink deeper. Cycles are remembered, not resumed.</>
              : <>The strata are empty. Cycles closed in this chamber will appear here as terrain.</>}
          </div>
        </div>

        <div className="strata-stack">
          {sorted.map((entry, i) => {
            const data = entry.data || entry;
            const tier = strDepthTier(i, sorted.length);
            const isSeq = entry.kind === 'sequence' || (!entry.kind && data.actions);
            const isCn  = entry.kind === 'constraint';
            const governingSeq = isSeq ? (data.actions || []).find(a => a.governs_flow) : null;
            const governingCn  = isCn  ? (data.observations || []).find(o => o.governs) : null;
            return (
              <article key={(data.id || 'h') + '-' + i} className="strata-cycle" data-tier={tier}>
                <div className="strata-cycle-marker">
                  <span className="strata-marker-id">{data.id || ('h' + i)}</span>
                  <span className="strata-marker-tier">stratum {tier}</span>
                </div>
                <div className="strata-cycle-body">
                  <div className="strata-cycle-label">
                    {isSeq ? <>Sequence · <em>{strTrim(data.outcome, 80) || '(no outcome named)'}</em></> :
                     isCn  ? <>Constraint · <em>{governingCn ? strTrim(governingCn.label, 80) : '(no governing surfaced)'}</em></> :
                             <>Cycle</>}
                  </div>
                  <div className="strata-cycle-meta">
                    <span>opened {strFmtDate(data.started_at)}</span>
                    <span>· closed {strFmtDate(data.last_modified)}</span>
                    {isSeq && data.actions ? <span>· {data.actions.length} action{data.actions.length === 1 ? '' : 's'}</span> : null}
                    {isCn && data.observations ? <span>· {data.observations.length} observation{data.observations.length === 1 ? '' : 's'}</span> : null}
                    {isCn && data.classification ? <span>· classified <em>{data.classification}</em></span> : null}
                    <span>· phase <em>{data.phase || '\u2014'}</em></span>
                  </div>
                  {isSeq && governingSeq ? (
                    <div className="strata-cycle-governing">
                      Governing limit · <em>{strTrim(governingSeq.label, 100)}</em>
                    </div>
                  ) : null}
                  {isCn && data.one_strengthening ? (
                    <div className="strata-cycle-governing">
                      One strengthening · <em>{strTrim(data.one_strengthening, 120)}</em>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        <div className="strata-foot">
          <span className="strata-stats">{sorted.length} cycle{sorted.length === 1 ? '' : 's'} · {currentChamber || 'all chambers'}</span>
          <span className="strata-dismiss">esc to return</span>
        </div>
      </div>
    </div>
  );
}

// Hook — bind `H` to toggle the strata.
function useStrata() {
  const [visible, setVisible] = strUseState(false);
  strUseEffect(() => {
    function onKey(e) {
      const tag = (e.target && e.target.tagName) || '';
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if ((e.key === 'h' || e.key === 'H') && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setVisible(v => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return {
    visible,
    open: () => setVisible(true),
    close: () => setVisible(false),
    toggle: () => setVisible(v => !v),
  };
}

window.Strata = Strata;
window.useStrata = useStrata;
