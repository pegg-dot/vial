import { Check, Sparkles } from "lucide-react";
import { SearchTrigger } from "@/components/search-trigger";
import { VialBuddy, ArtMolecule, ArtFlask, ArtShieldCheck } from "@/components/vial-art";

// Hero: Gumroad-hard (flat cream, one accent, thick outlines, hard offset shadows) + Ascend sharpness.
export function HomeHero() {
  return (
    <section className="relative isolate overflow-hidden border-b-2 border-[#111214] bg-[var(--background)]">
      <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 -z-10 opacity-40" />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <VialBuddy className="gum-float absolute left-[4%] top-[24%] hidden w-[86px] drop-shadow-[5px_5px_0_#111214] md:block lg:w-28" liquid="#2b31d8" />
        <ArtMolecule className="gum-float-slow absolute right-[5%] top-[15%] hidden w-24 drop-shadow-[5px_5px_0_#111214] sm:block lg:w-28" />
        <ArtFlask className="gum-float-rev absolute right-[9%] bottom-[10%] hidden w-16 drop-shadow-[4px_4px_0_#111214] md:block lg:w-20" fill="#12b3a6" />
        <ArtShieldCheck className="gum-float absolute left-[10%] bottom-[9%] hidden w-16 drop-shadow-[4px_4px_0_#111214] sm:block lg:w-[76px]" />
      </div>

      <div className="mx-auto max-w-[1080px] px-5 pb-20 pt-16 text-center sm:px-8 sm:pb-28 sm:pt-24">
        <div className="ink hard-sm mx-auto inline-flex items-center gap-2 rounded-full bg-white px-4 py-1.5 text-[11px] font-bold uppercase tracking-[.16em] text-[#111214]">
          <Sparkles className="size-3.5 text-[#2b31d8]" /> The peptide verification layer
        </div>

        <h1 className="mx-auto mt-8 max-w-[15ch] text-balance text-[clamp(3.4rem,9.5vw,8rem)] font-extrabold leading-[.84] tracking-[-.055em]">
          Know what&rsquo;s really <span className="text-[#2b31d8]">in the vial.</span>
        </h1>

        <p className="mx-auto mt-7 max-w-[50ch] text-balance text-lg font-medium leading-8 text-[var(--muted)] sm:text-xl">
          Every vendor&rsquo;s real lab tests, prices, and reputation &mdash; gathered and fact-checked in one place. So you never take a stranger&rsquo;s word for what&rsquo;s in the bottle.
        </p>

        <div className="mx-auto mt-10 max-w-2xl">
          <SearchTrigger />
        </div>

        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-semibold text-[#111214]/70">
          {["Prices compared across every vendor", "Lab tests matched to the exact batch", "Free — and we never sell anything"].map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5"><Check className="size-4 text-[#12b3a6]" /> {t}</span>
          ))}
        </div>
      </div>
    </section>
  );
}
