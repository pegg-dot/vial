import type { Metadata } from "next";
import { NotebookPen } from "lucide-react";
import { deskTopicById, type DeskTopicId } from "@/lib/peptide-research-desk";
import { ResearchDesk } from "@/components/intelligence/research-desk";
import { PageHero, Pill, Section } from "@/components/intelligence/research-ui";
import { researchAiAvailability, issueResearchAiPilotToken } from "@/server/intelligence/research-ai-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Research Desk | VialGrade",
  description: "Investigate peptide study questions using original research records and source-linked briefing notes.",
  robots: { index: false, follow: false },
};

export default async function IntelligenceResearchDeskPage({ searchParams }: { searchParams: Promise<{ topic?: string | string[] }> }) {
  const { topic } = await searchParams;
  const requested = Array.isArray(topic) ? topic[0] : topic;
  const initialTopic: DeskTopicId = (requested && deskTopicById(requested)?.id) || "publication-matching";
  const aiStatus = researchAiAvailability();
  const aiPilotToken = issueResearchAiPilotToken();
  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <PageHero size="compact" art={["magnifier", "coa"]}
        breadcrumb={[{ href: "/intelligence/market", label: "Research Market" }, { label: "Research Desk" }]}
        eyebrow={<><NotebookPen className="size-4" aria-hidden="true" /> Source-linked briefing · Pexiganan pilot</>}
        title="Research Desk"
        lead="Build a source-linked brief. Pick a question, check each observation against its original record, then export."
        note="Pexiganan is the only compound with connected evidence here · records reviewed October 19, 2026 · limited pilot, not a scientific review."
        actions={<>
          <Pill href="/compounds/pexiganan" arrow="right">Open the Pexiganan dossier</Pill>
          <Pill href="/intelligence/passports/pexiganan" variant="ghost" arrow="right">Evidence passport</Pill>
        </>}
      />
      <Section tight>
        <ResearchDesk aiStatus={aiStatus} aiPilotToken={aiPilotToken} initialTopic={initialTopic} />
      </Section>
    </div>
  );
}
