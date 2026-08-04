"use client";
import Link from "next/link";
import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import type { Compound, Product } from "@/lib/types";
import { shelfForCompound } from "@/lib/market-taxonomy";
import { compoundPriceRange, compoundTrustTier } from "@/lib/curation";
import { formatCurrency } from "@/lib/format";
import { DataOriginBadge } from "@/components/data-origin-badge";
import { TrustTierChip } from "./trust-tier-chip";

// A scannable compound "ticker" tile: one labeled canonical number (from $X), the
// observed price-change delta (a fact), the decomposable trust tier, and — when the
// card sits in a ranked row — that row's own ranking metric.
export function CompoundTickerCard({
  compound,
  products,
  metric,
  onQuickView,
}: {
  compound: Compound;
  products: Product[];
  metric?: { label: string; value: string };
  onQuickView?: () => void;
}) {
  const shelf = shelfForCompound(compound);
  const range = compoundPriceRange(compound.slug, products);
  const tier = compoundTrustTier(compound);
  const delta = compound.priceChange ?? 0;

  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-bold uppercase tracking-[.08em] text-[var(--muted)]">{shelf.label}</p>
          {compound.origin === "live" && <DataOriginBadge origin="live" />}
        </div>
        <ArrowUpRight className="size-4 shrink-0 text-[#111214] transition group-hover:translate-x-0.5" aria-hidden />
      </div>

      <h3 className="mt-2 text-xl font-extrabold tracking-[-.03em]">{compound.name}</h3>
      <p className="text-xs font-semibold text-[var(--muted)]">{compound.shorthand}</p>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-lg font-extrabold tabular-nums tracking-[-.03em]">
            {range.from != null ? <>from {formatCurrency(range.from)}</> : "—"}
          </p>
          <p className="text-[11px] font-semibold text-[var(--muted)]">
            {compound.medianPrice > 0 ? <>median {formatCurrency(compound.medianPrice)} · </> : null}{range.count} vendor{range.count === 1 ? "" : "s"}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-sm font-extrabold tabular-nums ${
            delta > 0 ? "text-[#0e8f80]" : delta < 0 ? "text-[#d3372c]" : "text-[var(--muted)]"
          }`}
        >
          {delta > 0 ? <TrendingUp className="size-3.5" /> : delta < 0 ? <TrendingDown className="size-3.5" /> : null}
          {delta === 0 ? "flat" : `${Math.abs(delta).toFixed(1)}%`}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <TrustTierChip tier={tier} />
        {compound.medianPurity != null && (
          <span className="ink-1 inline-flex items-center rounded-full bg-[#e6fbf4] px-2.5 py-1 text-[11px] font-extrabold tabular-nums text-[#0e8f80]">
            {compound.medianPurity.toFixed(1)}% pure
          </span>
        )}
      </div>

      {metric && (
        <div className="ink-1 mt-4 rounded-xl bg-[var(--background)] p-3 text-center">
          <p className="text-lg font-extrabold tabular-nums tracking-[-.03em]">{metric.value}</p>
          <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[.1em] text-[var(--muted)]">{metric.label}</p>
        </div>
      )}
    </>
  );

  const className = "ink-1 hard press group flex w-full flex-col rounded-[20px] bg-white p-5 text-left";

  if (onQuickView) {
    return (
      <button type="button" onClick={onQuickView} aria-label={`Quick view ${compound.name}`} className={className}>
        {body}
      </button>
    );
  }
  return (
    <Link href={`/compounds/${compound.slug}`} className={className}>
      {body}
    </Link>
  );
}
