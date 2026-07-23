import Link from "next/link";
import { ArrowRight, ScanLine } from "lucide-react";
import { VialBuddy, ArtMolecule, ArtDroplet } from "@/components/vial-art";

// The closer: one clear action — check something before you buy it.
export function HomeFinalCta() {
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-24">
      <div className="relative isolate overflow-hidden rounded-[40px] border border-black/[.06] bg-gradient-to-br from-[#eef0ff] via-white to-[#eafff8] px-6 py-16 text-center sm:px-10 sm:py-20">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <VialBuddy className="gum-float absolute left-[6%] top-[18%] hidden w-24 opacity-95 sm:block lg:w-28" />
          <ArtMolecule className="gum-float-slow absolute right-[7%] top-[14%] hidden w-24 opacity-90 sm:block" />
          <ArtDroplet className="gum-float-rev absolute right-[18%] bottom-[10%] hidden w-12 opacity-90 md:block" fill="#4c6ef5" />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">One habit, zero scams</p>
        <h2 className="mx-auto mt-4 max-w-[18ch] text-balance text-[clamp(2.4rem,6vw,4.6rem)] font-semibold leading-[.92] tracking-[-.05em]">
          Run it through VIAL <span className="bg-gradient-to-r from-[#2b31d8] to-[#12b3a6] bg-clip-text text-transparent">before you buy.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-[var(--muted)]">
          Paste a vendor, a compound, or a COA code. We&rsquo;ll tell you what we know &mdash; and what nobody can verify yet.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href="/verify" className="inline-flex items-center gap-2 rounded-full bg-[#2b31d8] px-7 py-4 text-base font-semibold text-white shadow-[0_14px_34px_rgba(43,49,216,.28)] transition hover:-translate-y-0.5 hover:bg-[#242ac2]">
            <ScanLine className="size-5" /> Verify something now
          </Link>
          <Link href="/market" className="inline-flex items-center gap-2 rounded-full border border-black/[.12] bg-white px-7 py-4 text-base font-semibold transition hover:-translate-y-0.5 hover:border-black/25">
            Browse the market <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
