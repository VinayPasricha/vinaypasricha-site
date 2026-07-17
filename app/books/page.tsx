type Book = {
  title: string;
  author: string;
  note: string;
  rating?: 1 | 2 | 3 | 4 | 5;
};

const reading: Book[] = [
  { title: "[ book title ]", author: "[ author ]", note: "[ a short note about why you’re reading this now ]" },
  { title: "[ book title ]", author: "[ author ]", note: "[ a short note ]" },
];

const altered: Book[] = [
  { title: "[ book title ]", author: "[ author ]", note: "[ one-line note ]", rating: 5 },
  { title: "[ book title ]", author: "[ author ]", note: "[ one-line note ]", rating: 5 },
  { title: "[ book title ]", author: "[ author ]", note: "[ one-line note ]", rating: 4 },
];

const shelf2026: Book[] = [
  { title: "[ book title ]", author: "[ author ]", note: "[ one-line note ]", rating: 4 },
  { title: "[ book title ]", author: "[ author ]", note: "[ one-line note ]", rating: 5 },
];

const unfinished: Book[] = [
  { title: "[ book title ]", author: "[ author ]", note: "[ a short note on why it stalled ]" },
];

function Stars({ n = 5 }: { n?: number }) {
  return (
    <span className="font-mono text-[10px] tracking-[0.3em] text-[var(--color-vermillion)]">
      {"●".repeat(n)}
      <span className="text-[var(--color-muted-soft)]">{"○".repeat(5 - n)}</span>
    </span>
  );
}

function BookRow({ b, rating = true }: { b: Book; rating?: boolean }) {
  return (
    <li className="grid grid-cols-12 gap-3 md:gap-6 items-baseline py-5 border-b border-[var(--color-rule)] group hover:bg-[var(--color-paper-deep)] -mx-3 px-3 transition-colors duration-300">
      <div className="col-span-12 md:col-span-5">
        <p className="font-display text-lg md:text-xl leading-snug italic text-[var(--color-muted)] group-hover:text-[var(--color-ink)] transition-colors duration-300">
          {b.title}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-soft)] mt-1">
          {b.author}
        </p>
      </div>
      <p className="col-span-12 md:col-span-5 italic text-[15px] text-[var(--color-muted-soft)] leading-relaxed">
        {b.note}
      </p>
      <div className="col-span-12 md:col-span-2 md:text-right">
        {rating && b.rating ? <Stars n={b.rating} /> : null}
      </div>
    </li>
  );
}

function Section({ title, eyebrow, books, withRating = true }: { title: string; eyebrow: string; books: Book[]; withRating?: boolean }) {
  return (
    <section className="mb-20">
      <div className="flex items-baseline justify-between gap-6 mb-5">
        <div className="flex items-baseline gap-5">
          <h2 className="display text-3xl md:text-5xl">{title}</h2>
          <span className="eyebrow">{eyebrow}</span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted-soft)]">
          {books.length} vols.
        </span>
      </div>
      <ol className="border-t border-[var(--color-ink)]">
        {books.map((b, i) => (
          <BookRow key={i} b={b} rating={withRating} />
        ))}
      </ol>
    </section>
  );
}

export default function BooksPage() {
  return (
    <div className="px-6 md:px-10 pt-12 md:pt-16 pb-20">
      {/* Header */}
      <header className="grid grid-cols-12 gap-6 mb-16 md:mb-20 pb-10 border-b border-[var(--color-rule)]">
        <div className="col-span-12 md:col-span-8 rise">
          <p className="eyebrow mb-5">№ III · Department of Books</p>
          <h1 className="display text-[clamp(2.2rem,6.5vw,4.5rem)] mb-6">
            [ Page headline — your reading life, on a page ]
          </h1>
          <p className="max-w-[60ch] text-[1.05rem] italic text-[var(--color-muted)]">
            [ Two or three sentences about how you keep this shelf — what
            counts, what doesn’t, and how readers should read it. ]
          </p>
        </div>
        <aside
          className="col-span-12 md:col-span-3 md:col-start-10 md:border-l md:border-[var(--color-rule)] md:pl-6 rise"
          style={{ animationDelay: "0.12s" }}
        >
          <p className="eyebrow mb-3">A Note on Stars</p>
          <p className="font-display italic text-base leading-relaxed text-[var(--color-muted)]">
            [ A short note on what your rating system means — what is five
            stars, what is three, what you do not finish. ]
          </p>
        </aside>
      </header>

      <Section title="Currently inside"        eyebrow="now reading"        books={reading}    withRating={false} />
      <Section title="Books that altered me"   eyebrow="the canon"          books={altered} />
      <Section title="The 2026 shelf"          eyebrow="this year so far"   books={shelf2026} />
      <Section title="Honourably unfinished"   eyebrow="someday, perhaps"   books={unfinished} withRating={false} />

      <section className="mt-24 text-center max-w-xl mx-auto">
        <p className="aster text-2xl mb-4">✦</p>
        <p className="font-display italic text-lg leading-snug text-[var(--color-muted)]">
          [ closing note for the books page ]
        </p>
      </section>
    </div>
  );
}
