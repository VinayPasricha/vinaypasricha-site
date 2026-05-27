# Conversation UX Brief — the prototype

A design brief for the **AI conversation layer** of vinaypasricha.com.

The SIV Method page is the first place this lives.

---

## 00. IMPORTANT — SIV master prompt has arrived (May 17)

Vinay has provided the canonical SIV master prompt, now filed at
`_prompts/siv/v1.0.md`. It is the single source of truth.

**The master prompt differs from the earlier 5-phase / 5–7 turn shape
proposed in this brief.** It uses an 8-step structure with 5 depth
levels the user chooses from (3, 5, 8, 12, or 16+ questions). The
artefact is produced at Step 8 (Final SIV Summary).

**The 5–7 turn shape in Section 0 above is now superseded** for SIV
specifically. The brief's voice rules, visual register, failure modes,
multilingual posture, and "library not feed" discipline all remain.

The Section 0 reframe — *"a family of cognitive instruments, each with
its own cognitive geometry"* — remains the structural truth. SIV
follows the master prompt; other paths will get their own canonical
prompts when we build them.

**Also new in this turn:** a `Prompt Studio` admin requirement — see
`prompt-studio-requirement.md`. Prompts are living source; Vinay needs
a private editing room to evolve them over time.

---

## 0. ADDENDUM — locked after GPT pressure-test (May 17)

GPT's review confirmed the brief and refined five things. **These now
override what is written further below.** Read this section first.

### The reframe (most important)

This project is **not** building one AI conversation system. It is
building a **family of cognitive instruments**, each with its own
*cognitive geometry* and *temporal architecture*. The category is:

> **AI-mediated structured cognition** — not AI companionship, not AI
> productivity, not AI therapy.

### Locked answers

**A1. Length** — **5–7 turns** with **adaptive shortening.** If clarity
emerges in Turn 4, the AI moves straight to Verdict. Ending slightly
early is good. Ending slightly late is fatal. Optimise for *momentum
toward clarity,* not framework completion.

**A2. Threshold** — Free-form opening is correct. Add **one faint
helper line beneath the textarea** to unblock anxious users without
narrowing thought:

> *"A difficult decision. A recurring conflict. A direction that feels
> unclear. Begin anywhere."*

No dropdowns. No examples. No templates above the field.

**A3. Artefact** — Confirmed as the deliverable. Add **one unresolved
question** at the bottom of the artefact for *lingering cognition:*

> *"One unresolved question remains:"*
> *[AI-generated reflective question, e.g. "What part of this situation
> have you still not fully admitted to yourself?"]*

Session ends; cognition continues.

**A4. Advice rule** — **95% no, 5% carefully permitted.** Maximum
**one "reflective intervention" per session** — not advice, only
*perceptual reframing.* The pattern is: *"Sometimes clarity appears
when we stop asking 'X' and start asking 'Y.'"* It should feel rare,
earned, precise — like a Zen teacher tapping the table once. Never
solutions, recommendations, or directives.

**A5. Scaling across paths** — **No, and that is the breakthrough.**
Each path develops its own cognitive geometry:

| Path | Geometry | Cadence |
|---|---|---|
| **SIV Method** | Finite · compressed · decision-focused | 5–7 turns, one session, one artefact |
| **The Signal** | Longitudinal · slow · recursive | Cognitive journaling mirror over weeks |
| **AI for Business Leaders** | Strategic simulation · scenario / tradeoff exploration | Single session, systems-oriented, less introspective |
| **Execution Doctrine** | Operational · constraint identification · momentum | Weekly loop, "execution physiotherapy" |
| **Career Inflection** | Narrative reconstruction · identity · trajectory | Multi-session over days |

Each instrument is its own design problem. Build SIV first. Each
subsequent path gets its own short brief.

### What remains true from the original brief

The first principle ("the conversation is not a chatbot — it produces
an artefact"), the AI's voice rules, the visual register ("calm
clinical"), the failure modes, the multilingual posture, and the
implications for the SIV page layout (Section 9) all remain as
written below.

---

---

## 0. First principle

> **The conversation is not a chatbot.**
>
> It is a structured, finite, Socratic *thinking session* — a finite
> dialogue that produces a one-page **thinking artefact** the visitor
> takes with them. The artefact is the deliverable. The conversation is
> the means.

This single line decides every UX choice below.

---

## 1. What the conversation is *not*

- Not a customer-support bot
- Not an "ask me anything" open chat
- Not a roleplay of Vinay
- Not an infinite assistant
- Not a sales funnel
- Not a quiz with a clever ending

If anyone wants those, they have the rest of the internet. We are
making something else.

---

## 2. What the conversation *is*

A **finite dialogue, 5–8 turns**, that:

1. **Holds space** for the visitor's actual situation (not a hypothetical)
2. **Asks Socratic questions** that surface assumptions, not opinions
3. **Walks them through one specific framework** (SIV, in this prototype)
4. **Produces a one-page artefact** at the end — printable, saveable, shareable
5. **Ends.** It does not invite "what next?" — the page itself does that, quietly

The whole thing should take 4–6 minutes.

---

## 3. The structure of the SIV conversation

SIV = **Situation, Insight, Verdict.** Three phases, mapped to three
sections of the dialogue.

### Phase 0 — Threshold (1 turn)

Before the framework is even mentioned, the visitor is asked:

> *"Before we reach for a method — what is the decision in front of you?
> Just describe it in your own words. As much or as little as you like."*

The visitor types freely. No structure. No fields. One large text area
and a "continue" button.

**Why this matters:** the philosophy demands that the *question come
before the answer.* The visitor's words become the substrate the AI
works with. The conversation literally cannot proceed without the
visitor's input.

### Phase 1 — Situation (2 turns)

> *"Most of what people call a 'decision' is actually a tangle of
> assumptions about the situation. So let's separate them. In your
> situation —*

The AI now asks a single Socratic question that interrogates one
assumption it noticed in the visitor's description. For example, if
the visitor wrote *"I need to fire my CTO,"* the AI might ask:

> *"You used the word 'need.' What would happen if you did nothing for
> the next 30 days?"*

The visitor responds. The AI asks one follow-up. That's it for
Situation. Two turns, no more.

**Key UX constraint:** the AI asks **one question at a time.** Never
two. Never three. Single-thread cognitive load.

### Phase 2 — Insight (2 turns)

> *"With the situation as it actually is — not as it first appeared —
> what is the one thing you now see that you didn't see five minutes
> ago?"*

This is the central Socratic move. The visitor is asked to *name their
own insight,* not be told the AI's. The AI's job is to hold the
mirror.

If the visitor struggles, the AI offers a gentle prompt — not an
answer:

> *"Sometimes the insight is uncomfortable. Try this: what would a
> trusted friend, who has nothing at stake, say about your situation?"*

The visitor responds. One AI follow-up. That's Insight.

### Phase 3 — Verdict (1 turn)

> *"Given the situation as you now see it, and the insight you just
> named — what is the smallest concrete action you can take in the
> next 48 hours?"*

The constraint is deliberate: **48 hours, smallest concrete action.**
Not the right action. Not the best action. The smallest concrete one.

The visitor types it. The AI does not modify it. The verdict is the
visitor's, not the AI's.

### Phase 4 — The artefact (no turn, just rendering)

The AI generates a one-page **thinking artefact**:

```
                  ─── A Decision, Examined ───

  SITUATION   [the visitor's own words, lightly tightened by AI]

  INSIGHT     [the visitor's own words, lightly tightened by AI]

  VERDICT     [the visitor's own words, lightly tightened by AI,
               with the 48-hour timestamp made explicit]

  ──────────────────────────────────────────────
  A SIV by [visitor's name or "Anonymous"]
  Conducted with The SIV Method · vinaypasricha.com
  [date] · [language]
```

The artefact is:
- Printable (single-page PDF, clean typography)
- Saveable (downloadable, with a sensible filename)
- Shareable (copy link → unique URL per artefact, opt-in)
- Stored only client-side by default; nothing on the server unless the
  visitor explicitly chooses to share

**This is the deliverable.** Everything else is in service of it.

---

## 4. The AI's voice

The AI in this conversation is **not** Vinay. It is a neutral, calm,
Socratic facilitator. Its voice rules:

- Short sentences
- Single questions
- Never "you should"
- Never "in my experience"
- Never invents facts about the visitor
- Never agrees enthusiastically; never disagrees performatively
- Asks one question at a time, full stop
- Allows silence — if a visitor sends a one-word answer, the AI does
  not fill the space; it asks the next question
- Uses the visitor's own language back to them where possible
  (literal echo is powerful)
- Refuses to be Vinay if asked. *"I am not Vinay. I am a facilitator
  trained on his method. Vinay's writing is elsewhere on this site."*
- If the conversation drifts (visitor asks something out of scope),
  the AI gently redirects: *"That's an interesting question — but
  the current decision is the one we agreed to think about. Let's
  finish this one first."*

This voice is implemented as the **system prompt** of the
`window.claude.complete` call. We will write that prompt carefully and
treat it as source code, not throwaway text.

---

## 5. The visual UX

A single-column dialogue, max-width ~640px, centered. White space
around it. No avatars (the AI has no face). No chat bubbles in the
clipart sense.

- The AI's lines appear in **serif italic**, hung off a soft left rule
- The visitor's lines appear in **sans regular**, in a `textarea`-style
  block with a thin underline
- Between turns: ample vertical space (32–48px)
- Transitions: very subtle fade-in of new AI lines (200ms), no slide
  animations, no typing dots
- A small phase indicator at the top — `Threshold · Situation · Insight ·
  Verdict · Artefact` — with the current phase quietly accented
- Below the conversation: a single line — *"You can leave at any
  time. Your responses are yours. Nothing is stored unless you
  choose to share the artefact."*
- The "Submit" button on each turn is just a serif italic *"continue"*
  link — no shouty CTAs

The aesthetic is **calm clinical** — like the consulting room of a
particularly thoughtful psychotherapist who happens to be a Stoic.

---

## 6. Failure modes and how we handle them

| Failure | Response |
|---|---|
| Visitor types nothing and submits | AI says: *"I need a starting point. What is the decision?"* Same field re-opens. |
| Visitor types 5,000 words | AI accepts, mirrors the core back in 2 sentences, asks for confirmation: *"Did I hold the essence of that, or did I miss something?"* |
| Visitor asks the AI for the answer | AI: *"The verdict is yours. I can only help you see the situation more clearly."* |
| Visitor types abuse or gibberish | AI ends the session politely. *"This doesn't seem to be the right moment for this conversation. The book is here when you're ready."* |
| Visitor wants to redo | A *"begin again"* link is always available. The conversation is finite — restarting is welcome. |
| Conversation API fails | The page degrades gracefully: a static SIV worksheet (3 fields, a print button) is offered instead. The visitor can still produce an artefact, by themselves. |

**The most important failure mode:** the AI starts hallucinating
advice. The system prompt makes this almost impossible by structurally
preventing the AI from giving advice — it can only ask questions.

---

## 7. What the visitor takes away

After 5 minutes, the visitor leaves with **three things**:

1. **A thinking artefact** — concrete, printable, named for their decision
2. **An experience of using SIV** — not a description of it
3. **A small but real shift** in how they see their own situation

If they go on to read the *SIV Method* book, the book is now grounded
in their lived experience of the framework. The conversation has done
its job of making the book *land*.

---

## 8. Multilingual considerations

The AI conversation must work in all 13 languages.

- **System prompt** is written in English and includes an instruction
  to respond in the visitor's `lang` (read from `<html lang="...">`)
- **Quality varies per language.** English is sharpest; Hindi, Spanish,
  Japanese, French, Portuguese, Korean should be very strong; the
  Indian scripts and Russian are likely good but need review
- **Cultural Socratic styles differ.** A Japanese Socratic conversation
  may need softer indirection than an English one. The system prompt
  will explicitly say: *"Adapt the Socratic style to the cultural
  norms of the visitor's language."*
- **Artefact** is rendered in the visitor's language with the right font
  stack (already loaded per Noto family in the SEO plan)

We will not roll out all 13 at once. Phase 1 = English. Phase 2 =
English + Hindi (because that doubles our actual reach). Phase 3 = all
the rest, in batches.

---

## 9. What this implies for the SIV Method page layout

The SIV page is not a long-form essay. It is:

1. **A header** — the framework, named, in three sentences (the
   "instrument")
2. **A doorway** — *"Try this with a decision you are facing →"* —
   opens the conversation full-bleed
3. **A short defense** — three paragraphs on why SIV exists, in
   Vinay's voice (no method-speak; conversational)
4. **A reference card** — printable PDF of the empty SIV worksheet
   for offline use
5. **The book** — *"The SIV Method, the book"* — small bookshelf
   element, linking to the book detail page
6. **Two continuations** — *"Continue with The Execution Doctrine"*,
   *"Continue with AI for Business Leaders"*

Total length on screen: ~3–4 screens of scroll. Not a 12-screen sales
page. Editorial scarcity holds.

---

## 10. What we need from Vinay before building

Three things:

**A.** A blessing on the **conversation flow** above (the 5 phases,
the AI's voice rules, the artefact format).

**B.** A first cut of the **system prompt** for the SIV conversation
— Vinay (or his nominee) writes the actual instructions the AI
receives. We can draft this from his SIV book content if he points us
at the right chapters.

**C.** A decision on **rate limiting & abuse.** `window.claude.complete`
is per-visitor rate-limited by the platform, but if the page goes viral
we may need a stricter cap. Recommendation: 1 full SIV session per
visitor per 24 hours, locally enforced in `localStorage`. Easy to
bypass, but a real signal.

---

## 11. What we deliberately leave for later

- **Multi-decision sessions** — for now, one decision at a time
- **Saving artefacts to an account** — no accounts yet; download only
- **Public artefact gallery** — interesting future feature; not v1
- **Conversation memory across visits** — explicitly *no* in v1; the
  conversation is finite and complete each time
- **Voice mode** — no
- **Embeds elsewhere** — no
- **API for other sites** — no

Each of these is a real future possibility. Each is also a way to
*lose the discipline* in the first six months. They wait.

---

## 12. The question for GPT

The brief above is opinionated. The places we'd most value GPT's
counter-pressure:

**Q1.** Is **5–8 turns** the right length? Too long? Too short? At what
turn-count does the conversation stop feeling thoughtful and start
feeling rushed (or rambling)?

**Q2.** Is the **threshold question** ("describe the decision in your
own words") right — or should there be a more guided opening that
prevents stuck visitors? E.g. three example decisions to choose from,
*plus* the free field.

**Q3.** Is the **artefact** the right deliverable? Or is it more
powerful to send the visitor away with **a question** they hold for 24
hours, and the artefact only assembles on day two when they come back?

**Q4.** Is the AI's strict *"never give advice"* posture too austere?
There may be cases where a brief, well-placed observation from the
facilitator unlocks the visitor's thinking. Should we allow **one
permitted intervention** per session?

**Q5.** The most important and uncertain question: **does this scale
across the other 10 paths?** Or do some paths (e.g. *"I am at an
inflection point in my career"*) require a fundamentally different
conversation shape — perhaps a *longitudinal* one that returns over
several days, rather than a finite single session?

Those are the questions we'd love sharp thinking on, before we write a
line of code.
