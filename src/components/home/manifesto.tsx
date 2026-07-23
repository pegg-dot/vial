import { Check, X } from "lucide-react";
import { VialBuddy } from "@/components/vial-art";

const MOST = [
  "A purity number with no test behind it",
  "No batch to match the claim to",
  "Reviews you can’t tell are real",
  "Pages that vanish when they get caught",
];
const VIAL = [
  "The third-party COA, linked to the batch",
  "Purity read off the actual certificate",
  "Reputation pulled from public records",
  "Enforcement history that never disappears",
];

export function HomeManifesto() {
  return (
    <section className="relative isolate overflow-hidden border-y border-black/[.06] bg-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="gum-blob gum-float absolute -right-24 top-10 size-72 bg-[radial-gradient(circle,rgba(76,110,245,.12),transparent_70%)] blur-2xl" />
        <VialBuddy className="gum-float-slow absolute -left-6 bottom-6 hidden w-24 opacity-90 lg:block" liquid="#12b3a6" cap="#0e8f80" />
      </div>
      <div className="mx-auto max-w-[1100px] px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Why VIAL exists</p>
          <h2 className="mt-4 text-balance text-[clamp(2.4rem,5.5vw,4rem)] font-semibold leading-[.95] tracking-[-.05em]">
            The whole market runs on
            <span className="bg-gradient-to-r from-[#2b31d8] to-[#6d5dfc] bg-clip-text text-transparent"> &ldquo;trust me.&rdquo;</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-[var(--muted)]">
            Grey-market peptides are sold on a stranger&rsquo;s word and a purity number you can&rsquo;t check. VIAL replaces the word with the receipt.
          </p>
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-2">
          {/* what most sites give you */}
          <div className="rounded-[28px] border border-rose-200/70 bg-rose-50/40 p-7 sm:p-9">
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-rose-500/80">What most sites give you</p>
            <p className="mt-3 text-2xl font-semibold tracking-[-.03em] text-rose-900/70 line-through decoration-rose-400 decoration-2">Trust us &mdash; it&rsquo;s 99% pure.</p>
            <ul className="mt-6 space-y-3.5">
              {MOST.map((t) => (
                <li key={t} className="flex items-start gap-3 text-[15px] leading-6 text-black/60">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-rose-100"><X className="size-3 text-rose-500" /></span>{t}
                </li>
              ))}
            </ul>
          </div>
          {/* what VIAL gives you */}
          <div className="relative overflow-hidden rounded-[28px] border-2 border-[#2b31d8]/25 bg-[#2b31d8]/[.03] p-7 shadow-[0_20px_60px_rgba(43,49,216,.10)] sm:p-9">
            <span className="absolute right-6 top-6 rounded-full bg-[#2b31d8] px-3 py-1 text-[11px] font-bold uppercase tracking-[.12em] text-white">The VIAL way</span>
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#2b31d8]">What you get here</p>
            <p className="mt-3 max-w-[16ch] text-2xl font-semibold tracking-[-.03em] text-black">Here&rsquo;s the test. Check it yourself.</p>
            <ul className="mt-6 space-y-3.5">
              {VIAL.map((t) => (
                <li key={t} className="flex items-start gap-3 text-[15px] font-medium leading-6 text-black/80">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[#2b31d8]"><Check className="size-3 text-white" /></span>{t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
