import Link from "next/link";

export default function Colophon() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-32 px-6 md:px-10 pb-10">
      <hr className="rule-thick" />

      {/* drifting cento */}
      <div className="overflow-hidden py-5 select-none">
        <div className="drift flex whitespace-nowrap font-display italic text-[var(--color-muted-soft)] text-2xl md:text-3xl">
          {Array.from({ length: 2 }).map((_, i) => (
            <span key={i} className="inline-flex items-center gap-8 pr-8">
              <span>[ word one ]</span>
              <span className="aster">✦</span>
              <span>[ word two ]</span>
              <span className="aster">✦</span>
              <span>[ word three ]</span>
              <span className="aster">✦</span>
              <span>[ word four ]</span>
              <span className="aster">✦</span>
              <span>[ word five ]</span>
              <span className="aster">✦</span>
            </span>
          ))}
        </div>
      </div>

      <hr className="rule" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 font-mono text-[11px] tracking-[0.18em] uppercase text-[var(--color-muted)]">
        <div>
          <p className="text-[var(--color-ink)] mb-2">The Press</p>
          <p>[ colophon line one ]</p>
          <p>[ colophon line two ]</p>
        </div>

        <div>
          <p className="text-[var(--color-ink)] mb-2">Correspondence</p>
          <a
            href="mailto:vinay@goodspace.ai"
            className="linkish lowercase tracking-normal font-display normal-case text-[13px] text-[var(--color-ink)]"
          >
            vinay@goodspace.ai
          </a>
        </div>

        <div className="md:text-right">
          <p className="text-[var(--color-ink)] mb-2">Elsewhere</p>
          <div className="flex md:justify-end gap-4">
            <Link className="linkish" href="/writings">RSS</Link>
            <a className="linkish" href="https://github.com/VinayPasricha" target="_blank" rel="noreferrer">GitHub</a>
            <a className="linkish text-[var(--color-muted-soft)]" href="#">[ X ]</a>
          </div>
        </div>
      </div>

      <hr className="rule mt-8" />

      <p className="pt-4 font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--color-muted-soft)] text-center">
        © {year} Vinay Pasricha · [ footer line ]
      </p>
    </footer>
  );
}
