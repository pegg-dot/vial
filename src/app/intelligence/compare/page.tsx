import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowUpRight, ArrowRight, GitCompareArrows } from "lucide-react";
import { CompareTrialSource } from "@/components/intelligence/compare-trial-source";
import { ResearchFileGradeMark } from "@/components/intelligence/research-file-grade";
import {
  compareExplorerHref, researchSubjectBySlug, researchThemeById,
  registryDiscoveryUrl, verifiedPubmedSearchUrl, type ExplorerAudience,
} from "@/lib/research-explorer";

export const metadata: Metadata = {
  title: "Compare research subjects | VialGrade",
  description: "Compare mechanisms, research questions, identity and original source links without unsupported effectiveness rankings.",
  robots: { index: false, follow: false },
};

export default async function CompareResearchPage({ searchParams }: {
  searchParams: Promise<{ subjects?: string; audience?: string }>;
}) {
  const query = await searchParams;
  const ids = Array.from(new Set((query.subjects ?? "").slice(0, 250).split(",")
    .map(s => s.trim().toLowerCase()).filter(Boolean))).slice(0, 3);
  const subjects = ids.map(researchSubjectBySlug).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const audience: ExplorerAudience = query.audience === "analyst" ? "analyst" : "researcher";

  return (
    <main className="bg-[#faf9f7] pb-20">
      <div className="mx-auto max-w-[1180px] px-5 pt-9 sm:px-8">
        <Link href="/intelligence#explore" className="inline-flex items-center gap-2 text-xs font-semibold text-[#625894] hover:underline"><ArrowLeft className="size-4" /> Back to Research Explorer</Link>
        <div className="mt-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-[#625794]"><GitCompareArrows className="size-4" /> Scientific comparison</div>
            <h1 className="mt-4 text-[clamp(2.1rem,4vw,3.35rem)] font-semibold leading-tight tracking-[-.055em] text-[#27283d]">Compare compounds</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[#717581]">Put molecular references, study questions, and source records side by side. This is a research comparison, not a ranking of effectiveness or safety.</p>
            <Link href="/intelligence/grading" className="mt-3 inline-flex text-xs font-semibold text-[#356f65] underline underline-offset-2">How our file coverage grades work</Link>
          </div>
          {subjects.length >= 2 && (
            <div className="flex shrink-0 gap-2">
              <Link href={compareExplorerHref(ids, "researcher")} aria-current={audience === "researcher" ? "page" : undefined}
                className={"rounded-lg px-4 py-2.5 text-xs font-semibold " + (audience === "researcher" ? "bg-[#30294e] text-white" : "border border-[#dfdfe9] bg-white text-[#6c6c7c]")}>Researcher</Link>
              <Link href={compareExplorerHref(ids, "analyst")} aria-current={audience === "analyst" ? "page" : undefined}
                className={"rounded-lg px-4 py-2.5 text-xs font-semibold " + (audience === "analyst" ? "bg-[#30294e] text-white" : "border border-[#dfdfe9] bg-white text-[#6c6c7c]")}>Analyst</Link>
            </div>
          )}
        </div>

        {subjects.length < 2 ? (
          <section className="mt-8 rounded-2xl border border-[#e0dee9] bg-white p-9">
            <h2 className="text-xl font-semibold text-[#2b2c3e]">Select two or three research subjects.</h2>
            <p className="mt-3 text-sm leading-7 text-[#777b88]">The comparison uses only curated, source-linked identities. Please choose subjects using the catalog.</p>
            <Link href="/intelligence#explore" className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#282441] px-5 py-3 text-sm font-semibold text-white">Browse catalog <ArrowRight className="size-4" /></Link>
          </section>
        ) : (
          <>
            {subjects.some(s => s.slug === "magainin-2") && subjects.some(s => s.slug === "pexiganan") && (
              <section className="mt-6 flex flex-col gap-3 rounded-xl border border-[#c8e0d3] bg-[#eff9f3] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.1em] text-[#3b846e]">Source-backed case study</p>
                  <p className="mt-1 text-sm font-semibold text-[#2d554c]">Why a membrane experiment and a pexiganan trial cannot be treated as the same evidence</p>
                </div>
                <Link href="/intelligence/cases/magainin-pexiganan" className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#216b60] hover:underline">Read the source trail <ArrowRight className="size-4" /></Link>
              </section>
            )}
            <div className={"mt-8 grid gap-4 md:grid-cols-2 " + (subjects.length === 3 ? "xl:grid-cols-3" : "xl:grid-cols-2")}>
              {subjects.map(subject => {
                const theme = researchThemeById(subject.theme);
                return (
                  <article key={subject.slug} className="flex flex-col overflow-hidden rounded-2xl border border-[#dedfe9] bg-white">
                    <div className="h-2" style={{ backgroundColor: theme.color }} />
                    <div className="flex flex-1 flex-col p-6">
                      <span className="text-xs font-semibold" style={{ color: theme.color }}>{theme.name}</span>
                      <h2 className="mt-2 text-2xl font-semibold tracking-[-.04em] text-[#29283a]">{subject.name}</h2>
                      <p className="mt-1 text-xs leading-6 text-[#818491]">{subject.family}</p>
                      <div className="mt-3"><ResearchFileGradeMark subject={subject} withCount /></div>
                      <div className="mt-6 space-y-5">
                        <div><h3 className="text-[11px] font-bold uppercase tracking-[.12em] text-[#777384]">Mechanism or experimental focus</h3><p className="mt-2 text-sm leading-6 text-[#383b4b]">{subject.mechanism}</p></div>
                        <div><h3 className="text-[11px] font-bold uppercase tracking-[.12em] text-[#777384]">{audience === "analyst" ? "Diligence question" : "Research question"}</h3><p className="mt-2 text-sm leading-6 text-[#383b4b]">{audience === "analyst" ? subject.analystAngle : subject.studyQuestion}</p></div>
                        <div><h3 className="text-[11px] font-bold uppercase tracking-[.12em] text-[#777384]">Molecular identity</h3><p className="mt-2 text-sm leading-6 text-[#383b4b]">{subject.referenceLabel}</p></div>
                        <div className="rounded-xl bg-[#f7f6fa] p-3.5"><h3 className="text-[11px] font-bold uppercase tracking-[.12em] text-[#766884]">Important limitation</h3><p className="mt-2 text-sm leading-6 text-[#616474]">{subject.identityCaveat}</p></div>
                      </div>
                      <Suspense fallback={<div className="mt-5 rounded-xl border border-[#dedfe9] bg-[#f9f8fc] p-4 text-xs text-[#7b7b87]">Checking official study sources…</div>}>
                        <CompareTrialSource subject={subject} />
                      </Suspense>
                      <div className="mt-auto space-y-3 pt-6">
                        <a href={subject.referenceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between border-b border-[#ececf1] pb-2 text-xs font-semibold text-[#5c4ca4]">PubChem identity <ArrowUpRight className="size-4" /></a>
                        <a href={verifiedPubmedSearchUrl(subject)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between border-b border-[#ececf1] pb-2 text-xs font-semibold text-[#5c4ca4]">PubMed search <ArrowUpRight className="size-4" /></a>
                        <a href={registryDiscoveryUrl(subject)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between border-b border-[#ececf1] pb-2 text-xs font-semibold text-[#5c4ca4]">Registry search <ArrowUpRight className="size-4" /></a>
                        <Link href={"/intelligence/explore/" + subject.slug} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#302b52] px-4 py-3 text-xs font-semibold text-white hover:bg-[#4b3e7b]">Open research dossier <ArrowRight className="size-4" /></Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <p className="mt-6 rounded-xl border border-[#e0e1e8] bg-white p-4 text-xs leading-6 text-[#777986]">
              The selected study panels contain ONE registry record per subject, not a comparative or head-to-head clinical evaluation. Comparison means differences in research questions, peptide identity, and the kinds of original records worth reviewing. There is no automatic cross-study inference or numerical ranking. These search links have not been independently screened for source relevance.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
