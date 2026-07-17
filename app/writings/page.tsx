import Link from "next/link";

type Entry = {
  date: string;
  year: string;
  title: string;
  blurb: string;
  tag: string;
  reading: string;
};

const entries: Entry[] = [
  { year: "[ year ]", date: "[ date ]", title: "[ writing title ]", blurb: "[ one-line description of the piece ]", tag: "[ tag ]", reading: "[ N min ]" },
  { year: "[ year ]", date: "[ date ]", title: "[ writing title ]", blurb: "[ one-line description of the piece ]", tag: "[ tag ]", reading: "[ N min ]" },
  { year: "[ year ]", date: "[ date ]", title: "[ writing title ]", blurb: "[ one-line description of the piece ]", tag: "[ tag ]", reading: "[ N min ]" },
];

const grouped = entries.reduce<Record<string, Entry[]>>((acc, e) => {
  (acc[e.year] ||= []).push(e);
  return acc;
}, {});

export default function WritingsPage() {
  return (
    <div className="px-6 md:px-10 pt-12 md:pt-16 pb-20">
      {/* Header */}
      <header className="grid grid-cols-12 gap-6 mb-16 md:mb-20 pb-10 border-b border-[var(--color-rule)]">
        <div className="col-span-12 md:col-span-8 rise">
          <p className="eyebrow mb-5">№ I · Department of Writings</p>
          <h1 className="display text-[clamp(2.2rem,6.5vw,4.5rem)] mb-6">
            [ Page headline — what is this department about? ]
          </h1>
          <p className="max-w-[60ch] text-[1.05rem] italic text-[var(--color-muted)]">
            [ Two or three sentences introducing your writing — what kinds of
            pieces live here, how often you publish, what a reader should
            expect. ]
          </p>
        </div>
        <aside
          className="col-span-12 md:col-span-3 md:col-start-10 md:border-l md:border-[var(--color-rule)] md:pl-6 rise"
          style={{ animationDelay: "0.15s" }}
        >
          <p className="eyebrow mb-3">House Style</p>
          <p className="font-display italic text-base leading-relaxed text-[var(--color-muted)]">
            [ A short note about your house style — what kinds of pieces, how
            you treat them, what you don’t do. ]
          </p>
        </aside>
      </header>

      {/* Index by year */}
      {Object.entries(grouped).map(([year, items]) => (
        <section key={year} className="mb-20">
          <div className="flex items-baseline gap-6 mb-6">
            <h2 className="display text-5xl md:text-7xl leading-none">
              <span className="text-[var(--color-vermillion)]">{year}</span>
            </h2>
            <p className="eyebrow">{items.length} entries</p>
          </div>
          <ol className="border-t border-[var(--color-ink)]">
            {items.map((e, i) => (
              <li key={i}>
                <Link
                  href="#"
                  className="grid grid-cols-12 gap-4 md:gap-6 items-baseline py-7 border-b border-[var(--color-rule)] group hover:bg-[var(--color-paper-deep)] -mx-3 px-3 transition-colors duration-300"
                >
                  <span className="col-span-3 md:col-span-2 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-muted-soft)] tabular-nums">
                    {e.date}
                  </span>
                  <div className="col-span-9 md:col-span-8">
                    <h3 className="font-display text-xl md:text-2xl leading-snug italic text-[var(--color-muted)] group-hover:text-[var(--color-ink)] transition-all duration-300">
                      {e.title}
                    </h3>
                    <p className="text-[15px] italic text-[var(--color-muted-soft)] mt-2 max-w-[58ch]">
                      {e.blurb}
                    </p>
                  </div>
                  <div className="col-span-12 md:col-span-2 md:text-right">
                    <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-soft)]">
                      {e.tag} · {e.reading}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ))}

      {/* Footnote */}
      <section className="mt-24 text-center max-w-xl mx-auto">
        <p className="aster text-2xl mb-4">✦</p>
        <p className="font-display italic text-lg leading-snug text-[var(--color-muted)]">
          [ closing note for the writings archive ]
        </p>
      </section>
    </div>
  );
}
