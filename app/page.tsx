import Link from "next/link";

const departments = [
  { num: "I",  title: "Writings",   href: "/writings",   blurb: "[ a sentence or two about what writings means to you ]", teaser: "[ teaser line ] →" },
  { num: "II", title: "Projects",   href: "/projects",   blurb: "[ a sentence or two about your projects ]",              teaser: "[ teaser line ] →" },
  { num: "III",title: "Books",      href: "/books",      blurb: "[ a sentence or two about your reading shelf ]",         teaser: "[ teaser line ] →" },
  { num: "IV", title: "Philosophy", href: "/philosophy", blurb: "[ a sentence or two about your philosophy ]",            teaser: "[ teaser line ] →" },
];

const recent = [
  { date: "[ date ]", title: "[ first writing title ]",  reading: "[ N min ]" },
  { date: "[ date ]", title: "[ second writing title ]", reading: "[ N min ]" },
  { date: "[ date ]", title: "[ third writing title ]",  reading: "[ N min ]" },
];

export default function Home() {
  return (
    <div className="px-6 md:px-10 pt-10">
      {/* — Hero spread — */}
      <section className="grid grid-cols-12 gap-x-6 gap-y-10 pb-16 md:pb-24 border-b border-[var(--color-rule)]">
        <div className="col-span-12 md:col-span-7 rise">
          <p className="eyebrow mb-6">№ 0 · Frontispiece</p>
          <h1 className="display text-[clamp(2.6rem,8.5vw,6.5rem)] mb-8">
            [ your headline goes here —{" "}
            <span className="italic" style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 100" }}>
              one bold sentence
            </span>{" "}
            that frames the site ]
          </h1>
          <p className="dropcap dropcap-red max-w-[58ch] text-[1.05rem] md:text-[1.12rem] leading-[1.7] text-[var(--color-muted)] italic">
            [ Opening paragraph. Three or four sentences that explain who you
            are, why this site exists, and what a reader should expect. The
            first letter will become a drop cap. Replace this italic placeholder
            with your own prose when you’re ready. ]
          </p>
        </div>

        <aside
          className="col-span-12 md:col-span-4 md:col-start-9 md:pl-6 md:border-l md:border-[var(--color-rule)] flex flex-col gap-6 rise"
          style={{ animationDelay: "0.15s" }}
        >
          <div>
            <p className="eyebrow mb-3">The Editor</p>
            <p className="font-display text-2xl leading-tight">Vinay Pasricha</p>
            <p className="italic text-[var(--color-muted-soft)] text-sm mt-1">
              [ one-line self-description ]
            </p>
          </div>
          <div>
            <p className="eyebrow mb-3">Currently</p>
            <ul className="text-[15px] leading-relaxed space-y-1 text-[var(--color-muted)]">
              {["building", "reading", "thinking", "avoiding"].map((label) => (
                <li key={label}>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted)] mr-2">
                    {label}
                  </span>
                  <span className="italic">[ … ]</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="text-sm">
            <Link href="/about" className="linkish font-display italic">
              A longer account of the editor →
            </Link>
          </div>
        </aside>
      </section>

      {/* — Pull quote — */}
      <section className="py-20 md:py-28 flex justify-center">
        <figure className="max-w-3xl text-center">
          <p className="display text-[clamp(1.6rem,3.2vw,2.4rem)] italic leading-[1.2] text-[var(--color-muted)]">
            <span className="text-[var(--color-vermillion)] not-italic align-top">“</span>
            [ a line you keep returning to — a working epigraph, your own or
            someone else’s ]
            <span className="text-[var(--color-vermillion)] not-italic">”</span>
          </p>
          <figcaption className="eyebrow mt-5">— [ attribution ]</figcaption>
        </figure>
      </section>

      <hr className="rule-thick" />

      {/* — Departments — */}
      <section className="py-16 md:py-24">
        <div className="flex items-baseline justify-between mb-10">
          <h2 className="display text-3xl md:text-5xl">The Departments</h2>
          <p className="eyebrow hidden md:block">Four rooms · one house</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-12">
          {departments.map((d) => (
            <Link key={d.title} href={d.href} className="group block">
              <article className="grid grid-cols-[auto,1fr] gap-5 md:gap-7 border-t border-[var(--color-rule)] pt-6 transition-colors duration-500 hover:border-[var(--color-ink)]">
                <div className="section-num text-5xl md:text-6xl leading-none -mt-1">
                  № {d.num}
                </div>
                <div>
                  <h3 className="display text-2xl md:text-3xl mb-3 group-hover:text-[var(--color-vermillion)] transition-colors duration-300">
                    {d.title}
                  </h3>
                  <p className="text-[15px] md:text-[16px] max-w-[44ch] italic text-[var(--color-muted)]">
                    {d.blurb}
                  </p>
                  <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--color-muted-soft)] group-hover:text-[var(--color-vermillion)] transition-colors duration-300">
                    {d.teaser}
                  </p>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </section>

      <hr className="rule-thick" />

      {/* — Recent writings — */}
      <section className="py-16 md:py-24">
        <div className="flex items-baseline justify-between mb-10">
          <h2 className="display text-3xl md:text-5xl">
            Recent <span className="italic">dispatches</span>
          </h2>
          <Link href="/writings" className="linkish font-mono text-[11px] uppercase tracking-[0.22em]">
            The complete archive →
          </Link>
        </div>

        <ol className="border-t border-[var(--color-ink)]">
          {recent.map((r, i) => (
            <li key={i}>
              <Link
                href="/writings"
                className="grid grid-cols-[auto,1fr,auto] items-baseline gap-6 py-5 border-b border-[var(--color-rule)] group hover:bg-[var(--color-paper-deep)] transition-colors duration-300 -mx-3 px-3"
              >
                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-muted-soft)] tabular-nums">
                  {r.date}
                </span>
                <span className="font-display text-lg md:text-xl italic text-[var(--color-muted)] group-hover:text-[var(--color-ink)] transition-all duration-300">
                  {r.title}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-muted-soft)] hidden md:inline">
                  {r.reading}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </section>

      {/* — Closing inscription — */}
      <section className="py-20 md:py-28 text-center max-w-2xl mx-auto">
        <p className="aster text-3xl mb-6">✦ ✦ ✦</p>
        <p className="font-display italic text-xl md:text-2xl leading-snug text-[var(--color-muted)]">
          [ closing inscription — a final line that sits at the foot of the page ]
        </p>
        <a
          href="mailto:vinay@goodspace.ai"
          className="inline-block mt-6 linkish font-mono text-[11px] uppercase tracking-[0.22em]"
        >
          vinay@goodspace.ai
        </a>
      </section>
    </div>
  );
}
