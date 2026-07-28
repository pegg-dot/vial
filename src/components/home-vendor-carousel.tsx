import Link from "next/link";
import { ArrowUpRight, FlaskConical } from "lucide-react";
import type { Vendor } from "@/lib/types";
import { VendorMark } from "./vendor-mark";

// Top-verified vendor carousel — hardened gumdrop cards: thick ink border, hard offset shadow, press.
export function HomeVendorCarousel({ vendors }: { vendors: Vendor[] }) {
  return (
    <div className="scroll-fade-x -mx-5 overflow-x-auto px-5 pb-3 pt-1 no-scrollbar sm:-mx-8 sm:px-8">
      <div className="flex w-max snap-x snap-mandatory gap-4">
        {vendors.map((v) => {
          const secondaryLabel = v.kind === "storefront" ? "Listings" : "Passports";
          const secondaryValue = v.kind === "storefront" ? v.productCount : v.passportCount;
          return (
            <Link
              key={v.slug}
              href={`/vendors/${v.slug}`}
              className="ink-1 hard press group flex w-[264px] shrink-0 snap-start flex-col rounded-[20px] bg-white p-5"
            >
              <div className="flex items-center gap-3">
                <VendorMark initials={v.initials} accent={v.accent} />
                <div className="min-w-0">
                  <p className="truncate font-bold tracking-[-.02em]">{v.name}</p>
                  <span className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[.08em] ${v.kind === "storefront" ? "bg-[#2b31d8] text-white" : "bg-[#111214] text-white"}`}>
                    {v.kind === "storefront" ? "Storefront" : "Manufacturer"}
                  </span>
                </div>
              </div>

              <div className="ink-1 mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-[var(--background)] p-3 text-center">
                <div>
                  <p className="text-xl font-extrabold tracking-[-.03em]">{v.coaCount}</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-[var(--muted)]">Lab tests</p>
                </div>
                <div>
                  <p className="text-xl font-extrabold tracking-[-.03em]">{v.medianPurity != null ? `${v.medianPurity.toFixed(1)}%` : "—"}</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-[var(--muted)]">Purity</p>
                </div>
                <div>
                  <p className="text-xl font-extrabold tracking-[-.03em]">{secondaryValue}</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-[var(--muted)]">{secondaryLabel}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-1.5 text-[12px] font-bold text-[#2b31d8]">
                <FlaskConical className="size-4" /> {v.coaCount > 0 ? "Independently tested" : "Profile on record"}
                <ArrowUpRight className="ml-auto size-4 text-[#111214] transition group-hover:translate-x-0.5" />
              </div>
            </Link>
          );
        })}

        <Link href="/vendors" className="ink hard press group flex w-[220px] shrink-0 snap-start flex-col items-start justify-center gap-3 rounded-[20px] bg-[#2b31d8] p-6 text-white">
          <span className="grid size-11 place-items-center rounded-xl bg-white text-[#2b31d8]"><ArrowUpRight className="size-5" /></span>
          <p className="text-lg font-extrabold leading-tight">Browse all vendors</p>
          <p className="text-xs font-medium text-white/75">Every storefront and upstream lab, with full histories.</p>
        </Link>
      </div>
    </div>
  );
}
