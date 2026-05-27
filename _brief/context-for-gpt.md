# Brief — vinaypasricha.com redesign

A context document for a strategy consult. Capturing the project, the
decisions made so far, the open questions, and the places we are stuck.
Anyone reading this should be able to give us sharp, specific input
without needing to ask 20 follow-ups.

---

## 1. The person

**Vinay Pasricha.** Founder, author, builder. Based in Delhi.

- **1990 → ~2020:** Built and ran **WLC College India**, an institute that
  grew from one rented classroom into a network with **50,000+ alumni**.
  Eventually sold.
- **~2008:** Built **Media Mantra** (media business). Exited.
- **2016 → today:** Founded **GoodSpace AI**, an AI-driven hiring platform.
  **500,000+ people hired** through it so far. This is the active company.
- **Books written:**
  1. **AI for Business Leaders** — published (Amazon).
  2. **The Execution Doctrine** — published.
  3. **The SIV Method** (Situation / Insight / Verdict) — published.
  4. **The Signal** — *upcoming book in progress*, about evolving as a
     person through meaningful conversations with AI.
- **Also runs:** an **AI Leadership Course** (current cohort III), and
  intends to publish a **monthly blog**.

The website must live in **11 languages** — English, Hindi, Bengali,
Tamil, Telugu, Kannada, Spanish, French, Portuguese, Chinese, Korean —
machine-translated at launch, refined over time.

## 2. The current site (what we're replacing)

`vinaypasricha.com` is currently a heavy **3D forest experience** built
with Three.js. It positions Vinay as "Explorer of Emergence," with seven
themed paths (The Human, The Builder, The Thinker, The Technologist,
The Future, The Writer, The Social Being) plus an infinity-marked SIV
Method. Cinematic, beautiful, slow to load, hard to position commercially.

It is being scrapped and redesigned.

## 3. The brief (decided)

After several rounds of questions, this is what we've agreed:

| Decision | Answer |
|---|---|
| **Who is Vinay to this website** | A founder / operator currently building GoodSpace AI |
| **Single primary action** | Visitor reads enough to **buy one of the four books** |
| **Primary audience** | Indian readers first (founders, professionals, MBA students). Global secondary. |
| **Tone** | Plain-spoken, direct — senior founder voice |
| **Aesthetic** | Light & airy, premium, lots of white space |
| **Languages** | All 11, with a real language switcher, machine-translated first |
| **Scope of v1** | Full site — home, life/story, books, course, blog, contact, FAQ |
| **Content source** | Take old copy as base, polish to new tone, paragraph-by-paragraph approval before publishing |

## 4. The architectural shift we made on this turn

Vinay's correction: *"I don't want the homepage to be my CV. I want it to
be **idea-forward and benefit-forward**. The visitor wants to know what's
in it for him. Start a **conversation** with the visitor first."*

So we pivoted to a **triage architecture**:

- The homepage is a **conversation starter**, not a bio.
- It presents **10 standalone landing pages** the visitor can pick from,
  each tuned to a specific visitor intent.
- Each landing page is **independently SEO-indexable** — someone searching
  "AI framework for CEOs" can land on the right page directly from Google.

**The 10 paths (locked):**

| # | Visitor's voice | Destination |
|---|---|---|
| 01 | "Use AI in my business" | *AI for Business Leaders* book |
| 02 | "Make a hard decision" | *The SIV Method* book + framework |
| 03 | "Execute — actually ship" | *The Execution Doctrine* book |
| 04 | "Evolve through AI conversations" | *The Signal* — upcoming book |
| 05 | "Hire great people" | GoodSpace AI for employers |
| 06 | "Find my next job" | GoodSpace AI for candidates |
| 07 | "Talk to Vinay directly" | Speaking / advisory / partnerships |
| 08 | "Stay in the loop" | Monthly blog |
| 09 | "Structured cohort learning" | AI Leadership Course |
| 10 | "Just tell me the story" | The journey / about |

## 5. Where we are stuck (the open questions)

This is the actual reason for this brief — the homepage **hero** is not
landing. We've now tried three versions and none feel right.

### What Vinay has rejected

- ❌ **CV-style hero** ("I build companies in India. And I write about it.")
  Too feature-focused, not benefit-focused. Sounds like a résumé.
- ❌ **Curator question** ("What brought you here today?")
  Too hackneyed, too trite. Sounds like a receptionist.
- ❌ **Vinay's portrait in the hero.** Should be subtle, lower on the page,
  not front and centre.
- ❌ **Boring/usual topbar** with just a brand mark and nav. Wants something
  more imaginative.

### What Vinay wants

> *"I want it to feel like a **thinker and explorer** — not a curator. I
> need it to give the visitor a brief overview of what they can get from
> this site, and then start a conversation with them about who they are
> and what they're seeking."*

### The specific design problems

1. **How does a "thinker and explorer" homepage open?**
   It needs to be idea-forward (not bio-forward) and benefit-forward (not
   feature-forward). It needs to communicate the **scope** of what the
   site offers without listing it like a menu. It needs to invite a
   conversation, not pose a check-in question.

2. **What is the right "first sentence" of the site?**
   We have tried:
   - "I build companies in India. And I write about it." (rejected — CV)
   - "What brought you here today?" (rejected — curator)
   - "We are running our companies on instruments built for another
     century. I've spent 35 years trying to build new ones." (proposed,
     not yet built)
   - "How do you build a company that thinks? How do you make a decision
     when you can't see the whole board? How do you stay human while
     doing both?" (proposed, not yet built)
   - "Most of what looks like genius is compounded patience." (proposed,
     not yet built)
   None of these have been blessed yet.

3. **What is the relationship between the hero and the 10-path triage?**
   Should the hero open with an idea, and the 10 paths appear below as
   the conversation continues? Should the hero **ask the visitor a
   question** that narrows them to one of the 10 paths? Should the 10
   paths be the entire homepage (no separate "hero")?

4. **What is the right topbar for a thinker/explorer site?**
   A standard brand + nav + language switcher feels corporate. Options
   considered: a live "now" status line; a journal-style volume/issue
   number; no topbar at all in the hero (only fades in after scroll).
   None blessed yet.

5. **What is the visual "first impression"?**
   Light & airy with warm ivory and deep ink is the agreed palette. But
   the hero has been blank-page minimal so far. Does a thinker's homepage
   need an artefact — a single line of an essay, a diagram, a quiet
   visual element — to anchor it? Or is white space the right answer?

## 6. References

The current direction is loosely informed by:

- **Stripe Press** — clean, serif, premium book-author energy
- **Maria Popova's The Marginalian** — long, contemplative
- **Edge.org** — provocations, big ideas, no decoration
- **Naval's site (nav.al)** — minimal, quote-led, opinion forward
- **Kevin Kelly** / **Stewart Brand** — explorer/thinker lineage
- **Paul Graham's essays** — direct, idea-forward, plain
- **HBR / The Atlantic** — editorial gravitas
- **Anthropic** — modern technical premium

What it must **not** feel like:
- A LinkedIn profile
- A corporate consulting site
- A flashy AI-startup landing page
- A guru / motivational speaker site

## 7. The specific ask

Given the above, what we'd love your input on:

**A.** A **single sharp opening move for the hero** — the first sentence
or short paragraph the visitor reads. Idea-forward, benefit-forward,
thinker-voice, not corporate. Three to five options would be ideal.

**B.** A **structural recommendation for the homepage** — how does the
opening idea connect to the 10 paths? Is it one continuous flow, or two
discrete sections? Is there a "conversation" mechanism (1–2 short
questions) that routes to the right path, or is the list itself the
conversation?

**C.** A **direction for the topbar / chrome** — something more
imaginative than a corporate header, but still functional (it has to
hold the 11-language switcher and a way to navigate).

**D.** A **point of view on the portrait** — should it appear at all on
the homepage? Where? At what size? Replaced with something else (a
signature, a single-line drawing, a small detail from the office)?

**E.** Anything else you think we should reconsider given who Vinay is,
who his readers are, and what he is selling.

---

*End of brief.*
