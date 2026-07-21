import Link from "next/link";
import { Crown, ExternalLink, TriangleAlert } from "lucide-react";
import type { Product } from "@/lib/types";
import type { LabTestRow } from "@/server/ingest/lab-tests";
import { formatCurrency, formatPricePerMg } from "@/lib/format";

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// The single most useful surface for a non-expert buyer: every vendor selling this
// compound, ranked by real cost-per-milligram, with the independently-tested purity
// beside it where we have one. Cheapest-and-tested rises to the top on its own.
export function PriceLeaderboard({ compoundName, listings, labTests }: { compoundName: string; listings: Product[]; labTests: LabTestRow[] }) {
  const ranked = listings.filter((p) => p.pricePerMg && p.pricePerMg > 0).sort((a, b) => a.pricePerMg! - b.pricePerMg!);
  if (ranked.length < 2) return null;

  // Too-good-to-be-true detector: real peptide has a floor cost, so a price far below the
  // market rate is a signal (underdosed, fake, or bait), not a deal. Flag listings well
  // under the median $/mg — but only when we have enough listings for a meaningful median.
  const med = median(ranked.map((p) => p.pricePerMg!));
  const isSuspicious = (p: Product) => ranked.length >= 4 && p.pricePerMg! < med * 0.45;

  // Best independently-tested purity per vendor for this compound.
  const purityByVendor = new Map<string, number>();
  for (const t of labTests) {
    if (!t.vendor_slug || t.purity_pct == null) continue;
    const p = Number(t.purity_pct);
    if (!purityByVendor.has(t.vendor_slug) || p > purityByVendor.get(t.vendor_slug)!) purityByVendor.set(t.vendor_slug, p);
  }
  // Crown the cheapest listing that ISN'T suspiciously cheap — the best legit deal.
  const cheapest = ranked.find((p) => !isSuspicious(p)) ?? ranked[0];

  return (
    <section className="mx-auto max-w-[1320px] px-5 py-10 sm:px-8">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">Compare by real cost</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-.045em]">Cheapest {compoundName}, by price per mg</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Vials come in different sizes, so the sticker price lies. This ranks every listing by what a milligram actually costs — with independent test purity where we have it.</p>
      </div>
      <div className="overflow-x-auto rounded-[24px] border border-black/[.07] bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-black/[.025] text-[10px] uppercase tracking-[.12em] text-[var(--muted)]">
            <tr>
              <th className="px-5 py-3 font-medium">#</th>
              <th className="px-5 py-3 font-medium">Vendor</th>
              <th className="px-5 py-3 font-medium">Size</th>
              <th className="px-5 py-3 font-medium">Price</th>
              <th className="px-5 py-3 font-medium">Per mg</th>
              <th className="px-5 py-3 font-medium">Tested purity</th>
              <th className="px-5 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[.06]">
            {ranked.map((p, i) => {
              const purity = purityByVendor.get(p.vendorSlug);
              const isCheapest = p.slug === cheapest.slug;
              const suspicious = isSuspicious(p);
              return (
                <tr key={p.slug} className={suspicious ? "bg-amber-50/70" : isCheapest ? "bg-emerald-50/60" : undefined}>
                  <td className="px-5 py-3 font-semibold tabular-nums text-[var(--muted)]">{i + 1}</td>
                  <td className="px-5 py-3">
                    <Link href={`/products/${p.slug}`} className="inline-flex items-center gap-1.5 font-semibold hover:underline">
                      {suspicious ? <TriangleAlert className="size-3.5 text-amber-600" /> : isCheapest ? <Crown className="size-3.5 text-emerald-600" /> : null}{p.vendorSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-[var(--muted)]">{p.quantity}</td>
                  <td className="px-5 py-3 font-semibold tabular-nums">{formatCurrency(p.price)}</td>
                  <td className="px-5 py-3"><span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${suspicious ? "bg-amber-100 text-amber-800" : isCheapest ? "bg-emerald-100 text-emerald-800" : "bg-black/[.05] text-black/70"}`}>{formatPricePerMg(p.pricePerMg!)}{suspicious && <span className="font-bold"> · too cheap?</span>}</span></td>
                  <td className="px-5 py-3">
                    {purity != null
                      ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 tabular-nums">{purity.toFixed(1)}%</span>
                      : <span className="text-xs text-[var(--muted)]">—</span>}
                  </td>
                  <td className="px-5 py-3"><Link href={`/products/${p.slug}`} className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:underline">View <ExternalLink className="size-3" /></Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]"><span className="font-semibold text-amber-700">Too cheap?</span> means a listing is priced far below the market rate for this compound — often a sign of underdosing or a fake, not a deal. The crown marks the cheapest listing that <em>isn&rsquo;t</em> an outlier. Purity and vendor reputation still matter.</p>
    </section>
  );
}
