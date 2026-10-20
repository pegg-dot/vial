import Link from "next/link";
import { ArrowUpRight, ExternalLink, ChevronDown } from "lucide-react";
import { VialGradeMark } from "./wordmark";
import { ResearchGlobalSearch, ResearchMobileMenu } from "@/components/intelligence/research-global-search";
import { ResearchBrandTicker } from "@/components/intelligence/research-brand-ticker";

// Keep the original visible brand and the main research tasks; everything
// else stays available in a single clearly labeled source/tools menu.
const NAV = [
  { href: "/intelligence/market", label: "Market" },
  { href: "/intelligence/verify", label: "Check a source" },
  { href: "/intelligence/desk", label: "Research Desk" },
  { href: "/intelligence/grading", label: "How we check" },
] as const;

const OTHER_RESEARCH_AREAS = [
  { href: "/intelligence/market#browse", label: "All compounds", description: "Search and filter the 16-record library" },
  { href: "/intelligence#trial-lookup", label: "Open a trial ID", description: "Look up a ClinicalTrials.gov registration" },
  { href: "/intelligence/organizations", label: "Study sponsors", description: "Names recorded on selected trial registrations" },
  { href: "/intelligence/providers", label: "Supplier documentation", description: "Unverified company-published laboratory methods" },
  { href: "/intelligence/materials", label: "Sample report checks", description: "Compare the lot IDs you already have" },
  { href: "/intelligence/compare?subjects=magainin-2%2Cpexiganan", label: "Compare compounds", description: "Compare two source files side by side" },
] as const;

export function ResearchReleaseHeader() {
  return (
    <>
      {process.env.VIALGRADE_LOCAL_PREVIEW === "true" && (
        <div className="bg-[#174f40] px-4 py-2 text-center text-[11px] font-bold uppercase tracking-[.1em] text-white">
          Local interactive preview — these changes are not live on vialgrade.com
        </div>
      )}
      <div className="border-b border-[#dededb] bg-[#f7f7f4] px-4 py-1.5 text-center text-[11px] font-medium text-[#666971]">
        Curated public research records · No sales, seller referrals, laboratory certification or medical advice
      </div>
      <header className="sticky top-0 z-40 border-b-2 border-[#111214] bg-[rgba(247,247,244,.95)] backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1320px] items-center gap-4 px-5 sm:gap-6 sm:px-8">
          <Link href="/intelligence" className="inline-flex shrink-0 items-center gap-2.5" aria-label="VialGrade home">
            <VialGradeMark idPrefix="research-head" className="size-8" />
            <span className="text-[16px] font-extrabold tracking-[.06em] text-[#111214]">VialGrade</span>
          </Link>
          <nav aria-label="Research navigation" className="hidden items-center gap-0.5 xl:flex">
            {NAV.map(item => (
              <Link key={item.href} href={item.href}
                className="shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-bold text-[#55575f] transition hover:bg-black/[.06] hover:text-[#111214]">
                {item.label}
              </Link>
            ))}
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full px-3 py-2 text-[13px] font-bold text-[#55575f] hover:bg-black/[.06] hover:text-[#111214] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b31d8] [&::-webkit-details-marker]:hidden">
                More research <ChevronDown className="size-3.5 transition group-open:rotate-180" />
              </summary>
              <div className="ink hard-sm absolute left-0 top-[calc(100%+13px)] z-50 w-[345px] rounded-[16px] bg-white p-2 shadow-lg">
                <p className="px-3 pb-1 pt-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#2b31d8]">Other research tools</p>
                <nav aria-label="More research areas" className="grid">
                  {OTHER_RESEARCH_AREAS.map(item => (
                    <Link href={item.href} key={item.href} className="rounded-xl px-3 py-2.5 hover:bg-[#eef0ff]">
                      <span className="block text-[13px] font-extrabold text-[#17191b]">{item.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-5 text-[#656b70]">{item.description}</span>
                    </Link>
                  ))}
                </nav>
              </div>
            </details>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ResearchGlobalSearch />
            <Link href="/intelligence/compare?subjects=magainin-2%2Cpexiganan"
              className="ink-1 hidden whitespace-nowrap rounded-full bg-white px-4 py-2.5 text-xs font-bold hover:bg-[#f3f3f1] sm:block">
              Compare
            </Link>
            <Link href="/login" aria-label="Existing account"
              className="ink hard-sm press hidden rounded-full bg-[#111214] px-4 py-2.5 text-xs font-bold text-white sm:inline-flex">
              Existing account
            </Link>
            <nav aria-label="Mobile research navigation" className="xl:hidden">
              <ResearchMobileMenu />
            </nav>
          </div>
        </div>
      </header>
      <ResearchBrandTicker />
    </>
  );
}

export function ResearchReleaseFooter() {
  return (
    <footer className="border-t-2 border-[#111214] bg-[#111214] text-white">
      <div className="mx-auto grid max-w-[1320px] gap-9 px-5 py-16 sm:grid-cols-[1.35fr_1fr_1fr_1fr] sm:px-8">
        <div>
          <div className="flex items-center gap-2">
            <VialGradeMark idPrefix="research-foot" className="size-7" />
            <span className="text-sm font-extrabold tracking-[.07em]">VialGrade</span>
          </div>
          <p className="mt-4 max-w-xs text-xs font-medium leading-6 text-white/60">
            Compounds, research questions and original source records in one place. This library makes source checks inspectable; it does not certify experiments, physical batches, or clinical claims.
          </p>
        </div>
        <nav aria-label="Explore research" className="grid content-start gap-2.5 text-xs font-medium text-white/65">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.18em] text-white/45">Explore</p>
          <Link href="/intelligence/market" className="hover:text-white">Market</Link>
          <Link href="/intelligence/market#browse" className="hover:text-white">Compounds</Link>
          <Link href="/intelligence/organizations" className="hover:text-white">Study sponsors</Link>
          <Link href="/intelligence/providers" className="hover:text-white">Supplier documents</Link>
          <Link href="/intelligence/compare?subjects=magainin-2%2Cpexiganan" className="hover:text-white">Compare</Link>
          <Link href="/intelligence/desk" className="hover:text-white">Research Desk</Link>
        </nav>
        <nav aria-label="Verify research" className="grid content-start gap-2.5 text-xs font-medium text-white/65">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.18em] text-white/45">How we check</p>
          <Link href="/intelligence/grading" className="hover:text-white">File coverage method</Link>
          <Link href="/intelligence/verify" className="hover:text-white">Check a source ID (pilot)</Link>
          <Link href="/intelligence/materials" className="hover:text-white">Material documents</Link>
          <Link href="/intelligence/passports/pexiganan" className="hover:text-white">Evidence passport</Link>
          <Link href="/intelligence/organizations" className="hover:text-white">Study organizations</Link>
        </nav>
        <nav aria-label="About and legal" className="grid content-start gap-2.5 text-xs font-medium text-white/65">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.18em] text-white/45">Legal</p>
          <Link href="/legal/privacy" className="hover:text-white">Privacy</Link>
          <Link href="/legal/us-regulations" className="hover:text-white">Regulations</Link>
          <Link href="/legal/disclaimer" className="hover:text-white">Research limitations</Link>
          <Link href="/legal/contact" className="hover:text-white">Contact and corrections</Link>
          <a href="https://clinicaltrials.gov/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-white">ClinicalTrials.gov <ExternalLink className="size-3" /></a>
        </nav>
      </div>
      <div className="mx-auto flex max-w-[1320px] flex-wrap items-center justify-between gap-3 border-t border-white/15 px-5 py-6 text-[11px] text-white/55 sm:px-8">
        <p>© 2026 VialGrade · Research context only · No commerce.</p>
        <Link href="/intelligence/grading" className="inline-flex items-center gap-1 hover:text-white">Read the methodology <ArrowUpRight className="size-3" /></Link>
      </div>
    </footer>
  );
}
