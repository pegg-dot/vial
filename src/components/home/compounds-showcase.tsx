import Link from "next/link";
import { ArrowUpRight, ArrowRight } from "lucide-react";
import type { Compound } from "@/lib/types";
import { formatCurrency } from "@/lib/format";
import { VialPlain } from "@/components/vial-art";

// Ascend-style "the compounds researchers ask for" — hardened sticker-vial cards.
const LIQUIDS = ["#2b31d8", "#12b3a6", "#6d5dfc", "#e0872b", "#d8467f", "#2b8fe0"];

export function HomeCompoundsShowcase({ compounds }: { compounds: Compound[] }) {
  return (
    <section className="border-y-2 border-[#111214] bg-[var(--background)]">
      <div className="mx-auto max-w-[1320px] px-5 py-20 sm:px-8 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Best tracked</p>
            <h2 className="mt-4 text-balance text-[clamp(2.4rem,5.5vw,4rem)] font-extrabold leading-[.92] tracking-[-.045em]">
              The compounds <span className="text-[#2b31d8]">people research most.</span>
            </h2>
          </div>
          <Link href="/compounds" className="ink hard-sm press inline-flex items-center gap-1.5 rounded-full bg-[#2b31d8] px-5 py-3 text-sm font-bold text-white">
            View full catalog <ArrowRight className="size-4" />
          </Link>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {compounds.map((c, i) => (
            <Link key={c.slug} href={`/compounds/${c.slug}`} className="ink-1 hard press group flex items-center gap-5 rounded-[20px] bg-white p-5">
              <div className="ink-1 grid size-[88px] shrink-0 place-items-center rounded-2xl bg-[var(--background)]">
                <VialPlain className="h-[62px]" liquid={LIQUIDS[i % LIQUIDS.length]} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[.08em] text-[var(--muted)]">{c.category}</p>
                <h3 className="mt-1 truncate text-xl font-extrabold tracking-[-.03em]">{c.name}</h3>
                <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-semibold text-[#111214]/70">
                  <span>{c.listings} listing{c.listings === 1 ? "" : "s"}</span>
                  {c.medianPrice > 0 && <span>median {formatCurrency(c.medianPrice)}</span>}
                  {c.coaCount > 0 && <span className="text-[#2b31d8]">{c.coaCount} lab test{c.coaCount === 1 ? "" : "s"}</span>}
                </div>
              </div>
              <ArrowUpRight className="size-5 shrink-0 text-[#111214] transition group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
