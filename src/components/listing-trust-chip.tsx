import type { ListingTrust } from "@/lib/types";
import { BadgeCheck, FlaskConical, ShieldAlert, TrendingDown, TriangleAlert } from "lucide-react";

const TONE: Record<ListingTrust["tone"], string> = {
  good: "bg-emerald-50 text-emerald-800 border-emerald-200",
  warn: "bg-amber-50 text-amber-800 border-amber-200",
  bad: "bg-rose-50 text-rose-800 border-rose-200",
  neutral: "bg-black/[.04] text-black/55 border-black/[.08]",
};

export function TrustChip({ trust, showNeutral = false }: { trust?: ListingTrust; showNeutral?: boolean }) {
  if (!trust) return null;

  // 0. A derived integrity red flag on the vendor outranks everything — a buyer needs to see
  //    "this vendor's paperwork doesn't hold up" before any purity or price signal.
  if (trust.vendorFlagged) {
    return (
      <span title="This vendor carries a certificate-integrity red flag — see its page." className="inline-flex items-center gap-1 rounded-full border border-rose-300 bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
        <ShieldAlert className="size-3" /> Vendor flagged
      </span>
    );
  }

  // 1. A vendor-specific verdict (green tested / amber low-purity / red mismatch) always wins —
  //    it's the strongest, most specific signal, and it always shows.
  if (trust.tone !== "neutral") {
    const Icon = trust.tone === "good" ? BadgeCheck : ShieldAlert;
    return (
      <span title={trust.detail} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TONE[trust.tone]}`}>
        <Icon className="size-3" /> {trust.label}
      </span>
    );
  }

  // 2. No vendor verdict, but we hold independent COAs for the COMPOUND — honest market
  //    intelligence, clearly scoped to the compound (not this vendor). Blue = info, beaker
  //    icon (not a checkmark), so it never reads as "this product is verified".
  if (trust.compoundCoas > 0) {
    const p = trust.compoundMedianPurity != null ? ` · ~${trust.compoundMedianPurity.toFixed(1)}% typical` : "";
    return (
      <span title={`We hold ${trust.compoundCoas} independent lab certificate${trust.compoundCoas === 1 ? "" : "s"} for this compound${p}. Market-wide — not specific to this vendor. Use it to judge the vendor's claim.`} className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-800">
        <FlaskConical className="size-3" /> Compound: {trust.compoundCoas} COA{trust.compoundCoas === 1 ? "" : "s"}
      </span>
    );
  }

  // 3. Nothing at all — shown only where the surface opts in, so grids don't fill with gray.
  if (!showNeutral) return null;
  return (
    <span title={trust.detail} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TONE.neutral}`}>
      <ShieldAlert className="size-3" /> {trust.label}
    </span>
  );
}

export function PriceFlag({ trust }: { trust?: ListingTrust }) {
  if (!trust?.priceFlag) return null;
  if (trust.priceFlag === "too-cheap") {
    return <span title={trust.priceNote ?? undefined} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800"><TriangleAlert className="size-3" /> Too cheap?</span>;
  }
  const pct = trust.priceNote?.match(/\d+%/)?.[0] ?? "drop";
  return <span title={trust.priceNote ?? undefined} className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800"><TrendingDown className="size-3" /> Price ↓ {pct}</span>;
}
