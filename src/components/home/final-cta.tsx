import Link from "next/link";
import { ArrowRight, ScanLine } from "lucide-react";
import { VialBuddy, ArtMolecule, ArtFlask } from "@/components/vial-art";

// The closer: one clear action, hardened. Bold outlined block, hard shadows, sticker props.
export function HomeFinalCta() {
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-24">
      <div className="ink hard-lg relative isolate overflow-hidden rounded-[28px] bg-white px-6 py-16 text-center sm:px-10 sm:py-20">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <VialBuddy className="gum-float absolute left-[6%] top-[16%] hidden w-20 drop-shadow-[4px_4px_0_#111214] sm:block lg:w-24" liquid="#2b31d8" />
          <ArtMolecule className="gum-float-slow absolute right-[6%] top-[14%] hidden w-24 drop-shadow-[4px_4px_0_#111214] sm:block" />
          <ArtFlask className="gum-float-rev absolute right-[16%] bottom-[10%] hidden w-14 drop-shadow-[3px_3px_0_#111214] md:block" fill="#12b3a6" />
        </div>
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">One habit, zero scams</p>
        <h2 className="mx-auto mt-4 max-w-[17ch] text-balance text-[clamp(2.6rem,6.5vw,5rem)] font-extrabold leading-[.9] tracking-[-.045em]">
          Run it through VIAL <span className="text-[#2b31d8]">before you buy.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg font-medium leading-8 text-[var(--muted)]">
          Paste a vendor, a compound, or a COA code. We&rsquo;ll tell you what we know &mdash; and what nobody can verify yet.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href="/verify" className="ink hard press inline-flex items-center gap-2 rounded-full bg-[#2b31d8] px-7 py-4 text-base font-bold text-white">
            <ScanLine className="size-5" /> Verify something now
          </Link>
          <Link href="/market" className="ink hard-sm press inline-flex items-center gap-2 rounded-full bg-white px-7 py-4 text-base font-bold text-[#111214]">
            Browse the market <ArrowRight className="size-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
