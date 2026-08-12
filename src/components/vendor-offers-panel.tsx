import { ExternalLink, Tag } from "lucide-react";
import type { VendorOffer } from "@/server/external/repository";

// Publicly advertised discount codes / offers. Informational only — VialGrade takes no cut and does not
// endorse buying. We show where we saw it so a buyer can confirm it is still live.
export function VendorOffersPanel({ offers, vendorName }: { offers: VendorOffer[]; vendorName: string }) {
  if (offers.length === 0) return null;
  return (
    <section className="mx-auto max-w-[1320px] px-5 pt-14 sm:px-8 sm:pt-16">
      <div className="mb-7">
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#2b31d8]">Public offers</p>
        <h2 className="mt-3 text-[clamp(1.8rem,3.6vw,2.6rem)] font-extrabold leading-[.98] tracking-[-.04em]">Advertised codes &amp; deals</h2>
        <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">Discounts {vendorName} advertises publicly, captured with a source link. Informational only — VialGrade doesn&rsquo;t sell or take a cut, and codes expire, so confirm at the source.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {offers.map((o) => (
          <div key={o.description} className="ink-1 hard flex flex-col gap-2.5 rounded-[18px] bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              {o.code
                ? <span className="inline-flex items-center gap-1.5 rounded-lg border-2 border-dashed border-black/30 bg-black/[.03] px-2.5 py-1 font-mono text-sm font-bold tracking-tight">{o.code}</span>
                : <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.12em] text-[var(--muted)]"><Tag className="size-3" /> Offer</span>}
              {o.discount_pct != null && <span className="ink-1 rounded-full bg-[#e6fbf6] px-2.5 py-1 text-sm font-extrabold text-[#0e8f80]">{o.discount_pct}% off</span>}
            </div>
            <p className="text-sm font-medium leading-6 text-black/70">{o.description}</p>
            {o.free_shipping_threshold && <p className="text-[11px] font-semibold text-[var(--muted)]">Free shipping {o.free_shipping_threshold}</p>}
            <a href={o.source_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-auto inline-flex items-center gap-1 text-[11px] font-bold text-black/45 hover:text-black">
              {o.seen_on_vendor_site ? "seen on vendor site" : "source"} <ExternalLink className="size-3" />
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
