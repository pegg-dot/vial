import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, FileCheck2 } from "lucide-react";
import { notFound } from "next/navigation";
import { PUBLIC_RESEARCH_TOPICS } from "@/server/intelligence/public-trials";
import { findResearchTopic, getPublicDossier } from "@/server/intelligence/public-dossiers";
import { ResearchWorkspace } from "@/components/intelligence/research-workspace";

export const revalidate = 21_600;
export const dynamicParams = false;

export function generateStaticParams() {
  return PUBLIC_RESEARCH_TOPICS.map(topic => ({ topic: topic.key }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ topic: string }>;
}): Promise<Metadata> {
  const { topic } = await params;
  const research = findResearchTopic(topic);
  if (!research) return { title: "Research topic unavailable" };
  return {
    title: research.label + " research dossier",
    description: "Source-linked public research metadata for " + research.label + ": trial registry records, publication information, dates and limitations.",
    alternates: { canonical: "/intelligence/" + research.key },
  };
}

export default async function ResearchDossierPage({
  params,
}: {
  params: Promise<{ topic: string }>;
}) {
  const { topic } = await params;
  if (!findResearchTopic(topic)) notFound();

  const dossier = await getPublicDossier(topic);
  if (!dossier) notFound();

  return (
    <div>
      <section className="border-b-2 border-[#111214] bg-[#f0edff]">
        <div className="mx-auto max-w-[1120px] px-5 pb-14 pt-10 sm:px-8 sm:pb-16">
          <Link href="/intelligence" className="inline-flex items-center gap-2 text-xs font-extrabold text-[#2b31d8] hover:underline">
            <ArrowLeft className="size-4" /> All research dossiers
          </Link>
          <div className="mt-10 inline-flex items-center gap-2 rounded-full border border-[#111214]/20 bg-white px-4 py-2 text-[11px] font-extrabold uppercase tracking-[.14em] text-[#2b31d8]">
            <FileCheck2 className="size-4" /> Traceable source register
          </div>
          <h1 className="mt-6 text-[clamp(2.8rem,6vw,5.5rem)] font-extrabold leading-tight tracking-[-.06em]">
            {dossier.label}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-[#111214]/75">
            A dated, reproducible starting point for exploring this R&amp;D topic.
            It separates registered study metadata from scholarly literature metadata,
            and makes unavailable sources and unanswered questions explicit.
          </p>
          <nav className="mt-7 flex flex-wrap gap-2" aria-label="Related research dossiers">
            {PUBLIC_RESEARCH_TOPICS.filter(entry => entry.key !== topic).map(entry => (
              <Link key={entry.key} href={"/intelligence/" + entry.key}
                className="inline-flex items-center gap-2 rounded-full border border-[#111214]/25 bg-white px-4 py-2 text-xs font-bold hover:bg-[#f7f7f4]">
                {entry.label} <ArrowUpRight className="size-3.5" />
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <ResearchWorkspace dossiers={[dossier]} selectedTopic={dossier.key} />

      <section className="border-t border-[#111214]/15 bg-white">
        <div className="mx-auto max-w-[1120px] px-5 py-12 sm:px-8">
          <p className="text-xs leading-7 text-[var(--muted)]">
            These are search-result samples, not all trials or publications and not a systematic review.
            A keyword match does not establish that a source directly investigates this compound.
            This page does not assess medical efficacy, drug approval, laboratory purity, human-use
            legality, financial valuation or recommended investments.
            Review the <Link href="/legal/us-regulations" className="font-bold text-[#2b31d8] underline">U.S. regulatory overview</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
