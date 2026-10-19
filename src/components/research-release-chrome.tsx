import Link from "next/link";
import { ChevronDown, ExternalLink } from "lucide-react";
import { VialGradeMark } from "./wordmark";

/**
 * The browsing shell has one primary job: let visitors find a research record.
 * Keep secondary methods and advanced tools accessible without putting nine
 * equally weighted navigation links in front of first-time visitors.
 */
const extraLinks = [
  { label: "Research Desk", href: "/intelligence/desk" },
  { label: "Material evidence", href: "/intelligence/materials" },
  { label: "Organizations & labs", href: "/intelligence/organizations" },
  { label: "Supplier documentation", href: "/intelligence/providers" },
  { label: "File-checking method", href: "/intelligence/grading" },
  { label: "Trial lookup", href: "/intelligence#trial-lookup" },
] as const;

function MoreMenu({ mobile = false }: { mobile?: boolean }) {
  return (
    <details className="group relative">
      <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-[#394c40] hover:bg-[#edf3ee] [&::-webkit-details-marker]:hidden">
        {mobile ? "Menu" : "More"} <ChevronDown aria-hidden="true" className="size-3.5 transition-transform group-open:rotate-180" />
      </summary>
      <div className={"absolute right-0 top-[calc(100%+8px)] z-50 w-[min(86vw,275px)] rounded-xl border border-[#d7e0d8] bg-white p-2 shadow-[0_14px_36px_rgba(16,32,21,.15)] " +
        (mobile ? "" : "")}>
        <p className="px-3 pb-2 pt-1 text-[11px] font-semibold text-[#778579]">Research tools</p>
        {mobile && (
          <>
            <Link href="/intelligence/compare?subjects=semaglutide,tirzepatide" className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#314938] hover:bg-[#edf5ee]">Compare compounds</Link>
            <Link href="/intelligence/verify" className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#314938] hover:bg-[#edf5ee]">Verify a source</Link>
          </>
        )}
        {extraLinks.map(item => (
          <Link key={item.href} href={item.href}
            className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#314938] hover:bg-[#edf5ee]">
            {item.label}
          </Link>
        ))}
        <div className="mt-1 border-t border-[#e4e9e4] pt-1">
          <Link href="/login" className="block rounded-lg px-3 py-2.5 text-sm font-medium text-[#314938] hover:bg-[#edf5ee]">Existing account</Link>
        </div>
      </div>
    </details>
  );
}

export function ResearchReleaseHeader() {
  return (
    <>
      {process.env.VIALGRADE_LOCAL_PREVIEW === "true" && (
        <div className="bg-[#1e5540] px-4 py-2 text-center text-[11px] font-semibold text-white">
          Local preview — these changes are not yet live on vialgrade.com
        </div>
      )}
      <div className="border-b border-[#e6ebe5] bg-[#f7f9f6] px-4 py-1.5 text-center text-[11px] text-[#6a786d]">
        Public research records only. No peptide sales or medical advice.
      </div>
      <header className="sticky top-0 z-40 border-b border-[#dce4dc] bg-white/95 backdrop-blur-lg">
        <div className="mx-auto flex min-h-[64px] max-w-[1232px] items-center justify-between gap-3 px-5 py-2 sm:px-8">
          <Link href="/intelligence" className="inline-flex shrink-0 items-center gap-2.5" aria-label="VialGrade home">
            <VialGradeMark idPrefix="research-head" className="size-8" />
            <span className="text-[17px] font-bold tracking-[.035em] text-[#1c2d22]">VialGrade</span>
          </Link>
          <nav aria-label="Research navigation" className="hidden items-center gap-1 md:flex">
            <Link href="/intelligence#explore" className="inline-flex min-h-10 items-center rounded-lg bg-[#e7f2e9] px-3.5 py-2 text-sm font-semibold text-[#255a38] hover:bg-[#d5e8d9]">Explore</Link>
            <Link href="/intelligence/compare?subjects=semaglutide,tirzepatide" className="inline-flex min-h-10 items-center rounded-lg px-3.5 py-2 text-sm font-medium text-[#394c40] hover:bg-[#edf3ee]">Compare</Link>
            <Link href="/intelligence/verify" className="inline-flex min-h-10 items-center rounded-lg px-3.5 py-2 text-sm font-medium text-[#394c40] hover:bg-[#edf3ee]">Verify</Link>
            <MoreMenu />
          </nav>
          <nav aria-label="Mobile research navigation" className="flex items-center gap-0.5 md:hidden">
            <Link href="/intelligence#explore" className="inline-flex min-h-10 items-center rounded-lg bg-[#e7f2e9] px-3 py-2 text-sm font-semibold text-[#255a38]">Explore</Link>
            <MoreMenu mobile />
          </nav>
        </div>
      </header>
    </>
  );
}

export function ResearchReleaseFooter() {
  return (
    <footer className="border-t border-[#dce5dd] bg-[#f2f5f1]">
      <div className="mx-auto grid max-w-[1200px] gap-8 px-5 py-10 sm:grid-cols-[1.4fr_1fr_1fr] sm:px-8">
        <div>
          <div className="flex items-center gap-2"><VialGradeMark idPrefix="research-foot" className="size-7" /><span className="text-sm font-bold tracking-[.03em] text-[#203429]">VialGrade</span></div>
          <p className="mt-3 max-w-xs text-xs leading-6 text-[#68796b]">
            Public scientific references, organized for research. Source coverage is not a measure of safety, clinical benefit, or material authenticity.
          </p>
        </div>
        <nav aria-label="Browse and research tools" className="grid content-start gap-2 text-xs font-medium text-[#465d4d]">
          <p className="mb-1 text-xs font-semibold text-[#263c2d]">Browse</p>
          <Link href="/intelligence#explore" className="hover:underline">Peptide research</Link>
          <Link href="/intelligence/compare?subjects=magainin-2%2Cpexiganan" className="hover:underline">Compare compounds</Link>
          <Link href="/intelligence/desk" className="hover:underline">Research Desk</Link>
          <Link href="/intelligence/verify" className="hover:underline">Verify a source</Link>
          <Link href="/intelligence/materials" className="hover:underline">Material evidence</Link>
          <Link href="/intelligence/providers" className="hover:underline">Supplier documentation</Link>
        </nav>
        <nav aria-label="About and legal" className="grid content-start gap-2 text-xs font-medium text-[#465d4d]">
          <p className="mb-1 text-xs font-semibold text-[#263c2d]">About</p>
          <Link href="/intelligence/grading" className="hover:underline">File-checking method</Link>
          <Link href="/legal/us-regulations" className="hover:underline">Regulatory information</Link>
          <Link href="/legal/privacy" className="hover:underline">Privacy</Link>
          <Link href="/legal/contact" className="hover:underline">Contact and corrections</Link>
          <Link href="/legal/disclaimer" className="hover:underline">Research limitations</Link>
          <a href="https://clinicaltrials.gov/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">ClinicalTrials.gov <ExternalLink className="size-3" /></a>
        </nav>
      </div>
      <div className="mx-auto max-w-[1200px] border-t border-[#dbe4dc] px-5 py-5 text-[11px] leading-5 text-[#738076] sm:px-8">
        © 2026 VialGrade. Informational research, not medical, legal or investment advice. Previous purchasing tools remain disabled.
      </div>
    </footer>
  );
}
