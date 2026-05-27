/* =============================================================
   KAIROS·1 — Structural Constraint Chamber · topology
   =============================================================
   The Sequence Chamber is a chain. The Constraint Observatory
   is a pressure field. The Structural Constraint Chamber is a
   layered architecture diagram — process / decision / information
   / resource — with structural elements distributed inside their
   layer and dependencies crossing vertically.

   Phenomenology: dense, architectural, schematic. The chamber
   should feel like reading a building's structural plan.
   ============================================================= */

const { useMemo: stUseMemo, useState: stUseState } = React;

const ST_W = 1000;
const ST_H = 700;

// Layer definitions — fixed y-centers and boundaries.
const ST_LAYERS = [
  { id: 'process',     name: 'Process & Workflow',         y: 130, top:  60, bottom: 205 },
  { id: 'decision',    name: 'Decision Architecture',      y: 280, top: 215, bottom: 355 },
  { id: 'information', name: 'Information & Tooling',      y: 430, top: 365, bottom: 505 },
  { id: 'resource',    name: 'Resource Flow & Org Design', y: 580, top: 515, bottom: 660 },
];

const ST_ELEMENT_W = 90;
const ST_ELEMENT_H = 36;

function stTrim(s, n) {
  s = String(s || '').trim();
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trim() + '…';
}

function stLayerFrictionBand(f) {
  if (f >= 0.7) return 'break';
  if (f >= 0.45) return 'low';
  if (f >= 0.2) return 'mid';
  return 'high';
}

// Layout: distribute elements horizontally within their layer.
function stLayout(elements) {
  const byLayer = { process: [], decision: [], information: [], resource: [] };
  elements.forEach(e => {
    if (byLayer[e.layer]) byLayer[e.layer].push(e);
  });
  const positioned = [];
  ST_LAYERS.forEach(layer => {
    const list = byLayer[layer.id];
    const n = list.length;
    if (n === 0) return;
    const leftMargin = 140;
    const rightMargin = 880;
    list.forEach((e, i) => {
      const x = n === 1 ? 500 : leftMargin + (i / (n - 1)) * (rightMargin - leftMargin);
      positioned.push({ e, x, y: layer.y, layer });
    });
  });
  return positioned;
}

function StructuralTopology({ session, history }) {
  const elements = session.elements || [];
  const dependencies = session.dependencies || [];
  const [hoveredId, setHoveredId] = stUseState(null);

  const positions = stUseMemo(() => stLayout(elements), [elements]);
  const byId = stUseMemo(() => {
    const m = {};
    positions.forEach(p => { m[p.e.id] = p; });
    return m;
  }, [positions]);

  // Landmarks from prior structural cycles — distributed along the
  // top edge (above the process layer) so they don't overlap any
  // active layer. The right edge could also hold them later.
  const landmarks = stUseMemo(() => {
    if (!window.kairos || !window.kairos.landmarks) return [];
    const raw = window.kairos.landmarks.extract(history || [], 'structural');
    const slots = [
      { x: 500, y: 30 },
      { x: 200, y: 30 },
      { x: 800, y: 30 },
      { x: 350, y: 30 },
      { x: 650, y: 30 },
      { x: 60,  y: 380 }, // edge of side
    ];
    return raw.slice(0, slots.length).map((lm, i) => ({
      ...lm,
      x: slots[i].x,
      y: slots[i].y,
    }));
  }, [history]);

  // Lineage threads — attention-revealed
  const lineages = stUseMemo(() => {
    if (!window.kairos || !window.kairos.landmarks || landmarks.length === 0) return [];
    const matches = [];
    elements.forEach(e => {
      const p = byId[e.id];
      if (!p || !e.label) return;
      const hits = window.kairos.landmarks.findLineage(e.label, landmarks);
      hits.forEach(h => {
        matches.push({
          id: e.id + '-' + h.landmark.id,
          from_element_id: e.id,
          from_x: p.x, from_y: p.y,
          to_x: h.landmark.x, to_y: h.landmark.y,
          score: h.score,
        });
      });
    });
    return matches;
  }, [elements, landmarks, byId]);

  const hasElements = elements.length > 0;

  if (!hasElements && landmarks.length === 0) {
    return (
      <div className="c-topology-stage">
        <div className="c-topology-empty">
          <div className="glyph" aria-hidden="true"></div>
          <div className="label">— The architecture is unread</div>
          <div className="hint">
            Four layers wait beneath this chamber: process, decision, information,
            resource flow. Name one structural element that suppresses execution,
            and the architecture begins to surface.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="c-topology-stage">
      <svg
        viewBox={`0 0 ${ST_W} ${ST_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="c-topology-svg"
        aria-label="Structural architecture"
      >
        <defs>
          <radialGradient id="stHot" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="rgba(217,148,102,0.30)" />
            <stop offset="60%"  stopColor="rgba(217,148,102,0.08)" />
            <stop offset="100%" stopColor="rgba(217,148,102,0)" />
          </radialGradient>
        </defs>

        {/* Layer boundaries — faint horizontal dashed rules */}
        {ST_LAYERS.slice(0, -1).map((layer, i) => (
          <line
            key={'lb' + i}
            x1="60" x2="940"
            y1={layer.bottom} y2={layer.bottom}
            stroke="rgba(120,130,150,0.10)"
            strokeWidth="0.4"
            strokeDasharray="2 5"
          />
        ))}

        {/* Layer labels — right side, mono telemetry */}
        {ST_LAYERS.map((layer, i) => (
          <text
            key={'ll' + i}
            x="940" y={layer.y - 4}
            textAnchor="end"
            fontFamily="JetBrains Mono, monospace"
            fontSize="9"
            letterSpacing="3"
            fill="rgba(180,180,200,0.32)"
            style={{ textTransform: 'uppercase' }}
          >
            {layer.name.toUpperCase()}
          </text>
        ))}

        {/* Landmarks (peripheral, at top) */}
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
                {stTrim(lm.label, 22)}
              </text>
            </g>
          );
        })}

        {/* Lineage threads — attention-revealed */}
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
          const active = l.from_element_id === hoveredId;
          return <path key={l.id} className={'lineage-thread' + (active ? ' is-active' : '')} d={d} style={{ '--lineage-peak': peakOpacity }} />;
        })}

        {/* Dependencies — vertical/cross-layer lines */}
        {dependencies.map(d => {
          const from = byId[d.from_id];
          const to   = byId[d.to_id];
          if (!from || !to) return null;
          const fb = stLayerFrictionBand(d.friction || 0);
          // Anchor at the bottom of the upper element and the top of the lower (or vice versa)
          const fromIsAbove = from.y < to.y;
          const fromY = from.y + (fromIsAbove ? ST_ELEMENT_H/2 : -ST_ELEMENT_H/2);
          const toY   = to.y   + (fromIsAbove ? -ST_ELEMENT_H/2 : ST_ELEMENT_H/2);
          // Use a slight bezier to suggest infrastructure routing
          const midY = (fromY + toY) / 2;
          const path = `M ${from.x} ${fromY} C ${from.x} ${midY} ${to.x} ${midY} ${to.x} ${toY}`;
          return (
            <g key={d.id}>
              <path
                className="st-dep"
                data-friction={fb}
                d={path}
                fill="none"
              />
            </g>
          );
        })}

        {/* Governing-element halo */}
        {session.governing_id ? (() => {
          const p = byId[session.governing_id];
          if (!p) return null;
          return <circle cx={p.x} cy={p.y} r="64" fill="url(#stHot)" />;
        })() : null}

        {/* Elements — rounded rectangles, architectural */}
        {positions.map(p => {
          const e = p.e;
          const isGoverning = e.governs;
          const fb = stLayerFrictionBand(e.friction || 0);
          const cls = [
            'st-element',
            isGoverning ? 'is-governing' : '',
            hoveredId === e.id ? 'is-focused' : '',
          ].filter(Boolean).join(' ');
          return (
            <g key={e.id}
               className={cls}
               transform={`translate(${p.x},${p.y})`}
               tabIndex={0}
               role="button"
               aria-label={`Structural element ${e.id}: ${e.label || 'unnamed'}`}
               onMouseEnter={() => setHoveredId(e.id)}
               onMouseLeave={() => setHoveredId(null)}
               onFocus={() => setHoveredId(e.id)}
               onBlur={() => setHoveredId(null)}
               style={{ cursor: 'pointer', outline: 'none' }}>
              <rect
                className="st-element-rect"
                x={-ST_ELEMENT_W/2}
                y={-ST_ELEMENT_H/2}
                width={ST_ELEMENT_W}
                height={ST_ELEMENT_H}
                rx="3" ry="3"
                data-friction={fb}
              />
              <text className="st-element-id" x="0" y={-ST_ELEMENT_H/2 - 8}>
                {e.id}
              </text>
              <text className="st-element-label" x="0" y="2">
                {stTrim(e.label || '(unnamed)', 13)}
              </text>
              <text className="st-element-sub" x="0" y={ST_ELEMENT_H/2 + 14}>
                {e.layer}
              </text>
              {isGoverning ? (
                <text x="0" y={-ST_ELEMENT_H/2 - 22}
                      textAnchor="middle"
                      fontFamily="JetBrains Mono, monospace"
                      fontSize="8"
                      letterSpacing="3"
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

window.StructuralTopology = StructuralTopology;
