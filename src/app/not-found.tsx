import Link from "next/link";
import { FileSearch } from "lucide-react";
import { evidenceOnlyPublicRelease } from "@/lib/public-research-release";
import { Pill, Section, UI } from "@/components/intelligence/research-ui";

export default function NotFound() {
  if (evidenceOnlyPublicRelease()) {
    return (
      <Section narrow className="flex min-h-[55vh] flex-col items-center justify-center text-center">
        <p className={UI.eyebrow}>Page not found</p>
        <h1 className={UI.h1Compact + " mt-5 max-w-[20ch]"}>
          There is no research page at this address.
        </h1>
        <p className={UI.body + " mt-6 max-w-2xl leading-7"}>
          Some historical marketplace pages were retired when VialGrade moved to a research-only preview.
          Purchases, seller listings and checkout are unavailable. If you followed an outdated link,
          start with an active research topic or the guided study audit.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Pill href="/intelligence" variant="primary" icon={FileSearch}>Explore research</Pill>
          <Pill href="/intelligence/cagrilintide/audit" variant="secondary" arrow="up">View study audit</Pill>
        </div>
      </Section>
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
