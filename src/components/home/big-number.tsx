// The Gumroad "$1,992,651" moment — one giant, real number on a solid block. Clean and disciplined.
export function HomeBigNumber({ labTests, vendors, listings }: { labTests: number; vendors: number; listings: number }) {
  return (
    <section className="border-y-2 border-[#111214] bg-[#2b31d8] text-white">
      <div className="mx-auto max-w-[1080px] px-5 py-24 text-center sm:px-8 sm:py-28">
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-white/65">Read by a human, not a scraper</p>
        <p className="mt-4 text-[clamp(5.5rem,20vw,15rem)] font-extrabold leading-[.78] tracking-[-.055em]">{labTests}</p>
        <p className="mx-auto mt-6 max-w-xl text-xl font-medium leading-8 text-white/80">
          independent lab certificates opened and read by hand &mdash; so a purity number on VialGrade actually means something.
        </p>
        <div className="mx-auto mt-12 grid max-w-2xl grid-cols-3 gap-4 border-t border-white/20 pt-8">
          {[[vendors, "vendors tracked"], [listings, "live listings"], ["$0", "what we take"]].map(([v, l]) => (
            <div key={l as string}>
              <p className="text-3xl font-extrabold tracking-[-.04em] sm:text-4xl">{v}</p>
              <p className="mt-1 text-xs font-semibold text-white/60">{l}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
