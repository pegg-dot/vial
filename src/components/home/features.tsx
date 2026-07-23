import { ArtMagnifierVial, ArtCoa, ArtShieldCheck, ArtMolecule } from "@/components/vial-art";

const CARDS = [
  { art: <ArtMolecule className="w-full" />, tint: "from-violet-100 to-violet-50", title: "Every price, side by side", body: "Same compound, same size, every vendor — lined up so the fair price (and the too-cheap-to-be-real one) is obvious at a glance." },
  { art: <ArtMagnifierVial className="w-full" />, tint: "from-blue-100 to-blue-50", title: "Lab tests, matched to the batch", body: "We don't take a COA's word for it. We match the third-party test to the exact batch you'd be buying — or tell you plainly there isn't one." },
  { art: <ArtCoa className="w-full" />, tint: "from-emerald-100 to-emerald-50", title: "The receipts, kept", body: "A timestamped copy of what every vendor and lab actually showed. When a page quietly 'disappears,' we still have the proof." },
  { art: <ArtShieldCheck className="w-full" />, tint: "from-amber-100 to-amber-50", title: "Buy direct. We never touch it.", body: "No cart, no checkout, no markup. Once you've decided, we hand you to the vendor's own site. VIAL never sells or sees a dollar." },
];

export function HomeFeatures() {
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-28">
      <div className="max-w-2xl">
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">What VIAL does for you</p>
        <h2 className="mt-4 text-balance text-[clamp(2.4rem,5.5vw,4rem)] font-semibold leading-[.95] tracking-[-.05em]">
          Everything you&rsquo;d check,
          <span className="block bg-gradient-to-r from-[#2b31d8] to-[#12b3a6] bg-clip-text text-transparent">already checked.</span>
        </h2>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {CARDS.map((c) => (
          <div key={c.title} className="group relative flex flex-col overflow-hidden rounded-[32px] border border-black/[.06] bg-white p-8 transition hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(20,22,27,.10)] sm:p-10">
            <div className={`mb-7 grid size-24 place-items-center rounded-[26px] bg-gradient-to-br ${c.tint} p-4 transition group-hover:scale-105`}>
              {c.art}
            </div>
            <h3 className="text-2xl font-semibold tracking-[-.03em]">{c.title}</h3>
            <p className="mt-3 max-w-md text-[15px] leading-7 text-[var(--muted)]">{c.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
