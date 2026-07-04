/* =============================================================
   SIV Conversation — state machine + Claude calls + artefact
   =============================================================
   The conversation is finite. The visitor describes a decision in
   their own words. The AI walks them through the 8 SIV steps
   (with depth auto-inferred per Option B). When complete, the AI
   emits an [[SIV_ARTEFACT_START]] / [[SIV_ARTEFACT_END]] block
   containing JSON; the page parses it and renders a printable
   thinking artefact.

   The system prompt below is the canonical SIV public-facing
   prompt (v1.0 from _prompts/siv/v1.0.md, adapted to single-page
   conversational UX).
   ============================================================= */

const SIV_SYSTEM_PROMPT_DEFAULT = `You are the SIV facilitator on Vinay Pasricha's website. You guide a visitor through SIV — Socratic Iterative Vinay — a structured method for examining reality before action.

CORE PROPOSITION
Before power is applied, reality must be examined hard enough to deserve action.

IDENTITY
- You are NOT Vinay. You are a facilitator trained on his method.
- If asked who you are: "I am the SIV facilitator. Vinay's writing is elsewhere on this site."
- Voice: calm, sharp, precise, slightly Socratic. Severe in ideas, moderate in language. Never warm for its own sake. Never motivational. Never therapy-speak.

THE METHOD — 8 STEPS, ONE QUESTION PER TURN

You will guide the visitor through these eight steps. The visitor has just sent you their decision in their own words. Proceed.

STEP 1 — INFER DEPTH (your first turn)
- Read the visitor's framing.
- Silently choose a depth level based on complexity:
  • Level 1 (Quick) — 3 questions, 3 lenses — simple/binary issues
  • Level 2 (Standard) — 5 questions, 5 lenses — DEFAULT for most cases
  • Level 3 (Deep) — 8 questions, 8 lenses — high stakes, multi-factor, life-shaping
- Announce the level in one sentence: "Given how you've described this, a Standard SIV — five questions, five lenses — feels right. You can ask me to go shorter or deeper at any time."
- Then move directly to Step 2 in the same turn.

STEP 2 — TWO-SENTENCE FRAME (in your first turn, right after Step 1)
- Restate the visitor's issue in EXACTLY two sentences:
  • Sentence 1: What is being examined or decided.
  • Sentence 2: Why it matters / what is at stake.
- Then ask: "Is this framing correct? (Yes — or fix it for me.)"
- Do not proceed until they confirm or correct it.

STEP 3 — QUESTIONS, ONE AT A TIME
- Ask N questions matching the depth (3/5/8). One per turn. Never two.
- Each question should surface ONE of: real objective, hidden assumptions, constraints, success criteria, risks, trade-offs, emotional bias, stakeholder impact, what they're avoiding, what would make the outcome truly successful.
- After each answer, briefly interpret what it reveals (1–2 sentences) before the next question.
- If an answer is vague: ask one follow-up. Don't move on with weak data.
- Adaptive shortening: if clarity emerges early, you may collapse remaining questions and move to lenses.

STEP 4 — LENSES (one turn)
- Generate N lenses (matching depth) fresh from the issue, not from a fixed menu.
- Each lens: formal name, what it reveals, what it warns against.
- Present them as a single numbered list in one turn.
- Then ask: "Are these the right lenses, or should we add or replace any?"

STEP 5 — CONTRADICTIONS (one turn)
- Name 1–3 contradictions you've noticed (between what they say they want vs. what their actions imply; ambition vs. resources; stated goal vs. hidden goal; ideal outcome vs. likely outcome).
- Be direct. Do not soften.

STEP 6 — THE REAL ISSUE (one turn)
- Present:
  • Surface Issue: what they first described
  • Deeper Issue: what the inquiry has revealed
  • Core Decision: the central thing to be decided now

STEP 7 — CONVERGENCE (one turn)
- Produce the convergence — recommendation, strategy, definition, or path — in 3–5 sentences. Direct. No fluff. No "you should." State what the integrated understanding now suggests.

STEP 8 — ARTEFACT
After Step 7, on a new turn, you MUST emit EXACTLY this marker on its own line:
[[SIV_ARTEFACT_START]]

Then on the next line a JSON object with these keys (no comments, valid JSON):
{
  "title": "Short title for this decision (max 8 words)",
  "framing": "The two-sentence frame from Step 2",
  "what_we_examined": ["bullet 1", "bullet 2", "bullet 3"],
  "what_siv_revealed": ["bullet 1", "bullet 2", "bullet 3"],
  "what_matters_most": "One clear sentence",
  "recommended_direction": "2-3 sentences",
  "immediate_next_step": "One concrete action, doable within 48 hours",
  "unresolved_question": "One reflective question the visitor carries away"
}

Then on a new line emit:
[[SIV_ARTEFACT_END]]

After the artefact you may add ONE short closing sentence in your facilitator voice (e.g., "Thank you for thinking with me. The verdict is yours.").

BEHAVIOR RULES
- ONE question per turn. Never two.
- Never invent facts about the visitor.
- Never say "you should."
- Never sympathise performatively. Never criticise harshly.
- If the visitor asks for the answer: "The verdict is yours. I can only help you see the situation more clearly."
- If the visitor drifts (asks something out of scope): gently redirect — "That's a real question. But the decision we agreed to think about is the one in front of us. Let's finish this first."
- If the visitor is abusive or nonsensical: end politely — "This doesn't seem to be the right moment for this conversation. The book is here when you're ready." Do not continue.
- ONE reflective intervention permitted per session, maximum. Pattern: "Sometimes clarity appears when we stop asking 'X' and start asking 'Y.'" Never advice; only perceptual reframing.

STYLE
- Short sentences.
- Use italic phrasing: "It seems...", "One possibility is...", "What would you say if..."
- Plain prose; no lists in normal turns (only in Step 4 and the artefact JSON).
- Respond in the language the visitor wrote in. Default English.

CORE PRINCIPLE TO HOLD THROUGHOUT
Before power is applied, reality must be examined hard enough to deserve action.

BEGIN
You will receive the visitor's first message (their decision in their own words). Respond with Step 1 and Step 2 combined, as described.`;

// Runtime override: if Studio has published a newer prompt to
// assets/data/prompts.json (or a localStorage draft), use that
// instead of the inline default above. The inline default remains
// the offline-safe fallback.
let SIV_SYSTEM_PROMPT = SIV_SYSTEM_PROMPT_DEFAULT;
(async function loadSivPromptOverride() {
  try {
    const draft = localStorage.getItem('studio.prompts');
    if (draft) {
      const d = JSON.parse(draft);
      const p = d && d.prompts && d.prompts['siv-facilitator'] && d.prompts['siv-facilitator'].system;
      if (p && p.trim()) { SIV_SYSTEM_PROMPT = p; return; }
    }
  } catch (e) {}
  try {
    const res = await fetch('../assets/data/prompts.json', { cache: 'no-cache' });
    if (res.ok) {
      const d = await res.json();
      const p = d && d.prompts && d.prompts['siv-facilitator'] && d.prompts['siv-facilitator'].system;
      if (p && p.trim()) SIV_SYSTEM_PROMPT = p;
    }
  } catch (e) {}
})();


/* ============================================================
   STATE
   ============================================================ */
const STATE_KEY = 'siv_session_v1';

let state = {
  phase: 'intro',        // intro | thinking | conversation | artefact | error
  messages: [],          // [{role: 'user'|'assistant', content: '...'}]
  artefact: null,
  startedAt: null,
};

function saveState() {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) {}
}
function loadState() {
  try {
    const s = localStorage.getItem(STATE_KEY);
    if (s) state = JSON.parse(s);
  } catch (e) {}
}
function clearState() {
  try { localStorage.removeItem(STATE_KEY); } catch (e) {}
  state = { phase: 'intro', messages: [], artefact: null, startedAt: null };
}


/* ============================================================
   RENDER
   ============================================================ */
const $root = () => document.getElementById('siv-conversation');

function render() {
  const root = $root();
  if (!root) return;

  if (state.phase === 'intro') {
    root.innerHTML = renderIntro();
    wireIntro();
  } else if (state.phase === 'artefact') {
    root.innerHTML = renderArtefact();
    wireArtefactActions();
  } else {
    root.innerHTML = renderConversation();
    wireConversation();
  }
}

function renderIntro() {
  return `
    <div class="siv-inner">
      ${renderPhases('threshold')}
      <div class="siv-intro">
        <h2>Bring <em>a decision</em> in front of you.</h2>
        <p class="lede">
          Describe it in your own words. The method walks you through SIV — multiple lenses, Socratic pressure, an integrated understanding. You leave with a one-page thinking artefact.
        </p>
        <form class="siv-threshold-form" id="siv-threshold-form">
          <textarea
            id="siv-threshold-input"
            placeholder="The decision is…"
            aria-label="Describe the decision in your own words"
          ></textarea>
          <div class="siv-helper">
            A difficult decision. A recurring conflict. A direction that feels unclear. Begin anywhere.
          </div>
          <div class="row">
            <div class="privacy">Stored only on your device · nothing sent until you submit</div>
            <button class="siv-submit" type="submit" id="siv-threshold-submit">
              Begin <span class="arrow">→</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function renderPhases(current) {
  const phases = ['threshold', 'framing', 'inquiry', 'lenses', 'verdict', 'artefact'];
  const labels = {
    threshold: 'Threshold',
    framing: 'Frame',
    inquiry: 'Inquiry',
    lenses: 'Lenses',
    verdict: 'Verdict',
    artefact: 'Artefact',
  };
  const currentIdx = phases.indexOf(current);
  const items = phases.map((p, i) => {
    const cls = i < currentIdx ? 'passed' : (i === currentIdx ? 'active' : '');
    return `
      <span class="siv-phase ${cls}">
        <span class="bar"></span>
        <span>${labels[p]}</span>
      </span>
      ${i < phases.length - 1 ? '<span class="sep">·</span>' : ''}
    `;
  }).join('');
  return `<div class="siv-phases">${items}</div>`;
}

function renderConversation() {
  // Determine current phase from messages
  const aiTurnCount = state.messages.filter(m => m.role === 'assistant').length;
  let currentPhase = 'framing';
  if (aiTurnCount === 0) currentPhase = 'threshold';
  else if (aiTurnCount <= 2) currentPhase = 'framing';
  else if (aiTurnCount <= 5) currentPhase = 'inquiry';
  else if (aiTurnCount <= 7) currentPhase = 'lenses';
  else currentPhase = 'verdict';

  const turns = state.messages.map((m, i) => {
    if (m.role === 'user') {
      return `
        <div class="siv-turn">
          <div class="siv-user">
            <div class="meta">— You</div>
            <div class="text">${escapeHTML(m.content)}</div>
          </div>
        </div>
      `;
    } else {
      // Strip artefact markers from displayed AI text
      let display = m.content
        .replace(/\[\[SIV_ARTEFACT_START\]\][\s\S]*?\[\[SIV_ARTEFACT_END\]\]/g, '')
        .trim();
      return `
        <div class="siv-turn">
          <div class="siv-ai">
            <div class="rule"></div>
            <div class="body">
              <div class="meta">— SIV Facilitator</div>
              <div class="text">${formatAiText(display)}</div>
            </div>
          </div>
        </div>
      `;
    }
  }).join('');

  // Thinking indicator
  const thinking = state.phase === 'thinking' ? `
    <div class="siv-turn">
      <div class="siv-ai">
        <div class="rule"></div>
        <div class="body">
          <div class="meta">— SIV Facilitator</div>
          <div class="text">
            <span class="siv-thinking" aria-label="thinking">
              <span></span><span></span><span></span>
            </span>
          </div>
        </div>
      </div>
    </div>
  ` : '';

  // Continue input — only show when not thinking and not awaiting initial submit
  const lastIsAi = state.messages.length > 0 && state.messages[state.messages.length - 1].role === 'assistant';
  const inputHTML = (state.phase === 'conversation' && lastIsAi) ? `
    <form class="siv-continue" id="siv-continue-form">
      <textarea
        id="siv-continue-input"
        placeholder="Type your response…"
        autofocus
        aria-label="Your response"
      ></textarea>
      <div class="row">
        <span class="hint"><kbd>Enter ↵</kbd> to send · <kbd>⇧ Enter</kbd> for newline</span>
        <button type="button" class="ghost-link" id="siv-begin-again">begin again</button>
        <button type="submit" class="siv-submit" id="siv-continue-submit">
          Continue <span class="arrow">→</span>
        </button>
      </div>
    </form>
  ` : '';

  const errorHTML = state.phase === 'error' ? `
    <div class="siv-error">
      <strong>Something went wrong.</strong> The conversation can't continue right now —
      this may be a network issue or a quota limit. You can
      <button class="linkish" id="siv-retry">try again</button> or
      <button class="linkish" id="siv-begin-again-err">begin again</button>.
    </div>
  ` : '';

  return `
    <div class="siv-inner">
      ${renderPhases(currentPhase)}
      <div class="siv-thread">
        ${turns}
        ${thinking}
      </div>
      ${inputHTML}
      ${errorHTML}
      <div class="siv-foot">
        Your responses live only on your device.
        <button class="linkish" id="siv-foot-restart">Begin again</button>
        <em>·</em>
        <a href="#how-siv-works">Read about the method</a>
      </div>
    </div>
  `;
}

function renderArtefact() {
  const a = state.artefact;
  const dateStr = new Date(state.startedAt || Date.now()).toLocaleDateString(
    document.documentElement.lang || 'en',
    { year: 'numeric', month: 'long', day: 'numeric' }
  );
  return `
    <div class="siv-inner">
      ${renderPhases('artefact')}
      <div class="siv-artefact" id="siv-artefact">
        <div class="top-rule">
          <span class="line"></span>
          <span class="label">A Decision, Examined</span>
          <span class="line"></span>
        </div>
        <h2 class="art-title">${escapeHTML(a.title || 'An SIV Examination')}</h2>
        <p class="art-subtitle">A thinking artefact · The SIV Method</p>

        <div class="art-row">
          <div class="art-label">Framing</div>
          <div class="art-content"><p>${escapeHTML(a.framing || '')}</p></div>
        </div>

        ${a.what_we_examined?.length ? `
        <div class="art-row">
          <div class="art-label">What we examined</div>
          <div class="art-content">
            <ul>${a.what_we_examined.map(b => `<li>${escapeHTML(b)}</li>`).join('')}</ul>
          </div>
        </div>` : ''}

        ${a.what_siv_revealed?.length ? `
        <div class="art-row">
          <div class="art-label">What SIV revealed</div>
          <div class="art-content">
            <ul>${a.what_siv_revealed.map(b => `<li>${escapeHTML(b)}</li>`).join('')}</ul>
          </div>
        </div>` : ''}

        <div class="art-row">
          <div class="art-label">What matters most</div>
          <div class="art-content"><p>${escapeHTML(a.what_matters_most || '')}</p></div>
        </div>

        <div class="art-row">
          <div class="art-label">Recommended direction</div>
          <div class="art-content"><p>${escapeHTML(a.recommended_direction || '')}</p></div>
        </div>

        <div class="art-row">
          <div class="art-label">Immediate next step</div>
          <div class="art-content"><p><em>Within 48 hours.</em> ${escapeHTML(a.immediate_next_step || '')}</p></div>
        </div>

        ${a.unresolved_question ? `
          <div class="art-divider">❦</div>
          <div class="art-unresolved">
            <div class="art-label">One unresolved question remains</div>
            <div class="question">${escapeHTML(a.unresolved_question)}</div>
          </div>
        ` : ''}

        <div class="art-foot">
          <div class="stamp">
            ${dateStr}<br>
            <em>vinaypasricha.com</em> · The SIV Method
          </div>
          <div class="art-actions">
            <button class="art-action" id="siv-print">Print</button>
            <button class="art-action" id="siv-copy">Copy text</button>
            <button class="art-action primary" id="siv-again">Begin again</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   WIRING
   ============================================================ */
function wireIntro() {
  const form = document.getElementById('siv-threshold-form');
  const input = document.getElementById('siv-threshold-input');
  const btn = document.getElementById('siv-threshold-submit');
  if (!form) return;

  // Disable submit until there's content
  const updateBtn = () => { btn.disabled = !input.value.trim(); };
  updateBtn();
  input.addEventListener('input', updateBtn);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    state.startedAt = Date.now();
    state.messages.push({ role: 'user', content: text });
    state.phase = 'thinking';
    saveState();
    render();
    await callClaude();
  });
}

function wireConversation() {
  const form = document.getElementById('siv-continue-form');
  const input = document.getElementById('siv-continue-input');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      state.messages.push({ role: 'user', content: text });
      state.phase = 'thinking';
      saveState();
      render();
      await callClaude();
    });
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          form.dispatchEvent(new Event('submit'));
        }
      });
    }
  }
  document.getElementById('siv-begin-again')?.addEventListener('click', resetSession);
  document.getElementById('siv-begin-again-err')?.addEventListener('click', resetSession);
  document.getElementById('siv-foot-restart')?.addEventListener('click', resetSession);
  document.getElementById('siv-retry')?.addEventListener('click', async () => {
    state.phase = 'thinking';
    render();
    await callClaude();
  });
}

function wireArtefactActions() {
  document.getElementById('siv-print')?.addEventListener('click', () => window.print());
  document.getElementById('siv-again')?.addEventListener('click', resetSession);
  document.getElementById('siv-copy')?.addEventListener('click', copyArtefact);
}

function resetSession() {
  if (!confirm('Begin a new SIV session? The current thread will be cleared.')) return;
  clearState();
  render();
  document.getElementById('siv-conversation')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function copyArtefact() {
  const a = state.artefact;
  const txt = `A DECISION, EXAMINED
The SIV Method · vinaypasricha.com

${a.title || ''}

FRAMING
${a.framing || ''}

WHAT WE EXAMINED
${(a.what_we_examined || []).map(b => '  → ' + b).join('\n')}

WHAT SIV REVEALED
${(a.what_siv_revealed || []).map(b => '  → ' + b).join('\n')}

WHAT MATTERS MOST
${a.what_matters_most || ''}

RECOMMENDED DIRECTION
${a.recommended_direction || ''}

IMMEDIATE NEXT STEP (within 48 hours)
${a.immediate_next_step || ''}

ONE UNRESOLVED QUESTION REMAINS
${a.unresolved_question || ''}

${new Date(state.startedAt || Date.now()).toLocaleDateString()}
`;
  navigator.clipboard?.writeText(txt).then(() => {
    const btn = document.getElementById('siv-copy');
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => { btn.textContent = orig; }, 1600);
  });
}

/* ============================================================
   CALL CLAUDE
   ============================================================ */
async function callClaude() {
  try {
    // Graceful notice while the AI backend is not yet wired up.
    if (typeof window.claude === 'undefined' || typeof window.claude?.complete !== 'function') {
      state.messages.push({
        role: 'assistant',
        content: 'The live SIV facilitator is not connected yet — it goes live very soon. Until then, the method itself is described on this page: Socratic, Iterative, Vinay. Read the book or return shortly to run a full session here.'
      });
      state.phase = 'conversation';
      saveState();
      render();
      return;
    }
    const response = await window.claude.complete({
      system: SIV_SYSTEM_PROMPT,
      messages: state.messages,
    });

    // Detect artefact emission
    const artefact = parseArtefact(response);
    if (artefact) {
      state.artefact = artefact;
      state.phase = 'artefact';
    } else {
      state.phase = 'conversation';
    }
    state.messages.push({ role: 'assistant', content: response });
    saveState();
    render();
    // Smooth scroll to keep latest in view
    setTimeout(() => {
      const last = document.querySelector('.siv-turn:last-of-type');
      last?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 100);
  } catch (err) {
    console.error('Claude call failed', err);
    state.phase = 'error';
    saveState();
    render();
  }
}

function parseArtefact(text) {
  const startMarker = '[[SIV_ARTEFACT_START]]';
  const endMarker = '[[SIV_ARTEFACT_END]]';
  const si = text.indexOf(startMarker);
  const ei = text.indexOf(endMarker);
  if (si === -1 || ei === -1 || ei < si) return null;
  const jsonStr = text.slice(si + startMarker.length, ei).trim();
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.warn('Failed to parse artefact JSON', e);
    // Best-effort recovery: try to extract JSON between first { and last }
    const lb = jsonStr.indexOf('{');
    const rb = jsonStr.lastIndexOf('}');
    if (lb !== -1 && rb !== -1) {
      try { return JSON.parse(jsonStr.slice(lb, rb + 1)); } catch (e2) {}
    }
    return null;
  }
}

/* ============================================================
   UTILS
   ============================================================ */
function escapeHTML(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Format AI text — paragraphs, simple bold/italic
function formatAiText(s) {
  const escaped = escapeHTML(s);
  // Split into paragraphs
  return escaped
    .split(/\n\n+/)
    .map(p => {
      // Convert numbered lists (lines starting with "1.", "2." etc.)
      if (/^\s*\d+\.\s/.test(p)) {
        const items = p.split(/\n/).filter(l => l.trim());
        return '<ol>' + items.map(i => `<li>${i.replace(/^\s*\d+\.\s*/, '')}</li>`).join('') + '</ol>';
      }
      // Markdown-light: **bold** and *italic*
      const formatted = p
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br>');
      return `<p>${formatted}</p>`;
    })
    .join('');
}

/* ============================================================
   INIT
   ============================================================ */
function init() {
  loadState();
  render();

  // Smooth scroll-to-conversation when the "Begin" button on the doorway is clicked
  document.querySelectorAll('a[href="#conversation"], a[href="#begin"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const target = document.getElementById('siv-conversation');
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Focus the textarea
        setTimeout(() => {
          document.getElementById('siv-threshold-input')?.focus();
        }, 500);
      }
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
