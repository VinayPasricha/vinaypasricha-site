"use client";
import React from "react";

// Minimal, safe markdown renderer (no dangerouslySetInnerHTML): headings,
// bullets, numbered lists, bold, and paragraphs. Enough for our outputs.
function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`/g;
  let last = 0, m: RegExpExecArray | null, i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const content = m[1] ?? m[2] ?? m[3] ?? "";
    if (m[1]) out.push(<strong key={`${keyBase}-${i++}`}>{content}</strong>);
    else if (m[2]) out.push(<em key={`${keyBase}-${i++}`}>{content}</em>);
    else out.push(<code key={`${keyBase}-${i++}`} className="font-mono text-[0.9em]">{content}</code>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export default function Markdown({ children, className = "" }: { children: string; className?: string }) {
  const lines = (children || "").replace(/\r/g, "").split("\n");
  const nodes: React.ReactNode[] = [];
  let list: React.ReactNode[] | null = null;
  let ordered = false;
  let k = 0;

  const flush = () => {
    if (list) {
      nodes.push(ordered
        ? <ol key={k++} className="list-decimal pl-5 my-3 space-y-1.5 marker:text-vermillion">{list}</ol>
        : <ul key={k++} className="list-disc pl-5 my-3 space-y-1.5 marker:text-vermillion">{list}</ul>);
      list = null;
    }
  };

  for (const raw of lines) {
    const l = raw.trimEnd();
    if (!l.trim()) { flush(); continue; }
    if (/^#\s/.test(l)) { flush(); nodes.push(<h2 key={k++} className="font-display text-2xl mt-6 mb-2">{inline(l.replace(/^#\s/, ""), `h${k}`)}</h2>); }
    else if (/^##\s/.test(l)) { flush(); nodes.push(<h3 key={k++} className="font-display text-xl mt-5 mb-2">{inline(l.replace(/^##\s/, ""), `h${k}`)}</h3>); }
    else if (/^###\s/.test(l)) { flush(); nodes.push(<h4 key={k++} className="font-mono text-xs tracking-widest uppercase text-muted mt-4 mb-1.5">{inline(l.replace(/^###\s/, ""), `h${k}`)}</h4>); }
    else if (/^---+$/.test(l)) { flush(); nodes.push(<hr key={k++} className="my-5 border-rule" />); }
    else if (/^[-*]\s/.test(l)) { if (list && ordered) flush(); ordered = false; list = list ?? []; list.push(<li key={`li${k}-${list.length}`}>{inline(l.replace(/^[-*]\s/, ""), `li${k}`)}</li>); }
    else if (/^\d+\.\s/.test(l)) { if (list && !ordered) flush(); ordered = true; list = list ?? []; list.push(<li key={`li${k}-${list.length}`}>{inline(l.replace(/^\d+\.\s/, ""), `li${k}`)}</li>); }
    else { flush(); nodes.push(<p key={k++} className="my-2.5 leading-relaxed">{inline(l, `p${k}`)}</p>); }
  }
  flush();
  return <div className={className}>{nodes}</div>;
}
