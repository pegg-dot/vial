import type { Metadata } from "next";
import { FileCheck2 } from "lucide-react";
import { notFound } from "next/navigation";
import { PUBLIC_RESEARCH_TOPICS } from "@/server/intelligence/public-trials";
import { findResearchTopic, getPublicDossier } from "@/server/intelligence/public-dossiers";
import { ResearchWorkspace } from "@/components/intelligence/research-workspace";
import { Frame, PageFootnote, PageHero, Pill, Section, UI } from "@/components/intelligence/research-ui";

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
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <PageHero art={["flask", "molecule"]}
        breadcrumb={[{ href: "/intelligence", label: "Home" }, { label: dossier.label }]}
        eyebrow={<><FileCheck2 className="size-4" aria-hidden="true" /> Traceable source register</>}
        title={dossier.label}
        lead="A dated, reproducible starting point for exploring this R&D topic. It separates registered study metadata from scholarly literature metadata, and makes unavailable sources and unanswered questions explicit."
        note="Search-result samples from two public systems, not a systematic review. Nothing here assesses efficacy, approval, purity or lawful supply."
        actions={<Pill href="#dossier-trail" variant="primary" arrow="right">Open the evidence trail</Pill>}
        aside={topic === "cagrilintide" ? (
          <Frame tone="blue" shadow="hard">
            <p className={UI.eyebrow}>Research-task prototype</p>
            <h2 className={UI.h3 + " mt-3"}>Follow the evidence from trial registrations to linked papers.</h2>
            <p className={UI.bodyInk + " mt-2"}>Inspect four selected official trials, compare the registered outcomes and result sections, and follow protocol-linked papers whose exact trial IDs PubMed independently indexes. This is not a complete clinical review.</p>
            <Pill href="/intelligence/cagrilintide/audit" variant="ink" size="sm" arrow="right" className="mt-4">Open study audit</Pill>
          </Frame>
        ) : undefined}>
        <nav aria-label="Related research dossiers" className="mt-7 flex flex-wrap gap-2">
          {PUBLIC_RESEARCH_TOPICS.filter(entry => entry.key !== topic).map(entry => (
            <Pill key={entry.key} href={"/intelligence/" + entry.key} variant="ghost" size="sm" arrow="right">{entry.label}</Pill>
          ))}
        </nav>
      </PageHero>

      <Section tight>
        <ResearchWorkspace dossiers={[dossier]} selectedTopic={dossier.key} />
      </Section>

      <PageFootnote href="/legal/us-regulations" linkLabel="U.S. regulatory overview">
        These are search-result samples, not all trials or publications and not a systematic review.
        A keyword match does not establish that a source directly investigates this compound.
        This page does not assess medical efficacy, drug approval, laboratory purity, human-use
        legality, financial valuation or recommended investments.
      </PageFootnote>
    </div>
  );
}
