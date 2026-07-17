"use client";
import Markdown from "@/components/abl/Markdown";

// Shared chat bubble for the VED / SIV tools.
export function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const mine = role === "user";
  return (
    <div className={mine ? "flex justify-end" : "flex justify-start"}>
      <div className={`max-w-[85%] rounded-lg px-4 py-3 ${mine ? "bg-ink text-paper" : "bg-white/70 border border-rule text-ink"}`}>
        {mine ? <p className="whitespace-pre-line">{content}</p> : <Markdown>{content}</Markdown>}
      </div>
    </div>
  );
}

// Understated "go deeper" book card — shown only after a report is generated, so it feels earned.
export function BookCard({ title, line, href }: { title: string; line: string; href: string }) {
  return (
    <div className="mt-6 rounded-lg border border-rule bg-white/40 p-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <div className="font-display text-base">{title}</div>
        <p className="text-sm text-muted mt-0.5">{line}</p>
      </div>
      <a href={href} target="_blank" rel="noopener noreferrer"
        className="rounded-md border border-vermillion text-vermillion px-4 py-2 text-sm font-mono shrink-0 hover:bg-vermillion hover:text-paper transition">
        Buy on Amazon ↗
      </a>
    </div>
  );
}
