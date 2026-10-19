import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, CheckCircle2, Compass, BookOpenCheck, ScanSearch, Building2, GitCompareArrows, ClipboardCheck, Store, Sparkles } from "lucide-react";
import { ResearchExplorer } from "@/components/intelligence/research-explorer";
import { StudyLookupForm } from "@/components/intelligence/study-lookup-form";
import { ArtMolecule, ArtFlask } from "@/components/vial-art";

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

      <section className="relative isolate overflow-hidden border-b-2 border-[#17191b] bg-[#eafff6]">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-36 size-[460px] rounded-full border-2 border-[#17191b]/10 opacity-70" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 right-[10%] size-80 rounded-full border-2 border-[#17191b]/10 opacity-70" />
        <div className="relative mx-auto grid max-w-[1320px] items-center gap-5 px-5 py-9 sm:px-8 sm:py-12 lg:grid-cols-[1.2fr_.8fr]">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-[#17191b] bg-white px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-[.13em] text-[#1c7668]">
              <Compass className="size-3.5" /> Scientific research directory
            </span>
            <h1 className="mt-5 text-[clamp(2.6rem,5.3vw,5rem)] font-extrabold leading-[.99] tracking-[-.065em] text-[#17191b]">
              Pick a peptide.<br />{" "}<span className="text-[#168e7f]">Follow the evidence.</span>
            </h1>
            <p className="mt-5 max-w-[650px] text-sm font-medium leading-7 text-[#45645c] sm:text-base sm:leading-8">
              Browse 16 research subjects the way you explored the original marketplace. Follow the science, inspect material-verification requirements and check the public documentation behind research suppliers. No purchases or recommendations.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a href="#explore" className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-[#17191b] bg-[#17191b] px-5 py-3 text-sm font-extrabold text-white hover:bg-[#343839]">
                Browse the research <ArrowRight className="size-4" />
              </a>
              <Link href="/intelligence/cases/magainin-pexiganan" className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-[#17191b] bg-white px-5 py-3 text-sm font-extrabold text-[#17191b] hover:bg-[#f3fffa]">
                See a real example <ArrowUpRight className="size-4" />
              </Link>
            </div>
            <p className="mt-4 text-xs font-semibold text-[#678177]">16 curated subjects · 4 areas · 5 selected trial examples · No purchasing</p>
            <Link href="/intelligence/grading" className="mt-2 inline-flex items-center gap-1 text-xs font-extrabold text-[#266b61] hover:underline">
              Research file grades explained <ArrowUpRight className="size-3.5" />
            </Link>
            <Link href="/intelligence/explore/cagrilintide" className="mt-3 inline-flex items-center gap-1.5 text-xs font-extrabold text-[#266b61] hover:underline">
              Open example dossier <ArrowUpRight className="size-3.5" />
            </Link>
          </div>

          <div className="relative hidden min-h-[255px] items-center justify-center lg:flex" aria-hidden="true">
            <div className="absolute size-64 rounded-full border-2 border-[#17191b] bg-[#aef2d6] shadow-[12px_12px_0_#17191b]/10" />
            <ArtMolecule className="relative z-10 w-44 rotate-[-9deg] drop-shadow-[8px_9px_0_#17191b]" a="#5248bd" b="#12b3a6" c="#fff" />
            <ArtFlask className="absolute bottom-0 right-2 z-20 w-20 rotate-[13deg] drop-shadow-[5px_5px_0_#17191b]" fill="#a991ff" />
            <span className="absolute bottom-3 left-0 z-20 rotate-[-6deg] rounded-full border-2 border-[#17191b] bg-white px-4 py-2 text-[11px] font-extrabold uppercase tracking-[.12em] text-[#17191b]">
              Source first, always
            </span>
          </div>
        </div>
      </section>

      <section aria-labelledby="research-workflows" className="border-b-2 border-[#17191b] bg-white">
        <div className="mx-auto max-w-[1180px] px-5 py-8 sm:px-8 sm:py-11">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.13em] text-[#26806b]">The original marketplace depth, rebuilt for research</p>
              <h2 id="research-workflows" className="mt-2 text-2xl font-extrabold tracking-[-.05em] text-[#17191b] sm:text-3xl">What do you want to investigate?</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#65746c]">Start with a compound, investigate a research material or inspect supplier documentation. These are different evidence trails, all connected to the same research market.</p>
            </div>
            <span className="rounded-full border border-[#d5e5da] bg-[#effaf3] px-3 py-1.5 text-[11px] font-bold text-[#447666]">Pexiganan is the fully connected pilot</span>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {([
              { name: "Ask a research question", prompt: "Build a source-linked briefing for an AI-assisted review", href: "/intelligence/desk", icon: Sparkles, shade: "bg-[#f0ebff]", action: "Open Research Desk" },
              { name: "Explore a compound", prompt: "Identity, experiments, studies and related analogs", href: "/intelligence/explore/pexiganan", icon: Compass, shade: "bg-[#dffff1]", action: "Open Pexiganan dossier" },
              { name: "Audit its evidence", prompt: "Six claims, original sources and what remains uncertain", href: "/intelligence/passports/pexiganan", icon: BookOpenCheck, shade: "bg-[#edebff]", action: "See evidence passport" },
              { name: "Verify a record", prompt: "Check a PMID or NCT against the curated source register", href: "/intelligence/verify?ref=PMID%2036781451", icon: ScanSearch, shade: "bg-[#fff1dc]", action: "Try source verifier" },
              { name: "Trace the organizations", prompt: "Find named trial sponsors and unverified lab claims", href: "/intelligence/organizations", icon: Building2, shade: "bg-[#e6efff]", action: "Explore source organizations" },
              { name: "Inspect a research material", prompt: "Compare a lot number to its report and see the five checks still required", href: "/intelligence/materials?subject=pexiganan", icon: ClipboardCheck, shade: "bg-[#d7f8e6]", action: "Open material verification" },
              { name: "Review supplier documentation", prompt: "See original QC statements, source links and what's not authenticated", href: "/intelligence/providers", icon: Store, shade: "bg-[#f7f3db]", action: "Inspect supplier sources" },
            ] as const).map(({name,prompt,href,icon:Icon,shade,action})=>(
              <Link key={href} href={href} className="group flex min-h-[195px] flex-col rounded-[17px] border-2 border-[#17191b] bg-white p-4 shadow-[4px_5px_0_rgba(23,25,27,0.1)] transition-transform hover:-translate-y-1 focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#168e7f]">
                <span className={"grid size-11 place-items-center rounded-xl border border-[#17191b]/15 "+shade}><Icon className="size-5" /></span>
                <h3 className="mt-3 text-base font-extrabold tracking-[-.03em] text-[#17191b]">{name}</h3>
                <p className="mt-1 flex-1 text-xs leading-5 text-[#63716b]">{prompt}</p>
                <span className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-extrabold text-[#256e5d]">{action}<ArrowRight className="size-3.5 transition-transform group-hover:translate-x-1" /></span>
              </Link>
            ))}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-[#65746c]">
            <GitCompareArrows className="size-4" />
            <span>Need to compare two peptides?</span>
            <Link href="/intelligence/compare?subjects=magainin-2%2Cpexiganan" className="font-extrabold text-[#226956] underline underline-offset-2">Compare Magainin 2 and Pexiganan</Link>
            <span className="text-[#a0aaa5]">·</span>
            <Link href="/intelligence/grading" className="font-bold text-[#226956] underline underline-offset-2">What our research file grades mean</Link>
          </div>
        </div>
      </section>

      <section id="explore" className="mx-auto max-w-[1180px] scroll-mt-24 px-5 py-12 sm:px-8 sm:py-16">
        <ResearchExplorer />
        <section aria-label="Pexiganan complete source network" className="mt-10 grid items-center gap-4 rounded-[19px] border-2 border-[#17191b] bg-[#17191b] p-5 text-white sm:grid-cols-[minmax(0,1fr)_auto] sm:p-7">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.12em] text-[#aef2d6]">Featured research file · More than search</p>
            <h2 className="mt-2 text-xl font-extrabold tracking-[-.035em] sm:text-2xl">Pexiganan. Follow the complete source trail.</h2>
            <p className="mt-2 max-w-2xl text-xs leading-6 text-white/70 sm:text-sm">Four selected registered studies, ten original source records, six evidence checks and sponsor attribution. Connect the science to a separate, unverified research-material workpaper. No purchasing.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/intelligence/explore/pexiganan" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#aef2d6] px-4 py-3 text-xs font-extrabold text-[#174334] hover:bg-[#ceffe9]">
              Open the dossier <ArrowRight className="size-4" />
            </Link>
            <Link href="/intelligence/passports/pexiganan" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-white/30 px-4 py-3 text-xs font-extrabold text-white hover:bg-white/10">
              Evidence passport <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </section>
        <div className="mt-12 flex flex-col justify-between gap-5 rounded-2xl border border-[#d3e9df] bg-[#ecf8f1] p-5 sm:flex-row sm:items-center sm:p-7">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#277b66]">New · Guided source review</p>
            <h2 className="mt-2 text-lg font-semibold tracking-[-.03em] text-[#2d4b45]">Can a magainin experiment tell you what happened in a pexiganan trial?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#668078]">Follow two distinct molecular identities, an original membrane experiment and a registered trial. See what each source actually supports.</p>
          </div>
          <Link href="/intelligence/cases/magainin-pexiganan"
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#24665a] px-5 py-3 text-xs font-bold text-white hover:bg-[#30796b]">
            Open guided example <ArrowRight className="size-4" />
          </Link>
        </div>
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
            <h2 className="text-lg font-semibold text-[#2e2e42]">Research marketplace, not a retail checkout.</h2>
            <p className="mt-3 text-sm leading-7 text-[#777a88]">We preserve the original browsing and verification approach. Supplier QC descriptions are visible as first-party sources, not certifications. Purchasing, pricing, seller referrals and checkout remain disabled.</p>
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
