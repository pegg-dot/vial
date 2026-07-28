import { ArtMagnifierVial, ArtCoa, ArtShieldCheck, ArtMolecule } from "@/components/vial-art";

const CARDS = [
  { art: <ArtMolecule className="w-16" />, tint: "bg-[#eef0ff]", title: "Every price, side by side", body: "Same compound, same size, every vendor — lined up so the fair price (and the too-cheap-to-be-real one) is obvious at a glance." },
  { art: <ArtMagnifierVial className="w-16" />, tint: "bg-[#e6fbf6]", title: "Lab tests, matched to the batch", body: "We don't take a COA's word for it. We match the third-party test to the exact batch you'd be buying — or tell you plainly there isn't one." },
  { art: <ArtCoa className="w-14" />, tint: "bg-[#eef0ff]", title: "The receipts, kept", body: "A timestamped copy of what every vendor and lab actually showed. When a page quietly 'disappears,' we still have the proof." },
  { art: <ArtShieldCheck className="w-14" />, tint: "bg-[#e6fbf6]", title: "Buy direct. We never touch it.", body: "No cart, no checkout, no markup. Once you've decided, we hand you to the vendor's own site. VIAL never sells or sees a dollar." },
];

export function HomeFeatures() {
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-28">
      <div className="max-w-2xl">
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">What VIAL does for you</p>
        <h2 className="mt-4 text-balance text-[clamp(2.6rem,6vw,4.4rem)] font-extrabold leading-[.92] tracking-[-.045em]">
          Everything you&rsquo;d check, <span className="text-[#2b31d8]">already checked.</span>
        </h2>
      </div>

      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {CARDS.map((c) => (
          <div key={c.title} className="ink hard press flex flex-col rounded-[22px] bg-white p-8 sm:p-9">
            <div className={`ink-1 mb-7 grid size-24 place-items-center rounded-2xl ${c.tint}`}>{c.art}</div>
            <h3 className="text-2xl font-extrabold tracking-[-.03em]">{c.title}</h3>
            <p className="mt-3 max-w-md text-[15px] font-medium leading-7 text-[var(--muted)]">{c.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
