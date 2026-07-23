import { Check, Sparkles } from "lucide-react";
import { SearchTrigger } from "@/components/search-trigger";
import { VialBuddy, VialPlain, ArtMolecule, ArtDroplet, ArtShieldCheck, ArtCoa } from "@/components/vial-art";

// The hero: Gumroad-scale type + scattered cartoon peptide props, on an Ascend-clean light base.
export function HomeHero() {
  return (
    <section className="relative isolate overflow-hidden border-b border-black/[.06]">
      {/* soft candy-science background */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(120%_90%_at_50%_-10%,rgba(76,110,245,.14),transparent_55%),radial-gradient(90%_70%_at_85%_20%,rgba(143,255,214,.16),transparent_55%),radial-gradient(80%_70%_at_10%_30%,rgba(109,93,252,.12),transparent_55%)]" />
      <div aria-hidden className="hero-grid pointer-events-none absolute inset-0 -z-20 opacity-40" />

      {/* floating cartoon props, scattered like Gumroad's coins */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <VialBuddy className="gum-float absolute left-[3%] top-[26%] hidden w-24 drop-shadow-[0_14px_30px_rgba(59,79,224,.18)] md:block lg:w-32" />
        <ArtMolecule className="gum-float-slow absolute right-[5%] top-[16%] hidden w-24 sm:block lg:w-32" />
        <VialPlain className="gum-float-rev absolute right-[9%] top-[52%] hidden w-14 md:block lg:w-16" liquid="#ffb787" cap="#ff9b57" />
        <ArtShieldCheck className="gum-float absolute left-[9%] bottom-[10%] hidden w-16 sm:block lg:w-20" />
        <ArtCoa className="gum-float-slow absolute right-[3%] bottom-[8%] hidden w-16 md:block lg:w-20" />
        <ArtDroplet className="gum-float-rev absolute left-[24%] top-[10%] hidden w-10 lg:block" fill="#4c6ef5" />
        <VialPlain className="gum-float absolute right-[26%] bottom-[4%] hidden w-12 lg:block" liquid="#8fffd6" cap="#22b8a0" />
      </div>

      <div className="mx-auto max-w-[1100px] px-5 pb-20 pt-16 text-center sm:px-8 sm:pb-28 sm:pt-24">
        <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[#2b31d8]/15 bg-white/80 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[.16em] text-[#2b31d8] shadow-sm backdrop-blur">
          <Sparkles className="size-3.5" /> The peptide verification layer
        </div>

        <h1 className="mx-auto mt-7 max-w-[16ch] text-balance text-[clamp(3.2rem,9vw,7.5rem)] font-semibold leading-[.86] tracking-[-.06em]">
          Know what&rsquo;s really
          <span className="block bg-gradient-to-r from-[#2b31d8] via-[#6d5dfc] to-[#12b3a6] bg-clip-text text-transparent">in the vial.</span>
        </h1>

        <p className="mx-auto mt-7 max-w-[52ch] text-balance text-lg leading-8 text-[var(--muted)] sm:text-xl">
          Every vendor&rsquo;s real lab tests, prices, and reputation &mdash; gathered and fact-checked in one place. So you never take a stranger&rsquo;s word for what&rsquo;s in the bottle.
        </p>

        <div className="mx-auto mt-10 max-w-2xl">
          <SearchTrigger />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm font-medium text-[var(--muted)]">
          <span className="inline-flex items-center gap-1.5"><Check className="size-4 text-[#12b3a6]" /> Prices compared across every vendor</span>
          <span className="inline-flex items-center gap-1.5"><Check className="size-4 text-[#12b3a6]" /> Lab tests matched to the exact batch</span>
          <span className="inline-flex items-center gap-1.5"><Check className="size-4 text-[#12b3a6]" /> Free &mdash; and we never sell anything</span>
        </div>
      </div>
    </section>
  );
}
