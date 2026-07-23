import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Compound } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { VialPlain } from "@/components/vial-art";

// Ascend-style "the compounds researchers ask for" — cartoon vial cards for the most-tracked compounds.
const CAPS = ["#3b4fe0", "#12b3a6", "#7c5cff", "#e0872b", "#d8467f", "#2b8fe0"];

export function HomeCompoundsShowcase({ compounds }: { compounds: Compound[] }) {
  return (
    <section className="relative isolate overflow-hidden border-y border-black/[.06] bg-[#f4f5ff]">
      <div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Best tracked</p>
            <h2 className="mt-4 text-balance text-[clamp(2.2rem,5vw,3.6rem)] font-semibold leading-[.96] tracking-[-.05em]">
              The compounds
              <span className="block bg-gradient-to-r from-[#2b31d8] to-[#6d5dfc] bg-clip-text text-transparent">people research most.</span>
            </h2>
          </div>
          <Link href="/compounds" className="inline-flex items-center gap-1.5 rounded-full bg-[#2b31d8] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#242ac2]">
            View full catalog <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {compounds.map((c, i) => (
            <Link key={c.slug} href={`/compounds/${c.slug}`} className="group flex items-center gap-5 rounded-[28px] border border-black/[.06] bg-white p-5 transition hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(20,22,27,.10)] sm:p-6">
              <div className="grid size-24 shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-black/[.04] to-transparent transition group-hover:scale-105">
                <VialPlain className="h-20" liquid={c.accent[0]} cap={CAPS[i % CAPS.length]} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[.1em] text-[var(--muted)]">{c.category}</p>
                <h3 className="mt-1 truncate text-xl font-semibold tracking-[-.03em]">{c.name}</h3>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-black/70">
                  <span className="font-semibold">{c.listings} vendor{c.listings === 1 ? "" : "s"}</span>
                  {c.medianPrice > 0 && <span>from {formatCurrency(c.medianPrice)}</span>}
                  {c.coaCount > 0 && <span className="inline-flex items-center gap-1 font-semibold text-[#2b31d8]">{c.coaCount} lab test{c.coaCount === 1 ? "" : "s"}</span>}
                </div>
              </div>
              <ArrowRight className="size-5 shrink-0 text-black/20 transition group-hover:translate-x-0.5 group-hover:text-black" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
