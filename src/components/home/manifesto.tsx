import { Check, X } from "lucide-react";
import { ArtFlask } from "@/components/vial-art";

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
    <section className="relative isolate overflow-hidden border-b-2 border-[#111214] bg-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <ArtFlask className="gum-float-slow absolute left-[4%] bottom-8 hidden w-16 drop-shadow-[4px_4px_0_#111214] lg:block" fill="#12b3a6" />
      </div>
      <div className="mx-auto max-w-[1080px] px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Why VIAL exists</p>
          <h2 className="mt-4 text-balance text-[clamp(2.6rem,6vw,4.4rem)] font-extrabold leading-[.92] tracking-[-.045em]">
            The whole market runs on <span className="text-[#2b31d8]">&ldquo;trust me.&rdquo;</span>
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-lg font-medium leading-8 text-[var(--muted)]">
            Grey-market peptides are sold on a stranger&rsquo;s word and a purity number you can&rsquo;t check. VIAL replaces the word with the receipt.
          </p>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2">
          <div className="ink hard rounded-[22px] bg-white p-7 sm:p-9">
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#f5463d]">What most sites give you</p>
            <p className="mt-3 text-2xl font-extrabold tracking-[-.03em] text-[#111214]/45 line-through decoration-[#f5463d] decoration-[3px]">Trust us &mdash; it&rsquo;s 99% pure.</p>
            <ul className="mt-6 space-y-3.5">
              {MOST.map((t) => (
                <li key={t} className="flex items-start gap-3 text-[15px] font-medium leading-6 text-[#111214]/70">
                  <span className="ink-1 mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-[#ffecea]"><X className="size-3.5 text-[#f5463d]" /></span>{t}
                </li>
              ))}
            </ul>
          </div>
          <div className="ink hard-blue relative rounded-[22px] bg-white p-7 sm:p-9">
            <span className="ink absolute right-6 top-6 rounded-full bg-[#2b31d8] px-3 py-1 text-[11px] font-bold uppercase tracking-[.1em] text-white">The VIAL way</span>
            <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[#2b31d8]">What you get here</p>
            <p className="mt-3 max-w-[15ch] text-2xl font-extrabold tracking-[-.03em] text-[#111214]">Here&rsquo;s the test. Check it yourself.</p>
            <ul className="mt-6 space-y-3.5">
              {VIAL.map((t) => (
                <li key={t} className="flex items-start gap-3 text-[15px] font-semibold leading-6 text-[#111214]">
                  <span className="ink-1 mt-0.5 grid size-6 shrink-0 place-items-center rounded-md bg-[#2b31d8]"><Check className="size-3.5 text-white" /></span>{t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
