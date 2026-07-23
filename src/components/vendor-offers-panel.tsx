import { ExternalLink, Tag } from "lucide-react";
import type { VendorOffer } from "@/server/external/repository";

// Publicly advertised discount codes / offers. Informational only — VIAL takes no cut and does not
// endorse buying. We show where we saw it so a buyer can confirm it is still live.
export function VendorOffersPanel({ offers, vendorName }: { offers: VendorOffer[]; vendorName: string }) {
  if (offers.length === 0) return null;
  return (
    <section className="mx-auto max-w-[1320px] px-5 pt-14 sm:px-8 sm:pt-16">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Public offers</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-.045em]">Advertised codes &amp; deals</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Discounts {vendorName} advertises publicly, captured with a source link. Informational only — VIAL doesn&rsquo;t sell or take a cut, and codes expire, so confirm at the source.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {offers.map((o) => (
          <div key={o.description} className="flex flex-col gap-2.5 rounded-[22px] border border-black/[.07] bg-white p-4">
            <div className="flex items-center justify-between gap-2">
              {o.code
                ? <span className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-black/25 bg-black/[.03] px-2.5 py-1 font-mono text-sm font-semibold tracking-tight">{o.code}</span>
                : <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[.12em] text-[var(--muted)]"><Tag className="size-3" /> Offer</span>}
              {o.discount_pct != null && <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-700">{o.discount_pct}% off</span>}
            </div>
            <p className="text-sm leading-6 text-black/70">{o.description}</p>
            {o.free_shipping_threshold && <p className="text-[11px] text-[var(--muted)]">Free shipping {o.free_shipping_threshold}</p>}
            <a href={o.source_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-auto inline-flex items-center gap-1 text-[11px] font-semibold text-black/45 hover:text-black">
              {o.seen_on_vendor_site ? "seen on vendor site" : "source"} <ExternalLink className="size-3" />
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
