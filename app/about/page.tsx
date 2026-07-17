import Link from "next/link";

const timeline = [
  { year: "[ year ]", what: "[ one-line description of this year ]" },
  { year: "[ year ]", what: "[ one-line description of this year ]" },
  { year: "[ year ]", what: "[ one-line description of this year ]" },
];

export default function AboutPage() {
  return (
    <div className="px-6 md:px-10 pt-12 md:pt-16 pb-24">
      <header className="grid grid-cols-12 gap-6 mb-16 pb-10 border-b border-[var(--color-rule)]">
        <div className="col-span-12 md:col-span-9 rise">
          <p className="eyebrow mb-5">№ V · The Colophon</p>
          <h1 className="display text-[clamp(2.2rem,6.5vw,4.6rem)] mb-6">
            About the <span className="italic">editor.</span>
          </h1>
          <p className="max-w-[60ch] text-[1.05rem] italic text-[var(--color-muted)]">
            [ A short framing line — one sentence explaining what this page is. ]
          </p>
        </div>
      </header>

      <section className="grid grid-cols-12 gap-x-8 gap-y-10 mb-24">
        <article className="col-span-12 md:col-span-8 md:col-start-2 max-w-[62ch]">
          <p className="dropcap dropcap-red text-[1.1rem] leading-[1.75] italic text-[var(--color-muted)]">
            [ Opening paragraph in the third or first person — who you are,
            what you do, where you’re from. The first letter becomes a drop cap. ]
          </p>

          <p className="mt-6 text-[1.05rem] leading-[1.75] italic text-[var(--color-muted)]">
            [ Second paragraph — why you write, why you build, why you read. ]
          </p>

          <p className="mt-6 text-[1.05rem] leading-[1.75] italic text-[var(--color-muted)]">
            [ Third paragraph — why this site exists, and what it is not. ]
          </p>

          <p className="mt-6 text-[1.05rem] leading-[1.75] italic text-[var(--color-muted)]">
            [ Final paragraph — small personal details. Where you live, what
            you carry around, what you’ve recently changed your mind about. ]
          </p>
        </article>

        <aside className="col-span-12 md:col-span-3 md:col-start-10 md:border-l md:border-[var(--color-rule)] md:pl-6">
          <p className="eyebrow mb-4">Identification</p>
          <dl className="space-y-3 text-[14px]">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-soft)]">role</dt>
              <dd className="italic">[ your role ]</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-soft)]">city</dt>
              <dd className="italic">[ city ]</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-soft)]">letters</dt>
              <dd>
                <a className="linkish" href="mailto:vinay@goodspace.ai">vinay@goodspace.ai</a>
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--color-muted-soft)]">elsewhere</dt>
              <dd className="flex gap-3">
                <a className="linkish" href="https://github.com/VinayPasricha" target="_blank" rel="noreferrer">GitHub</a>
                <a className="linkish text-[var(--color-muted-soft)]" href="#">[ link ]</a>
              </dd>
            </div>
          </dl>
        </aside>
      </section>

      {/* Timeline */}
      <section className="mb-24">
        <div className="flex items-baseline gap-5 mb-8">
          <h2 className="display text-3xl md:text-5xl">A short chronology</h2>
          <span className="eyebrow">selected years</span>
        </div>
        <ol className="border-t border-[var(--color-ink)]">
          {timeline.map((t, i) => (
            <li
              key={i}
              className="grid grid-cols-[auto,1fr] gap-6 md:gap-10 items-baseline py-5 border-b border-[var(--color-rule)]"
            >
              <span className="font-display text-3xl md:text-4xl text-[var(--color-vermillion)] leading-none">
                {t.year}
              </span>
              <p className="font-display italic text-lg md:text-xl text-[var(--color-muted)]">
                {t.what}
              </p>
            </li>
          ))}
        </ol>
      </section>

      {/* Colophon proper */}
      <section className="grid grid-cols-12 gap-6 mb-16">
        <div className="col-span-12 md:col-span-8">
          <h2 className="display text-3xl md:text-4xl mb-5">
            About this <span className="italic">edition.</span>
          </h2>
          <p className="max-w-[60ch] text-[1.02rem] leading-[1.7] text-[var(--color-muted)]">
            Typeset in{" "}
            <span className="font-display italic">Fraunces</span> (display),{" "}
            <span className="font-display italic">Newsreader</span> (body), and{" "}
            <span className="font-mono">JetBrains Mono</span> (marginalia). Built
            with Next.js and Tailwind. The grain is real noise, generated on
            the page each load — a small, deliberate imperfection.
          </p>
        </div>
        <div className="col-span-12 md:col-span-3 md:col-start-10">
          <p className="eyebrow mb-3">Press marks</p>
          <p className="font-display italic leading-relaxed text-[var(--color-muted)]">
            [ short press credo — three lines, broken across line breaks ]
          </p>
        </div>
      </section>

      <section className="mt-20 text-center max-w-xl mx-auto">
        <Link href="/" className="linkish font-mono text-[11px] uppercase tracking-[0.22em]">
          ← Return to the Frontispiece
        </Link>
      </section>
    </div>
  );
}
