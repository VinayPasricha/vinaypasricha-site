/* =============================================================
   KAIROS·1 — Character of the Executor · integrity topology
   =============================================================
   Vertical alignment pillars. Stable, unmoving, load-bearing.
   Each pillar = a quality of internal coherence carrying force
   across time. No animation. No motion. Standing structures.

   States:
     aligned  — plumb, calm
     leaning  — tilted; tilt 0..1 → angle
     cracked  — fracture line through pillar
     buried   — partially sunken into the ground stratum
   ============================================================= */

const { useMemo: chUseMemo, useState: chUseState } = React;

const CH_W = 1000;
const CH_H = 700;
const CH_GROUND_Y = 580;       // The ground line — pillars rise from here
const CH_PILLAR_HEIGHT = 360;  // Aligned pillar height
const CH_PILLAR_WIDTH = 32;

function chTrim(s, n) {
  s = String(s || '').trim();
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trim() + '…';
}

function chLayout(pillars) {
  const n = pillars.length;
  if (n === 0) return [];
  const left = 120;
  const right = 880;
  return pillars.map((p, i) => {
    const x = n === 1 ? 500 : left + (i / (n - 1)) * (right - left);
    return { p, x };
  });
}

function IntegrityTopology({ session, history }) {
  const pillars = session.pillars || [];
  const [hoveredId, setHoveredId] = chUseState(null);

  const positions = chUseMemo(() => chLayout(pillars), [pillars]);

  const landmarks = chUseMemo(() => {
    if (!window.kairos || !window.kairos.landmarks) return [];
    const raw = window.kairos.landmarks.extract(history || [], 'character');
    const slots = [
      { x: 60,  y: 60 }, { x: 940, y: 60 },
      { x: 60,  y: 200 }, { x: 940, y: 200 },
      { x: 60,  y: 340 }, { x: 940, y: 340 },
    ];
    return raw.slice(0, slots.length).map((lm, i) => ({ ...lm, x: slots[i].x, y: slots[i].y }));
  }, [history]);

  const hasPillars = pillars.length > 0;
  if (!hasPillars && landmarks.length === 0) {
    return (
      <div className="c-topology-stage">
        <div className="c-topology-empty">
          <div className="glyph" aria-hidden="true"></div>
          <div className="label">— The pillars are unread</div>
          <div className="hint">
            Internal coherence is load-bearing. Name one quality that holds
            you steady across pressure, time, and scale — and the chamber
            will begin.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="c-topology-stage">
      <svg
        viewBox={`0 0 ${CH_W} ${CH_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="c-topology-svg"
        aria-label="Integrity topology"
      >
        <defs>
          <linearGradient id="chPillar" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%"   stopColor="rgba(217,148,102,0.04)" />
            <stop offset="60%"  stopColor="rgba(180,180,200,0.10)" />
            <stop offset="100%" stopColor="rgba(180,180,200,0.18)" />
          </linearGradient>
          <linearGradient id="chPillarGoverning" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%"   stopColor="rgba(217,148,102,0.20)" />
            <stop offset="60%"  stopColor="rgba(217,148,102,0.30)" />
            <stop offset="100%" stopColor="rgba(217,148,102,0.42)" />
          </linearGradient>
          <radialGradient id="chFloor" cx="50%" cy="100%" r="55%">
            <stop offset="0%" stopColor="rgba(217,148,102,0.024)" />
            <stop offset="100%" stopColor="rgba(217,148,102,0)" />
          </radialGradient>
        </defs>

        {/* Deep floor wash beneath the pillars */}
        <ellipse cx={CH_W / 2} cy={CH_GROUND_Y + 40} rx={500} ry={120} fill="url(#chFloor)" />

        {/* The ground line — where pillars rise from */}
        <line
          x1={60} x2={CH_W - 60}
          y1={CH_GROUND_Y} y2={CH_GROUND_Y}
          stroke="rgba(180,180,200,0.18)"
          strokeWidth="0.6"
        />
        {/* A second seam below — geological depth */}
        <line
          x1={60} x2={CH_W - 60}
          y1={CH_GROUND_Y + 18} y2={CH_GROUND_Y + 18}
          stroke="rgba(180,180,200,0.08)"
          strokeWidth="0.4"
          strokeDasharray="2 6"
        />

        {/* Landmarks — prior character cycles */}
        {landmarks.map(lm => {
          const isUnresolved = lm.origin !== 'governing';
          return (
            <g key={lm.id}
               className={`landmark landmark-tier-${lm.tier || 1}${isUnresolved ? ' is-unresolved' : ''}`}
               transform={`translate(${lm.x},${lm.y})`}
               data-cycle-id={lm.cycle_id || ''}>
              <circle className="landmark-circle" cx="0" cy="0" r="11" />
              <text className="landmark-id" x="0" y="3">{(lm.cycle_id || '').slice(-4)}</text>
              <text className="landmark-label" x="0" y="26">{chTrim(lm.label, 22)}</text>
            </g>
          );
        })}

        {/* Pillars — vertical alignment structures */}
        {positions.map(({ p, x }) => {
          const isGoverning = p.governs;
          const isAligned = p.state === 'aligned';
          const isLeaning = p.state === 'leaning';
          const isCracked = p.state === 'cracked';
          const isBuried = p.state === 'buried';

          // Visible height by state
          const fullH = CH_PILLAR_HEIGHT;
          const h = isBuried ? fullH * 0.45 : fullH;
          const topY = CH_GROUND_Y - h;

          // Lean: tilt 0..1 → 0..7deg around the ground anchor
          const angle = isLeaning ? (p.tilt || 0.5) * 7 : 0;

          const fill = isGoverning ? 'url(#chPillarGoverning)' : 'url(#chPillar)';
          const stroke =
            isGoverning ? 'var(--heat)' :
            isCracked   ? 'rgba(217,148,102,0.55)' :
            isBuried    ? 'rgba(180,180,200,0.20)' :
                          'rgba(180,180,200,0.45)';
          const strokeWidth = isGoverning ? 1.4 : 0.8;

          const cls = [
            'ch-pillar',
            'ch-pillar--' + p.state,
            isGoverning ? 'is-governing' : '',
            hoveredId === p.id ? 'is-focused' : '',
          ].filter(Boolean).join(' ');

          return (
            <g key={p.id} className={cls}
               transform={`translate(${x},${CH_GROUND_Y}) rotate(${angle})`}
               tabIndex={0}
               role="button"
               aria-label={`Pillar ${p.id}: ${p.label || 'unnamed'} (${p.state})`}
               onMouseEnter={() => setHoveredId(p.id)}
               onMouseLeave={() => setHoveredId(null)}
               onFocus={() => setHoveredId(p.id)}
               onBlur={() => setHoveredId(null)}
               style={{ cursor: 'pointer', outline: 'none' }}>
              {/* Buried portion (sunken into the ground line) */}
              {isBuried ? (
                <rect
                  x={-CH_PILLAR_WIDTH / 2}
                  y={0}
                  width={CH_PILLAR_WIDTH}
                  height={fullH - h}
                  fill="rgba(60,70,90,0.4)"
                  stroke="none"
                />
              ) : null}
              {/* The pillar body */}
              <rect
                className="ch-pillar-body"
                x={-CH_PILLAR_WIDTH / 2}
                y={-h}
                width={CH_PILLAR_WIDTH}
                height={h}
                fill={fill}
                stroke={stroke}
                strokeWidth={strokeWidth}
              />
              {/* Crack — diagonal line through the pillar */}
              {isCracked ? (
                <line
                  className="ch-pillar-crack"
                  x1={-CH_PILLAR_WIDTH / 2}
                  y1={-h * 0.45}
                  x2={CH_PILLAR_WIDTH / 2}
                  y2={-h * 0.7}
                  stroke="var(--heat)"
                  strokeWidth="0.8"
                  strokeDasharray="3 2"
                />
              ) : null}
              {/* Capital at the top — a flat cap stone */}
              <rect
                x={-CH_PILLAR_WIDTH / 2 - 4}
                y={-h - 4}
                width={CH_PILLAR_WIDTH + 8}
                height={4}
                fill={isGoverning ? 'rgba(217,148,102,0.5)' : 'rgba(180,180,200,0.25)'}
                stroke="none"
              />
              {/* ID on the pillar */}
              <text className="ch-pillar-id" x="0" y={-h / 2} transform={`rotate(${-angle})`}>{p.id}</text>
              {/* Label below the pillar */}
              <text className="ch-pillar-label" x="0" y={22} transform={`rotate(${-angle})`}>
                {chTrim(p.label || '(unnamed)', 26)}
              </text>
              {/* State sub-label */}
              <text className="ch-pillar-state" x="0" y={38} transform={`rotate(${-angle})`}>
                {p.state}
              </text>
              {isGoverning ? (
                <text x="0" y={-h - 14} textAnchor="middle"
                      fontFamily="JetBrains Mono, monospace"
                      fontSize="8" letterSpacing="3"
                      fill="var(--heat)"
                      transform={`rotate(${-angle})`}>
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

window.IntegrityTopology = IntegrityTopology;
