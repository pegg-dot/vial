import type { Metadata } from "next";
import Link from "next/link";
import { ResearchDesk } from "@/components/intelligence/research-desk";
import { researchAiAvailability, issueResearchAiPilotToken } from "@/server/intelligence/research-ai-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Research Desk | VialGrade",
  description: "Investigate peptide study questions using original research records and source-linked briefing notes.",
  robots: { index: false, follow: false },
};

export default function IntelligenceResearchDeskPage() {
  const aiStatus = researchAiAvailability();
  const aiPilotToken = issueResearchAiPilotToken();
  return (
    <main className="min-h-screen bg-[#f7f8f6] pb-20">
      <div className="mx-auto max-w-[1200px] px-5 pt-7 sm:px-8 sm:pt-9">
        <nav aria-label="Research desk breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-[#6c8170]">
          <Link href="/intelligence#explore" className="hover:underline">Compounds</Link><span>/</span><span aria-current="page" className="font-semibold text-[#315d40]">Research Desk</span>
        </nav>
        <header className="mb-8 border-b border-[#dbe5dc] pb-7">
          <h1 className="mt-3 text-[clamp(2rem,4.5vw,3.1rem)] font-bold tracking-[-.055em] text-[#20382a]">Research Desk</h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#617367]">
            Explore a specific question using original source records. Start with Pexiganan, our most complete example. The notes show what is documented and what still needs checking.
          </p>
          <p className="mt-2 text-xs text-[#819084]">Source records last reviewed October 19, 2026 · Limited pilot, not a full scientific review</p>
        </header>
        <ResearchDesk aiStatus={aiStatus} aiPilotToken={aiPilotToken} />
      </div>
    </main>
  );
}
