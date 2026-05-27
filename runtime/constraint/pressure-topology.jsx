/* =============================================================
   KAIROS·1 — Constraint Observatory · pressure topology
   =============================================================
   The Sequence Chamber is a chain; the Constraint Observatory
   is a pressure field. Observations float as nodes in a loose
   cluster. Their weight (the runtime's probability that this is
   the governing constraint) controls their size and proximity
   to center. Eliminated observations recede to an outer dim
   ring. When the governing observation is named, it sits at
   center with a slow heat-pulse and faint pressure halos.

   Layout — radial, not axial:
   • Center (the "pressure point") — where governing emerges
   • Inner orbit (high weight, candidate constraints)
   • Outer orbit (low weight or eliminated)
   ============================================================= */

const { useMemo: poUseMemo, useState: poUseState } = React;

const PT_W = 1000;
const PT_H = 700;
const PT_CX = 500;
const PT_CY = 350;

function poTrim(s, n) {
  s = String(s || '').trim();
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trim() + '…';
}

// Layout: spread observations around the center on a ring
// whose radius depends on the observation's weight.
// - Governing: r=0 (center)
// - Eliminated: r=outer (320)
// - Otherwise: r interpolated from weight (1.0 → 90, 0 → 280)
function poLayout(observations, governingId) {
  const n = observations.length;
  if (n === 0) return [];
  // Sort: governing first, then by weight desc, eliminated last
  const sorted = [...observations].sort((a, b) => {
    if (a.id === governingId) return -1;
    if (b.id === governingId) return 1;
    if (a.eliminated !== b.eliminated) return a.eliminated ? 1 : -1;
    return (b.weight || 0) - (a.weight || 0);
  });
  return sorted.map((o, i) => {
    if (o.id === governingId) {
      return { o, x: PT_CX, y: PT_CY, r: 38, isCenter: true };
    }
    const w = o.eliminated ? 0.05 : (o.weight || 0.5);
    const radius = o.eliminated ? 300 : 100 + (1 - w) * 170;
    // Distribute orbiting nodes around the circle.
    // Skip the governing slot if it's reserved.
    const reserveCenter = governingId ? 1 : 0;
    const orbiting = n - reserveCenter;
    const idx = i - reserveCenter;
    const angle = (idx / Math.max(1, orbiting)) * Math.PI * 2 - Math.PI / 2;
    const x = PT_CX + Math.cos(angle) * radius;
    const y = PT_CY + Math.sin(angle) * radius;
    const r = o.eliminated ? 14 : 16 + w * 12;
    return { o, x, y, r, isCenter: false };
  });
}

// =============================================================
// CONSTRAINT OBSERVATORY — landmark layout
// =============================================================
// Landmarks sit at the outer ring of the pressure field, at
// radius 290 from center. Up to 6 distributed around the circle.
const PT_LANDMARK_RADIUS = 290;
function ptLandmarkPosition(i, count) {
  // Start at top (-90°), go clockwise. Avoid placing right behind
  // the most-saturated central area by spreading evenly.
  const slots = Math.max(6, count);
  const angle = (i / slots) * Math.PI * 2 - Math.PI / 2;
  return {
    x: PT_CX + Math.cos(angle) * PT_LANDMARK_RADIUS,
    y: PT_CY + Math.sin(angle) * PT_LANDMARK_RADIUS,
  };
}

function PressureTopology({ session, history }) {
  const observations = session.observations || [];
  // Attention-revealed lineage — only the hovered observation's
  // threads to landmarks are visible. Memory surfaces on attention.
  const [hoveredObsId, setHoveredObsId] = poUseState(null);
  const positions = poUseMemo(
    () => poLayout(observations, session.governing_id),
    [observations, session.governing_id]
  );

  // Landmarks from prior cycles
  const landmarks = poUseMemo(() => {
    if (!window.kairos || !window.kairos.landmarks) return [];
    const raw = window.kairos.landmarks.extract(history || [], 'constraint');
    return raw.slice(0, 6).map((lm, i) => {
      const pos = ptLandmarkPosition(i, raw.length);
      return { ...lm, x: pos.x, y: pos.y };
    });
  }, [history]);

  // Lineage threads from active observations to landmarks
  const positionsById = poUseMemo(() => {
    const m = {};
    positions.forEach(p => { m[p.o.id] = p; });
    return m;
  }, [positions]);

  const lineages = poUseMemo(() => {
    if (!window.kairos || !window.kairos.landmarks || landmarks.length === 0) return [];
    const matches = [];
    observations.forEach(o => {
      const p = positionsById[o.id];
      if (!p || !o.label) return;
      const hits = window.kairos.landmarks.findLineage(o.label, landmarks);
      hits.forEach(h => {
        matches.push({
          id: o.id + '-' + h.landmark.id,
          from_obs_id: o.id,
          from_x: p.x, from_y: p.y,
          to_x: h.landmark.x, to_y: h.landmark.y,
          score: h.score,
        });
      });
    });
    return matches;
  }, [observations, landmarks, positionsById]);

  const hasObservations = observations.length > 0;

  if (!hasObservations && landmarks.length === 0) {
    return (
      <div className="c-topology-stage">
        <div className="c-topology-empty">
          <div className="glyph" aria-hidden="true"></div>
          <div className="label">— The pressure field is unread</div>
          <div className="hint">
            The runtime will reveal pressure as you observe. Where does reality
            repeatedly resist? Name one place and the field begins.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="c-topology-stage">
      <svg
        viewBox={`0 0 ${PT_W} ${PT_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="c-topology-svg"
        aria-label="Pressure topology"
      >
        <defs>
          {/* The central pressure halo — only renders when governing is set */}
          <radialGradient id="ptCenter" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="rgba(217,148,102,0.35)" />
            <stop offset="40%"  stopColor="rgba(217,148,102,0.12)" />
            <stop offset="100%" stopColor="rgba(217,148,102,0)" />
          </radialGradient>
          <radialGradient id="ptField" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="rgba(217,148,102,0.04)" />
            <stop offset="100%" stopColor="rgba(217,148,102,0)" />
          </radialGradient>
        </defs>

        {/* Ambient pressure field */}
        <circle cx={PT_CX} cy={PT_CY} r="320" fill="url(#ptField)" />

        {/* Landmarks at outer ring — prior governing constraints */}
        {landmarks.map(lm => {
          const isUnresolved = lm.origin !== 'governing';
          return (
            <g key={lm.id}
               className={`landmark landmark-tier-${lm.tier || 1}${isUnresolved ? ' is-unresolved' : ''}`}
               transform={`translate(${lm.x},${lm.y})`}
               data-cycle-id={lm.cycle_id || ''}>
              <circle className="landmark-circle" cx="0" cy="0" r="11" />
              <text className="landmark-id" x="0" y="3">
                {(lm.cycle_id || '').slice(-4)}
              </text>
              <text className="landmark-label" x="0" y="26">
                {poTrim(lm.label, 22)}
              </text>
            </g>
          );
        })}

        {/* Lineage threads from current observations to landmarks —
            attention-revealed only. Threads appear when the
            reader hovers/focuses the source observation. */}
        {lineages.map(l => {
          const mx = (l.from_x + l.to_x) / 2;
          const my = (l.from_y + l.to_y) / 2;
          const dx = l.to_x - l.from_x;
          const dy = l.to_y - l.from_y;
          const len = Math.hypot(dx, dy) || 1;
          const ox = -dy / len * 30;
          const oy =  dx / len * 30;
          const peakOpacity = Math.max(0.32, Math.min(0.7, l.score * 1.4));
          const d = `M ${l.from_x} ${l.from_y} Q ${mx + ox} ${my + oy} ${l.to_x} ${l.to_y}`;
          const active = l.from_obs_id === hoveredObsId;
          return <path key={l.id} className={'lineage-thread' + (active ? ' is-active' : '')} d={d} style={{ '--lineage-peak': peakOpacity }} />;
        })}

        {/* Faint pressure rings — the observatory's gravity */}
        <circle cx={PT_CX} cy={PT_CY} r="100"
                fill="none" stroke="rgba(180,180,200,0.10)" strokeWidth="0.4"
                strokeDasharray="0.8 4" />
        <circle cx={PT_CX} cy={PT_CY} r="200"
                fill="none" stroke="rgba(180,180,200,0.06)" strokeWidth="0.4"
                strokeDasharray="0.8 5" />
        <circle cx={PT_CX} cy={PT_CY} r="300"
                fill="none" stroke="rgba(180,180,200,0.04)" strokeWidth="0.4"
                strokeDasharray="0.8 6" />

        {/* Governing center halo */}
        {session.governing_id ? (
          <circle cx={PT_CX} cy={PT_CY} r="120" fill="url(#ptCenter)" />
        ) : null}

        {/* Faint connecting lines from each non-eliminated observation
            toward the center — gravity, made visible */}
        {positions.filter(p => !p.isCenter && !p.o.eliminated).map(p => (
          <line
            key={'g-' + p.o.id}
            x1={p.x} y1={p.y}
            x2={PT_CX} y2={PT_CY}
            stroke={session.governing_id ? 'rgba(217,148,102,0.10)' : 'rgba(180,180,200,0.06)'}
            strokeWidth="0.4"
            strokeDasharray="1 4"
          />
        ))}

        {/* Observation nodes */}
        {positions.map(p => {
          const o = p.o;
          const isCenter = p.isCenter;
          const isEliminated = o.eliminated && !isCenter;
          const cls = [
            'pt-node',
            isCenter ? 'is-center' : '',
            isEliminated ? 'is-eliminated' : '',
            hoveredObsId === o.id ? 'is-focused' : '',
          ].filter(Boolean).join(' ');
          return (
            <g key={o.id} className={cls} transform={`translate(${p.x},${p.y})`}
               tabIndex={0}
               role="button"
               aria-label={`Observation ${o.id}: ${o.label || 'unnamed'}`}
               onMouseEnter={() => setHoveredObsId(o.id)}
               onMouseLeave={() => setHoveredObsId(null)}
               onFocus={() => setHoveredObsId(o.id)}
               onBlur={() => setHoveredObsId(null)}
               style={{ cursor: 'pointer', outline: 'none' }}>
              <circle className="pt-node-circle" cx="0" cy="0" r={p.r} />
              <text className="pt-node-id" x="0" y="-2">{o.id}</text>
              <text className="pt-node-label" x="0" y={p.r + 18}>
                {poTrim(o.label || '(unnamed)', 32)}
              </text>
              {o.category ? (
                <text className="pt-node-cat" x="0" y={p.r + 34}>
                  {o.category}
                </text>
              ) : null}
              {isCenter ? (
                <text x="0" y={-p.r - 12} textAnchor="middle"
                      fontFamily="JetBrains Mono, monospace"
                      fontSize="8.5"
                      letterSpacing="2"
                      fill="var(--heat)">
                  GOVERNING
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

window.PressureTopology = PressureTopology;
