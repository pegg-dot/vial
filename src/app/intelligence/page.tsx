import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, BookOpenCheck, DatabaseZap, GitCompareArrows, ShieldCheck } from "lucide-react";
import { getAllPublicDossiers } from "@/server/intelligence/public-dossiers";
import { ResearchWorkspace } from "@/components/intelligence/research-workspace";

export const metadata: Metadata = {
  title: "Research intelligence",
  description: "Investigate peptide R&D topics through linked public clinical-trial and scholarly metadata, dated source records, transparent limitations and portable citations.",
  alternates: { canonical: "/intelligence" },
};

export const revalidate = 21_600;

export default async function IntelligencePage() {
  const dossiers = await getAllPublicDossiers();

  return (
    <div>
      <section className="border-b-2 border-[#111214] bg-[#f0edff]">
        <div className="mx-auto max-w-[1120px] px-5 py-16 sm:px-8 sm:py-24">
          <p className="inline-flex items-center gap-2 rounded-full border border-[#111214]/20 bg-white px-4 py-2 text-[11px] font-extrabold uppercase tracking-[.15em] text-[#2b31d8]">
            <BookOpenCheck className="size-4" /> VialGrade Intelligence · Research beta
          </p>
          <h1 className="mt-7 max-w-[950px] text-balance text-[clamp(3rem,6.6vw,6.2rem)] font-extrabold leading-[.99] tracking-[-.065em]">
            Investigate the evidence, not the hype.
          </h1>
          <p className="mt-7 max-w-[710px] text-base leading-8 text-[#111214]/75 sm:text-lg">
            Compare public trial records and scholarly publication metadata on investigational
            peptide research. Follow original-source links, identify gaps and export citations.
            No peptide storefronts, purchase recommendations or user research profiles.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="#workspace" className="ink hard-sm press inline-flex items-center gap-2 rounded-full bg-[#111214] px-6 py-3 text-sm font-bold text-white">
              Explore evidence dossiers <ArrowUpRight className="size-4" />
            </a>
            <Link href="/legal/us-regulations" className="ink hard-sm press inline-flex items-center rounded-full bg-white px-6 py-3 text-sm font-bold text-[#111214]">
              Understand regulatory limits
            </Link>
          </div>
          <div className="mt-9 max-w-[780px] rounded-2xl border border-[#111214]/15 bg-white/75 p-5 sm:p-6">
            <h2 className="text-base font-extrabold">What can I actually do here?</h2>
            <p className="mt-2 text-sm leading-7 text-[#111214]/75">Open one of the three topics below, inspect the latest returned trial and publication records, filter for specific studies, and export source identifiers for your own review. This is source discovery, not AI interpretation or a complete scientific review.</p>
            <p className="mt-2 text-sm leading-7 text-[#111214]/75">If you need to understand whether evidence supports a particular conclusion, open the original trial or publication. VialGrade does not verify outcomes or assess study quality yet.</p>
          </div>
          <div className="mt-12 grid max-w-[810px] gap-4 border-t border-[#111214]/20 pt-5 sm:grid-cols-3">
            <div><p className="text-xl font-extrabold">02</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Independent public source systems</p></div>
            <div><p className="text-xl font-extrabold">03</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">Fixed research topics to explore</p></div>
            <div><p className="text-xl font-extrabold">0</p><p className="mt-1 text-xs leading-5 text-[var(--muted)]">User searches stored by this workspace</p></div>
          </div>
        </div>
      </section>

      <ResearchWorkspace dossiers={dossiers} />

      <section className="border-y-2 border-[#111214] bg-white">
        <div className="mx-auto grid max-w-[1120px] gap-8 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="text-xs font-extrabold uppercase tracking-[.14em] text-[#2b31d8]">What makes this different</p>
            <h2 className="mt-4 text-3xl font-extrabold tracking-[-.045em] sm:text-4xl">
              A research trail you can audit.
            </h2>
            <p className="mt-5 max-w-lg text-sm leading-7 text-[var(--muted)]">
              Instead of asking an AI model to improvise a conclusion, start with a traceable
              source register. The next stage is a citation-checked analysis assistant that can
              explain changes and contradictions without erasing uncertainty.
            </p>
          </div>
          <div className="grid gap-3">
            <div className="flex items-start gap-4 rounded-[16px] border border-[#111214]/15 bg-[#f7f7f4] p-5">
              <DatabaseZap className="mt-1 size-5 shrink-0 text-[#2b31d8]" />
              <div><h3 className="font-extrabold">Direct source retrieval</h3><p className="mt-1 text-sm leading-6 text-[var(--muted)]">Registry IDs, publication dates, DOI links and the source of every displayed record.</p></div>
            </div>
            <div className="flex items-start gap-4 rounded-[16px] border border-[#111214]/15 bg-[#f7f7f4] p-5">
              <GitCompareArrows className="mt-1 size-5 shrink-0 text-[#2b31d8]" />
              <div><h3 className="font-extrabold">Compare without false rankings</h3><p className="mt-1 text-sm leading-6 text-[var(--muted)]">Explore different source coverage without confusing paper counts with evidence of benefit.</p></div>
            </div>
            <div className="flex items-start gap-4 rounded-[16px] border border-[#111214]/15 bg-[#f7f7f4] p-5">
              <ShieldCheck className="mt-1 size-5 shrink-0 text-[#2b31d8]" />
              <div><h3 className="font-extrabold">Limits in the open</h3><p className="mt-1 text-sm leading-6 text-[var(--muted)]">Retrieval errors, research gaps and retraction metadata are never quietly converted into recommendations.</p></div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-5 py-12 sm:px-8">
        <p className="max-w-4xl text-xs leading-7 text-[var(--muted)]">
          Research-use notices are informational, not drug-law exemptions or researcher credentials.
          Clinical trial listings and scholarly metadata are not clinical advice, securities advice,
          FDA authorization or confirmation that a particular product is authentic or lawful to sell.
          OpenAlex metadata and ClinicalTrials.gov records are retrieved on the server through fixed
          public search topics, may be cached for up to six hours, and can be unavailable.
          We do not republish full article text or laboratory reports here. Read the{" "}
          <Link href="/legal/privacy" className="font-bold text-[#2b31d8] underline">privacy notice</Link>
          {" "}and <Link href="/legal/disclaimer" className="font-bold text-[#2b31d8] underline">research limitations</Link>.
        </p>
      </section>
    </div>
  );
}
