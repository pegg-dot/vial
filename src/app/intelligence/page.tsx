import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, BookOpen, CheckCircle2, Compass, GitCompareArrows, Microscope, ShieldCheck } from "lucide-react";
import { ResearchExplorer } from "@/components/intelligence/research-explorer";
import { StudyLookupForm } from "@/components/intelligence/study-lookup-form";

export const metadata: Metadata = {
  title: "VialGrade | Discover peptide research",
  description: "Explore peptide research themes, compare molecular identities and follow original scientific sources. No product sales or medical recommendations.",
  alternates: { canonical: "/intelligence" },
};

export default async function IntelligencePage({ searchParams }: {
  searchParams: Promise<{ notice?: string }>;
}) {
  const { notice } = await searchParams;
  return (
    <main className="bg-[#faf9f7]">
      {notice === "retired" && (
        <section role="status" className="border-b border-[#ecd9b8] bg-[#fff8ea]">
          <div className="mx-auto max-w-[1180px] px-5 py-4 text-sm leading-6 text-[#795620] sm:px-8">
            <strong>The old marketplace is inactive.</strong> VialGrade now provides research discovery, not product purchasing. Checkout, sellers and referrals remain unavailable. Existing customers can still access historical account information.
          </div>
        </section>
      )}

      <section className="relative isolate overflow-hidden border-b border-[#e6e5ee] bg-[#f7f5ff]">
        <div className="pointer-events-none absolute -right-36 -top-72 size-[590px] rounded-full border border-white/80 bg-[radial-gradient(circle,#eee9ff_0%,#f7f5ff_70%)] opacity-90" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-64 bottom-0 size-[420px] rounded-full border border-white/70" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-[1180px] items-center gap-9 px-5 pb-9 pt-8 sm:px-8 sm:pb-16 sm:pt-20 lg:grid-cols-[1.12fr_.88fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#dcd7f1] bg-white/75 px-3 py-1.5 text-[11px] font-bold tracking-wide text-[#5e5694]">
              <Compass className="size-3.5" /> Research discovery · Early preview
            </div>
            <h1 className="mt-6 max-w-[700px] text-[clamp(2.7rem,5.5vw,5.05rem)] font-semibold leading-[1.065] tracking-[-.07em] text-[#25223d]">
              Discover what deserves a closer look.
            </h1>
            <p className="mt-4 max-w-[610px] text-base leading-7 text-[#64657a] sm:mt-6 sm:leading-8">
              Explore peptide biology by research area, understand what each molecule is, compare unanswered questions, and follow the original scientific sources. The evidence, not a seller pitch, comes first.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-2 sm:mt-8 sm:gap-3">
              <a href="#explore" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#2d284e] px-4 py-3 text-sm font-semibold sm:px-6 text-white hover:bg-[#493b7c]">
                Explore research <ArrowRight className="size-4" />
              </a>
              <Link href="/intelligence/compare?subjects=semaglutide,tirzepatide&audience=researcher" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#d6d4e7] bg-white/85 px-4 py-3 text-sm font-semibold sm:px-5 text-[#514780] hover:bg-white">
                <GitCompareArrows className="size-4" /> See a comparison
              </Link>
            </div>
            <p className="mt-4 text-xs leading-6 text-[#87849b]">16 curated subjects · No purchasing · Not clinical or investment advice</p>
            <Link href="/intelligence/explore/cagrilintide" className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#58489e] sm:hidden">Open example dossier <ArrowUpRight className="size-3.5" /></Link>
          </div>

          <div className="relative hidden sm:block">
            <div className="overflow-hidden rounded-[24px] border border-[#e1dcef] bg-white shadow-[0_26px_60px_rgba(55,45,101,.09)]">
              <div className="border-b border-[#e9e7f0] bg-[#faf9fe] px-6 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold text-[#62598d]">Inside a research dossier</p>
                  <div className="flex gap-1.5" aria-hidden="true"><span className="size-2 rounded-full bg-[#cbc4e8]" /><span className="size-2 rounded-full bg-[#e1dbf5]" /><span className="size-2 rounded-full bg-[#efebff]" /></div>
                </div>
              </div>
              <div className="px-6 pb-6 pt-6 sm:px-7">
                <p className="text-[11px] font-bold uppercase tracking-[.13em] text-[#8279ab]">Example · Cagrilintide</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-.04em] text-[#27253e]">A molecule is only the starting point.</h2>
                <p className="mt-2 text-sm leading-6 text-[#77788b]">Understand the identity, investigate the mechanism and verify the study behind a claim.</p>
                <div className="mt-6 space-y-4">
                  <div className="flex gap-3 rounded-xl bg-[#f5f2ff] p-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#6357a7]"><Microscope className="size-4.5" /></span>
                    <div><p className="text-sm font-semibold text-[#303049]">Research question</p><p className="mt-1 text-xs leading-5 text-[#79758c]">How should standalone and combination study findings be distinguished?</p></div>
                  </div>
                  <div className="flex gap-3 rounded-xl bg-[#f8f9fb] p-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#676b91]"><BookOpen className="size-4.5" /></span>
                    <div><p className="text-sm font-semibold text-[#303049]">Evidence trail</p><p className="mt-1 text-xs leading-5 text-[#797b8c]">Molecular reference, publications and original trial records</p></div>
                  </div>
                  <div className="flex gap-3 rounded-xl bg-[#f8f9fb] p-4">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#676b91]"><ShieldCheck className="size-4.5" /></span>
                    <div><p className="text-sm font-semibold text-[#303049]">Uncertainty stays visible</p><p className="mt-1 text-xs leading-5 text-[#797b8c]">Formulations, aliases and limitations are not silently merged</p></div>
                  </div>
                </div>
                <Link href="/intelligence/explore/cagrilintide" className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#58489e] hover:underline">
                  Open example dossier <ArrowUpRight className="size-4" />
                </Link>
              </div>
            </div>
            <div className="pointer-events-none absolute -bottom-6 -left-5 -z-10 size-28 rounded-[28px] bg-[#e4ddfa]" aria-hidden="true" />
          </div>
        </div>
      </section>

      <section id="explore" className="mx-auto max-w-[1180px] scroll-mt-24 px-5 py-12 sm:px-8 sm:py-16">
        <ResearchExplorer />
      </section>

      <section id="trial-lookup" className="scroll-mt-24 border-t border-[#e6e6ee] bg-white">
        <div className="mx-auto grid max-w-[1180px] items-center gap-8 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-[#6657a0]"><CheckCircle2 className="size-4" /> Evidence tools</div>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-.045em] text-[#28273e]">Already have a clinical-trial ID?</h2>
            <p className="mt-3 max-w-lg text-sm leading-7 text-[#6d7180]">Investigate one actual registry record. Check its posted results status and verify which cited PubMed papers independently index the exact same trial ID.</p>
            <p className="mt-3 text-xs leading-6 text-[#818594]">This checks publications cited by the registry, not every paper about a drug. It does not interpret trial outcomes or guarantee publication completeness.</p>
          </div>
          <div className="rounded-[18px] border border-[#e1e0e8] bg-[#faf9fd] p-5 shadow-[0_12px_30px_rgba(35,35,73,.035)] sm:p-7">
            <StudyLookupForm />
            <p className="mt-4 text-xs leading-6 text-[#7c7f8d]">
              No ID? <Link href="/intelligence/studies/NCT05804162" className="font-semibold text-[#54459b] underline underline-offset-4">Open a verified example</Link>
            </p>
          </div>
        </div>
      </section>

      <section id="method" className="scroll-mt-24 border-t border-[#e6e6ee] bg-[#faf9f7]">
        <div className="mx-auto grid max-w-[1180px] gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_1fr]">
          <div>
            <h2 className="text-lg font-semibold text-[#2e2e42]">Research, not retail.</h2>
            <p className="mt-3 text-sm leading-7 text-[#777a88]">The original peptide marketplace is preserved as an inactive code archive. Public purchasing, pricing, seller referrals and checkout remain disabled. No commercial rights or legal approvals are implied by this discovery catalog.</p>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#2e2e42]">A starting collection, not a scientific verdict.</h2>
            <p className="mt-3 text-sm leading-7 text-[#777a88]">Identity references have been checked, but the linked paper and trial searches are not systematically screened reviews. Every proposed research question and comparison needs a qualified scientific review for consequential use.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
