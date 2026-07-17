"use client";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, AP, pdfUrl } from "@/lib/abl/paths";
import { QA_ITEMS, DEPTHS } from "@/lib/abl/types";
import type { Participant, ParticipantResearch, GeneratedOutput, Depth, QaChecklist } from "@/lib/abl/types";
import Markdown from "@/components/abl/Markdown";

const FIELDS: { key: string; label: string; ph?: string }[] = [
  { key: "name", label: "Participant name" }, { key: "email", label: "Email (optional)" },
  { key: "company_name", label: "Company name" }, { key: "role_title", label: "Role / title" },
  { key: "company_website", label: "Company website" }, { key: "industry", label: "Industry" },
  { key: "geography", label: "Geography" }, { key: "business_model", label: "Business model" },
];
const RESEARCH_FIELDS: { key: string; label: string }[] = [
  { key: "customers", label: "Customers / customer segments" }, { key: "products", label: "Products / services" },
  { key: "competitors", label: "Competitors" }, { key: "pressures", label: "Current business pressures" },
  { key: "ai_relevance", label: "Likely AI relevance" }, { key: "ai_exposure", label: "Current known AI exposure (optional)" },
];

export default function ParticipantDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === "new";

  const [p, setP] = useState<Participant | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [structured, setStructured] = useState<Record<string, string>>({});
  const [dossier, setDossier] = useState("");
  const [sources, setSources] = useState("");
  const [outputs, setOutputs] = useState<GeneratedOutput[]>([]);
  const [qa, setQa] = useState<QaChecklist>({});
  const [qaNotes, setQaNotes] = useState("");
  const [msg, setMsg] = useState("");
  const [savedNote, setSavedNote] = useState("");

  // QA test chat
  const [depth, setDepth] = useState<Depth>("15");
  const [chat, setChat] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (isNew) return;
    const r = await apiFetch<{ participant: Participant; research: ParticipantResearch | null; qa: { checklist: QaChecklist; notes: string } | null; outputs: GeneratedOutput[] }>(`/admin/participants/${id}`);
    if (r.status === 401) { router.push(`/admin/ai-business-leaders`); return; }
    if (r.data) {
      setP(r.data.participant);
      setFields(Object.fromEntries(FIELDS.map((f) => [f.key, (r.data!.participant as unknown as Record<string, string>)[f.key] ?? ""])));
      setStructured((r.data.research?.structured_context as Record<string, string>) ?? {});
      setDossier(r.data.research?.research_dossier ?? "");
      setSources(r.data.research?.sources_notes ?? "");
      setOutputs(r.data.outputs ?? []);
      setQa(r.data.qa?.checklist ?? {});
      setQaNotes(r.data.qa?.notes ?? "");
    }
  }, [id, isNew, router]);
  useEffect(() => { load(); }, [load]);

  const flash = (t: string) => { setSavedNote(t); setTimeout(() => setSavedNote(""), 1600); };

  const saveFields = async () => {
    if (isNew) {
      const r = await apiFetch<Participant>("/admin/participants", { method: "POST", body: JSON.stringify(fields) });
      if (r.ok && r.data) router.push(`/admin/ai-business-leaders/participants/${r.data.id}`);
      else setMsg(r.error || "Could not create");
    } else {
      const r = await apiFetch<Participant>(`/admin/participants/${id}`, { method: "PATCH", body: JSON.stringify(fields) });
      if (r.ok && r.data) { setP(r.data); flash("Saved"); } else setMsg(r.error || "Could not save");
    }
  };
  const saveResearch = async () => {
    const r = await apiFetch(`/admin/participants/${id}/research`, { method: "PUT", body: JSON.stringify({ structured_context: structured, research_dossier: dossier, sources_notes: sources }) });
    if (r.ok) { flash("Research saved"); load(); } else setMsg(r.error || "Could not save research");
  };
  const saveQa = async (status: "in_progress" | "passed" | "failed") => {
    const r = await apiFetch(`/admin/participants/${id}/qa`, { method: "PUT", body: JSON.stringify({ checklist: qa, notes: qaNotes, status, tested_by: "assistant" }) });
    if (r.ok) { flash(status === "passed" ? "QA passed" : "QA saved"); load(); } else setMsg(r.error || "Could not save QA");
  };
  const approve = async (on: boolean) => {
    const r = await apiFetch(`/admin/participants/${id}/approve`, { method: on ? "POST" : "DELETE" });
    if (r.ok) { flash(on ? "Link approved" : "Link revoked"); load(); }
  };
  const genBrief = async () => {
    setBusy(true);
    const r = await apiFetch(`/admin/participants/${id}/brief`, { method: "POST" });
    setBusy(false);
    if (r.ok) { flash("Brief generated"); load(); } else setMsg(r.error || "Could not generate brief");
  };
  const usagePatch = async (patch: Record<string, unknown>, note: string) => {
    const r = await apiFetch<Participant>(`/admin/participants/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    if (r.ok && r.data) { setP(r.data); flash(note); } else setMsg(r.error || "Could not update");
  };
  const resetConv = async (mode: "participant" | "ved" | "siv") => {
    if (!confirm(`Reset the ${mode} conversation? This deletes its messages so the participant restarts it.`)) return;
    const r = await apiFetch(`/admin/participants/${id}/reset`, { method: "POST", body: JSON.stringify({ mode }) });
    if (r.ok) { flash("Conversation reset"); load(); } else setMsg(r.error || "Could not reset");
  };
  const sendTest = async () => {
    const m = chatInput.trim(); if (!m || busy) return;
    setChatInput(""); setChat((c) => [...c, { role: "user", content: m }]); setBusy(true);
    const r = await apiFetch<{ reply: string }>(`/admin/participants/${id}/qa-message`, { method: "POST", body: JSON.stringify({ message: m, depth }) });
    setBusy(false);
    setChat((c) => [...c, { role: "assistant", content: r.ok && r.data ? r.data.reply : `⚠ ${r.error || "error"}` }]);
  };

  const allChecked = QA_ITEMS.every((it) => qa[it.key]?.pass === true);
  const brief = outputs.find((o) => o.output_type === "vinay_meeting_brief");
  const reward = outputs.find((o) => ["course_preparation_brief", "use_case_map", "strategy_note"].includes(o.output_type));
  const share = outputs.find((o) => o.output_type === "share_summary");
  const sivReport = outputs.find((o) => o.output_type === "siv_report");
  const vedReport = outputs.find((o) => o.output_type === "ved_report");

  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-3xl px-5 py-10">
        <Link href={`/admin/ai-business-leaders`} className="font-mono text-xs text-muted">← All participants</Link>
        <div className="flex items-center justify-between mt-2">
          <h1 className="font-display text-2xl">{isNew ? "New participant" : p?.name}</h1>
          {savedNote && <span className="text-vermillion text-sm font-mono">{savedNote}</span>}
        </div>
        {msg && <p className="text-vermillion text-sm mt-2">{msg}</p>}

        {/* Fields */}
        <Section title="1 · Participant & company">
          <div className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="text-sm">
                <span className="text-muted">{f.label}</span>
                <input value={fields[f.key] ?? ""} onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                  className="mt-1 w-full rounded-md border border-rule bg-white/60 p-2.5 focus:border-vermillion focus:outline-none" />
              </label>
            ))}
          </div>
          <button onClick={saveFields} className="mt-4 rounded-md bg-ink text-paper px-5 py-2 text-sm">{isNew ? "Create participant" : "Save"}</button>
        </Section>

        {!isNew && (
          <>
            {/* Research */}
            <Section title="2 · Research (manual-first)">
              <p className="text-xs text-muted mb-3">Structured fields personalise the agent; the dossier gives it depth. TODO(v2): automatic web research can populate these — for now, paste manually.</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {RESEARCH_FIELDS.map((f) => (
                  <label key={f.key} className="text-sm">
                    <span className="text-muted">{f.label}</span>
                    <textarea value={structured[f.key] ?? ""} onChange={(e) => setStructured({ ...structured, [f.key]: e.target.value })} rows={2}
                      className="mt-1 w-full rounded-md border border-rule bg-white/60 p-2.5 focus:border-vermillion focus:outline-none" />
                  </label>
                ))}
              </div>
              <label className="block text-sm mt-3"><span className="text-muted">Research dossier (rich free text)</span>
                <textarea value={dossier} onChange={(e) => setDossier(e.target.value)} rows={8} className="mt-1 w-full rounded-md border border-rule bg-white/60 p-2.5 font-mono text-[13px] focus:border-vermillion focus:outline-none" /></label>
              <label className="block text-sm mt-3"><span className="text-muted">Sources / notes (optional)</span>
                <textarea value={sources} onChange={(e) => setSources(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-rule bg-white/60 p-2.5 focus:border-vermillion focus:outline-none" /></label>
              <button onClick={saveResearch} className="mt-4 rounded-md bg-ink text-paper px-5 py-2 text-sm">Save research</button>
            </Section>

            {/* QA */}
            <Section title="3 · QA — test the agent, then check off">
              <div className="rounded-lg border border-rule bg-white/40 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs text-muted font-mono">Test as depth:</span>
                  {DEPTHS.map((d) => <button key={d.id} onClick={() => setDepth(d.id)} className={`text-xs font-mono px-2 py-1 rounded ${depth === d.id ? "bg-vermillion text-paper" : "text-muted"}`}>{d.id}m</button>)}
                </div>
                <div className="space-y-3 max-h-72 overflow-y-auto">
                  {chat.length === 0 && <p className="text-sm text-muted">Send a message to greet the agent as if you were the participant.</p>}
                  {chat.map((m, i) => (
                    <div key={i} className={m.role === "user" ? "text-right" : ""}>
                      <div className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm text-left ${m.role === "user" ? "bg-ink text-paper" : "bg-paper-deep/50 border border-rule"}`}>
                        {m.role === "user" ? m.content : <Markdown>{m.content}</Markdown>}
                      </div>
                    </div>
                  ))}
                  {busy && <p className="text-xs text-muted font-mono">thinking…</p>}
                </div>
                <div className="mt-3 flex gap-2">
                  <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendTest()} placeholder="Type as the participant…"
                    className="flex-1 rounded-md border border-rule bg-white/60 p-2.5 text-sm focus:border-vermillion focus:outline-none" />
                  <button onClick={sendTest} disabled={busy} className="rounded-md bg-ink text-paper px-4 text-sm">Send</button>
                </div>
              </div>

              <div className="mt-4 space-y-1.5">
                {QA_ITEMS.map((it) => (
                  <label key={it.key} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={qa[it.key]?.pass === true} onChange={(e) => setQa({ ...qa, [it.key]: { pass: e.target.checked } })} className="accent-vermillion" />
                    <span>{it.label}</span>
                  </label>
                ))}
              </div>
              <textarea value={qaNotes} onChange={(e) => setQaNotes(e.target.value)} rows={2} placeholder="QA notes" className="mt-3 w-full rounded-md border border-rule bg-white/60 p-2.5 text-sm focus:border-vermillion focus:outline-none" />
              <div className="mt-3 flex gap-3">
                <button onClick={() => saveQa("in_progress")} className="text-sm font-mono text-muted">Save progress</button>
                <button onClick={() => saveQa("passed")} disabled={!allChecked} title={allChecked ? "" : "Complete all checks first"} className="rounded-md bg-ink text-paper px-4 py-2 text-sm disabled:opacity-40">Mark QA passed</button>
              </div>
            </Section>

            {/* Approve + link */}
            <Section title="4 · Approve & share the link">
              <div className="flex flex-wrap items-center gap-4">
                {p?.link_approved
                  ? <>
                      <span className="text-vermillion text-sm">Link approved.</span>
                      <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}${AP}/session/${p.slug}`); flash("Link copied"); }} className="rounded-md bg-vermillion text-paper px-4 py-2 text-sm">Copy participant link</button>
                      <button onClick={() => approve(false)} className="text-sm font-mono text-muted">Revoke</button>
                    </>
                  : <button onClick={() => approve(true)} disabled={p?.qa_status !== "passed"} title={p?.qa_status === "passed" ? "" : "Pass QA first"} className="rounded-md bg-vermillion text-paper px-4 py-2 text-sm disabled:opacity-40">Approve link</button>}
              </div>
              {p && <p className="text-xs font-mono text-muted mt-2 break-all">{`${AP}/session/${p.slug}`}</p>}
            </Section>

            {/* Brief + outputs */}
            <Section title="5 · Vinay’s brief & participant outputs">
              <div className="flex flex-wrap gap-3">
                <button onClick={genBrief} disabled={busy} className="rounded-md bg-ink text-paper px-4 py-2 text-sm disabled:opacity-50">{brief ? "Regenerate" : "Generate"} Vinay brief</button>
                {brief && <a href={pdfUrl(brief.id)} className="text-sm font-mono text-vermillion self-center">Download brief PDF ↓</a>}
                {reward && <a href={pdfUrl(reward.id)} className="text-sm font-mono text-vermillion self-center">Reward PDF ↓</a>}
                {vedReport && <a href={pdfUrl(vedReport.id)} className="text-sm font-mono text-vermillion self-center">VED Constraint Report PDF ↓</a>}
                {sivReport && <a href={pdfUrl(sivReport.id)} className="text-sm font-mono text-vermillion self-center">SIV Decision Report PDF ↓</a>}
              </div>
              {brief?.content_markdown && <div className="mt-4 rounded-lg border border-rule bg-white/50 p-5"><Markdown>{brief.content_markdown}</Markdown></div>}
              {vedReport?.content_markdown && (
                <div className="mt-5">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-muted">VED — Execution Constraint Report</div>
                  <div className="mt-2 rounded-lg border border-rule bg-paper-deep/30 p-4 text-sm"><Markdown>{vedReport.content_markdown}</Markdown></div>
                </div>
              )}
              {sivReport?.content_markdown && (
                <div className="mt-5">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-muted">SIV — First AI Project Decision Report</div>
                  <div className="mt-2 rounded-lg border border-rule bg-paper-deep/30 p-4 text-sm"><Markdown>{sivReport.content_markdown}</Markdown></div>
                </div>
              )}
              {share && (
                <div className="mt-5">
                  <div className="font-mono text-[11px] uppercase tracking-wider text-muted">Participant-approved summary {share.participant_approved ? "✓" : "(not yet approved)"}</div>
                  <div className="mt-2 rounded-lg border border-rule bg-paper-deep/30 p-4 text-sm"><Markdown>{share.reviewed_content_markdown ?? share.content_markdown ?? ""}</Markdown></div>
                </div>
              )}
            </Section>

            {/* Usage & access */}
            {p && (() => {
              const today = new Date().toISOString().slice(0, 10);
              const usedToday = p.daily_date === today ? p.daily_count : 0;
              const btn = "rounded-md border border-ink/20 px-3 py-1.5 text-xs font-mono hover:border-vermillion hover:text-vermillion transition";
              const num = "w-20 rounded border border-rule bg-white/60 px-2 py-1 text-ink focus:border-vermillion focus:outline-none";
              return (
                <Section title="6 · Usage & access">
                  <div className="grid gap-2 sm:grid-cols-2 text-sm">
                    <div>Interactions: <b>{p.message_count}</b> / {p.max_messages}</div>
                    <div>Today: <b>{usedToday}</b> / {p.daily_limit}</div>
                    <div>Est. tokens: <b>{(p.token_estimate ?? 0).toLocaleString()}</b>{p.token_budget != null ? ` / ${p.token_budget.toLocaleString()}` : " · no budget"}</div>
                    <div>Access: {p.access_paused ? <span className="text-vermillion">paused</span> : "active"}</div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button className={btn} onClick={() => usagePatch({ max_messages: p.max_messages + 50 }, "Extended +50")}>Extend +50</button>
                    <button className={btn} onClick={() => usagePatch({ max_messages: p.max_messages + 100 }, "Extended +100")}>Extend +100</button>
                    <button className={btn} onClick={() => usagePatch({ max_messages: 1000000, token_budget: null }, "Set unlimited")}>Set unlimited</button>
                    <button className={`${btn} ${p.access_paused ? "text-vermillion border-vermillion" : ""}`}
                      onClick={() => usagePatch({ access_paused: !p.access_paused }, p.access_paused ? "Access resumed" : "Access paused")}>
                      {p.access_paused ? "Resume access" : "Pause access"}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="text-muted">Reset a conversation:</span>
                    <button className={btn} onClick={() => resetConv("participant")}>AI Journey</button>
                    <button className={btn} onClick={() => resetConv("ved")}>VED</button>
                    <button className={btn} onClick={() => resetConv("siv")}>SIV</button>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
                    <label className="flex items-center gap-2">Daily limit
                      <input type="number" defaultValue={p.daily_limit} className={num}
                        onBlur={(e) => { const v = Number(e.target.value); if (v !== p.daily_limit) usagePatch({ daily_limit: v }, "Daily limit set"); }} />
                    </label>
                    <label className="flex items-center gap-2">Token budget
                      <input type="number" defaultValue={p.token_budget ?? ""} placeholder="none" className={num}
                        onBlur={(e) => { const v = e.target.value === "" ? null : Number(e.target.value); if (v !== p.token_budget) usagePatch({ token_budget: v }, "Token budget set"); }} />
                    </label>
                  </div>
                </Section>
              );
            })()}
          </>
        )}
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8 border-t border-rule pt-6">
      <h2 className="font-mono text-xs tracking-widest uppercase text-vermillion mb-4">{title}</h2>
      {children}
    </section>
  );
}
