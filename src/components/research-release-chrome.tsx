import Link from "next/link";
import { ArrowUpRight, ExternalLink, ChevronDown } from "lucide-react";
import { VialGradeMark } from "./wordmark";
import { ResearchGlobalSearch, ResearchMobileMenu } from "@/components/intelligence/research-global-search";
import { publicBrowseRelease } from "@/lib/public-research-release";
import { ResearchBrandTicker } from "@/components/intelligence/research-brand-ticker";

// One navigation: the directories first, the method page, then the research tools in one menu.
// Vendors, labs and batch records exist only under the browse release; the rest is always public.
const DIRECTORIES = [
  { href: "/compounds", label: "Compounds", note: "One page per compound: the research file, its studies and sources", browse: false },
  { href: "/vendors", label: "Vendors", note: "VialGrade letters with the evidence behind them, and each vendor's own site", browse: true },
  { href: "/labs", label: "Labs", note: "Who tests, and what they have published", browse: true },
  { href: "/passports", label: "Batch records", note: "The full test record for a batch, including results that disagree", browse: true },
  { href: "/how-we-check", label: "How we check", note: "The evidence ladder, lab reports, and the research-file letters", browse: false },
] as const;

// Four tools. The rest of what used to sit here lives where it is used: a trial ID goes through
// Check a source (which links the study audit), study sponsors sit on the pexiganan page, supplier
// documents sit inside Material checks, Purity vs grade is linked wherever a purity figure appears
// and from the method page, and the monthly update is a footer link.
const TOOLS = [
  { href: "/intelligence/desk", label: "Research Desk", note: "Build a source-linked brief from a fixed question" },
  { href: "/intelligence/verify", label: "Check a source", note: "An exact NCT, PMID or CID against the source register, the study audit one step on" },
  { href: "/intelligence/compare?subjects=magainin-2%2Cpexiganan", label: "Compare compounds", note: "Two research files side by side" },
  { href: "/intelligence/materials", label: "Material checks", note: "Compare the lot IDs on two documents; supplier quality documents" },
] as const;
const FOOTER_ONLY = [{ href: "/intelligence/updates", label: "Monthly update" }] as const;

const navItems = (browse: boolean) => DIRECTORIES.filter((item) => browse || !item.browse);
const toolItems = (browse: boolean) => TOOLS.filter((item) => browse || !("browse" in item && item.browse));

export function ResearchReleaseHeader() {
  return (
    <>
      {process.env.VIALGRADE_LOCAL_PREVIEW === "true" && (
        <div className="bg-[#0b6b60] px-4 py-2 text-center text-[11px] font-bold uppercase tracking-[.1em] text-white">
          Local interactive preview — these changes are not live on vialgrade.com
        </div>
      )}
      <div className="border-b border-[#111214]/15 bg-[var(--background)] px-4 py-1.5 text-center text-[11px] font-medium text-[var(--muted)]">
        Curated public research records · No sales, seller referrals, laboratory certification or medical advice
      </div>
      <header className="sticky top-0 z-40 border-b-2 border-[#111214] bg-[rgba(247,247,244,.95)] backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1320px] items-center gap-4 px-5 sm:gap-6 sm:px-8">
          <Link href="/intelligence" className="inline-flex shrink-0 items-center gap-2.5" aria-label="VialGrade home">
            <VialGradeMark idPrefix="research-head" className="size-8" />
            <span className="text-[16px] font-extrabold tracking-[.06em] text-[#111214]">VialGrade</span>
          </Link>
          <nav aria-label="Research navigation" className="hidden items-center gap-0.5 xl:flex">
            {navItems(publicBrowseRelease()).map(item => (
              <Link key={item.href} href={item.href}
                className="shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-bold text-[#3a3d46] transition hover:bg-black/[.06] hover:text-[#111214]">
                {item.label}
              </Link>
            ))}
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full px-3 py-2 text-[13px] font-bold text-[#3a3d46] hover:bg-black/[.06] hover:text-[#111214] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2b31d8] [&::-webkit-details-marker]:hidden">
                Research tools <ChevronDown className="size-3.5 transition group-open:rotate-180" />
              </summary>
              <div className="ink hard-sm absolute left-0 top-[calc(100%+13px)] z-50 w-[345px] rounded-[16px] bg-white p-2 shadow-lg">
                <p className="px-3 pb-1 pt-2 text-[10px] font-extrabold uppercase tracking-[.14em] text-[#2b31d8]">Research tools</p>
                <nav aria-label="Research tools" className="grid">
                  {toolItems(publicBrowseRelease()).map(item => (
                    <Link href={item.href} key={item.href} className="grid rounded-xl px-3 py-2.5 hover:bg-[#eef0ff]">
                      <span className="block text-[13px] font-extrabold text-[#111214]">{item.label}</span>
                      <span className="mt-0.5 block text-[11px] leading-5 text-[var(--muted)]">{item.note}</span>
                    </Link>
                  ))}
                </nav>
              </div>
            </details>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <ResearchGlobalSearch />
            <Link href="/login" aria-label="Existing account"
              className="ink-1 hidden whitespace-nowrap rounded-full bg-white px-4 py-2.5 text-xs font-bold hover:bg-[#eef0ff] sm:inline-flex">
              Existing account
            </Link>
            <nav aria-label="Mobile research navigation" className="xl:hidden">
              <ResearchMobileMenu primary={navItems(publicBrowseRelease())} tools={toolItems(publicBrowseRelease())} />
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
          {navItems(publicBrowseRelease()).map(item => <Link key={item.href} href={item.href} className="hover:text-white">{item.label}</Link>)}
        </nav>
        <nav aria-label="Research tools" className="grid content-start gap-2.5 text-xs font-medium text-white/65">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[.18em] text-white/45">Research tools</p>
          {[...toolItems(publicBrowseRelease()), ...FOOTER_ONLY].map(item => <Link key={item.href} href={item.href} className="hover:text-white">{item.label}</Link>)}
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
        <Link href="/how-we-check" className="inline-flex items-center gap-1 hover:text-white">Read the methodology <ArrowUpRight className="size-3" /></Link>
      </div>
    </footer>
  );
}
