const principles = [
  { num: "I",   title: "[ principle one ]",   body: "[ A paragraph of two to four sentences explaining this principle — what it means, why you keep it, how you test it. ]" },
  { num: "II",  title: "[ principle two ]",   body: "[ A paragraph of two to four sentences. ]" },
  { num: "III", title: "[ principle three ]", body: "[ A paragraph of two to four sentences. ]" },
  { num: "IV",  title: "[ principle four ]",  body: "[ A paragraph of two to four sentences. ]" },
  { num: "V",   title: "[ principle five ]",  body: "[ A paragraph of two to four sentences. ]" },
];

export default function PhilosophyPage() {
  return (
    <div className="px-6 md:px-10 pt-12 md:pt-16 pb-24">
      {/* Header */}
      <header className="grid grid-cols-12 gap-6 mb-20 md:mb-28 pb-12 border-b border-[var(--color-rule)]">
        <div className="col-span-12 md:col-span-9 md:col-start-2 rise">
          <p className="eyebrow mb-5 text-center md:text-left">№ IV · The Manifesto</p>
          <h1 className="display text-[clamp(2.4rem,8vw,5.5rem)] leading-[0.92] text-center md:text-left">
            [ Manifesto title — <br />
            a bold opening sentence, <br />
            broken across{" "}
            <span className="italic" style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 100" }}>
              three lines
            </span>{" "}
            ]
          </h1>
          <p className="mt-10 max-w-[58ch] mx-auto md:mx-0 text-[1.05rem] italic text-[var(--color-muted)]">
            [ A short preamble — two or three sentences framing the principles
            below. Why these, why now, and how seriously you mean them. ]
          </p>
        </div>
      </header>

      {/* Principles */}
      <ol className="max-w-4xl mx-auto space-y-20">
        {principles.map((p) => (
          <li key={p.num} className="grid grid-cols-12 gap-6 md:gap-10">
            <div className="col-span-12 md:col-span-3">
              <p className="section-num text-7xl md:text-8xl leading-none">
                № {p.num}
              </p>
            </div>
            <div className="col-span-12 md:col-span-9 border-t border-[var(--color-ink)] pt-6">
              <h2 className="display text-2xl md:text-3xl leading-[1.15] mb-5">
                {p.title}
              </h2>
              <p className="max-w-[62ch] text-[1.05rem] leading-[1.7] italic text-[var(--color-muted)]">
                {p.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* Coda */}
      <section className="mt-32 text-center max-w-2xl mx-auto">
        <p className="aster text-3xl mb-6">✦ ✦ ✦</p>
        <p className="display italic text-2xl md:text-3xl leading-snug text-[var(--color-muted)]">
          [ A final two-line coda for the bottom of the page. ]
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
