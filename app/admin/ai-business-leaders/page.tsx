"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch, AP } from "@/lib/abl/paths";
import type { Participant } from "@/lib/abl/types";

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", research_added: "Research added", qa_pending: "QA pending",
  qa_approved: "QA approved", link_ready: "Link ready", active: "Active", completed: "Completed",
};

export default function AdminDashboard() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [pw, setPw] = useState("");
  const [loginErr, setLoginErr] = useState("");
  const [rows, setRows] = useState<Participant[]>([]);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await apiFetch<Participant[]>("/admin/participants");
    if (r.status === 401) { setAuthed(false); return; }
    setAuthed(true);
    setRows(r.data ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const login = async () => {
    setLoginErr("");
    const r = await apiFetch("/admin/login", { method: "POST", body: JSON.stringify({ password: pw }) });
    if (r.ok) { setPw(""); load(); } else setLoginErr(r.error || "Incorrect password");
  };

  const copyLink = (slug: string) => {
    const url = `${window.location.origin}${AP}/session/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(slug); setTimeout(() => setCopied(null), 1800);
  };

  const today = new Date().toISOString().slice(0, 10);
  const dailyToday = (p: Participant) => (p.daily_date === today ? p.daily_count : 0);

  if (authed === null) return <Shell><p className="text-muted">Loading…</p></Shell>;

  if (!authed) return (
    <Shell>
      <h1 className="font-display text-2xl mb-4">Admin · AI for Business Leaders</h1>
      <div className="max-w-sm">
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()}
          placeholder="Admin password" className="w-full rounded-md border border-rule bg-white/60 p-3 text-ink focus:border-vermillion focus:outline-none" />
        {loginErr && <p className="text-vermillion text-sm mt-2">{loginErr}</p>}
        <button onClick={login} className="mt-3 rounded-md bg-ink text-paper px-5 py-2 text-sm">Enter</button>
      </div>
    </Shell>
  );

  return (
    <Shell wide>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl">Participants</h1>
        <div className="flex gap-3 items-center">
          <Link href={`/admin/ai-business-leaders/participants/new`} className="rounded-md bg-vermillion text-paper px-4 py-2 text-sm">+ New participant</Link>
          <button onClick={async () => { await apiFetch("/admin/login", { method: "DELETE" }); setAuthed(false); }} className="text-sm font-mono text-muted">Sign out</button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-left font-mono text-[11px] uppercase tracking-wider text-muted border-b border-rule">
              <th className="py-2 pr-3">Name</th><th className="py-2 pr-3">Company</th><th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">QA</th><th className="py-2 pr-3">Link</th><th className="py-2 pr-3">Brief</th>
              <th className="py-2 pr-3">Msgs</th><th className="py-2 pr-3">Last active</th><th className="py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="py-6 text-muted">No participants yet. Create one to begin.</td></tr>}
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-rule/60 align-top">
                <td className="py-3 pr-3">{p.name}<div className="text-xs text-muted">{p.role_title}</div></td>
                <td className="py-3 pr-3">{p.company_name}</td>
                <td className="py-3 pr-3">{STATUS_LABEL[p.status] ?? p.status}{p.access_paused && <span className="text-vermillion" title="Access paused"> · ⏸</span>}</td>
                <td className="py-3 pr-3">{p.qa_status}</td>
                <td className="py-3 pr-3">{p.link_approved ? <span className="text-vermillion">approved</span> : "—"}</td>
                <td className="py-3 pr-3">{p.vinay_brief_status === "generated" ? "✓" : "—"}</td>
                <td className="py-3 pr-3">
                  <span className={p.message_count >= p.max_messages * 0.8 ? "text-vermillion" : ""}>{p.message_count}/{p.max_messages}</span>
                  <div className="text-[11px] text-muted">{dailyToday(p)}/{p.daily_limit} today</div>
                </td>
                <td className="py-3 pr-3 text-xs text-muted">{p.last_activity_at ? new Date(p.last_activity_at).toLocaleString() : "—"}</td>
                <td className="py-3">
                  <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs">
                    <Link href={`/admin/ai-business-leaders/participants/${p.id}`} className="text-vermillion">Edit / QA / Brief</Link>
                    {p.link_approved
                      ? <button onClick={() => copyLink(p.slug)} className="text-ink">{copied === p.slug ? "Copied!" : "Copy link"}</button>
                      : <span className="text-muted/60" title="Approve the link after QA">Copy link</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function Shell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return <main className="min-h-screen bg-paper text-ink"><div className={`mx-auto ${wide ? "max-w-6xl" : "max-w-2xl"} px-5 py-10`}>{children}</div></main>;
}
