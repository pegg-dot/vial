import type { ListingTrust } from "@/lib/types";
import { BadgeCheck, FlaskConical, ShieldAlert, TrendingDown, TriangleAlert } from "lucide-react";

const TONE: Record<ListingTrust["tone"], string> = {
  good: "ink-1 bg-[#e6fbf4] text-[#0e8f80]",
  warn: "ink-1 bg-[#fff4e0] text-[#b26a00]",
  bad: "ink-1 bg-[#fff1f0] text-[#d3372c]",
  neutral: "ink-1 bg-[#f2f2ef] text-[var(--muted)]",
};

export function TrustChip({ trust, showNeutral = false }: { trust?: ListingTrust; showNeutral?: boolean }) {
  if (!trust) return null;

  // 0. A derived integrity red flag on the vendor outranks everything — a buyer needs to see
  //    "this vendor's paperwork doesn't hold up" before any purity or price signal.
  if (trust.vendorFlagged) {
    return (
      <span title="This vendor carries a certificate-integrity red flag — see its page." className="ink-1 inline-flex items-center gap-1 rounded-full bg-[#fff1f0] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#d3372c]">
        <ShieldAlert className="size-3" /> Vendor flagged
      </span>
    );
  }

  // 1. A vendor-specific verdict (green tested / amber low-purity / red mismatch) always wins —
  //    it's the strongest, most specific signal, and it always shows.
  if (trust.tone !== "neutral") {
    const Icon = trust.tone === "good" ? BadgeCheck : ShieldAlert;
    return (
      <span title={trust.detail} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${TONE[trust.tone]}`}>
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
      <span title={`We hold ${trust.compoundCoas} independent lab certificate${trust.compoundCoas === 1 ? "" : "s"} for this compound${p}. Market-wide — not specific to this vendor. Use it to judge the vendor's claim.`} className="ink-1 inline-flex items-center gap-1 rounded-full bg-[#eef0ff] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#2b31d8]">
        <FlaskConical className="size-3" /> Compound: {trust.compoundCoas} COA{trust.compoundCoas === 1 ? "" : "s"}
      </span>
    );
  }

  // 3. Nothing at all — shown only where the surface opts in, so grids don't fill with gray.
  if (!showNeutral) return null;
  return (
    <span title={trust.detail} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${TONE.neutral}`}>
      <ShieldAlert className="size-3" /> {trust.label}
    </span>
  );
}

export function PriceFlag({ trust }: { trust?: ListingTrust }) {
  if (!trust?.priceFlag) return null;
  if (trust.priceFlag === "too-cheap") {
    return <span title={trust.priceNote ?? undefined} className="ink-1 inline-flex items-center gap-1 rounded-full bg-[#fff4e0] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#b26a00]"><TriangleAlert className="size-3" /> Too cheap?</span>;
  }
  const pct = trust.priceNote?.match(/\d+%/)?.[0] ?? "drop";
  return <span title={trust.priceNote ?? undefined} className="ink-1 inline-flex items-center gap-1 rounded-full bg-[#e6fbf4] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-[#0e8f80]"><TrendingDown className="size-3" /> Price ↓ {pct}</span>;
}
