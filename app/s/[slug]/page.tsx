import type { Metadata } from "next";
import ParticipantSession from "@/components/abl/ParticipantSession";

// Short link shape used by the Harvard portal + the links already shared with
// participants: /ai-business-leaders/s/{slug}. Renders the same workspace as
// /session/{slug} so existing links keep working after this app takes over.
export const metadata: Metadata = {
  title: "AI for Business Leaders — Preparation Session",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ParticipantSession slug={slug} />;
}
