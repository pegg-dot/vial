import type { MarketStats } from "@/lib/curation";
import { formatCurrency, formatPricePerMg } from "@/lib/format";

// The "is this price good?" block — a single listing's price shown in the context of the
// whole market for its compound: median, range, this listing's rank, and a position bar.
// Purely presentational; all numbers are precomputed server-side.
export function ProductMarketStats({
  price,
  pricePerMg,
  adjustedPricePerMg,
  previousPrice,
  stats,
}: {
  price: number;
  pricePerMg?: number;
  adjustedPricePerMg?: number;
  previousPrice?: number;
  stats: MarketStats;
}) {
  const { count, low, high, med, rank, positionPct, vsMedianPct } = stats;
  const hasRange = high > low;
  const pos = positionPct ?? 0;
  // Below-median is the good side (cheaper) → teal; above → coral.
  const vsGood = vsMedianPct != null && vsMedianPct <= 0;

  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[var(--muted)]">Observed price</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[2.75rem] font-extrabold leading-none tracking-[-.05em] tabular-nums">{formatCurrency(price)}</span>
        {pricePerMg ? <span className="text-sm font-bold tabular-nums text-[var(--muted)]">{formatPricePerMg(pricePerMg)}</span> : null}
        {previousPrice && previousPrice !== price ? <span className="text-sm tabular-nums text-[var(--muted)] line-through">{formatCurrency(previousPrice)}</span> : null}
        {vsMedianPct != null && vsMedianPct !== 0 && (
          <span className={`ink-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold tabular-nums ${vsGood ? "bg-[#e6fbf4] text-[#0e8f80]" : "bg-[#fff1f0] text-[#d3372c]"}`}>
            {vsMedianPct > 0 ? "+" : ""}{vsMedianPct}% vs median
          </span>
        )}
      </div>

      {/* Market-context stat strip */}
      <div className="ink-1 mt-4 grid grid-cols-2 divide-x divide-y divide-[#111214]/10 overflow-hidden rounded-[14px] sm:grid-cols-4 sm:divide-y-0">
        <Stat label="Market median" value={med != null ? formatCurrency(med) : "—"} />
        <Stat label="Range" value={hasRange ? `${formatCurrency(low)}–${formatCurrency(high)}` : formatCurrency(low)} />
        <Stat label="This listing" value={rank != null ? `#${rank} of ${count}` : "—"} sub={rank != null && count > 1 ? (rank === 1 ? "cheapest" : rank === count ? "priciest" : "mid-market") : undefined} />
        <Stat label="Real / active mg" value={adjustedPricePerMg ? formatPricePerMg(adjustedPricePerMg) : pricePerMg ? formatPricePerMg(pricePerMg) : "—"} accent={Boolean(adjustedPricePerMg)} />
      </div>

      {/* Price-position bar: where this $ sits between the market low and high */}
      {hasRange && (
        <div className="mt-4">
          <div className="relative h-2.5 rounded-full bg-[#eceae4]">
            <div className="absolute inset-y-0 left-0 rounded-full bg-[#12b3a6]/25" style={{ width: `${pos}%` }} />
            <span className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#111214] bg-[#12b3a6]" style={{ left: `${pos}%` }} aria-hidden />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] font-bold tabular-nums text-[var(--muted)]">
            <span>low {formatCurrency(low)}</span>
            {med != null && <span>median {formatCurrency(med)}</span>}
            <span>high {formatCurrency(high)}</span>
          </div>
        </div>
      )}
      <p className="mt-3 text-[11px] font-medium leading-4 text-[var(--muted)]">
        {count > 1 ? `Compared against ${count} vendor listings of this compound.` : "The only listing we track for this compound so far."}
        {" "}Real / active mg divides price-per-mg by measured purity.
      </p>
    </div>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="bg-white px-3.5 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[.08em] text-[var(--muted)]">{label}</p>
      <p className={`mt-1 text-base font-extrabold tabular-nums tracking-[-.02em] ${accent ? "text-[#0e8f80]" : ""}`}>{value}</p>
      {sub && <p className="text-[10px] font-semibold text-[var(--muted)]">{sub}</p>}
    </div>
  );
}
