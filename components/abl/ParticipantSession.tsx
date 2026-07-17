"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, pdfUrl } from "@/lib/abl/paths";
import { OPENING_COPY, PRIVACY_NOTICE, PROGRESS_STEPS } from "@/lib/abl/copy";
import { DEPTHS } from "@/lib/abl/types";
import type { Depth } from "@/lib/abl/types";
import { SIV_COPY } from "@/lib/abl/siv";
import { VED_COPY } from "@/lib/abl/ved";
import Markdown from "@/components/abl/Markdown";
import SivSelector from "@/components/abl/SivSelector";
import VedSelector from "@/components/abl/VedSelector";

type Msg = { role: "user" | "assistant"; content: string };
interface Loaded {
  participant: { name: string; company_name: string; role_title: string | null; current_stage: string | null; message_count: number; max_messages: number };
  session: { selected_depth: Depth | null; consent_given: boolean; current_stage: string | null; summary_reviewed: boolean };
  messages: (Msg & { at: string })[];
  reward: { id: string; type: string; markdown: string } | null;
  share: { id: string; markdown: string; approved: boolean } | null;
}

const REWARD_TITLES: Record<string, string> = {
  course_preparation_brief: "Course Preparation Brief",
  use_case_map: "AI Opportunity & Use-Case Map",
  strategy_note: "Personalised AI Strategy Note + 90-Day Direction",
};

type Tool = "ved" | "siv" | null;

export default function ParticipantSession({ slug }: { slug: string }) {
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [errMsg, setErrMsg] = useState("");
  const [data, setData] = useState<Loaded | null>(null);
  const [consent, setConsent] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"welcome" | "chat" | "review" | "done">("welcome");
  const [reward, setReward] = useState<Loaded["reward"]>(null);
  const [, setShareId] = useState<string | null>(null);
  const [shareText, setShareText] = useState("");
  const [note, setNote] = useState("");
  const [openTool, setOpenTool] = useState<Tool>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const r = await apiFetch<Loaded>(`/session/${slug}`);
      if (!r.ok || !r.data) { setErrMsg(r.error || "This session could not be found."); setState("error"); return; }
      const d = r.data;
      setData(d);
      setConsent(d.session.consent_given);
      setMessages(d.messages.map((m) => ({ role: m.role, content: m.content })));
      setReward(d.reward);
      setShareId(d.share?.id ?? null);
      setShareText(d.share?.markdown ?? "");
      if (d.share?.approved) setView("done");
      else if (d.reward && d.share) setView("review");
      else if (d.session.selected_depth) setView("chat");
      else setView("welcome");
      setState("ready");
    })();
  }, [slug]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  const openAndScroll = useCallback((tool: Exclude<Tool, null> | "ai-journey") => {
    if (tool === "ved" || tool === "siv") setOpenTool(tool);
    setTimeout(() => document.getElementById(tool)?.scrollIntoView({ behavior: "smooth" }), 60);
  }, []);

  const start = useCallback(async (depth: Depth) => {
    if (!consent) return;
    setBusy(true);
    const r = await apiFetch(`/session/${slug}`, { method: "POST", body: JSON.stringify({ depth, consent: true }) });
    setBusy(false);
    if (r.ok) {
      setData((d) => d && ({ ...d, session: { ...d.session, selected_depth: depth, consent_given: true } }));
      setView("chat");
    } else setErrMsg(r.error || "Could not start the session.");
  }, [consent, slug]);

  const send = useCallback(async () => {
    const msg = input.trim();
    if (!msg || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setBusy(true);
    try {
      const r = await apiFetch<{ reply: string }>(`/session/${slug}/message`, { method: "POST", body: JSON.stringify({ message: msg }) });
      if (r.ok && r.data) setMessages((m) => [...m, { role: "assistant", content: r.data!.reply }]);
      else setMessages((m) => [...m, { role: "assistant", content: `⚠ ${r.error || "Something went wrong. Your session is saved — please try again."}` }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "⚠ Network error. Your session is saved — please try again." }]);
    } finally { setBusy(false); }
  }, [input, busy, slug]);

  const finish = useCallback(async () => {
    setBusy(true);
    const r = await apiFetch<{ reward: { id: string; type: string; markdown: string }; share: { id: string; markdown: string } }>(
      `/session/${slug}/reward`, { method: "POST" });
    setBusy(false);
    if (r.ok && r.data) { setReward(r.data.reward); setShareId(r.data.share.id); setShareText(r.data.share.markdown); setView("review"); }
    else setErrMsg(r.error || "Could not prepare your summary.");
  }, [slug]);

  const submitReview = useCallback(async (approved: boolean) => {
    setBusy(true);
    const r = await apiFetch(`/session/${slug}/review`, { method: "POST", body: JSON.stringify({ reviewed_markdown: shareText, approved, note }) });
    setBusy(false);
    if (r.ok && approved) setView("done");
  }, [slug, shareText, note]);

  if (state === "loading") return <Shell><p className="text-muted">Loading your workspace…</p></Shell>;
  if (state === "error") return <Shell><h1 className="font-display text-2xl mb-2">Session unavailable</h1><p className="text-muted">{errMsg}</p></Shell>;

  const p = data!.participant;
  const stepIndex = view === "done" ? 5 : view === "review" ? 4 : view === "chat" ? (data!.session.selected_depth === "45" ? 2 : data!.session.selected_depth === "30" ? 1 : 0) : -1;
  const rewardTitle = reward ? REWARD_TITLES[reward.type] ?? "Your Brief" : "";
  const journeyDone = view === "done";

  return (
    <Shell>
      {/* ---- Workspace header ---- */}
      <header className="border-b border-rule pb-5">
        <div className="font-mono text-[11px] tracking-widest uppercase text-vermillion">AI for Business Leaders</div>
        <h1 className="font-display text-3xl sm:text-4xl mt-1">Your Personal Course Workspace</h1>
        <p className="mt-2 text-ink/80 max-w-xl">This page helps you prepare for the course, sharpen your thinking, select the right first AI project, and build your 90-day implementation blueprint.</p>
        <p className="mt-2 font-mono text-xs text-muted">{p.name}{p.company_name ? ` · ${p.company_name}` : ""}</p>
      </header>

      {/* ---- Three connected conversations ---- */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <ToolCard n="1" title="My AI Journey" tagline="Understand where I am and what I need from the course."
          purpose="This conversation helps Vinay understand your company, your AI literacy, your current priorities and what you want to achieve through the course."
          button="Continue My AI Journey" done={journeyDone} onClick={() => openAndScroll("ai-journey")} />
        <ToolCard n="2" title={VED_COPY.card.title} tagline={VED_COPY.card.tagline} purpose={VED_COPY.card.purpose}
          button={VED_COPY.card.button} onClick={() => openAndScroll("ved")} />
        <ToolCard n="3" title={SIV_COPY.card.title} tagline={SIV_COPY.card.tagline} purpose={SIV_COPY.card.purpose}
          button={SIV_COPY.card.button} onClick={() => openAndScroll("siv")} />
      </div>

      <RecommendedPath />

      {/* ---- Conversation 1: My AI Journey ---- */}
      <div id="ai-journey" className="scroll-mt-6 mt-10 border-t border-rule pt-8">
        <div className="font-mono text-[11px] tracking-widest uppercase text-vermillion">Conversation 1 · My AI Journey</div>
        {view !== "welcome" && <Progress index={stepIndex} />}

        {view === "welcome" && (
          <div className="mt-4">
            <div className="whitespace-pre-line leading-relaxed text-ink/90">{OPENING_COPY}</div>
            <div className="mt-6 rounded-md border border-rule bg-paper-deep/40 p-4 text-sm text-muted">
              <div className="font-mono text-[11px] tracking-widest uppercase text-vermillion mb-1">Privacy &amp; sharing</div>
              {PRIVACY_NOTICE}
              <label className="mt-3 flex items-start gap-2 text-ink cursor-pointer">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 accent-vermillion" />
                <span>I understand, and I’m happy to begin. I can review what’s shared with Vinay before anything is saved.</span>
              </label>
            </div>
            <h2 className="font-display text-xl mt-8 mb-3">Choose how deep you’d like to go</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {DEPTHS.map((d) => (
                <button key={d.id} disabled={!consent || busy} onClick={() => start(d.id)}
                  className="text-left rounded-lg border border-rule p-4 transition hover:border-vermillion hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed bg-white/40">
                  <div className="font-mono text-[11px] tracking-widest uppercase text-vermillion">{d.minutes}</div>
                  <div className="font-display text-lg mt-1">{d.title}</div>
                  <p className="text-sm text-muted mt-2">{d.blurb}</p>
                  <div className="mt-3 text-xs font-mono text-ink/70">Reward · {d.reward}</div>
                </button>
              ))}
            </div>
            {!consent && <p className="text-xs text-muted mt-3">Please accept the privacy notice above to choose a journey.</p>}
            {errMsg && <p className="text-xs text-vermillion mt-3">{errMsg}</p>}
          </div>
        )}

        {view === "chat" && (
          <div className="mt-4">
            <div className="space-y-4">
              {messages.map((m, i) => <Bubble key={i} role={m.role} content={m.content} />)}
              {busy && <div className="text-muted text-sm font-mono">the agent is thinking…</div>}
              <div ref={bottomRef} />
            </div>
            <div className="mt-5">
              <textarea value={input} onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
                placeholder="Type your reply…  (⌘/Ctrl + Enter to send)" rows={3} disabled={busy}
                className="w-full rounded-md border border-rule bg-white/60 p-3 text-ink focus:border-vermillion focus:outline-none disabled:opacity-50" />
              <div className="mt-2 flex items-center justify-between">
                <button onClick={finish} disabled={busy || messages.length < 2}
                  className="text-sm font-mono text-vermillion disabled:opacity-40">I’m ready — prepare my summary &amp; reward →</button>
                <button onClick={send} disabled={busy || !input.trim()}
                  className="rounded-md bg-ink text-paper px-5 py-2 text-sm disabled:opacity-40">Send</button>
              </div>
            </div>
          </div>
        )}

        {view === "review" && reward && (
          <div className="mt-4 space-y-8">
            <section>
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl">{rewardTitle}</h2>
                <a href={pdfUrl(reward.id, slug)} className="text-sm font-mono text-vermillion">Download PDF ↓</a>
              </div>
              <div className="mt-3 rounded-lg border border-rule bg-white/50 p-5"><Markdown>{reward.markdown}</Markdown></div>
            </section>
            <section>
              <h2 className="font-display text-xl">Summary to be shared with Vinay</h2>
              <p className="text-sm text-muted mt-1">Please review. You can edit the text or remove anything sensitive before it’s saved for Vinay.</p>
              <textarea value={shareText} onChange={(e) => setShareText(e.target.value)} rows={14}
                className="mt-3 w-full rounded-md border border-rule bg-white/60 p-3 font-mono text-[13px] leading-relaxed text-ink focus:border-vermillion focus:outline-none" />
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional: add a note to Vinay"
                className="mt-3 w-full rounded-md border border-rule bg-white/60 p-3 text-ink focus:border-vermillion focus:outline-none" />
              <div className="mt-4 flex gap-3">
                <button onClick={() => submitReview(false)} disabled={busy} className="text-sm font-mono text-muted">Save edits</button>
                <button onClick={() => submitReview(true)} disabled={busy} className="rounded-md bg-vermillion text-paper px-5 py-2 text-sm disabled:opacity-50">Approve &amp; send to Vinay</button>
              </div>
            </section>
          </div>
        )}

        {view === "done" && (
          <div className="mt-6">
            <h2 className="font-display text-2xl">Thank you.</h2>
            <p className="mt-3 text-ink/90">Your summary has been shared with Vinay, and your session is saved. Now continue below — find your weakest execution link, then choose your first AI project.</p>
            {reward && <a href={pdfUrl(reward.id, slug)} className="mt-4 inline-block text-sm font-mono text-vermillion">Download your {REWARD_TITLES[reward.type] ?? "brief"} (PDF) ↓</a>}
          </div>
        )}
      </div>

      {/* ---- Conversations 2 & 3 ---- */}
      <VedSelector slug={slug} open={openTool === "ved"} onToggle={() => setOpenTool((t) => (t === "ved" ? null : "ved"))} />
      <SivSelector slug={slug} open={openTool === "siv"} onToggle={() => setOpenTool((t) => (t === "siv" ? null : "siv"))} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-paper text-ink"><div className="mx-auto max-w-2xl px-5 py-10 sm:py-16">{children}</div></main>;
}

function ToolCard({ n, title, tagline, purpose, button, onClick, done }: {
  n: string; title: string; tagline: string; purpose: string; button: string; onClick: () => void; done?: boolean;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-rule bg-white/40 p-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[11px] tracking-widest uppercase text-vermillion">{n}</div>
        {done && <span className="font-mono text-[9px] uppercase tracking-wider text-ink/60">done ✓</span>}
      </div>
      <div className="font-display text-lg mt-1">{title}</div>
      <div className="text-sm text-ink/80 mt-1">{tagline}</div>
      <p className="text-xs text-muted mt-2 flex-1">{purpose}</p>
      <button onClick={onClick} className="mt-3 rounded-md border border-ink/20 px-3 py-2 text-sm font-mono hover:border-vermillion hover:text-vermillion transition text-left">{button} →</button>
    </div>
  );
}

function RecommendedPath() {
  const steps = [
    "Complete My AI Journey",
    "Use the Execution Doctrine Assistant to find the weakest execution link",
    "Use the SIV AI Project Selector to choose the first AI project",
    "Return to My AI Journey to refine your project and course goals",
    "Use your selected project to build your 90-day AI blueprint",
  ];
  return (
    <div className="mt-5 rounded-md border border-rule bg-paper-deep/30 p-4">
      <div className="font-mono text-[11px] tracking-widest uppercase text-muted">Recommended path</div>
      <ol className="mt-2 space-y-1 text-sm text-ink/85">
        {steps.map((s, i) => <li key={i}><span className="font-mono text-vermillion mr-2">{i + 1}</span>{s}</li>)}
      </ol>
      <p className="mt-3 text-xs text-muted">You can return to these conversations at any time during the course as your thinking improves.</p>
    </div>
  );
}

function Progress({ index }: { index: number }) {
  return (
    <ol className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono">
      {PROGRESS_STEPS.map((s, i) => (
        <li key={s.key} className={i <= index ? "text-vermillion" : "text-muted/60"}>
          {i <= index ? "●" : "○"} {s.label}
        </li>
      ))}
    </ol>
  );
}
function Bubble({ role, content }: { role: "user" | "assistant"; content: string }) {
  const mine = role === "user";
  return (
    <div className={mine ? "flex justify-end" : "flex justify-start"}>
      <div className={`max-w-[85%] rounded-lg px-4 py-3 ${mine ? "bg-ink text-paper" : "bg-white/60 border border-rule text-ink"}`}>
        {mine ? <p className="whitespace-pre-line">{content}</p> : <Markdown>{content}</Markdown>}
      </div>
    </div>
  );
}
