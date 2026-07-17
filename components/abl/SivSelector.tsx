"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, pdfUrl } from "@/lib/abl/paths";
import { SIV_COPY, SIV_DEPTHS } from "@/lib/abl/siv";
import type { SivDepth } from "@/lib/abl/siv";
import Markdown from "@/components/abl/Markdown";
import { Bubble, BookCard } from "@/components/abl/ToolBits";

type Msg = { role: "user" | "assistant"; content: string };
interface SivState {
  started: boolean;
  depth: SivDepth | null;
  message_count: number;
  max_messages: number;
  messages: Msg[];
  report: { id: string; markdown: string } | null;
}

export default function SivSelector({ slug, open: openProp, onToggle }: { slug: string; open?: boolean; onToggle?: () => void }) {
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp !== undefined ? openProp : openInternal;
  const toggle = onToggle ?? (() => setOpenInternal((o) => !o));

  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState<"intro" | "chat" | "report">("intro");
  const [chosen, setChosen] = useState<SivDepth>("standard");
  const [depth, setDepth] = useState<SivDepth | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [report, setReport] = useState<SivState["report"]>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState("");
  const [limited, setLimited] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const r = await apiFetch<SivState>(`/session/${slug}/siv`);
      if (r.ok && r.data) {
        const d = r.data;
        setMessages(d.messages || []); setDepth(d.depth); setReport(d.report);
        if (d.depth) setChosen(d.depth);
        setView(d.report ? "report" : d.started ? "chat" : "intro");
      }
      setLoaded(true);
    })();
  }, [slug]);

  useEffect(() => { if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy, open]);

  const start = useCallback(async () => {
    setBusy(true); setErr("");
    try {
      const r = await apiFetch(`/session/${slug}/siv`, { method: "POST", body: JSON.stringify({ depth: chosen }) });
      if (r.ok) { setDepth(chosen); setView("chat"); } else setErr(r.error || "Could not start the selector.");
    } finally { setBusy(false); }
  }, [slug, chosen]);

  const send = useCallback(async () => {
    const msg = input.trim();
    if (!msg || busy) return;
    setInput(""); setErr("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setBusy(true);
    try {
      const r = await apiFetch<{ reply: string }>(`/session/${slug}/siv/message`, { method: "POST", body: JSON.stringify({ message: msg }) });
      if (r.ok && r.data) setMessages((m) => [...m, { role: "assistant", content: r.data!.reply }]);
      else if (r.status === 429) { setLimited(true); setMessages((m) => m.slice(0, -1)); }
      else setMessages((m) => [...m, { role: "assistant", content: `⚠ ${r.error || "Something went wrong — your work is saved. Please try again."}` }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "⚠ Network error — your work is saved. Please try again." }]);
    } finally { setBusy(false); }
  }, [input, busy, slug]);

  const generate = useCallback(async () => {
    setGenerating(true); setErr("");
    try {
      const r = await apiFetch<{ report: { id: string; markdown: string } }>(`/session/${slug}/siv/report`, { method: "POST" });
      if (r.ok && r.data) { setReport(r.data.report); setView("report"); }
      else setErr(r.error || "Could not generate the report.");
    } catch { setErr("Network error while generating the report. Please try again."); }
    finally { setGenerating(false); }
  }, [slug]);

  if (!loaded) return null;

  return (
    <section id="siv" className="mt-6 rounded-xl border border-rule bg-paper-deep/30 p-5 sm:p-6 scroll-mt-6">
      <button onClick={toggle} className="flex w-full items-start justify-between gap-4 text-left">
        <div>
          <div className="font-mono text-[11px] tracking-widest uppercase text-vermillion">{SIV_COPY.eyebrow}</div>
          <h2 className="font-display text-xl sm:text-2xl mt-1">{SIV_COPY.card.title}</h2>
          <p className="text-sm text-muted mt-1">{SIV_COPY.card.tagline}</p>
        </div>
        <span className="font-mono text-xs text-muted mt-1 shrink-0">{open ? "hide ▲" : (report ? "view ▾" : "open ▾")}</span>
      </button>

      {open && (
        <div className="mt-5">
          {limited && <LimitNote />}
          {view === "intro" && (
            <div>
              <p className="text-ink/90 leading-relaxed">{SIV_COPY.intro}</p>
              <h3 className="font-display text-lg mt-6 mb-3">Choose your depth</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                {SIV_DEPTHS.map((d) => (
                  <button key={d.id} onClick={() => setChosen(d.id)}
                    className={`text-left rounded-lg border p-4 transition bg-white/40 ${chosen === d.id ? "border-vermillion shadow-sm" : "border-rule hover:border-vermillion/60"}`}>
                    <div className="flex items-center justify-between">
                      <div className="font-mono text-[11px] tracking-widest uppercase text-vermillion">{d.minutes}</div>
                      {d.recommended && <span className="font-mono text-[9px] uppercase tracking-wider text-ink/60 bg-paper-deep px-1.5 py-0.5 rounded">Recommended</span>}
                    </div>
                    <div className="font-display text-base mt-1">{d.title}</div>
                    <p className="text-xs text-muted mt-1.5">{d.blurb}</p>
                    <div className="mt-2 text-[11px] font-mono text-ink/70">{d.lensCount} lenses</div>
                  </button>
                ))}
              </div>
              {err && <p className="text-xs text-vermillion mt-3">{err}</p>}
              <button onClick={start} disabled={busy} className="mt-5 rounded-md bg-ink text-paper px-5 py-2.5 text-sm disabled:opacity-50">
                {busy ? "Starting…" : `${SIV_COPY.card.button} →`}
              </button>
            </div>
          )}

          {view === "chat" && (
            <div>
              <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
                {messages.length === 0 && (
                  <p className="text-sm text-muted">Name the 2–5 areas where you are considering AI — or ask the selector to propose likely areas from your company context and your execution constraint.</p>
                )}
                {messages.map((m, i) => <Bubble key={i} role={m.role} content={m.content} />)}
                {busy && <div className="text-muted text-sm font-mono">examining…</div>}
                <div ref={bottomRef} />
              </div>
              {err && <p className="text-xs text-vermillion mt-2">{err}</p>}
              <div className="mt-4">
                <textarea value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
                  placeholder="Type your reply…  (⌘/Ctrl + Enter to send)" rows={3} disabled={busy || generating}
                  className="w-full rounded-md border border-rule bg-white/60 p-3 text-ink focus:border-vermillion focus:outline-none disabled:opacity-50" />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <button onClick={generate} disabled={generating || busy || messages.length < 2}
                    className="text-sm font-mono text-vermillion disabled:opacity-40">
                    {generating ? "Preparing your decision report…" : "Generate my First AI Project decision →"}
                  </button>
                  <button onClick={send} disabled={busy || generating || !input.trim()}
                    className="rounded-md bg-ink text-paper px-5 py-2 text-sm disabled:opacity-40">Send</button>
                </div>
                <div className="mt-1 text-[11px] font-mono text-muted">{SIV_DEPTHS.find((d) => d.id === depth)?.title ?? "SIV"}</div>
              </div>
            </div>
          )}

          {view === "report" && report && (
            <div>
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-display text-lg">{SIV_COPY.reportTitle}</h3>
                <a href={pdfUrl(report.id, slug)} className="text-sm font-mono text-vermillion shrink-0">Download Decision Report ↓</a>
              </div>
              <div className="mt-3 rounded-lg border border-rule bg-white/60 p-5"><Markdown>{report.markdown}</Markdown></div>
              <div className="mt-4 flex flex-wrap gap-4">
                <a href="#ai-journey" className="text-sm font-mono text-vermillion">Refine your course profile for Vinay →</a>
                <button onClick={() => setView("chat")} className="text-sm font-mono text-muted">← Continue the examination</button>
                <button onClick={generate} disabled={generating} className="text-sm font-mono text-muted disabled:opacity-40">{generating ? "Regenerating…" : "Regenerate"}</button>
              </div>
              <BookCard title={SIV_COPY.book.title} line={SIV_COPY.book.line} href={SIV_COPY.book.href} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function LimitNote() {
  return (
    <div className="mb-4 rounded-md border border-rule bg-white/60 p-3 text-sm text-ink">
      You have used your included course AI allowance. This is not a problem — please message the course admin and we can extend access where needed.
    </div>
  );
}
