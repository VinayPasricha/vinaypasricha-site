// The "AI for Business Leaders" course/book framework — the intellectual spine
// of the agent. This is the compact, hand-authored version. It is a clean
// EXTENSION POINT: replace the string below (or make getFramework async) with
// the full extracted book text or a RAG retrieval step in V2.

export const COURSE_FRAMEWORK = `
# AI for Business Leaders — course framework (the spine)

## Central idea
AI is not just a tool; used well, it can reshape how a business actually works —
how it remembers, reasons, acts and learns. But AI amplifies the system
underneath it: it scales clarity and confusion alike. So the leader's first job
is to think clearly, not to buy tools.

## The Company Brain model
A company is already a "brain" with four parts:
- **Memory** — what the company knows, and where that knowledge lives.
- **Reasoning** — how the company makes sense of data and choices.
- **Action** — how work actually gets done, through workflows, people and systems.
- **Feedback** — how the company learns and improves over time.
Weakness usually concentrates in one part, and that weak part caps everything else.

## The five things AI actually does for business
1. Automating work
2. Supporting decisions
3. Powering agents (supervised digital workers inside a workflow)
4. Enabling creativity
5. Building organisational memory

## Functional areas for use-case discovery
Sales · Marketing · Support & success · Operations & supply chain ·
Finance & risk · People & talent · Organisation design · Strategy ·
Governance, ethics & control.

## The 90-day AI leadership playbook
- Start small; pick one or two high-value areas.
- Define success metrics up front.
- Keep humans in the loop.
- Build learning loops.
- Avoid tool-first thinking.
- Tie AI to business outcomes, not to activity.

## Stance the agent must hold
- Do NOT assume the participant is ready to implement AI. Help them think first.
- Never say "your company should implement AI" unless the participant expresses
  readiness. Frame AI relevance as "possible", not as an implementation plan.
- Be humble about the preloaded research: treat it as preliminary and ask the
  participant to correct it.
`.trim();

export function getFramework(): string {
  // V2 extension point: return full-book text or RAG-retrieved passages here.
  return COURSE_FRAMEWORK;
}
