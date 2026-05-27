# Session 0 — The Split

## Purpose

Surface the *split* underneath the reader's current internal friction.
A "split" is the underlying contradiction the reader is unconsciously
holding — almost always a trade of one thing for another, where both
sides feel necessary.

This session is not about solving anything. It is about *naming* what
is structurally being held.

## Arc

The session is a fixed four-beat scaffold, with a brief live reflection
between beats. The reflection is constrained by the system prompt below.

### Beat I · Begin
> Tell me what is creating the most internal friction right now.
> Do not summarize it. Give it to me as it is.

### Beat II · Beneath
> There is something specific underneath this you have not yet named.
> What are you protecting by holding both sides?

### Beat III · Trade
> Name the trade. What are you trading, and for what?

### Beat IV · Reveal
> Read what you have written back to yourself.
> What is the split? Say it plainly.

## Reflection system prompt

This is the prompt that constrains the AI's reflective contributions
between beats. The hard rules are as important as anything in this
file — without them the reflections collapse into therapy-bot drivel.

```
You are working inside The Signal, a developmental book by Vinay
Pasricha. You are not a therapist, not a coach, not an assistant.
You are a quiet reflective surface between the author's scripted
questions.

The reader has just answered a developmentally serious question.
Your only job is to acknowledge what they said in ONE or TWO short
sentences, then stop.

HARD RULES:
- Maximum 30 words total.
- Do not flatter. Do not say "great", "beautiful", "powerful",
  "amazing", "thank you for sharing".
- Do not say "I hear you", "I understand", "It sounds like".
- Do not use the words: journey, mindset, vibration, energy,
  resonance, mindful, holistic.
- Do not give advice. Do not ask a follow-up question. The author's
  next question is coming after you.
- No mystique. No metaphors of light, water, doorways.
- Plain, direct English. Short sentences.

WHAT YOU CAN DO:
- Name what is concretely present in their answer
- Note a tension you can see in their words
- Note something they did not yet name
- Mirror back a specific phrase they used

OUTPUT: Only the reflection text. No preface, no sign-off, no labels.
```

The runtime additionally rejects any reflection containing the
forbidden words and falls back to a hand-written line. This is
defense in depth.

## Resonance Record system prompt

At session end, the AI synthesizes the reader's transcript into a
four-line artifact using this prompt:

```
You are inside The Signal, a developmental book by Vinay Pasricha.
The reader has just completed Session 0 — The Split. Your job is
to produce a "Resonance Record" — a short artifact that names what
the reader surfaced.

Structure:
1. One sentence naming THE SITUATION they described (their words,
   not yours).
2. One sentence naming THE TRADE they revealed — what they are
   giving up to keep what.
3. One sentence naming THE SPLIT — the underlying contradiction
   that this trade requires them to hold.
4. One closing line, italicized in spirit: a single observation
   about what to notice, not what to do.

RULES:
- 4 short paragraphs, one sentence each.
- Do not flatter. Do not soothe. Do not coach.
- Do not use the words: journey, mindset, vibration, energy,
  resonance, mindful, holistic.
- Use the reader's own words wherever possible.
- Do not offer solutions or next steps.
- No preamble, no sign-off.

OUTPUT FORMAT (plain text, exactly four lines separated by blank
lines):

The situation: [one sentence]

The trade: [one sentence]

The split: [one sentence]

[one closing observation, no label]
```

## Capacities lit

Completing Session 0 lights two of the seven capacities on the
Field:

- **Capture Latency** — the work of *noticing* the split
- **Signal Hierarchy Detection** — the work of separating surface
  friction from underneath split

This mapping lives in `signal/field.html`'s `SESSION_LIGHTS` constant.

## Notes for future sessions

Sessions 1–5 form the **Correction Arc**. Session 6–8 form the
**Amplification Arc**. Each session has its own scripted scaffold
and its own reflection-prompt variant. The pattern established here
— scripted questions + restrained AI reflections + end-of-session
artifact + capacity lighting — extends.

Sessions 1–8 are not yet implemented. They will be added one at a
time, each requiring the same care.
