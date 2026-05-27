# Interaction Architecture — the next phase

Captured from GPT's strategy reply on May 17. This document is the
*cognitive choreography* layer of the project — separate from the
philosophy (`operating-principles.md`) and the indexing plan
(`seo-and-i18n-plan.md`).

Seven design questions, each pointing at a future capability of the
ecosystem. Most are not built now. But every page we build today must
be **compatible** with these directions — so we don't paint ourselves
into a corner.

---

## 1. The Return Loop — why people come back

The hard problem. *Not* optimising dopamine. Optimising **cognitive
renewal.** Candidates for the recurring mechanism:

- A **Question of the Month** posted in the NOW layer
- An evolving **Frameworks** page that quietly grows
- The monthly blog (already planned)
- A **public notebook** of current obsessions
- A "what I'm reading" annotated stack
- A *single* civilisation-scale question being worked over many months

**My take:** the monthly blog is necessary but insufficient. A blog is a
feed. The **public notebook** + **question of the month** are more
aligned with the philosophy because they encourage thinking *with*
rather than consuming.

**Action now:** keep the NOW rotator simple and expressive on the
homepage. Plan a `/now` page later that is the full public notebook.
Do not build it this turn.

## 2. AI Conversation UX — the future moat

The conversations are the engine. Each book is a portal *into* an AI
conversation. Open design questions:

- One question at a time? Or open-ended?
- Does it challenge assumptions or merely answer them?
- Does it remember between sessions?
- Does it produce a map or framework at the end?
- Socratic? Clinical? Exploratory?

**My take:** the right opening posture is **Socratic + exploratory**.
The AI asks the visitor a question first — *"What problem brought you
here?"* — and only then proposes a frame. It produces a one-page
summary at the end (a printable "thinking artefact") that the visitor
can keep.

**Action now:** the SIV Method page will be the first to actually have
an AI conversation. Designing its UX is the most important decision of
the next phase. Treat the SIV page as the *prototype* for all
conversation pages.

## 3. The NOW Layer — public cognition in motion

The rotator is a seed. Over time:

- A small `/now` page (à la Derek Sivers' nownownow.com but
  intellectually serious)
- Current obsessions
- Active questions
- Books being read
- Experiments in progress
- Frameworks evolving

**My take:** the topbar rotator should pull from a single
`now.json` file. When we have a `/now` page, the rotator and the
page share the same source. The whole site has a heartbeat.

**Action now:** factor the rotator content out into a small data file
so it's editable without touching HTML.

## 4. The Transformation Arc — multi-year evolution

Not gamification. But **progressive deepening** — frameworks building
on frameworks, conversations getting denser over time. Without this
the site risks being intellectually interesting but directionless.

**My take:** this is largely a *content* problem, not a *design*
problem. Solved by editorial discipline (Section 5 below). The site
doesn't need a "level" UI; it needs a few visible "if you have walked
this path, here is the next one" links between pages.

**Action now:** every inner page ends with two or three quiet
suggestions for "the next path." Not a recommendation algorithm. A
human-curated next step.

## 5. Signal-to-noise — editorial scarcity

> *Library, not feed.*

The biggest long-term risk: content inflation. Too many essays, too
many products, too many ideas, too much cleverness.

**My take:** this is **already** how we are building. The home
page has eleven paths and stops. The monthly blog is *monthly*. The
books are four. The discipline is in the structure of the project,
not just in what we publish.

**Action now:** never let the homepage grow more than ~12 quiet
sections. Never put a "what's new" carousel on it. Every new feature
must replace an old one or be put on its own dedicated path.

## 6. The Map of Ideas — interconnected topology

A future signature feature. Essays linked to books linked to
conversations linked to frameworks linked to questions linked to other
thinkers — a navigable cognitive landscape.

**My take:** build the *graph* in our data structure from day one,
even if we don't visualise it yet. Each page declares its **concepts**
(small list of tags), its **prerequisites** (other pages that ground
it), and its **continuations** (where to go next). After ~20 pages
exist, we can render that graph as a real map.

**Action now:** every page's front-matter (in HTML `<meta>` blocks)
declares `concepts`, `prerequisites`, `continuations`. The map is
data first; visual later.

## 7. Asymptotic direction — what this becomes in 20 years

GPT's framing: great systems are shaped by their **asymptotic
direction.** Candidates:

- A school
- A digital monastery
- A civilization lab
- A cognitive institute
- A global intellectual network
- An AI-human collaborative research environment

**My take:** the closest analog is probably **a civilization lab** —
public-facing on top, with deep research and AI experiments beneath.
Not a school (too one-directional). Not a monastery (too closed). Not
a network (too distributed). A *lab* preserves the calm-but-active
register, has room for both publication and experimentation, and
explicitly puts the **questions before the answers** — exactly the
register the operating principles demand.

**Action now:** the homepage already says "observatory · laboratory ·
notebook." Lean into *laboratory* as the dominant frame as the site
matures. The forthcoming `/labs/` section (later) is where active
experiments live.

---

## What this means for the immediate next build (SIV Method page)

The SIV Method page is the first one we will build under these
principles. Concretely, it should:

1. **Open** with the *question* the visitor is bringing, not with
   the framework. ("There is a decision in front of you. Before we
   reach for a method — what is the decision?")
2. **Present** SIV as a *small instrument*, not a doctrine. Three
   sentences, lots of white space. No buzzwords.
3. **Invite** the visitor into a brief AI conversation that walks them
   through SIV applied to *their* decision — produces a one-page
   thinking artefact they can save.
4. **End** with two quiet continuations: *"Continue with The
   Execution Doctrine"* and *"Continue with AI for Business
   Leaders"* — not a CTA wall.
5. **Declare** concepts (`decision-making`, `frameworks-of-thinking`,
   `cognitive-tools`), prerequisites (none — SIV is foundational),
   continuations (`execute`, `ai-for-business`).
6. **Index** in all 13 languages with locally-researched keywords as
   per the SEO plan.

That is the prototype. Once it is good, every other inner page
inherits the pattern.
