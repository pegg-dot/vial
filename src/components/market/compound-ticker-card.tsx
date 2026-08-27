"use client";
import Link from "next/link";
import { ArrowUpRight, CircleHelp, FlaskConical, ShieldCheck } from "lucide-react";
import type { Compound, Product } from "@/lib/types";
import { shelfForCompound } from "@/lib/market-taxonomy";
import { compoundPriceRange, compoundTrustTier, type TrustTier } from "@/lib/curation";
import { formatCurrency } from "@/lib/format";
import { DataOriginBadge } from "@/components/data-origin-badge";

// A compound ticker tile — the same six things in the same six places on every tile, so a row
// of ten reads as one board rather than ten cards of different heights:
//   stamp · shelf · live ↗  /  name  /  lowest price + the row's own metric  /  one evidence line.
//
// What is deliberately NOT here any more:
//   • The price-change delta. `compounds.price_change` is a median of per-listing moves computed
//     from `price_history`, and 685 of 904 live listings hold exactly one point while the rest
//     hold placeholder junk (`[34.95, 150, 150]` on a listing whose price is $34.95). The
//     "↗ 525.3%" that produced was a fact about a broken column, not about a market. The tile
//     shows nothing it cannot stand behind; the delta returns when the history is real.
//   • The tint pills. One evidence line, in the tier's colour, with an icon — never colour alone.
const TIER: Record<TrustTier["tier"], { cls: string; Icon: typeof ShieldCheck }> = {
  independent: { cls: "text-[#0e8f80]", Icon: ShieldCheck },
  vendor: { cls: "text-[#b26a00]", Icon: FlaskConical },
  none: { cls: "text-[var(--muted)]", Icon: CircleHelp },
};

function evidenceLine(tier: TrustTier, compound: Compound): string {
  if (tier.tier === "independent" && compound.medianPurity != null) return `${tier.label} · ${compound.medianPurity.toFixed(1)}% pure`;
  return tier.label;
}

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
  const { cls, Icon } = TIER[tier.tier];

  const body = (
    <>
      <div className="flex items-center gap-2">
        <span className="ink-1 inline-flex h-[22px] shrink-0 items-center rounded-[6px] bg-[#111214] px-1.5 text-[10px] font-extrabold uppercase tracking-[.1em] text-white">
          {compound.shorthand}
        </span>
        <span className="min-w-0 flex-1 truncate text-[10.5px] font-bold uppercase tracking-[.08em] text-[var(--muted)]">{shelf.label}</span>
        {compound.origin === "live" && <DataOriginBadge origin="live" compact />}
        <ArrowUpRight className="size-4 shrink-0 text-[#111214] transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden />
      </div>

      <h3 className="mt-3 truncate text-[18px] font-extrabold leading-tight tracking-[-.03em]">{compound.name}</h3>

      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[26px] font-extrabold leading-none tabular-nums tracking-[-.04em]" title="Lowest priced listing on the market">{range.from != null ? formatCurrency(range.from) : "—"}</p>
          <p className="mt-1.5 truncate text-[11px] font-semibold text-[var(--muted)]">
            {range.from != null ? `${range.vendors} vendor${range.vendors === 1 ? "" : "s"}` : "no priced listing"}
            {compound.medianPrice > 0 ? ` · median ${formatCurrency(compound.medianPrice)}` : ""}
          </p>
        </div>
        {metric && (
          <div className="shrink-0 text-right">
            <p className="text-[26px] font-extrabold leading-none tabular-nums tracking-[-.04em]">{metric.value}</p>
            <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[.1em] text-[var(--muted)]">{metric.label}</p>
          </div>
        )}
      </div>

      <p className={`mt-3.5 flex items-center gap-1.5 border-t-2 border-[#111214]/10 pt-3 text-[12px] font-bold ${cls}`} title={tier.reasons.join(" · ")}>
        <Icon className="size-3.5 shrink-0" aria-hidden />
        <span className="truncate">{evidenceLine(tier, compound)}</span>
      </p>
    </>
  );

  const className = "ink-1 hard press group flex w-full flex-col rounded-[16px] bg-white p-4 text-left";

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
