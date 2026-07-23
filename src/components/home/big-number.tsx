import { VialPlain, ArtMolecule, ArtDroplet } from "@/components/vial-art";

// The Gumroad "$1,992,651" moment — one giant, real number, on a bold color block.
export function HomeBigNumber({ labTests, vendors, listings }: { labTests: number; vendors: number; listings: number }) {
  return (
    <section className="relative isolate overflow-hidden bg-[#2b31d8] text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 top-0 size-80 rounded-full bg-[radial-gradient(circle,rgba(143,255,214,.28),transparent_70%)] blur-2xl" />
        <div className="absolute -right-24 bottom-0 size-96 rounded-full bg-[radial-gradient(circle,rgba(180,150,255,.35),transparent_70%)] blur-2xl" />
        <VialPlain className="gum-float absolute left-[8%] top-[22%] hidden w-16 opacity-95 lg:block" liquid="#8fffd6" cap="#12b3a6" />
        <ArtMolecule className="gum-float-slow absolute right-[9%] top-[16%] hidden w-24 opacity-90 lg:block" />
        <ArtDroplet className="gum-float-rev absolute right-[16%] bottom-[14%] hidden w-12 opacity-90 md:block" fill="#8fffd6" />
      </div>
      <div className="mx-auto max-w-[1100px] px-5 py-24 text-center sm:px-8 sm:py-28">
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-white/60">Read by a human, not a scraper</p>
        <p className="mt-4 text-[clamp(5rem,17vw,13rem)] font-semibold leading-[.8] tracking-[-.06em]">{labTests}</p>
        <p className="mx-auto mt-6 max-w-xl text-xl leading-8 text-white/75">
          lab certificates opened, read, and matched to real batches by hand &mdash; so a purity number on VIAL means something.
        </p>
        <div className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-4 border-t border-white/15 pt-8">
          {[[vendors, "vendors tracked"], [listings, "live listings"], ["$0", "what we take"]].map(([v, l]) => (
            <div key={l as string}>
              <p className="text-3xl font-semibold tracking-[-.04em] sm:text-4xl">{v}</p>
              <p className="mt-1 text-xs text-white/55">{l}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
