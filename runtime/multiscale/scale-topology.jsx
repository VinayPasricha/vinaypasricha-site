/* =============================================================
   KAIROS·1 — Multi-Scale Systems Chamber · scale topology
   =============================================================
   Four concentric scale layers from inner to outer:
     individual → team → organization → mission
   Forces live at a specific scale. Cross-scale links are
   radial lines crossing scale boundaries with friction
   encoded as heat.
   ============================================================= */

const { useMemo: msUseMemo, useState: msUseState } = React;

const MS_W = 1000;
const MS_H = 700;
const MS_CX = 500;
const MS_CY = 350;

const MS_SCALES = [
  { id: 'individual',   name: 'Individual',   r: 90 },
  { id: 'team',         name: 'Team',         r: 170 },
  { id: 'organization', name: 'Organization', r: 250 },
  { id: 'mission',      name: 'Mission',      r: 320 },
];

function msTrim(s, n) {
  s = String(s || '').trim();
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trim() + '…';
}

function msFrictionBand(f) {
  if (f >= 0.7) return 'break';
  if (f >= 0.45) return 'low';
  if (f >= 0.2) return 'mid';
  return 'high';
}

// Layout: distribute forces evenly around their scale ring,
// at a radius slightly inside the ring's boundary.
function msLayout(forces) {
  const byScale = { individual: [], team: [], organization: [], mission: [] };
  forces.forEach(f => { if (byScale[f.scale]) byScale[f.scale].push(f); });
  const positioned = [];
  MS_SCALES.forEach((scale, scaleIdx) => {
    const list = byScale[scale.id];
    const n = list.length;
    if (n === 0) return;
    // Inset slightly so forces sit just inside the ring
    const rInner = scale.r - 30;
    const rOuter = scaleIdx === 0 ? rInner * 0.5 : MS_SCALES[scaleIdx - 1].r + 10;
    const r = (rInner + rOuter) / 2;
    list.forEach((f, i) => {
      // Stagger angles per scale so concentric forces don't all align
      const offset = scaleIdx * 0.3;
      const angle = (i / n) * Math.PI * 2 + offset - Math.PI / 2;
      positioned.push({
        f,
        x: MS_CX + Math.cos(angle) * r,
        y: MS_CY + Math.sin(angle) * r,
        scale,
      });
    });
  });
  return positioned;
}

function ScaleTopology({ session, history }) {
  const forces = session.forces || [];
  const links = session.links || [];
  const [hoveredId, setHoveredId] = msUseState(null);

  const positions = msUseMemo(() => msLayout(forces), [forces]);
  const byId = msUseMemo(() => {
    const m = {};
    positions.forEach(p => { m[p.f.id] = p; });
    return m;
  }, [positions]);

  const landmarks = msUseMemo(() => {
    if (!window.kairos || !window.kairos.landmarks) return [];
    const raw = window.kairos.landmarks.extract(history || [], 'multi-scale');
    const slots = [
      { x: 80,  y: 80 }, { x: 920, y: 80 },
      { x: 80,  y: 620 }, { x: 920, y: 620 },
      { x: 500, y: 40 }, { x: 500, y: 660 },
    ];
    return raw.slice(0, slots.length).map((lm, i) => ({ ...lm, x: slots[i].x, y: slots[i].y }));
  }, [history]);

  const hasForces = forces.length > 0;
  if (!hasForces && landmarks.length === 0) {
    return (
      <div className="c-topology-stage">
        <div className="c-topology-empty">
          <div className="glyph" aria-hidden="true"></div>
          <div className="label">— The scales are unread</div>
          <div className="hint">
            Four scales nest beneath this chamber: individual, team, organization, mission.
            Name one force at one scale and the structure begins.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="c-topology-stage">
      <svg
        viewBox={`0 0 ${MS_W} ${MS_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="c-topology-svg"
        aria-label="Multi-scale topology"
      >
        <defs>
          <radialGradient id="msCore" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="rgba(217,148,102,0.05)" />
            <stop offset="100%" stopColor="rgba(217,148,102,0)" />
          </radialGradient>
        </defs>

        {/* Inner core wash */}
        <ellipse cx={MS_CX} cy={MS_CY} rx={420} ry={340} fill="url(#msCore)" />

        {/* Scale ring boundaries — nested */}
        {MS_SCALES.map((scale, i) => (
          <circle
            key={'sc-' + scale.id}
            cx={MS_CX} cy={MS_CY} r={scale.r}
            fill="none"
            stroke={session.dominant_scale === scale.id ? 'rgba(217,148,102,0.36)' : 'rgba(180,180,200,0.10)'}
            strokeWidth={session.dominant_scale === scale.id ? 1.0 : 0.4}
            strokeDasharray={session.dominant_scale === scale.id ? '' : '1 5'}
          />
        ))}

        {/* Scale labels — top of each ring */}
        {MS_SCALES.map(scale => (
          <text
            key={'lbl-' + scale.id}
            x={MS_CX} y={MS_CY - scale.r + 14}
            textAnchor="middle"
            fontFamily="JetBrains Mono, monospace"
            fontSize="8.5"
            letterSpacing="4"
            fill={session.dominant_scale === scale.id ? 'rgba(217,148,102,0.55)' : 'rgba(180,180,200,0.30)'}
          >
            {scale.name.toUpperCase()}
          </text>
        ))}

        {/* Cross-scale links — radial lines between forces */}
        {links.map(l => {
          const from = byId[l.from_id];
          const to = byId[l.to_id];
          if (!from || !to) return null;
          const fb = msFrictionBand(l.friction);
          return (
            <g key={l.id}>
              <line
                className="ms-link"
                data-friction={fb}
                x1={from.x} y1={from.y}
                x2={to.x} y2={to.y}
              />
            </g>
          );
        })}

        {/* Landmarks */}
        {landmarks.map(lm => {
          const isUnresolved = lm.origin !== 'governing';
          return (
            <g key={lm.id}
               className={`landmark landmark-tier-${lm.tier || 1}${isUnresolved ? ' is-unresolved' : ''}`}
               transform={`translate(${lm.x},${lm.y})`}
               data-cycle-id={lm.cycle_id || ''}>
              <circle className="landmark-circle" cx="0" cy="0" r="11" />
              <text className="landmark-id" x="0" y="3">{(lm.cycle_id || '').slice(-4)}</text>
              <text className="landmark-label" x="0" y="26">{msTrim(lm.label, 22)}</text>
            </g>
          );
        })}

        {/* Force nodes — small diamonds (distinct primitive from circles/rects) */}
        {positions.map(p => {
          const f = p.f;
          const isGoverning = f.governs;
          const cls = [
            'ms-force',
            'ms-force--' + f.scale,
            isGoverning ? 'is-governing' : '',
            hoveredId === f.id ? 'is-focused' : '',
          ].filter(Boolean).join(' ');
          const r = isGoverning ? 14 : 10 + Math.min(4, f.strain * 6);
          return (
            <g key={f.id} className={cls}
               transform={`translate(${p.x},${p.y})`}
               tabIndex={0}
               role="button"
               aria-label={`Force ${f.id} at ${f.scale}: ${f.label || 'unnamed'}`}
               onMouseEnter={() => setHoveredId(f.id)}
               onMouseLeave={() => setHoveredId(null)}
               onFocus={() => setHoveredId(f.id)}
               onBlur={() => setHoveredId(null)}
               style={{ cursor: 'pointer', outline: 'none' }}>
              {/* Diamond shape — rotated square */}
              <rect
                className="ms-force-shape"
                x={-r * 0.7} y={-r * 0.7}
                width={r * 1.4} height={r * 1.4}
                transform="rotate(45)"
              />
              <text className="ms-force-id" x="0" y="3">{f.id}</text>
              <text className="ms-force-label" x="0" y={r + 16}>
                {msTrim(f.label || '(unnamed)', 26)}
              </text>
              {isGoverning ? (
                <text x="0" y={-r - 14} textAnchor="middle"
                      fontFamily="JetBrains Mono, monospace"
                      fontSize="8" letterSpacing="3"
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

window.ScaleTopology = ScaleTopology;
