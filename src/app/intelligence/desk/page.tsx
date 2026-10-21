import type { Metadata } from "next";
import Link from "next/link";
import { deskTopicById, type DeskTopicId } from "@/lib/peptide-research-desk";
import { ResearchDesk } from "@/components/intelligence/research-desk";
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
    <div className="min-h-screen bg-[#f7f8f6] pb-20">
      <div className="mx-auto max-w-[1200px] px-5 pt-7 sm:px-8 sm:pt-9">
        <nav aria-label="Research desk breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-[#6c8170]">
          <Link href="/intelligence/market" className="hover:underline">Research Market</Link><span>/</span><span aria-current="page" className="font-semibold text-[#315d40]">Research Desk</span>
        </nav>
        <header className="mb-5 mt-4 border-b border-[#dbe5dc] pb-4">
          <h1 className="text-[clamp(1.75rem,3.4vw,2.25rem)] font-bold tracking-[-.05em] text-[#20382a]">Research Desk</h1>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-[#617367]">
            Build a source-linked brief. Pick a question, check each observation against its original record, then export. To explore the compound itself, use its <Link href="/intelligence/explore/pexiganan" className="font-bold text-[#276d58] underline underline-offset-2">dossier</Link>.
          </p>
          <p className="mt-1 text-xs text-[#819084]">Pexiganan is the only compound with connected evidence here · records reviewed October 19, 2026 · limited pilot, not a scientific review</p>
        </header>
        <ResearchDesk aiStatus={aiStatus} aiPilotToken={aiPilotToken} initialTopic={initialTopic} />
      </div>
    </div>
  );
}
