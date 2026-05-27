/* =============================================================
   KAIROS·1 — Sequence Chamber · the topology
   =============================================================
   The living execution graph. Pure SVG, pure React. Reads from
   sequence state; emits no commands. Friction is encoded as
   heat (color warms, stroke thickens, halo appears). The
   governing constraint pulses on the ambient breath.

   Layout strategy
   ---------------
   • Outcome sits at the right edge — the destination.
   • Actions queue horizontally from the left; Action 1
     leftmost, Action N adjacent to Outcome.
   • Transitions are cubic-bezier arcs between consecutive
     actions, terminating with arrowheads.
   • The final transition reaches into the Outcome rect.
   • For dense sequences (>5 actions), positions stay evenly
     spread; the viewBox scales fonts so the graph stays
     legible.
   ============================================================= */

const { useMemo, useState } = React;

const SVG_W = 1000;
const SVG_H = 600;
const LEFT  = 90;
const RIGHT = 880;
const Y_MID = 300;
const NODE_R = 38;
const OUTCOME_W = 220;
const OUTCOME_H = 150;

function frictionBand(f) {
  if (f >= 0.7) return 'break';
  if (f >= 0.45) return 'low';
  if (f >= 0.2) return 'mid';
  return 'high';
}
function stabilityBand(s) {
  if (s >= 0.75) return 'high';
  if (s >= 0.5)  return 'mid';
  if (s >= 0.25) return 'low';
  return 'break';
}

function layout(actions) {
  // Even spread, with a gentle vertical wave so the topology
  // doesn't feel like a ruler. Wave amplitude scales down as
  // node count grows (denser graphs = flatter).
  const n = actions.length;
  if (n === 0) return [];
  const span = RIGHT - OUTCOME_W - 60 - LEFT;
  const step = n === 1 ? 0 : span / (n - 1);
  const amp = Math.max(0, 40 - n * 4);
  return actions.map((a, i) => {
    const x = LEFT + i * step;
    const phase = (i / Math.max(1, n - 1)) * Math.PI * 1.2;
    const y = Y_MID + Math.sin(phase) * amp;
    return { id: a.id, x, y, a };
  });
}

// Build cubic bezier "d" from (x1,y1) to (x2,y2)
function arcPath(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const cx1 = x1 + dx * 0.45;
  const cy1 = y1;
  const cx2 = x2 - dx * 0.45;
  const cy2 = y2;
  return `M ${x1} ${y1} C ${cx1} ${cy1} ${cx2} ${cy2} ${x2} ${y2}`;
}

// Approximate the arrowhead anchor: the tangent at the end of a
// cubic bezier toward the target. For our gentle curves the
// direction at the endpoint is close to the line from the second
// control point to the endpoint.
function arrowHead(x1, y1, x2, y2) {
  const dx = x2 - x1;
  const cx2 = x2 - dx * 0.45;
  const cy2 = y2;
  const tx = x2 - cx2;
  const ty = y2 - cy2;
  const len = Math.hypot(tx, ty) || 1;
  const ux = tx / len;
  const uy = ty / len;
  // Arrow tip at (x2,y2); back two corners offset perpendicular
  const baseX = x2 - ux * 9;
  const baseY = y2 - uy * 9;
  const px = -uy;
  const py =  ux;
  const a = `${x2},${y2}`;
  const b = `${baseX + px * 4},${baseY + py * 4}`;
  const c = `${baseX - px * 4},${baseY - py * 4}`;
  return `${a} ${b} ${c}`;
}

// Truncate a label to N chars, ellipsizing if needed
function trim(s, n) {
  s = String(s || '').trim();
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trim() + '…';
}

// =============================================================
// SEQUENCE CHAMBER — landmark layout
// =============================================================
// Up to 6 prior cycles render as faded peripheral glyphs around
// the active topology. Position slots are deterministic; the
// newest landmark takes the most prominent slot (top-center)
// and older ones distribute outward.
const SC_LANDMARK_SLOTS = [
  { x: 500, y: 50  },  // top-center (newest)
  { x: 140, y: 80  },  // top-left
  { x: 820, y: 80  },  // top-right
  { x: 500, y: 570 },  // bottom-center
  { x: 140, y: 540 },  // bottom-left
  { x: 820, y: 540 },  // bottom-right
];

function Topology({ sequence, history }) {
  // Attention-revealed lineage — threads appear only when the
  // reader hovers/focuses an action node. Per Refinement 04:
  // memory surfaces from underground, only on intentional attention.
  const [hoveredActionId, setHoveredActionId] = useState(null);

  const positions = useMemo(
    () => layout(sequence.actions || []),
    [sequence.actions]
  );
  const byId = useMemo(() => {
    const m = {};
    positions.forEach(p => { m[p.id] = p; });
    return m;
  }, [positions]);

  // Landmarks — prior cycles as peripheral glyphs
  const landmarks = useMemo(() => {
    if (!window.kairos || !window.kairos.landmarks) return [];
    const raw = window.kairos.landmarks.extract(history || [], 'sequence');
    return raw.slice(0, SC_LANDMARK_SLOTS.length).map((lm, i) => ({
      ...lm,
      x: SC_LANDMARK_SLOTS[i].x,
      y: SC_LANDMARK_SLOTS[i].y,
    }));
  }, [history]);

  // Lineage threads — detect recurrence between current actions and prior landmarks
  const lineages = useMemo(() => {
    if (!window.kairos || !window.kairos.landmarks || landmarks.length === 0) return [];
    const matches = [];
    (sequence.actions || []).forEach(a => {
      const p = byId[a.id];
      if (!p || !a.label) return;
      const hits = window.kairos.landmarks.findLineage(a.label, landmarks);
      hits.forEach(h => {
        matches.push({
          id: a.id + '-' + h.landmark.id,
          from_action_id: a.id,
          from_x: p.x, from_y: p.y,
          to_x: h.landmark.x, to_y: h.landmark.y,
          score: h.score,
        });
      });
    });
    return matches;
  }, [sequence.actions, landmarks, byId]);

  const hasActions = (sequence.actions || []).length > 0;
  const hasOutcome = !!sequence.outcome;

  // Action → outcome final arc anchors to the rightmost action
  // (max x). If there are no actions, the outcome sits centered.
  const lastAction = positions.reduce(
    (acc, p) => (acc && acc.x > p.x ? acc : p),
    null
  );

  const outcomeX = hasActions ? RIGHT - OUTCOME_W : (SVG_W - OUTCOME_W) / 2;
  const outcomeY = hasActions ? Y_MID - OUTCOME_H / 2 : (SVG_H - OUTCOME_H) / 2;
  const outcomeCenter = { x: outcomeX + OUTCOME_W / 2, y: outcomeY + OUTCOME_H / 2 };

  // Empty topology — pre-sequence (but landmarks may still exist)
  if (!hasActions && !hasOutcome) {
    return (
      <div className="c-topology-stage">
        <div className="c-topology-empty">
          <div className="glyph" aria-hidden="true"></div>
          <div className="label">— The topology is unfinished</div>
          <div className="hint">
            The graph will emerge as you describe what is being brought into reality.
            Speak; the runtime maps. The blank is part of the work.
          </div>
        </div>
        {landmarks.length > 0 ? (
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            preserveAspectRatio="xMidYMid meet"
            className="c-topology-svg c-topology-svg-landmarks-only"
            aria-label="Prior cycle landmarks"
          >
            {landmarks.map(lm => <LandmarkGlyph key={lm.id} landmark={lm} />)}
          </svg>
        ) : null}
      </div>
    );
  }

  return (
    <div className="c-topology-stage">
      <svg
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="c-topology-svg"
        aria-label="Execution topology"
      >
        <defs>
          {/* Subtle radial wash behind the outcome */}
          <radialGradient id="outcomeWash" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="rgba(217,148,102,0.10)" />
            <stop offset="100%" stopColor="rgba(217,148,102,0)" />
          </radialGradient>
        </defs>

        {/* Landmarks first — they sit beneath the active topology */}
        {landmarks.map(lm => <LandmarkGlyph key={lm.id} landmark={lm} />)}

        {/* Lineage threads from current actions to landmarks —
            only the threads from the hovered/focused action are
            visible. Per Refinement 04: attention-revealed memory. */}
        {lineages.map(l => (
          <LineageThread
            key={l.id}
            from={{ x: l.from_x, y: l.from_y }}
            to={{ x: l.to_x, y: l.to_y }}
            score={l.score}
            active={l.from_action_id === hoveredActionId}
          />
        ))}

        {/* Outcome — destination */}
        {hasOutcome ? (
          <g className="tn-outcome-group">
            <ellipse
              cx={outcomeCenter.x}
              cy={outcomeCenter.y}
              rx={OUTCOME_W * 0.62}
              ry={OUTCOME_H * 0.6}
              fill="url(#outcomeWash)"
            />
            <rect
              className="tn-outcome"
              x={outcomeX}
              y={outcomeY}
              width={OUTCOME_W}
              height={OUTCOME_H}
              rx="2"
              ry="2"
            />
            <text
              className="tn-outcome-label"
              x={outcomeCenter.x}
              y={outcomeY + 22}
            >
              — Outcome
            </text>
            <foreignObject
              x={outcomeX + 18}
              y={outcomeY + 34}
              width={OUTCOME_W - 36}
              height={OUTCOME_H - 50}
            >
              <div
                xmlns="http://www.w3.org/1999/xhtml"
                style={{
                  fontFamily: 'Newsreader, Georgia, serif',
                  fontStyle: 'italic',
                  fontSize: 14,
                  lineHeight: 1.45,
                  color: 'var(--ink)',
                  textAlign: 'center',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}
              >
                {trim(sequence.outcome, 140)}
              </div>
            </foreignObject>
          </g>
        ) : null}

        {/* Transitions — drawn first so nodes overlay them */}
        {(sequence.transitions || []).map((t) => {
          const from = byId[t.from_id];
          const to   = byId[t.to_id];
          if (!from || !to) return null;
          const sb = stabilityBand(t.stability);
          // End anchor: just before the to-node's left edge
          const ang = Math.atan2(to.y - from.y, to.x - from.x);
          const fx = from.x + Math.cos(ang) * NODE_R;
          const fy = from.y + Math.sin(ang) * NODE_R;
          const tx = to.x - Math.cos(ang) * NODE_R;
          const ty = to.y - Math.sin(ang) * NODE_R;
          return (
            <g key={t.id} className="tt-group">
              <path
                className="tt-arc"
                data-stab={sb}
                d={arcPath(fx, fy, tx, ty)}
              />
              <polygon
                className="tt-arrow"
                data-stab={sb}
                points={arrowHead(fx, fy, tx, ty)}
              />
            </g>
          );
        })}

        {/* Final transition: last action → outcome (drawn when both exist) */}
        {hasActions && hasOutcome && lastAction ? (() => {
          const ang = Math.atan2(outcomeCenter.y - lastAction.y, outcomeX - lastAction.x);
          const fx = lastAction.x + Math.cos(ang) * NODE_R;
          const fy = lastAction.y + Math.sin(ang) * NODE_R;
          // Anchor on the left edge of the outcome rect, vertically centered to its midline
          const tx = outcomeX - 4;
          const ty = outcomeCenter.y;
          return (
            <g className="tt-group">
              <path
                className="tt-arc"
                data-stab="high"
                d={arcPath(fx, fy, tx, ty)}
              />
              <polygon
                className="tt-arrow"
                data-stab="high"
                points={arrowHead(fx, fy, tx, ty)}
              />
            </g>
          );
        })() : null}

        {/* Action nodes */}
        {positions.map((p) => {
          const a = p.a;
          const hasFriction = a.friction >= 0.2;
          const governing = a.governs_flow;
          const classes = [
            'tn-action',
            governing ? 'is-governing' : '',
            hasFriction ? 'is-friction' : '',
            a.avoided ? 'is-avoided' : '',
            hoveredActionId === p.id ? 'is-focused' : '',
          ].filter(Boolean).join(' ');
          const fb = frictionBand(a.friction);
          return (
            <g
              key={p.id}
              className={classes}
              transform={`translate(${p.x},${p.y})`}
              tabIndex={0}
              role="button"
              aria-label={`Action ${p.id}: ${a.label || 'unnamed'}`}
              onMouseEnter={() => setHoveredActionId(p.id)}
              onMouseLeave={() => setHoveredActionId(null)}
              onFocus={() => setHoveredActionId(p.id)}
              onBlur={() => setHoveredActionId(null)}
              style={{ cursor: 'pointer', outline: 'none' }}
            >
              {/* Friction halo */}
              <circle
                className="tn-action-halo"
                cx="0" cy="0"
                r={NODE_R + 12}
              />
              {/* Main circle */}
              <circle
                className="tn-action-circle"
                cx="0" cy="0"
                r={NODE_R}
                data-friction={fb}
              />
              {/* ID inside */}
              <text className="tn-action-id" x="0" y="-3">{p.id}</text>
              {/* Label below */}
              <text className="tn-action-label" x="0" y={NODE_R + 22}>
                {trim(a.label || '(unnamed)', 28)}
              </text>
              {/* Completion criteria — quiet italic below the label */}
              {a.completion_criteria ? (
                <text className="tn-action-completion" x="0" y={NODE_R + 40}>
                  {trim(a.completion_criteria, 36)}
                </text>
              ) : null}
              {/* Governing flag */}
              {governing ? (
                <text
                  x="0"
                  y={-NODE_R - 14}
                  textAnchor="middle"
                  fontFamily="JetBrains Mono, monospace"
                  fontSize="8.5"
                  letterSpacing="2"
                  fill="var(--heat)"
                >
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

window.Topology = Topology;
window.kairos = window.kairos || {};
window.kairos.topology = {
  frictionBand,
  stabilityBand,
};

// =============================================================
// LANDMARK GLYPH — a faded peripheral memory of a prior cycle
// =============================================================
// Style is intentionally archaeological: small, dashed, dim.
// Tier 1 (newest) brightest; tier 4 (ancient) barely visible.
// No labels until hover — the topology must not become noisy.
function LandmarkGlyph({ landmark }) {
  const isUnresolved = landmark.origin !== 'governing';
  return (
    <g
      className={`landmark landmark-tier-${landmark.tier || 1}${isUnresolved ? ' is-unresolved' : ''}`}
      transform={`translate(${landmark.x},${landmark.y})`}
      data-cycle-id={landmark.cycle_id || ''}
    >
      <circle className="landmark-circle" cx="0" cy="0" r="11" />
      <text className="landmark-id" x="0" y="3">
        {(landmark.cycle_id || '').slice(-4)}
      </text>
      <text className="landmark-label" x="0" y="26">
        {trim(landmark.label, 24)}
      </text>
    </g>
  );
}
window.LandmarkGlyph = LandmarkGlyph;

// =============================================================
// LINEAGE THREAD — a faint amber arc connecting a current node
// to a prior landmark it echoes. Recurrence made visible.
// =============================================================
function LineageThread({ from, to, score, active }) {
  // Curve outward slightly so threads don't overlap the active topology straight-on.
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  // Perpendicular offset (small, gentle curve)
  const ox = -dy / len * 30;
  const oy =  dx / len * 30;
  const cx = mx + ox;
  const cy = my + oy;
  const peakOpacity = Math.max(0.32, Math.min(0.7, score * 1.4));
  const d = `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`;
  return (
    <path
      className={'lineage-thread' + (active ? ' is-active' : '')}
      d={d}
      style={{ '--lineage-peak': peakOpacity }}
    />
  );
}
window.LineageThread = LineageThread;
