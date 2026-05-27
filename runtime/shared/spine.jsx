/* =============================================================
   KAIROS·1 — Shared SPINE overlay
   =============================================================
   The constellation of all chambers. Summoned from inside any
   chamber via `S` (or the small spine glyph in the top-right
   chrome). Dismissed via `Esc` or click outside the map.

   The spine reveals the doctrinal connection topology of the
   runtime — not a grid, but the actual routing relationships
   between chambers. Looking at the spine is looking at the
   building's blueprint while standing in a room.

   Selecting an open chamber initiates a transition (see
   transition.js): the current chamber recedes, the spine
   flashes briefly, then the destination chamber emerges.
   ============================================================= */

const { useEffect: spineUseEffect, useState: spineUseState } = React;

// Canonical chamber constellation. Positions are fixed —
// spatial constancy is constitutional. These coordinates are
// in a 1000×700 viewBox and never change. Depth = id number;
// chambers numbered higher sit deeper in the doctrine.
//
// Refinement 07: the spine is no longer a constellation. It is
// a vertical subterranean shaft. Chambers stack by depth; the
// reader senses descent into execution reality itself.
const SPINE_CHAMBERS = [
  { id: '01', slug: 'sequence',         name: 'Sequence',                x: 500, y:  60, status: 'open',    coord: 'S·1' },
  { id: '02', slug: 'constraint',       name: 'Constraint Observatory',  x: 500, y: 160, status: 'open',    coord: 'C·2' },
  { id: '03', slug: 'output-reality',   name: 'Output Reality',          x: 500, y: 260, status: 'pending', coord: 'O·3' },
  { id: '04', slug: 'failure-recovery', name: 'Failure & Recovery',      x: 500, y: 360, status: 'pending', coord: 'F·4' },
  { id: '05', slug: 'human-constraint', name: 'Human Constraint',        x: 360, y: 430, status: 'pending', coord: 'H·5' },
  { id: '06', slug: 'structural-constraint', name: 'Structural Constraint', x: 640, y: 430, status: 'open',    coord: 'X·6' },
  { id: '07', slug: 'capacity-expansion', name: 'Capacity Expansion',    x: 500, y: 510, status: 'pending', coord: 'K·7' },
  { id: '08', slug: 'multi-scale',      name: 'Multi-Scale Systems',     x: 500, y: 590, status: 'pending', coord: 'M·8' },
  { id: '09', slug: 'character',        name: 'Character of the Executor', x: 500, y: 660, status: 'pending', coord: 'E·9' },
];

// Doctrinal routing — derived from each chamber's spec.
// Refinement 07: in the vertical shaft, edges represent doctrinal
// descent paths, not constellation adjacency. Higher → lower.
const SPINE_EDGES = [
  ['01','02'], ['02','03'], ['03','04'],
  ['04','05'], ['04','06'], ['05','06'],
  ['02','05'], ['02','06'],
  ['03','05'], ['03','06'],
  ['05','07'], ['06','07'],
  ['07','08'], ['08','09'],
  ['05','09'], ['06','08'],
];

// URL for each chamber slug. Pending chambers route to nothing.
// Sequence and Constraint are both live; the others are stubs.
function chamberHref(slug) {
  switch (slug) {
    case 'sequence':              return '../sequence/index.html';
    case 'constraint':            return '../constraint/index.html';
    case 'structural-constraint': return '../structural/index.html';
    default: return null;
  }
}

function Spine({ currentSlug, visible, onDismiss }) {
  // Dismiss on Esc + click-outside
  spineUseEffect(() => {
    if (!visible) return;
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); onDismiss && onDismiss(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, onDismiss]);

  const current = SPINE_CHAMBERS.find(c => c.slug === currentSlug);
  const currentDepth = current ? parseInt(current.id, 10) : '—';

  function onChamberClick(c) {
    if (c.status !== 'open') return;
    if (c.slug === currentSlug) { onDismiss && onDismiss(); return; }
    const href = chamberHref(c.slug);
    if (!href) return;
    // Use the shared transition helper if available; fall back to direct nav.
    if (window.kairos && window.kairos.transition && window.kairos.transition.depart) {
      window.kairos.transition.depart({ from: currentSlug, to: c.slug, href });
    } else {
      window.location.href = href;
    }
  }

  return (
    <div className={'spine-overlay' + (visible ? ' is-open' : '')} aria-hidden={!visible}>
      <div className="spine-veil" onClick={onDismiss}></div>
      <div className="spine-stage" role="dialog" aria-label="Runtime spine">
        <div className="spine-head">
          <div className="spine-eyebrow">— <em>The shaft</em> · underground observatory descent</div>
          <div className="spine-title">
            <em>KAIROS·1</em> · nine depths, one organism
          </div>
          <div className="spine-sub">
            The runtime is descent. Chambers are stacked by depth;
            higher-numbered chambers sit deeper in the doctrine.
            Bright nodes are open; faint nodes are pending strata.
          </div>
        </div>

        <svg viewBox="0 0 1000 700" className="spine-svg" aria-label="Chamber constellation">
          <defs>
            <radialGradient id="spineHot" cx="50%" cy="50%" r="50%">
              <stop offset="0%"   stopColor="rgba(217,148,102,0.55)" />
              <stop offset="60%"  stopColor="rgba(217,148,102,0.12)" />
              <stop offset="100%" stopColor="rgba(217,148,102,0)" />
            </radialGradient>
            <linearGradient id="spineShaft" x1="0%" x2="0%" y1="0%" y2="100%">
              <stop offset="0%"  stopColor="rgba(217,148,102,0.06)" />
              <stop offset="50%" stopColor="rgba(217,148,102,0.02)" />
              <stop offset="100%" stopColor="rgba(120,130,150,0.01)" />
            </linearGradient>
          </defs>

          {/* The shaft — a faint vertical column behind the chambers,
              suggesting subterranean descent geometry */}
          <rect x="480" y="0" width="40" height="700" fill="url(#spineShaft)" />

          {/* Depth-band markers — mono telemetry on the left edge */}
          <text x="40" y="68"  fontFamily="JetBrains Mono, monospace" fontSize="8.5" letterSpacing="3" fill="rgba(180,180,200,0.32)">SURFACE</text>
          <text x="40" y="268" fontFamily="JetBrains Mono, monospace" fontSize="8.5" letterSpacing="3" fill="rgba(180,180,200,0.28)">DIAGNOSIS</text>
          <text x="40" y="438" fontFamily="JetBrains Mono, monospace" fontSize="8.5" letterSpacing="3" fill="rgba(180,180,200,0.24)">CAUSE</text>
          <text x="40" y="598" fontFamily="JetBrains Mono, monospace" fontSize="8.5" letterSpacing="3" fill="rgba(180,180,200,0.20)">FOUNDATION</text>

          {/* Edges — drawn first, beneath nodes */}
          {SPINE_EDGES.map(([a, b], i) => {
            const A = SPINE_CHAMBERS.find(c => c.id === a);
            const B = SPINE_CHAMBERS.find(c => c.id === b);
            if (!A || !B) return null;
            const lit = (A.slug === currentSlug || B.slug === currentSlug);
            return (
              <line
                key={'e' + i}
                x1={A.x} y1={A.y}
                x2={B.x} y2={B.y}
                stroke={lit ? 'rgba(217,148,102,0.35)' : 'rgba(180,180,200,0.10)'}
                strokeWidth={lit ? 0.7 : 0.4}
                strokeDasharray={lit ? '' : '2 4'}
              />
            );
          })}

          {/* Nodes */}
          {SPINE_CHAMBERS.map(c => {
            const isCurrent = c.slug === currentSlug;
            const isOpen = c.status === 'open';
            return (
              <g
                key={c.id}
                className={'sp-node ' + (isCurrent ? 'is-current ' : '') + (isOpen ? 'is-open' : 'is-pending')}
                transform={`translate(${c.x},${c.y})`}
                onClick={() => onChamberClick(c)}
                style={{ cursor: isOpen && !isCurrent ? 'pointer' : 'default' }}
              >
                {isCurrent ? (
                  <circle r="42" fill="url(#spineHot)" />
                ) : null}
                <circle
                  className="sp-node-circle"
                  r={isCurrent ? 22 : 18}
                />
                <text className="sp-node-id" y="-2">{c.id}</text>
                <text className="sp-node-name" y="42">{c.name}</text>
                <text className="sp-node-coord" y="58">{c.coord}</text>
                {!isOpen ? (
                  <text className="sp-node-pending" y="74">pending</text>
                ) : null}
                {isCurrent ? (
                  <text className="sp-node-current" y="74">you are here</text>
                ) : null}
              </g>
            );
          })}
        </svg>

        <div className="spine-foot">
          <span className="spine-stats">
            9 chambers · <em>{SPINE_CHAMBERS.filter(c => c.status === 'open').length} open</em> · {SPINE_CHAMBERS.filter(c => c.status === 'pending').length} pending
          </span>
          <span className="spine-current">
            current depth · <em>{currentDepth}/9</em>
          </span>
          <span className="spine-dismiss">esc to return</span>
        </div>
      </div>
    </div>
  );
}

// Small re-usable hook: any chamber that wants the spine
// available wires this once. Returns { visible, open, close }.
function useSpine() {
  const [visible, setVisible] = spineUseState(false);
  spineUseEffect(() => {
    function onKey(e) {
      const tag = (e.target && e.target.tagName) || '';
      // Don't capture S while typing in a textarea/input
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;
      if ((e.key === 's' || e.key === 'S') && !e.metaKey && !e.ctrlKey && !e.altKey) {
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

window.Spine = Spine;
window.useSpine = useSpine;
window.SPINE_CHAMBERS = SPINE_CHAMBERS;
