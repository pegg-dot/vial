import Link from "next/link";
import { Crown, ExternalLink, TriangleAlert } from "lucide-react";
import type { Product } from "@/lib/types";
import type { LabTestRow } from "@/server/ingest/lab-tests";
import { formatCurrency, formatMgTotal, formatPricePerMg } from "@/lib/format";
import { independentPurityByVendor, isSuspicious } from "@/lib/market-picks";
import { ExpandableRows } from "./expandable-rows";

// The single most useful surface for a non-expert buyer: every vendor selling this
// compound, ranked by real cost-per-milligram, with the independently-tested purity
// beside it where we have one. Cheapest-and-tested rises to the top on its own.
// Long markets are bounded: the top rows always show, the rest sit behind one expander —
// a 49-row wall is what made the old page feel endless.
const PREVIEW_ROWS = 10;

// "0.5mg" vs a 0.5mg total — when the declared per-unit size already IS the total, don't repeat it.
function sameSize(quantity: string | undefined, totalMg: number): boolean {
  const m = String(quantity ?? "").match(/([0-9.]+)\s*(mg|mcg|µg)/i);
  if (!m) return false;
  const asMg = Number(m[1]) / (/mcg|µg/i.test(m[2]) ? 1000 : 1);
  return Math.abs(asMg - totalMg) < 0.001;
}

// "1 vial each" beside a one-vial listing adds nothing; a real per-unit breakdown ("NAD+ 100mg:
// KIT (10 vials)") does. Only print the quantity subline when it carries information.
function quantityAddsInfo(quantity: string | undefined, totalMg: number): boolean {
  const q = String(quantity ?? "").trim();
  if (!q || sameSize(q, totalMg)) return false;
  return !/^1\s*(vial|bottle|unit|pack|kit|item)s?$/i.test(q);
}

export function PriceLeaderboard({ compoundName, listings, labTests }: { compoundName: string; listings: Product[]; labTests: LabTestRow[] }) {
  const ranked = listings.filter((p) => p.pricePerMg && p.pricePerMg > 0).sort((a, b) => a.pricePerMg! - b.pricePerMg!);
  if (ranked.length < 2) return null;

  // Suspiciously-cheap, purity-by-vendor, and real-cost-per-active-mg all come from the shared
  // pick logic (lib/market-picks.ts) — the exact rules the Top picks row uses — so this table
  // can never disagree with the picks or the product buy box for the same listing.
  const purityByVendor = independentPurityByVendor(labTests);

  // Crown the cheapest listing that ISN'T suspiciously cheap — the best legit deal.
  const cheapest = ranked.find((p) => !isSuspicious(p)) ?? ranked[0];

  // Best TRUE value: lowest canonical real cost per active mg among the listings that carry one.
  const withReal = ranked.filter((p) => p.trust?.adjustedPricePerMg != null);
  const bestValue = withReal.length ? withReal.reduce((a, b) => (a.trust!.adjustedPricePerMg! <= b.trust!.adjustedPricePerMg! ? a : b)) : null;

  const renderRow = (p: Product, i: number) => {
    const purity = purityByVendor.get(p.vendorSlug);
    const isCheapest = p.slug === cheapest.slug;
    const suspicious = isSuspicious(p);
    return (
      <tr key={p.slug} className={suspicious ? "bg-[#fff4e0]" : isCheapest ? "bg-[#e6fbf4]" : undefined}>
        <td className="px-4 py-2.5 font-extrabold tabular-nums text-[var(--muted)]">{i + 1}</td>
        <td className="px-4 py-2.5">
          <Link href={`/products/${p.slug}`} className="inline-flex items-center gap-1.5 font-bold hover:underline">
            {suspicious ? <TriangleAlert className="size-3.5 text-[#b26a00]" /> : isCheapest ? <Crown className="size-3.5 text-[#0e8f80]" /> : null}{p.vendorSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </Link>
        </td>
        {/* Show the size the PER-MG IS ACTUALLY BASED ON. `quantity` is the declared
            per-unit strength, so a 60-capsule bottle read "0.5mg" beside "$86" and
            "$2.87/mg" — arithmetic that cannot be reconciled on screen, which reads as
            the site being unable to divide. The math was right; the label was wrong. */}
        <td className="px-4 py-2.5 font-medium text-[var(--muted)]">
          {p.mg != null && p.mg > 0 ? (
            <>
              <span className="font-bold text-[#111214]">{formatMgTotal(p.mg)} total</span>
              {quantityAddsInfo(p.quantity, p.mg) && <span className="block text-xs">{p.quantity} each</span>}
            </>
          ) : p.quantity}
        </td>
        <td className="px-4 py-2.5 font-extrabold tabular-nums">{formatCurrency(p.price)}</td>
        <td className="px-4 py-2.5"><span className={`ink-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-extrabold tabular-nums ${suspicious ? "bg-[#fff4e0] text-[#b26a00]" : isCheapest ? "bg-[#e6fbf4] text-[#0e8f80]" : "bg-[#f2f2ef] text-[#111214]/70"}`}>{formatPricePerMg(p.pricePerMg!)}{suspicious && <span className="font-bold"> · too cheap?</span>}</span></td>
        <td className="px-4 py-2.5">
          {purity != null
            ? <span className="ink-1 rounded-full bg-[#e6fbf4] px-2.5 py-1 text-xs font-extrabold text-[#0e8f80] tabular-nums">{purity.toFixed(1)}%</span>
            : <span className="text-xs font-medium text-[var(--muted)]">—</span>}
        </td>
        <td className="px-4 py-2.5">
          {p.trust?.adjustedPricePerMg != null
            ? <span className={`font-extrabold tabular-nums ${p.slug === bestValue?.slug ? "text-[#0e8f80]" : ""}`}>{formatPricePerMg(p.trust.adjustedPricePerMg)}{p.slug === bestValue?.slug && <span className="ink-1 ml-1 rounded-full bg-[#e6fbf4] px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#0e8f80]">best value</span>}</span>
            : <span className="text-xs font-medium text-[var(--muted)]">—</span>}
        </td>
        <td className="px-4 py-2.5"><Link href={`/products/${p.slug}`} className="inline-flex items-center gap-1 text-xs font-bold text-[#2b31d8] hover:underline">View <ExternalLink className="size-3" /></Link></td>
      </tr>
    );
  };

  return (
    <section className="mx-auto max-w-[1320px] px-5 py-6 sm:px-8">
      <div className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#2b31d8]">Compare by real cost</p>
        <h2 className="mt-1.5 text-xl font-extrabold tracking-[-.03em] sm:text-2xl">Cheapest {compoundName}, by price per mg</h2>
        <p className="mt-1.5 max-w-2xl text-[13px] font-medium leading-5 text-[var(--muted)]">Sticker prices hide the size, so every listing is ranked by what a milligram actually costs — with independently tested purity where it exists.</p>
      </div>
      <div className="overflow-x-auto rounded-[16px] ink bg-white hard-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b-2 border-[#111214] bg-[#f7f7f4] text-[10px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">
            <tr>
              <th className="px-4 py-2.5 font-bold">#</th>
              <th className="px-4 py-2.5 font-bold">Vendor</th>
              <th className="px-4 py-2.5 font-bold">Size</th>
              <th className="px-4 py-2.5 font-bold">Price</th>
              <th className="px-4 py-2.5 font-bold">Per mg</th>
              <th className="px-4 py-2.5 font-bold">Tested purity</th>
              <th className="px-4 py-2.5 font-bold">Real $/active mg</th>
              <th className="px-4 py-2.5 font-bold"></th>
            </tr>
          </thead>
          <ExpandableRows
            colSpan={8}
            restCount={ranked.length - PREVIEW_ROWS}
            label={`Show all ${ranked.length} listings`}
            bodyClassName="divide-y divide-[#111214]/10"
            preview={ranked.slice(0, PREVIEW_ROWS).map((p, i) => renderRow(p, i))}
            rest={ranked.slice(PREVIEW_ROWS).map((p, i) => renderRow(p, i + PREVIEW_ROWS))}
          />
        </table>
      </div>
      <p className="mt-3 text-xs font-medium text-[var(--muted)]"><span className="font-bold text-[#0e8f80]">Real $/active mg</span> divides the price-per-mg by the measured purity — the honest cost of the actual peptide, so a 90%-pure vial isn&rsquo;t compared as if it were 99%. <span className="font-bold text-[#b26a00]">Too cheap?</span> flags a listing far below the market rate — often underdosing or a fake, not a deal. The crown marks the cheapest non-outlier; <span className="font-bold text-[#0e8f80]">best value</span> marks the lowest real cost per active mg.</p>
    </section>
  );
}
