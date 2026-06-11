# /library — the manuscripts

This folder holds the **full, plain-text manuscript** of each of Vinay's books, kept here so any page on the site can ground an AI reply in the actual book (not the model's training data) when a reader asks a question.

## Layout

```
library/
  manifest.json                 ← index of all books + where their text lives
  execution-doctrine/
    full-text.txt               ← cleaned manuscript, ~94k chars / 120 pages
  civilization/                 ← Vol. I — "The Compass"
    full-text.txt               ← cleaned manuscript, ~396k chars / 19 chapters
    chapters.json               ← three-part structure + section titles
    jacket.pdf                  ← cover / jacket
    source/                     ← the 19 original typeset HTML chapters
  siv-method/                   ← (pending — upload the PDF)
  organizational-frequency/     ← (pending — upload the PDF)
  …
```

## How to add a new book

1. Drop the print PDF into `uploads/`.
2. Ask Claude to extract it: "Add `<filename>.pdf` to the library for the `<slug>` book."
3. The extracted text goes to `library/<slug>/full-text.txt` and the entry in `manifest.json` is updated.

## How a page uses it

Load `js/library.js`, then:

```js
const book   = await window.library.getBook('execution-doctrine');
const answer = await window.library.ask('execution-doctrine', readerQuestion);
```

`ask()` calls `window.claude.complete` with the manuscript as context and a system prompt that constrains the reply to the book's voice and prevents hallucination.

## Why a separate folder

The book data in `assets/data/books.json` is for the **storefront** (covers, blurbs, Amazon links). This folder is for the **content** — large text bodies kept out of the JSON so the bookshelf page stays light.
