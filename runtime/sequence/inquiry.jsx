/* =============================================================
   KAIROS·1 — Sequence Chamber · the inquiry surface
   =============================================================
   Pure UI. The inquiry stream renders runtime/reader turns from
   the sequence's inquiry_log. The composer captures the reader's
   response and hands it back to the chamber orchestrator.

   No AI calls in here — those live in chamber.jsx. This file is
   strictly presentational so the chamber's voice and the
   chamber's chrome are separable.
   ============================================================= */

const { useEffect, useRef, useState } = React;

function InquirySurface({
  turns,
  thinking,
  phase,
  composerLocked,
  resting,
  onSubmit,
  onRest,
  onResume,
  onCloseCycle,
  composerHint,
  composerPlaceholder,
}) {
  const [draft, setDraft] = useState('');
  const streamRef = useRef(null);
  const taRef = useRef(null);
  const submitting = useRef(false);

  // Auto-scroll the stream to the latest turn whenever it grows
  // or the runtime starts thinking.
  useEffect(() => {
    const el = streamRef.current;
    if (!el) return;
    // Use rAF so the new turn is in the DOM before we scroll
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });
  }, [turns.length, thinking]);

  // Auto-grow the textarea
  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(200, ta.scrollHeight) + 'px';
  }, [draft]);

  function handleKey(e) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    }
  }

  function submit() {
    const value = draft.trim();
    if (!value || thinking || composerLocked || submitting.current) return;
    submitting.current = true;
    onSubmit(value);
    setDraft('');
    setTimeout(() => { submitting.current = false; }, 50);
  }

  // Opt/Alt + R to enter rest
  useEffect(() => {
    function onKey(e) {
      if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        if (resting) { onResume && onResume(); }
        else        { onRest && onRest(); }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [resting, onRest, onResume]);

  // Title shifts with phase, so the inquiry rail labels what
  // the chamber is currently doing. The voice stays disciplined.
  const phaseTitle = {
    outcome:    'Defining what is being brought into reality.',
    sequencing: 'Mapping Action 1 → Action N.',
    refining:   'Examining transitions, completion, friction.',
    settled:    'Sequence stable. The chamber observes.',
  }[phase || 'outcome'];

  return (
    <section className="c-inquiry" aria-label="The inquiry">
      <div className="c-inquiry-stream" ref={streamRef}>
        <div className="c-inquiry-eyebrow">— <em>The inquiry</em></div>
        <div className="c-inquiry-title">{phaseTitle}</div>

        {turns.map((t, i) => {
          // The last `settle` turn carries the hybrid-sovereignty
          // affordance. The runtime observes structural stillness;
          // the reader formally decides what to do.
          const isLatestSettle =
            t.role === 'runtime'
            && t.kind === 'settle'
            && i === turns.length - 1;
          return (
            <article
              key={i}
              className="c-turn"
              data-role={t.role}
              data-kind={t.kind || (t.role === 'runtime' ? 'inquiry' : 'response')}
            >
              <div className="c-turn-label">
                {t.role === 'runtime'
                  ? <><em>Runtime</em> · {labelForKind(t.kind)}</>
                  : <>Reader · response</>}
              </div>
              <div className="c-turn-body">{t.content}</div>
              {isLatestSettle && typeof onCloseCycle === 'function' ? (
                <div className="c-cycle-decision" role="group" aria-label="Cycle decision">
                  <button
                    type="button"
                    className="c-cycle-close"
                    onClick={onCloseCycle}
                    aria-label="Close this cycle"
                  >
                    <em>close this cycle</em>
                  </button>
                  <span className="c-cycle-or">· or simply continue probing</span>
                </div>
              ) : null}
            </article>
          );
        })}

        {thinking ? (
          <div className="c-thinking" aria-live="polite">
            <span className="dot"></span><span className="dot"></span>
            <span>the runtime is reading</span>
          </div>
        ) : null}
      </div>

      <div className={'c-composer' + (resting ? ' is-resting' : '')}>
        {resting ? (
          <div className="c-rest-state" onClick={onResume} role="button" tabIndex={0}
               onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onResume && onResume(); }}>
            <div className="c-rest-glyph" aria-hidden="true"></div>
            <div className="c-rest-label">— At rest. The chamber holds.</div>
            <div className="c-rest-hint">Any keystroke or click to resume · ⌥R</div>
          </div>
        ) : (
          <>
            <div className="c-composer-hint">
              <span>— Respond</span>
              <span className="c-composer-actions">
                <button
                  className="c-rest-trigger"
                  type="button"
                  onClick={onRest}
                  disabled={thinking}
                  aria-label="Rest with this"
                  title="Sit with what has surfaced (Alt+R)"
                >rest with this · ⌥R</button>
                <span className="pacing">{composerHint || 'Cmd/Ctrl + Enter to submit'}</span>
              </span>
            </div>
            <div className="c-composer-wrap">
              <textarea
                ref={taRef}
                className="c-textarea"
                placeholder={composerPlaceholder || 'Be specific. The sequence is built from what you say.'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKey}
                disabled={thinking || composerLocked}
                rows={2}
                aria-label="Your response"
              ></textarea>
              <button
                className="c-send"
                onClick={submit}
                disabled={thinking || composerLocked || !draft.trim()}
                aria-label="Submit response"
              >
                Submit <span className="arrow">→</span>
              </button>
            </div>
            {composerLocked && !thinking ? (
              <div className="c-composer-held" aria-live="polite">
                — Sit with this. The composer will release.
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function labelForKind(kind) {
  switch (kind) {
    case 'observation':   return 'observation';
    case 'doctrine-aged': return 'inscription';
    case 'settle':        return 'settling';
    case 'open':          return 'opening';
    case 'inquiry':
    default:              return 'inquiry';
  }
}

window.InquirySurface = InquirySurface;
