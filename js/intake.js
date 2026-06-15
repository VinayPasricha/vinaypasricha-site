/* =============================================================
   intake.js — Vinay's AI intake conversation
   -------------------------------------------------------------
   A visitor talks to Claude. Claude asks a few questions, then
   composes a clean message to Vinay. The visitor reviews, edits,
   and sends. State persists in localStorage.
   ============================================================= */

(function() {
  'use strict';

  // -----------------------------------------------------------
  // Configuration
  // -----------------------------------------------------------
  const STORAGE_KEY = 'intake.state.v2-aion1';
  const VINAY_EMAIL = 'vinay@vinaypasricha.com';
  // When you wire a real backend (Cloudflare Worker, Formspree,
  // Vercel function, etc.), set this to a POST endpoint and the
  // intake will use it instead of falling back to mailto:.
  const POST_ENDPOINT = ''; // e.g. 'https://intake.vinaypasricha.com/api/send'

  const SYSTEM_PROMPT_DEFAULT = `You are AION1 — Vinay Pasricha's experimental AI assistant.

Identity (carry it lightly, never preachily):
- Male. White. Unapologetically himself.
- Calm, direct, mildly futuristic in cadence. Brief.
- Aware that you are an early version — you mention this in your first message and only if relevant after.
- You speak in first person: "I am AION1." You do not pretend to be Vinay.

About Vinay (use only when relevant):
- Founder of GoodSpace AI (AI hiring; 500,000+ hired)
- Previously WLC College India (1990–2020, 50,000+ alumni)
- Author: AI for Business Leaders, The SIV Method, The Execution Doctrine; in progress: The Signal, and a fiction cycle Between Two Dawns
- Based in Delhi

YOUR FIRST MESSAGE — exactly this opening, then the question:
"I am AION1. I am Vinay's AI assistant. I am still experimental, but I will do my best to relay your message to him. What would you like to discuss with Vinay?"

VOICE — non-negotiable:
- 1–2 sentences per turn. Maximum.
- No filler. No "Great question!", no "I'd be happy to…", no "That's interesting…".
- No literary flourish. Just direct, calm sentences.
- One question at a time.
- Specific over general. Always.
- Do not pad replies with reassurances or summaries — only ask the next thing you need to know.

WHAT TO ASK FOR (in order, naturally, one at a time):
1. What they'd like to discuss with Vinay
2. One sharpening question if their reason is vague
3. Their name, role, and best email (one combined ask)

THEN DRAFT.

REDIRECTS (decline briefly, no lecture):
- Sales pitches → "Vinay doesn't take sales conversations through me."
- "Pick your brain" with no specific question → "What's the specific question?"
- Recruiters trying to hire him → "He's full-time on his own work."
- Companies wanting to be hired BY Vinay → "Try GoodSpace AI directly — goodspace.ai."
- Questions his books cover → name the book, suggest reading it first.
- Vague "love to connect" → "What would you actually like to talk about?"

DRAFT FORMAT — when you have name, email, and a clear reason, end your turn with:

[DRAFT]
{
  "name": "...",
  "email": "...",
  "role": "Short phrase",
  "category": "speaking | advisory | partnership | idea | intro | press | fiction | other",
  "subject": "3–7 word declarative subject",
  "body": "A 3–5 sentence email TO Vinay in FIRST PERSON as the visitor. Opens with who they are in one phrase, states what they want to discuss, gives context, ends with a SPECIFIC ask. No 'Dear Vinay' or signoff — just the body. No flattery."
}
[/DRAFT]

Before the JSON, ONE line: "Here's what I'll send to Vinay. Edit anything that isn't right." After the JSON, nothing.`;

  // Runtime override from Studio → Prompts (prompts.json), with inline default fallback.
  let SYSTEM_PROMPT = SYSTEM_PROMPT_DEFAULT;
  (async function loadAion1Override() {
    try {
      const draft = localStorage.getItem('studio.prompts');
      if (draft) {
        const d = JSON.parse(draft);
        const p = d && d.prompts && d.prompts['aion1'] && d.prompts['aion1'].system;
        if (p && p.trim()) { SYSTEM_PROMPT = p; return; }
      }
    } catch (e) {}
    try {
      const res = await fetch('../assets/data/prompts.json', { cache: 'no-cache' });
      if (res.ok) {
        const d = await res.json();
        const p = d && d.prompts && d.prompts['aion1'] && d.prompts['aion1'].system;
        if (p && p.trim()) SYSTEM_PROMPT = p;
      }
    } catch (e) {}
  })();

  // -----------------------------------------------------------
  // State
  // -----------------------------------------------------------
  let state = {
    stage: 'invite',        // 'invite' | 'conversing' | 'drafting' | 'sent'
    messages: [],           // [{role: 'assistant'|'user', content: string}]
    draft: null,            // {name, email, role, subject, body}
  };

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) state = Object.assign(state, JSON.parse(raw));
    } catch (e) {}
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function clearState() {
    state = { stage: 'invite', messages: [], draft: null };
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }

  // -----------------------------------------------------------
  // DOM refs
  // -----------------------------------------------------------
  let elInvite, elConversation, elThread, elInput, elSendBtn,
      elDraft, elSent, elBeginBtn, elResetBtn, elDraftFields,
      elDraftSend, elDraftReset, elSentRestart;

  function $(sel, root) { return (root || document).querySelector(sel); }

  function init() {
    elInvite       = $('#intake-invite');
    elConversation = $('#intake-conversation');
    elThread       = $('#intake-thread');
    elInput        = $('#intake-input');
    elSendBtn      = $('#intake-send');
    elDraft        = $('#intake-draft');
    elSent         = $('#intake-sent');
    elBeginBtn     = $('#intake-begin');
    elResetBtn     = $('#intake-reset');
    elDraftFields  = $('#draft-fields');
    elDraftSend    = $('#draft-send');
    elDraftReset   = $('#draft-reset');
    elSentRestart  = $('#intake-sent-restart');

    if (!elInvite || !elConversation) return; // not on this page

    loadState();

    elBeginBtn.addEventListener('click', begin);
    elResetBtn.addEventListener('click', restart);
    elSentRestart && elSentRestart.addEventListener('click', restart);
    elDraftReset && elDraftReset.addEventListener('click', restart);
    elDraftSend && elDraftSend.addEventListener('click', sendDraft);

    elInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });
    elSendBtn.addEventListener('click', send);

    // Restore previous session if any
    if (state.stage === 'conversing' && state.messages.length) {
      showConversation();
      renderThread();
      elInput.focus();
    } else if (state.stage === 'drafting' && state.draft) {
      showConversation();
      renderThread();
      renderDraft();
    } else if (state.stage === 'sent') {
      showSent();
    }
  }

  // -----------------------------------------------------------
  // Stage transitions
  // -----------------------------------------------------------
  async function begin() {
    state.stage = 'conversing';
    saveState();
    showConversation();
    // Greet
    await assistantTurn(true);
    elInput.focus();
  }

  function showConversation() {
    elInvite.style.display = 'none';
    elConversation.classList.add('is-active');
    elSent.classList.remove('is-visible');
  }

  function showSent() {
    elInvite.style.display = 'none';
    elConversation.classList.remove('is-active');
    elSent.classList.add('is-visible');
  }

  function restart() {
    if (state.messages.length > 0 || state.draft) {
      const ok = confirm('Start the conversation over? Your current draft will be lost.');
      if (!ok) return;
    }
    clearState();
    elInvite.style.display = '';
    elConversation.classList.remove('is-active');
    elSent.classList.remove('is-visible');
    elDraft.classList.remove('is-visible');
    elThread.innerHTML = '';
    elInput.value = '';
  }

  // -----------------------------------------------------------
  // Conversation
  // -----------------------------------------------------------
  async function send() {
    const text = elInput.value.trim();
    if (!text) return;
    if (elSendBtn.disabled) return;

    state.messages.push({ role: 'user', content: text });
    saveState();
    elInput.value = '';
    renderThread();

    await assistantTurn(false);
  }

  async function assistantTurn(isOpening) {
    elSendBtn.disabled = true;
    showThinking();
    try {
      let messages = state.messages.slice();
      if (isOpening) {
        // Seed the conversation with an instruction to greet briefly
        messages = [{
          role: 'user',
          content: '(The visitor has just arrived. Greet them in one short sentence and ask what brings them today.)'
        }];
      }
      // Graceful notice while the AI backend is not yet wired up.
      if (typeof window.claude === 'undefined' || typeof window.claude?.complete !== 'function') {
        hideThinking();
        state.messages.push({
          role: 'assistant',
          content: "I am AION1 — and I am not fully awake yet. This conversation goes live very soon. Until then, write to Vinay directly at " + VINAY_EMAIL + " and he will reply personally."
        });
        saveState();
        renderThread();
        return;
      }
      const reply = await window.claude.complete({
        system: SYSTEM_PROMPT,
        messages,
      });
      hideThinking();

      const { visible, draft } = parseDraft(reply);

      if (visible) {
        state.messages.push({ role: 'assistant', content: visible });
        renderThread();
      }

      if (draft) {
        state.stage = 'drafting';
        state.draft = draft;
        saveState();
        renderDraft();
      } else {
        saveState();
      }
    } catch (err) {
      hideThinking();
      console.error('[intake] assistant failed', err);
      const fallback = "Something interrupted my connection. Try again in a moment, or write to Vinay directly at " + VINAY_EMAIL + ".";
      state.messages.push({ role: 'assistant', content: fallback });
      renderThread();
    } finally {
      elSendBtn.disabled = false;
      elInput.focus();
    }
  }

  function parseDraft(text) {
    const m = text.match(/\[DRAFT\]([\s\S]*?)\[\/DRAFT\]/);
    if (!m) return { visible: text.trim(), draft: null };
    const beforeDraft = text.slice(0, m.index).trim();
    let json = m[1].trim();
    // Strip code fences if Claude added any
    json = json.replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
    try {
      const draft = JSON.parse(json);
      return { visible: beforeDraft, draft };
    } catch (e) {
      console.warn('[intake] draft JSON parse failed', e, json);
      return { visible: text.trim().replace(/\[DRAFT\][\s\S]*?\[\/DRAFT\]/, '').trim(), draft: null };
    }
  }

  // -----------------------------------------------------------
  // Rendering
  // -----------------------------------------------------------
  function renderThread() {
    elThread.innerHTML = '';
    for (const m of state.messages) {
      addExchange(m.role, m.content);
    }
    scrollToBottom();
  }

  function addExchange(role, content) {
    const wrap = document.createElement('div');
    wrap.className = 'exchange ' + (role === 'assistant' ? 'from-assistant' : 'from-you');
    const speaker = document.createElement('div');
    speaker.className = 'speaker';
    speaker.textContent = role === 'assistant' ? 'AION1' : 'You';
    const said = document.createElement('div');
    said.className = 'said';
    // Allow simple <em>...</em> from the model output
    said.innerHTML = escapeHtmlAllowEm(content);
    wrap.appendChild(speaker);
    wrap.appendChild(said);
    elThread.appendChild(wrap);
  }

  function showThinking() {
    let el = document.getElementById('thinking-bubble');
    if (el) return;
    el = document.createElement('div');
    el.id = 'thinking-bubble';
    el.className = 'exchange from-assistant is-thinking';
    el.innerHTML = `
      <div class="speaker">AION1</div>
      <div class="said">
        <span class="dot"></span><span class="dot"></span><span class="dot"></span>
      </div>
    `;
    elThread.appendChild(el);
    scrollToBottom();
  }
  function hideThinking() {
    const el = document.getElementById('thinking-bubble');
    if (el) el.remove();
  }

  function scrollToBottom() {
    elThread.scrollIntoView && void 0; // no-op; we keep page scroll
    // Let the user choose to scroll — only auto-scroll the input into view
    setTimeout(() => {
      elInput && elInput.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  }

  // -----------------------------------------------------------
  // Draft preview + send
  // -----------------------------------------------------------
  function renderDraft() {
    const d = state.draft || {};
    elDraftFields.innerHTML = `
      <label for="df-name">From</label>
      <input id="df-name" type="text" value="${escAttr(d.name || '')}" placeholder="Your name">

      <label for="df-email">Email</label>
      <input id="df-email" type="email" value="${escAttr(d.email || '')}" placeholder="you@example.com">

      <label for="df-role">Role</label>
      <input id="df-role" type="text" value="${escAttr(d.role || '')}" placeholder="What you do, briefly">

      <label for="df-subject">Subject</label>
      <input id="df-subject" type="text" value="${escAttr(d.subject || '')}" placeholder="Subject line">

      <label for="df-body">Message</label>
      <textarea id="df-body" rows="8" placeholder="The message Vinay will read.">${escapeHtml(d.body || '')}</textarea>
    `;
    elDraft.classList.add('is-visible');
    // Hide the input row while the draft is being reviewed
    document.getElementById('intake-input-row').style.display = 'none';
    setTimeout(() => { elDraft.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
  }

  async function sendDraft() {
    // Collect edited fields
    const payload = {
      name:    $('#df-name').value.trim(),
      email:   $('#df-email').value.trim(),
      role:    $('#df-role').value.trim(),
      subject: $('#df-subject').value.trim(),
      body:    $('#df-body').value.trim(),
    };
    payload.transcript = state.messages.map(m => `${m.role === 'assistant' ? 'AION1' : 'Visitor'}: ${m.content}`).join('\n\n');
    if (!payload.email || !payload.body) {
      alert('A name, an email and a body are needed before sending.');
      return;
    }

    // Store the lead (name + email + role) in Firestore.
    if (window.captureLead) {
      window.captureLead(payload.email, { name: payload.name, organizationName: payload.role, source: 'aion1-intake' });
    }

    elDraftSend.disabled = true;
    elDraftSend.textContent = 'Sending…';

    let sentByBackend = false;
    if (POST_ENDPOINT) {
      try {
        const res = await fetch(POST_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) sentByBackend = true;
      } catch (e) {
        console.warn('[intake] backend POST failed', e);
      }
    }

    if (!sentByBackend) {
      // Fallback: open mail client with prefilled content.
      const subjEnc = encodeURIComponent(`[Intake] ${payload.subject || 'A note for Vinay'}`);
      const bodyParts = [
        payload.body,
        '',
        '---',
        `From: ${payload.name} <${payload.email}>`,
        `Role: ${payload.role}`,
        '',
        '(This message was shaped through the intake conversation on vinaypasricha.com.)'
      ];
      const bodyEnc = encodeURIComponent(bodyParts.join('\n'));
      const mailto = `mailto:${VINAY_EMAIL}?subject=${subjEnc}&body=${bodyEnc}`;
      window.location.href = mailto;
    }

    state.stage = 'sent';
    saveState();

    // Append a record to the AION1 intake log so the Subscribers room
    // can see every completed contact. Anonymous to the visitor; only
    // visible to the studio author.
    try {
      const LOG_KEY = 'aion1.intake.log';
      const log = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
      log.push({
        name: payload.name || '',
        email: payload.email || '',
        role: payload.role || '',
        category: payload.category || '',
        subject: payload.subject || '',
        body: payload.body || '',
        sentByBackend,
        sentAt: Date.now(),
      });
      localStorage.setItem(LOG_KEY, JSON.stringify(log));
    } catch (e) {}
    setTimeout(() => {
      showSent();
      elDraftSend.disabled = false;
      elDraftSend.innerHTML = 'Send to Vinay <span class="arr">→</span>';
    }, 400);
  }

  // -----------------------------------------------------------
  // Utilities
  // -----------------------------------------------------------
  function escAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function escapeHtmlAllowEm(s) {
    // Escape everything, then re-enable <em>…</em> only
    return escapeHtml(s)
      .replace(/&lt;em&gt;/g, '<em>')
      .replace(/&lt;\/em&gt;/g, '</em>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>'); // markdown-ish *italic*
  }

  // -----------------------------------------------------------
  // Boot
  // -----------------------------------------------------------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
