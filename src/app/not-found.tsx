import Link from "next/link";
import { ArrowUpRight, FileSearch } from "lucide-react";
import { evidenceOnlyPublicRelease } from "@/lib/public-research-release";

export default function NotFound() {
  if (evidenceOnlyPublicRelease()) {
    return (
      <section className="mx-auto flex min-h-[55vh] max-w-[850px] flex-col justify-center px-5 py-20 sm:px-8">
        <p className="text-xs font-extrabold uppercase tracking-[.15em] text-[#2b31d8]">Page not found</p>
        <h1 className="mt-5 text-balance text-4xl font-extrabold tracking-[-.05em] sm:text-6xl">
          There is no research page at this address.
        </h1>
        <p className="mt-6 max-w-2xl text-sm leading-7 text-[var(--muted)]">
          Some historical marketplace pages were retired when VialGrade moved to a research-only preview.
          Purchases, seller listings and checkout are unavailable. If you followed an outdated link,
          start with an active research topic or the guided study audit.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/intelligence" className="inline-flex items-center gap-2 rounded-full bg-[#111214] px-5 py-3 text-sm font-bold text-white">
            <FileSearch className="size-4" /> Explore research
          </Link>
          <Link href="/intelligence/cagrilintide/audit" className="inline-flex items-center gap-2 rounded-full border border-[#111214]/25 bg-white px-5 py-3 text-sm font-bold">
            View study audit <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </section>
    );
  }
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-[900px] flex-col items-center justify-center px-5 py-20 text-center sm:px-8">
      <p className="ink-1 rounded-full bg-white px-3 py-1 text-[11px] font-extrabold uppercase tracking-[.18em] text-[#111214]">404 · Record not found</p>
      <h1 className="mt-5 text-5xl font-extrabold tracking-[-.05em] text-[#111214] sm:text-6xl">This market record does not exist.</h1>
      <p className="mt-5 max-w-md text-sm font-medium leading-6 text-[var(--muted)]">The listing may have changed, or the URL may be incomplete.</p>
      <Link href="/market" className="ink hard-sm press mt-7 rounded-full bg-[#111214] px-5 py-3 text-sm font-bold text-white">Return to market</Link>
    </section>
  );
}
