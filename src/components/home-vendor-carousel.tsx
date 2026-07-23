import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";
import type { Vendor } from "@/lib/types";
import { VendorMark } from "./vendor-mark";

// Top-verified vendor carousel — replaces the 83-wide grid. A curated, horizontally-scrollable row of
// gumdrop cards (soft accent wash, rounded, friendly) showing each vendor's real evidence at a glance.
export function HomeVendorCarousel({ vendors }: { vendors: Vendor[] }) {
  return (
    <div className="scroll-fade-x -mx-5 overflow-x-auto px-5 pb-2 no-scrollbar sm:-mx-8 sm:px-8">
      <div className="flex w-max snap-x snap-mandatory gap-4">
        {vendors.map((v) => {
          const secondaryLabel = v.kind === "storefront" ? "Listings" : "Passports";
          const secondaryValue = v.kind === "storefront" ? v.productCount : v.passportCount;
          return (
            <Link
              key={v.slug}
              href={`/vendors/${v.slug}`}
              className="group relative flex w-[268px] shrink-0 snap-start flex-col overflow-hidden rounded-[28px] border border-black/[.07] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,.03)] transition hover:-translate-y-1 hover:border-black/[.12] hover:shadow-[0_22px_60px_rgba(20,22,27,.12)]"
            >
              {/* soft gumdrop accent wash from the vendor's own colors */}
              <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full opacity-25 blur-2xl transition group-hover:opacity-40" style={{ background: `radial-gradient(circle, ${v.accent[0]}, ${v.accent[1] ?? v.accent[0]})` }} />
              <div className="flex items-center gap-3">
                <VendorMark initials={v.initials} accent={v.accent} />
                <div className="min-w-0">
                  <p className="truncate font-semibold tracking-[-.02em]">{v.name}</p>
                  <span className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${v.kind === "storefront" ? "bg-blue-50 text-blue-700" : "bg-black/[.05] text-black/55"}`}>
                    {v.kind === "storefront" ? "Storefront" : "Manufacturer"}
                  </span>
                </div>
              </div>

              <div className="relative mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-black/[.025] p-3 text-center">
                <div>
                  <p className="text-lg font-semibold tracking-[-.03em]">{v.coaCount}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--muted)]">Lab tests</p>
                </div>
                <div>
                  <p className="text-lg font-semibold tracking-[-.03em]">{v.medianPurity != null ? `${v.medianPurity.toFixed(1)}%` : "—"}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--muted)]">Median purity</p>
                </div>
                <div>
                  <p className="text-lg font-semibold tracking-[-.03em]">{secondaryValue}</p>
                  <p className="mt-0.5 text-[10px] text-[var(--muted)]">{secondaryLabel}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-1.5 text-[11px] font-semibold text-blue-700/90">
                <FlaskConical className="size-3.5" /> {v.coaCount > 0 ? "Independently tested" : "Profile on record"}
                <ArrowRight className="ml-auto size-4 text-black/25 transition group-hover:translate-x-0.5 group-hover:text-black" />
              </div>
            </Link>
          );
        })}

        {/* Gumdrop CTA card to the full directory */}
        <Link
          href="/vendors"
          className="group flex w-[220px] shrink-0 snap-start flex-col items-start justify-center gap-3 rounded-[28px] border border-dashed border-black/15 bg-gradient-to-br from-violet-50 to-blue-50 p-6 transition hover:-translate-y-1 hover:border-black/25"
        >
          <span className="grid size-11 place-items-center rounded-2xl bg-white shadow-sm transition group-hover:scale-105">
            <ArrowRight className="size-5 text-black" />
          </span>
          <p className="text-lg font-semibold leading-tight tracking-[-.02em]">Browse all vendors</p>
          <p className="text-xs text-[var(--muted)]">Every storefront and upstream lab we track, with full histories.</p>
        </Link>
      </div>
    </div>
  );
}
