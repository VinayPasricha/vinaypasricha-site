/* =============================================================
   KAIROS·1 — Capacity Expansion Chamber · the Field
   =============================================================
   Sequence: chains. Constraint: gravitational fields. Structural:
   architectural rectangles. Capacity: expanding concentric fields.

   The reader's carrying-field is one wide ring at center. Loads
   sit at distances from center proportional to their strain:
     stabilized → inside the field, near center (calm)
     active     → near the field's edge (carried but with strain)
     overload   → outside the field (pressure fronts pushing in)

   No motion. No orbital animation. The field BREATHES (slow).
   Loads are placed; they do not orbit.
   ============================================================= */

const { useMemo: ftUseMemo, useState: ftUseState } = React;

const FT_W = 1000;
const FT_H = 700;
const FT_CX = 500;
const FT_CY = 350;

// Field tier → radius. Tier 1 small; tier 5 wide.
function fieldRadius(tier) {
  const t = Math.max(1, Math.min(5, tier || 1));
  return 90 + (t - 1) * 32;       // 90, 122, 154, 186, 218
}

// Load position: stabilized loads sit inside the field on a low
// inner ring; active loads at the field edge; overload outside.
function loadPosition(load, fieldR, idx, total) {
  const angle = (idx / Math.max(1, total)) * Math.PI * 2 - Math.PI / 2;
  let r;
  if (load.state === 'stabilized') r = Math.max(30, fieldR * 0.55);
  else if (load.state === 'overload') r = fieldR + 70 + Math.min(60, load.strain * 80);
  else r = fieldR - 6 + Math.min(20, load.strain * 30);
  return { x: FT_CX + Math.cos(angle) * r, y: FT_CY + Math.sin(angle) * r };
}

function ftTrim(s, n) {
  s = String(s || '').trim();
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trim() + '…';
}

function FieldTopology({ session, history }) {
  const loads = session.loads || [];
  const fieldR = fieldRadius(session.field_radius_tier);
  const [hoveredId, setHoveredId] = ftUseState(null);

  // Sort loads so stabilized first (drawn beneath), then active, then overload
  const ordered = ftUseMemo(() => {
    const order = { stabilized: 0, active: 1, overload: 2 };
    return loads.slice().sort((a, b) => (order[a.state] || 1) - (order[b.state] || 1));
  }, [loads]);

  const positions = ftUseMemo(() => {
    return ordered.map((l, i) => ({ load: l, ...loadPosition(l, fieldR, i, ordered.length) }));
  }, [ordered, fieldR]);

  // Landmarks from prior capacity cycles — sit at the outer wash
  const landmarks = ftUseMemo(() => {
    if (!window.kairos || !window.kairos.landmarks) return [];
    const raw = window.kairos.landmarks.extract(history || [], 'capacity');
    return raw.slice(0, 6).map((lm, i) => {
      const slots = [
        { x: 120, y: 90 },
        { x: 880, y: 90 },
        { x: 120, y: 610 },
        { x: 880, y: 610 },
        { x: 500, y: 60 },
        { x: 500, y: 640 },
      ];
      return { ...lm, x: slots[i].x, y: slots[i].y };
    });
  }, [history]);

  const hasLoads = loads.length > 0;
  if (!hasLoads && landmarks.length === 0) {
    return (
      <div className="c-topology-stage">
        <div className="c-topology-empty">
          <div className="glyph" aria-hidden="true"></div>
          <div className="label">— The carrying field is unread</div>
          <div className="hint">
            What can now be carried calmly that previously caused fragmentation?
            Name one load. The field will surface.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="c-topology-stage">
      <svg
        viewBox={`0 0 ${FT_W} ${FT_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="c-topology-svg"
        aria-label="Carrying field"
      >
        <defs>
          <radialGradient id="ftFieldWash" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="rgba(217,148,102,0.06)" />
            <stop offset="55%"  stopColor="rgba(217,148,102,0.020)" />
            <stop offset="100%" stopColor="rgba(180,180,200,0.005)" />
          </radialGradient>
          <radialGradient id="ftDeepWash" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(217,148,102,0.024)" />
            <stop offset="100%" stopColor="rgba(217,148,102,0)" />
          </radialGradient>
        </defs>

        {/* Deep ambient wash filling the chamber — the reservoir */}
        <ellipse cx={FT_CX} cy={FT_CY} rx={460} ry={300} fill="url(#ftDeepWash)" />

        {/* Concentric tier rings — the implicit expansion history.
            Faint, ascending tiers visible behind the current field. */}
        {[1,2,3,4,5].map(t => (
          <circle
            key={'tier-' + t}
            cx={FT_CX} cy={FT_CY}
            r={fieldRadius(t)}
            fill="none"
            stroke={t === session.field_radius_tier ? 'rgba(217,148,102,0.34)' : 'rgba(180,180,200,0.08)'}
            strokeWidth={t === session.field_radius_tier ? 1.2 : 0.4}
            strokeDasharray={t === session.field_radius_tier ? '' : '1 6'}
          />
        ))}

        {/* The carrying field — main wash inside the current radius */}
        <circle cx={FT_CX} cy={FT_CY} r={fieldR} fill="url(#ftFieldWash)" />

        {/* Field-tier mono label at the field's edge */}
        <text
          x={FT_CX}
          y={FT_CY - fieldR - 14}
          textAnchor="middle"
          fontFamily="JetBrains Mono, monospace"
          fontSize="9"
          letterSpacing="4"
          fill="rgba(217,148,102,0.55)"
        >
          CARRYING FIELD · TIER {session.field_radius_tier || 1}
        </text>

        {/* Landmarks — prior carrying-field cycles */}
        {landmarks.map(lm => {
          const isUnresolved = lm.origin !== 'governing';
          return (
            <g key={lm.id}
               className={`landmark landmark-tier-${lm.tier || 1}${isUnresolved ? ' is-unresolved' : ''}`}
               transform={`translate(${lm.x},${lm.y})`}
               data-cycle-id={lm.cycle_id || ''}>
              <circle className="landmark-circle" cx="0" cy="0" r="11" />
              <text className="landmark-id" x="0" y="3">{(lm.cycle_id || '').slice(-4)}</text>
              <text className="landmark-label" x="0" y="26">{ftTrim(lm.label, 22)}</text>
            </g>
          );
        })}

        {/* Loads — placed at their position */}
        {positions.map(p => {
          const l = p.load;
          const cls = [
            'ft-load',
            'ft-load--' + l.state,
            hoveredId === l.id ? 'is-focused' : '',
          ].filter(Boolean).join(' ');
          // Visual size by tier of importance — stabilized smaller (settled), overload larger (urgent)
          const r =
            l.state === 'stabilized' ? 9 :
            l.state === 'overload'   ? 14 + Math.min(8, l.strain * 8) :
                                       11 + Math.min(6, l.strain * 6);
          return (
            <g key={l.id} className={cls}
               transform={`translate(${p.x},${p.y})`}
               tabIndex={0}
               role="button"
               aria-label={`Load ${l.id}: ${l.label || 'unnamed'} (${l.state})`}
               onMouseEnter={() => setHoveredId(l.id)}
               onMouseLeave={() => setHoveredId(null)}
               onFocus={() => setHoveredId(l.id)}
               onBlur={() => setHoveredId(null)}
               style={{ cursor: 'pointer', outline: 'none' }}>
              {/* Pressure front for overload loads — a faint arc pointing toward center */}
              {l.state === 'overload' ? (
                <path
                  className="ft-pressure"
                  d={(() => {
                    // arc segment perpendicular to the radial direction
                    const dx = FT_CX - p.x;
                    const dy = FT_CY - p.y;
                    const len = Math.hypot(dx, dy) || 1;
                    const ux = dx / len, uy = dy / len;
                    const px = -uy, py = ux;
                    const ax = p.x + px * 22, ay = p.y + py * 22;
                    const bx = p.x - px * 22, by = p.y - py * 22;
                    const midX = p.x + ux * -16;
                    const midY = p.y + uy * -16;
                    return `M ${ax} ${ay} Q ${midX} ${midY} ${bx} ${by}`;
                  })()}
                  fill="none"
                />
              ) : null}
              <circle className="ft-load-circle" r={r} />
              <text className="ft-load-id" x="0" y="3">{l.id}</text>
              <text className="ft-load-label" x="0" y={r + 16}>
                {ftTrim(l.label || '(unnamed)', 26)}
              </text>
              {l.state === 'stabilized' ? (
                <text className="ft-load-meta" x="0" y={r + 30}>stabilized</text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

window.FieldTopology = FieldTopology;
