import Link from "next/link";
import { Crown, ExternalLink, TriangleAlert } from "lucide-react";
import type { Product } from "@/lib/types";
import type { LabTestRow } from "@/server/ingest/lab-tests";
import { formatCurrency, formatPricePerMg } from "@/lib/format";

// The single most useful surface for a non-expert buyer: every vendor selling this
// compound, ranked by real cost-per-milligram, with the independently-tested purity
// beside it where we have one. Cheapest-and-tested rises to the top on its own.
export function PriceLeaderboard({ compoundName, listings, labTests }: { compoundName: string; listings: Product[]; labTests: LabTestRow[] }) {
  const ranked = listings.filter((p) => p.pricePerMg && p.pricePerMg > 0).sort((a, b) => a.pricePerMg! - b.pricePerMg!);
  if (ranked.length < 2) return null;

  // Suspiciously-cheap and real-cost-per-active-mg come straight from the canonical listing
  // trust (the exact values the product buy box and the compare table show), so this table
  // can never disagree with them for the same listing.
  const isSuspicious = (p: Product) => p.trust?.priceFlag === "too-cheap";

  // Best INDEPENDENTLY-tested purity per vendor for this compound — display column only. Must exclude
  // self-published records (is_independent=false) or a vendor's own number would render in the same
  // emerald "independent test purity" pill the rest of the app reserves for third-party evidence.
  const purityByVendor = new Map<string, number>();
  for (const t of labTests) {
    if (!t.vendor_slug || t.purity_pct == null || t.is_independent === false) continue;
    const p = Number(t.purity_pct);
    if (!purityByVendor.has(t.vendor_slug) || p > purityByVendor.get(t.vendor_slug)!) purityByVendor.set(t.vendor_slug, p);
  }
  // Crown the cheapest listing that ISN'T suspiciously cheap — the best legit deal.
  const cheapest = ranked.find((p) => !isSuspicious(p)) ?? ranked[0];

  // Best TRUE value: lowest canonical real cost per active mg among the listings that carry one.
  const withReal = ranked.filter((p) => p.trust?.adjustedPricePerMg != null);
  const bestValue = withReal.length ? withReal.reduce((a, b) => (a.trust!.adjustedPricePerMg! <= b.trust!.adjustedPricePerMg! ? a : b)) : null;

  return (
    <section className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8">
      <div className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#2b31d8]">Compare by real cost</p>
        <h2 className="mt-2 text-3xl font-extrabold tracking-[-.045em]">Cheapest {compoundName}, by price per mg</h2>
        <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">Vials come in different sizes, so the sticker price lies. This ranks every listing by what a milligram actually costs — with independent test purity where we have it.</p>
      </div>
      <div className="overflow-x-auto rounded-[18px] ink bg-white hard">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b-2 border-[#111214] bg-[#f7f7f4] text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3 font-bold">#</th>
              <th className="px-5 py-3 font-bold">Vendor</th>
              <th className="px-5 py-3 font-bold">Size</th>
              <th className="px-5 py-3 font-bold">Price</th>
              <th className="px-5 py-3 font-bold">Per mg</th>
              <th className="px-5 py-3 font-bold">Tested purity</th>
              <th className="px-5 py-3 font-bold">Real $/active mg</th>
              <th className="px-5 py-3 font-bold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#111214]/10">
            {ranked.map((p, i) => {
              const purity = purityByVendor.get(p.vendorSlug);
              const isCheapest = p.slug === cheapest.slug;
              const suspicious = isSuspicious(p);
              return (
                <tr key={p.slug} className={suspicious ? "bg-[#fff4e0]" : isCheapest ? "bg-[#e6fbf4]" : undefined}>
                  <td className="px-5 py-3 font-extrabold tabular-nums text-[var(--muted)]">{i + 1}</td>
                  <td className="px-5 py-3">
                    <Link href={`/products/${p.slug}`} className="inline-flex items-center gap-1.5 font-bold hover:underline">
                      {suspicious ? <TriangleAlert className="size-3.5 text-[#b26a00]" /> : isCheapest ? <Crown className="size-3.5 text-[#0e8f80]" /> : null}{p.vendorSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Link>
                  </td>
                  <td className="px-5 py-3 font-medium text-[var(--muted)]">{p.quantity}</td>
                  <td className="px-5 py-3 font-extrabold tabular-nums">{formatCurrency(p.price)}</td>
                  <td className="px-5 py-3"><span className={`ink-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold tabular-nums ${suspicious ? "bg-[#fff4e0] text-[#b26a00]" : isCheapest ? "bg-[#e6fbf4] text-[#0e8f80]" : "bg-[#f2f2ef] text-[#111214]/70"}`}>{formatPricePerMg(p.pricePerMg!)}{suspicious && <span className="font-bold"> · too cheap?</span>}</span></td>
                  <td className="px-5 py-3">
                    {purity != null
                      ? <span className="ink-1 rounded-full bg-[#e6fbf4] px-2.5 py-1 text-xs font-extrabold text-[#0e8f80] tabular-nums">{purity.toFixed(1)}%</span>
                      : <span className="text-xs font-medium text-[var(--muted)]">—</span>}
                  </td>
                  <td className="px-5 py-3">
                    {p.trust?.adjustedPricePerMg != null
                      ? <span className={`font-extrabold tabular-nums ${p.slug === bestValue?.slug ? "text-[#0e8f80]" : ""}`}>{formatPricePerMg(p.trust.adjustedPricePerMg)}{p.slug === bestValue?.slug && <span className="ink-1 ml-1 rounded-full bg-[#e6fbf4] px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#0e8f80]">best value</span>}</span>
                      : <span className="text-xs font-medium text-[var(--muted)]">—</span>}
                  </td>
                  <td className="px-5 py-3"><Link href={`/products/${p.slug}`} className="inline-flex items-center gap-1 text-xs font-bold text-[#2b31d8] hover:underline">View <ExternalLink className="size-3" /></Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs font-medium text-[var(--muted)]"><span className="font-bold text-[#0e8f80]">Real $/active mg</span> divides the price-per-mg by the measured purity — the honest cost of the actual peptide, so a 90%-pure vial isn&rsquo;t compared as if it were 99%. <span className="font-bold text-[#b26a00]">Too cheap?</span> flags a listing far below the market rate — often underdosing or a fake, not a deal. The crown marks the cheapest non-outlier; <span className="font-bold text-[#0e8f80]">best value</span> marks the lowest real cost per active mg.</p>
    </section>
  );
}
