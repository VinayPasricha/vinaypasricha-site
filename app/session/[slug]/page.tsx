import type { Metadata } from "next";
import ParticipantSession from "@/components/abl/ParticipantSession";

export const metadata: Metadata = {
  title: "AI for Business Leaders — Preparation Session",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ParticipantSession slug={slug} />;
}
