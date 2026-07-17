"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/writings", label: "Writings" },
  { href: "/projects", label: "Projects" },
  { href: "/books", label: "Books" },
  { href: "/philosophy", label: "Philosophy" },
  { href: "/about", label: "Colophon" },
];

function todayLine() {
  const d = new Date();
  const fmt = d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return fmt;
}

function issueNumber() {
  // Anchor an "issue" cadence so the number changes meaningfully.
  // Treat each fortnight since 2025-01-01 as one issue.
  const start = new Date("2025-01-01T00:00:00Z").getTime();
  const now = Date.now();
  const fortnights = Math.max(1, Math.floor((now - start) / (1000 * 60 * 60 * 24 * 14)) + 1);
  return fortnights.toString().padStart(3, "0");
}

const roman = (n: number) => {
  const map: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"],
    [100, "C"], [90, "XC"], [50, "L"], [40, "XL"],
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  let r = n;
  for (const [v, s] of map) {
    while (r >= v) { out += s; r -= v; }
  }
  return out;
};

export default function Masthead() {
  const pathname = usePathname();
  const issue = issueNumber();
  return (
    <header className="px-6 md:px-10 pt-6 md:pt-8">
      {/* Top meta strip */}
      <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.22em] uppercase text-[var(--color-muted)]">
        <span>{todayLine()}</span>
        <span className="hidden md:inline">Bound in Paper, Ink, &amp; Pixels</span>
        <span>No. {issue} · Vol. {roman(new Date().getFullYear() - 2024)}</span>
      </div>

      <hr className="rule mt-3" />

      {/* Title block */}
      <div className="masthead-grid pt-5 pb-4">
        <div className="hidden md:block font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted-soft)] leading-relaxed">
          <p className="italic font-display text-[13px] tracking-normal normal-case">
            [ epigraph — <br /> a short line about <br /> this site ]
          </p>
        </div>

        <Link href="/" className="block text-center group">
          <div className="display text-[clamp(2.6rem,7vw,5rem)] leading-none">
            Vinay Pasricha
          </div>
          <div className="font-display italic text-[var(--color-muted-soft)] text-sm md:text-base mt-2 tracking-wide">
            [ tagline ]
          </div>
        </Link>

        <div className="hidden md:block text-right font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--color-muted-soft)] leading-relaxed">
          <p>[ founded MMXXV ]</p>
          <p>[ city · the internet ]</p>
          <p>[ subtitle ]</p>
        </div>
      </div>

      <hr className="rule-thick" />

      {/* Nav */}
      <nav className="flex flex-wrap items-center justify-center gap-x-7 gap-y-2 py-4 font-mono text-[11px] tracking-[0.22em] uppercase">
        <Link
          href="/"
          aria-current={pathname === "/" ? "page" : undefined}
          className="nav-link"
        >
          Frontispiece
        </Link>
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname.startsWith(item.href) ? "page" : undefined}
            className="nav-link"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <hr className="rule" />
    </header>
  );
}
