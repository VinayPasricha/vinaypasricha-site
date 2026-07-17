# vinay.press

A personal website — a small, slow, stubbornly personal record of writings,
projects, books, and philosophy.

Typeset in **Fraunces**, **Newsreader**, and **JetBrains Mono**.
Built with **Next.js 16** and **Tailwind v4**.

## Local

```bash
npm run dev      # http://localhost:3000
npm run build    # production build
npm start        # serve production build
```

## Structure

```
app/
  layout.tsx        # root shell — fonts, masthead, colophon
  page.tsx          # Frontispiece (home)
  writings/         # essays, notes, letters
  projects/         # things made, on purpose
  books/            # the reading shelf, kept honestly
  philosophy/       # seven things tested and kept
  about/            # the editor, the colophon
components/
  Masthead.tsx      # editorial header + nav
  Colophon.tsx      # footer
```

## Deploy

Push to `main` — Vercel builds automatically.

---

*All errors are mine. Corrections are gifts.*
