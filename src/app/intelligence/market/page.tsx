import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileSearch, Layers3, ShieldCheck } from "lucide-react";
import { ArtDroplet, ArtTag, VialBuddy } from "@/components/vial-art";
import { ResearchExplorer } from "@/components/intelligence/research-explorer";
import { ResearchThemeRail } from "@/components/intelligence/research-original-home";
import { ResearchMarketShelves } from "@/components/intelligence/research-market-shelves";
import { parseExplorerState } from "@/lib/research-explorer-state";

export const metadata: Metadata = {
  title: "The research market | VialGrade",
  description: "Browse compounds, original source files and selected registered study references with VialGrade's research-only marketplace.",
  alternates: { canonical: "/intelligence/market" },
};

const START_PATHS = [
  { icon: Layers3, title: "Find a compound", note: "Start with a name, alias or research area", href: "#browse" },
  { icon: FileSearch, title: "Check a source ID", note: "Selected Pexiganan registry and publication IDs", href: "/intelligence/verify" },
  { icon: ShieldCheck, title: "Understand the file grade", note: "A, B and C describe linked sources, not effectiveness", href: "/intelligence/grading" },
] as const;

export default async function ResearchMarketPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const initial = parseExplorerState(await searchParams);
  const selected = initial.theme === "all" ? undefined : initial.theme;
  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <section className="relative overflow-hidden border-b-2 border-[#111214] bg-[#e9fff6]">
        <div className="mx-auto max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#0e8f80]">The research market</p>
          <h1 className="mt-5 max-w-[13ch] text-balance text-[clamp(3.1rem,7.6vw,6.5rem)] font-extrabold leading-[.9] tracking-[-.055em]">
            The research,<br /><span className="text-[#0e8f80]">on one screen.</span>
          </h1>
          <p className="mt-7 max-w-[570px] text-base font-medium leading-8 text-[#51585a] sm:text-lg">
            Compounds, identities, study records and their limitations side by side. The original sources stay one click away.
          </p>
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 hidden w-[35%] md:block">
            <ArtDroplet className="gum-float absolute right-[54%] top-[29%] w-13" fill="#12b3a6" />
            <ArtTag className="gum-float-slow absolute right-[14%] top-[18%] w-24" />
            <VialBuddy className="gum-float-rev absolute bottom-[14%] right-[29%] w-17" liquid="#12b3a6" />
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-[1320px] px-5 pt-8 sm:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {START_PATHS.map(({icon:Icon,title,note,href}) => (
            <Link href={href} key={title} className="ink hard-sm press group flex items-start gap-3 rounded-[14px] bg-white p-4">
              <div className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#12b3a6] text-white"><Icon className="size-5" /></div>
              <div className="min-w-0 flex-1"><p className="text-sm font-extrabold">{title} <ArrowRight className="inline size-3.5 transition-transform group-hover:translate-x-1" /></p><p className="mt-1 text-xs leading-5 text-[#656872]">{note}</p></div>
            </Link>
          ))}
        </div>
        <div className="mt-8"><ResearchThemeRail /></div>
        <div className="mt-8"><ResearchMarketShelves /></div>
        <section id="browse" className="scroll-mt-36 pt-12">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#0e8f80]">Every curated subject</p>
              <h2 className="mt-3 text-[clamp(2.5rem,5vw,4rem)] font-extrabold leading-[.9] tracking-[-.045em]">Browse everything.</h2>
              <p className="mt-3 text-sm font-medium leading-6 text-[#656872]">Filter by biology and documented source coverage. This is a reference library, not an inventory.</p>
            </div>
            <Link href="/intelligence/grading" className="ink hard-sm press inline-flex items-center gap-1 rounded-full bg-white px-4 py-2.5 text-xs font-bold">Our file checking method <ArrowRight className="size-4" /></Link>
          </div>
          <ResearchExplorer key={selected || "all"} initial={initial} />
        </section>
        <p className="mt-12 border-t border-[#111214]/15 pt-6 text-xs font-medium leading-6 text-[#696b71]">
          All sixteen cards are dated public research reference files. They do not establish clinical effectiveness, a tested physical lot, a scientific consensus or purchase eligibility.
        </p>
      </div>
    </div>
  );
}
