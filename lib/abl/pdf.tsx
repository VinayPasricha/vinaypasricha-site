// Server-side PDF rendering for participant rewards and Vinay briefs.
// Simple, elegant markdown -> react-pdf. Uses built-in Times/Helvetica for
// reliability (no font files to bundle). Node runtime only.
import "server-only";
import React from "react";
import {
  Document, Page, Text, View, StyleSheet, renderToBuffer,
} from "@react-pdf/renderer";

const INK = "#15171c";
const MUTED = "#7a7264";
const RULE = "#d9d0bc";
const VERMILLION = "#bf3a19";

const s = StyleSheet.create({
  page: { paddingTop: 54, paddingBottom: 56, paddingHorizontal: 56, fontFamily: "Times-Roman", fontSize: 11, color: INK, lineHeight: 1.5 },
  eyebrow: { fontFamily: "Helvetica-Bold", fontSize: 8, letterSpacing: 2, color: VERMILLION, textTransform: "uppercase", marginBottom: 6 },
  title: { fontFamily: "Times-Bold", fontSize: 20, marginBottom: 4 },
  meta: { fontFamily: "Helvetica", fontSize: 9, color: MUTED, marginBottom: 2 },
  rule: { borderBottomWidth: 1, borderBottomColor: RULE, marginTop: 12, marginBottom: 16 },
  h1: { fontFamily: "Times-Bold", fontSize: 15, marginTop: 16, marginBottom: 6 },
  h2: { fontFamily: "Times-Bold", fontSize: 12.5, marginTop: 13, marginBottom: 5 },
  h3: { fontFamily: "Helvetica-Bold", fontSize: 10, letterSpacing: 0.5, marginTop: 10, marginBottom: 4, color: MUTED, textTransform: "uppercase" },
  p: { marginBottom: 7 },
  bulletRow: { flexDirection: "row", marginBottom: 4, paddingLeft: 4 },
  bulletDot: { width: 12, color: VERMILLION },
  bulletText: { flex: 1 },
  footer: { position: "absolute", bottom: 28, left: 56, right: 56, flexDirection: "row", justifyContent: "space-between", fontFamily: "Helvetica", fontSize: 8, color: MUTED, borderTopWidth: 1, borderTopColor: RULE, paddingTop: 6 },
});

// strip inline markdown emphasis to plain text (clean for V1)
function clean(t: string): string {
  return t.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1").replace(/`(.+?)`/g, "$1").replace(/^#+\s*/, "").trim();
}

function Body({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r/g, "").split("\n");
  const nodes: React.ReactNode[] = [];
  let key = 0;
  for (const raw of lines) {
    const l = raw.trimEnd();
    if (!l.trim()) continue;
    if (/^#\s/.test(l)) nodes.push(<Text key={key++} style={s.h1}>{clean(l)}</Text>);
    else if (/^##\s/.test(l)) nodes.push(<Text key={key++} style={s.h2}>{clean(l)}</Text>);
    else if (/^###\s/.test(l)) nodes.push(<Text key={key++} style={s.h3}>{clean(l)}</Text>);
    else if (/^[-*]\s/.test(l))
      nodes.push(<View key={key++} style={s.bulletRow}><Text style={s.bulletDot}>—</Text><Text style={s.bulletText}>{clean(l.replace(/^[-*]\s/, ""))}</Text></View>);
    else if (/^\d+\.\s/.test(l)) {
      const m = l.match(/^(\d+)\.\s(.*)$/)!;
      nodes.push(<View key={key++} style={s.bulletRow}><Text style={s.bulletDot}>{m[1]}.</Text><Text style={s.bulletText}>{clean(m[2])}</Text></View>);
    } else if (/^---+$/.test(l)) nodes.push(<View key={key++} style={s.rule} />);
    else nodes.push(<Text key={key++} style={s.p}>{clean(l)}</Text>);
  }
  return <>{nodes}</>;
}

export interface PdfDoc {
  eyebrow: string;   // "AI FOR BUSINESS LEADERS"
  title: string;     // reward / brief title
  metaLines: string[];
  markdown: string;
  footerLeft?: string;
}

export async function renderPdf(doc: PdfDoc): Promise<Buffer> {
  const el = (
    <Document title={doc.title} author="Vinay Pasricha">
      <Page size="A4" style={s.page}>
        <Text style={s.eyebrow}>{doc.eyebrow}</Text>
        <Text style={s.title}>{doc.title}</Text>
        {doc.metaLines.map((m, i) => <Text key={i} style={s.meta}>{m}</Text>)}
        <View style={s.rule} />
        <Body markdown={doc.markdown} />
        <View style={s.footer} fixed>
          <Text>{doc.footerLeft ?? "AI for Business Leaders — vinaypasricha.com"}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
  return (await renderToBuffer(el)) as Buffer;
}
