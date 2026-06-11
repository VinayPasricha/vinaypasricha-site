# Civilization — Runtime (v1)

A first working conversational layer over the book *Civilization*. A reader
opens `paths/civilization.html`, scrolls to **Ask the book**, and has a
conversation grounded in the actual manuscript — every answer cites the
chapter and section it came from.

This is **v1**. Deliberately small: no accounts, no memory, no analytics, no
agent system.

---

## A. Implementation plan

1. **Index (build-time).** Convert the manuscript into a retrieval index of
   ~450 short chunks, each tagged with `part / chapter / section` for
   citations. Built once from the typeset chapter sources.
2. **Retrieval (client-side).** A lightweight TF-IDF model over the chunks,
   built in the browser. No server, no embeddings, no API keys.
3. **Answer layer.** The top chunks (only those) are sent to
   `window.claude.complete` with a strict, grounded system prompt + guardrails.
4. **UI.** A calm chat panel reusing the site's design tokens — input,
   thread, source citations, starter questions.

## B. Files

**Created**
- `library/civilization/chunks.json` — the retrieval index (≈446 chunks).
- `js/civilization-runtime.js` — index loader + TF-IDF retrieval + grounded
  prompt + `window.civilizationRuntime.ask()`.
- `js/civilization-chat.js` — the DOM controller for the chat UI.
- `css/civilization-runtime.css` — styles (uses existing site tokens).

**Modified**
- `paths/civilization.html` — added the `#ask` section, the CSS link, the two
  scripts, and repointed the doorway CTA to “Ask the book a question”.

**Source of truth (already present)**
- `library/civilization/full-text.txt` — clean manuscript.
- `library/civilization/chapters.json` — three-part structure.
- `library/civilization/source/*.html` — 19 typeset chapters (the index is
  built from these, which is why section titles are exact).

## C. Working v1

Live on the Civilization book page. `window.civilizationRuntime.ask(q)` returns
`{ grounded, answer, sources:[{chapter, section, quote}] }`. The chat UI renders
it with the question, the companion's answer, and "From the book" citations.

## D. How retrieval works

1. **Tokenise** the question → lowercase words, drop stopwords, crude
   singularise.
2. **Score every chunk** = length-normalised TF-IDF over the body
   + a boost when a query term appears in the chapter/section **title**
   + a **section-title match** bonus (Jaccard) so that when a question
     essentially names a section — e.g. *“what are the eight directions”* →
     the section *“The Eight Directions”* — that section wins decisively
   + a small exact-phrase bonus.
3. **Diversify**: at most two chunks per section; keep the top ~7.
4. **Prompt**: those chunks are inserted as numbered EXCERPTS under a system
   prompt that forbids outside knowledge and requires JSON
   `{grounded, answer, used[]}`.
5. **Cite**: the chunks the model says it `used` become the source list; the
   quote is the chunk's most query-relevant sentence (≤180 chars).

If retrieval finds nothing, or the answer layer is unavailable, the runtime
degrades gracefully (a plain "not in the book" message, or the raw passages).

## E. Guardrails (built in)

- Presents itself as **“The Civilization Companion,” not Vinay**.
- Answers **only** from the retrieved manuscript excerpts; no outside knowledge.
- If the book doesn't address it → says so (`grounded:false`), no invention.
- Never invents chapters, sections, quotes, or figures.
- Distinguishes what the book **states** from what it **implies**.
- No personal/legal/medical/financial/policy advice unless grounded in the text.
- Quotes ≤25 words, in quotation marks, only from excerpts.

Verified behaviours: enumerates the eight directions with the correct source;
explains Continuity / possibility space / Rome with citations; declines
"best stock to buy" and "Decoupled Continuity" (not in the book) without
hallucinating.

## F. Known limitations

- **Keyword retrieval only.** TF-IDF misses pure-synonym questions (no
  semantic embeddings yet). Broad "list everything" questions depend on the
  title-match boost.
- **Output cap.** The host caps replies at ~1024 tokens — long answers truncate.
- **No conversation memory.** Each question is answered independently.
- **Index is a build artifact.** If the manuscript changes, `chunks.json`
  must be rebuilt from `source/`.
- **Depends on `window.claude.complete`.** Where unavailable it falls back to
  showing the most relevant passages rather than a composed answer.
- **Citations are chunk-level**, not page-level (the book has no stable page map here).

## G. v2 roadmap

1. **Semantic retrieval** — precompute embeddings for chunks; hybrid
   keyword + vector search for synonym/paraphrase robustness.
2. **Conversation memory** — carry prior turns for follow-ups ("and Rome?").
3. **Cross-book** — generalise the runtime to the whole `/library` (the
   manifest already indexes every book).
4. **Inline citation anchors** — click a source to jump to the passage in a
   reader view.
5. **Server-side answer layer** — move off the artifact host for higher token
   limits, streaming, and rate control.
6. **Light analytics** (opt-in) — which questions readers ask, to shape the book's FAQ.
