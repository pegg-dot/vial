import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, BookOpenCheck, GitCompareArrows, SearchCheck, Sparkles } from "lucide-react";
import { ResearchDesk } from "@/components/intelligence/research-desk";
import { researchAiAvailability, issueResearchAiPilotToken } from "@/server/intelligence/research-ai-config";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Research Desk | VialGrade Intelligence",
  description: "Create research-question-specific, source-backed evidence briefing packets for peptide research and biotech diligence, without unverified efficacy or supplier claims.",
  robots: { index: false, follow: false },
};

export default function IntelligenceResearchDeskPage() {
  const aiStatus = researchAiAvailability();
  const aiPilotToken = issueResearchAiPilotToken();
  return (
    <main className="bg-[#faf9f7] pb-24">
      <div className="mx-auto max-w-[1200px] px-5 pt-8 sm:px-8">
        <nav aria-label="Research desk breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#6c8074]">
          <Link href="/intelligence" className="hover:underline">Research Market</Link>
          <span>/</span>
          <span aria-current="page" className="text-[#2a765e]">Research Desk</span>
        </nav>
        <header className="relative mt-6 overflow-hidden rounded-[22px] border-2 border-[#17191b] bg-[#e9fff2] p-6 sm:p-9">
          <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full border-2 border-[#17191b]/10" aria-hidden="true" />
          <div className="relative max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#17191b] bg-white px-3 py-2 text-[11px] font-black uppercase tracking-[.12em] text-[#247863]">
              <Sparkles className="size-4" /> AI-ready scientific evidence
            </p>
            <h1 className="mt-5 text-[clamp(2.6rem,5vw,4.5rem)] font-extrabold leading-[1.04] tracking-[-.06em] text-[#17191b]">
              Ask better questions.<br /><span className="text-[#148e76]">Keep the sources.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-sm leading-7 text-[#507263] sm:text-base">
              Work from a real peptide evidence network, not an unsupported AI guess. Choose a question, trace the original records, and turn the verified source pointers into a briefing you can review or use with an AI model.
            </p>
            <p className="mt-4 text-[11px] font-bold text-[#648170]">Pexiganan pilot · 6 curated observations · 10 original source records · Model calls require explicit opt-in</p>
          </div>
        </header>

        <section aria-label="Research desk assurances" className="my-6 grid gap-3 sm:grid-cols-3">
          {([
            { title: "Original source links", subtitle: "Exact IDs, not generic search snippets", icon: BookOpenCheck },
            { title: "Unknowns stay visible", subtitle: "No manufactured clinical or patent certainty", icon: SearchCheck },
            { title: "Connected to the market", subtitle: "Dossiers, sponsors and material checks", icon: GitCompareArrows },
          ] as const).map(({ title, subtitle, icon: Icon }) => (
            <div key={title} className="flex items-center gap-3 rounded-xl border border-[#dbe8df] bg-white p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#eff9f1]"><Icon className="size-5 text-[#257661]" /></span>
              <div><p className="text-xs font-extrabold text-[#2e4939]">{title}</p><p className="mt-1 text-[11px] leading-5 text-[#77867b]">{subtitle}</p></div>
            </div>
          ))}
        </section>
        <ResearchDesk aiStatus={aiStatus} aiPilotToken={aiPilotToken} />
        <div className="mt-8 flex flex-wrap gap-4">
          <Link href="/intelligence" className="inline-flex items-center gap-2 text-xs font-bold text-[#347461] hover:underline"><ArrowLeft className="size-4" /> Back to Research Market</Link>
          <Link href="/intelligence/grading" className="inline-flex items-center gap-2 text-xs font-bold text-[#347461] hover:underline">What our research grades actually mean <ArrowRight className="size-4" /></Link>
        </div>
      </div>
    </main>
  );
}
