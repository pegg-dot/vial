"use client";
import Link from "next/link";
import { Bookmark, GitCompareArrows } from "lucide-react";
import type { Product } from "@/lib/types";
import { formatCurrency, formatPricePerMg, evidenceTone } from "@/lib/format";
import { valueVsMarketPerMg } from "@/lib/curation";
import { evidenceBadgeFor } from "@/lib/evidence-badge-derive";
import { displayProductName, displaySize } from "@/lib/product-title";
import { useMarketplace } from "./marketplace-state";
import { DataOriginBadge } from "./data-origin-badge";
import { TrustLine, PriceFlagText } from "./listing-trust-chip";
import { VialGradeMark } from "./vial-grade-card";
import { ProductPhoto } from "./product-photo";

// The listing card, at market density.
//
// The previous card stacked eight coloured pills under a photo that grew to the image's natural
// height, and a three-column grid of them ran past 600px a tile — a buyer scanning 900 listings
// saw three at a time. Everything here is one line each, in the order a buyer asks: what is it,
// who sells it, what does it cost, is it tested, is it a fair price, can I get it. One verdict
// line replaces the evidence badge + trust chip + origin pill (all three derived from the same
// trust status); goal tags belong to the compound page, not to every tile.

const AVAIL: Record<Product["availability"], string> = {
  "In stock": "text-[#0e8f80]",
  "Low stock": "text-[#b26a00]",
  Unavailable: "text-[#d3372c]",
};

// A demo listing has no live trust verdict; its curated evidence label is the honest line.
const EVIDENCE_TEXT: Record<ReturnType<typeof evidenceTone>, string> = {
  emerald: "text-[#0e8f80]",
  violet: "text-[#6d5dfc]",
  blue: "text-[#2b31d8]",
  amber: "text-[#b26a00]",
  neutral: "text-[var(--muted)]",
};

export function ProductCard({ product }: { product: Product }) {
  const { catalog, isWatched, isCompared, toggleWatchlist, toggleCompare } = useMarketplace();
  const vendor = catalog.vendors.find((item) => item.slug === product.vendorSlug);
  const watched = isWatched(product.slug);
  const compared = isCompared(product.slug);
  const medPerMg = catalog.compounds.find((item) => item.slug === product.compoundSlug)?.medianPricePerMg ?? null;
  const vsMed = valueVsMarketPerMg(product.pricePerMg, medPerMg);
  const size = displaySize(product.name, product.quantity);
  const href = `/products/${product.slug}`;
  const evidence = evidenceBadgeFor(product);
  const hasValueLine = (vsMed !== null && vsMed !== 0) || Boolean(product.trust?.priceFlag);
  const iconBtn = "ink-1 grid size-8 place-items-center rounded-full transition";

  return (
    <article className="group ink-1 hard flex flex-col overflow-hidden rounded-[16px] bg-white transition duration-200 hover:-translate-y-0.5">
      <div className="relative border-b-2 border-[#111214]/10">
        <Link href={href} aria-hidden="true" tabIndex={-1}>
          <ProductPhoto name={product.name} quantity={product.quantity} accent={product.accent} imageUrl={product.imageUrl} compact decorative />
        </Link>
        <div className="absolute right-2 top-2 flex gap-1.5">
          <button
            onClick={() => toggleWatchlist(product.slug)}
            aria-label={watched ? "Remove from watchlist" : "Add to watchlist"}
            aria-pressed={watched}
            className={`${iconBtn} ${watched ? "bg-[#111214] text-white" : "bg-white text-[#111214] hover:bg-[var(--background)]"}`}
          >
            <Bookmark className={`size-3.5 ${watched ? "fill-current" : ""}`} />
          </button>
          <button
            onClick={() => toggleCompare(product.slug)}
            aria-label={compared ? "Remove from comparison" : "Add to comparison"}
            aria-pressed={compared}
            className={`${iconBtn} ${compared ? "bg-[#2b31d8] text-white" : "bg-white text-[#111214] hover:bg-[var(--background)]"}`}
          >
            <GitCompareArrows className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-3.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Link href={href} className="line-clamp-2 text-[14px] font-extrabold leading-[1.25] tracking-[-.02em] hover:underline hover:decoration-black/20 hover:underline-offset-4">
              {displayProductName(product.name)}
              {size ? <span className="font-semibold text-[var(--muted)]"> {size}</span> : null}
            </Link>
            <Link href={`/vendors/${product.vendorSlug}`} className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold text-[var(--muted)] hover:text-[#111214]">
              <span className="truncate">{vendor?.name}</span>
              {vendor?.grade ? <VialGradeMark grade={vendor.grade} vendorName={vendor.name} /> : null}
            </Link>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[18px] font-extrabold leading-none tabular-nums tracking-[-.03em]">{formatCurrency(product.price)}</p>
            {product.pricePerMg ? (
              <p className="mt-1 text-[11px] font-semibold tabular-nums text-[var(--muted)]">{formatPricePerMg(product.pricePerMg)}</p>
            ) : product.previousPrice && product.previousPrice !== product.price ? (
              <p className="mt-1 text-[11px] tabular-nums text-[var(--muted)] line-through">{formatCurrency(product.previousPrice)}</p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex min-w-0 items-center">
          {product.trust ? (
            <TrustLine trust={product.trust} />
          ) : (
            <span className={`truncate text-[12px] font-bold ${EVIDENCE_TEXT[evidenceTone(evidence.level)]}`}>{evidence.label}</span>
          )}
        </div>
        {hasValueLine && (
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-extrabold tabular-nums">
            {vsMed !== null && vsMed !== 0 ? (
              <span className={vsMed <= 0 ? "text-[#0e8f80]" : "text-[#d3372c]"} title="Cost per milligram against this compound's market median">
                {vsMed > 0 ? "+" : ""}{vsMed}% vs median/mg
              </span>
            ) : null}
            <PriceFlagText trust={product.trust} />
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t-2 border-[#111214]/10 pt-2.5 text-[11px] font-semibold text-[var(--muted)]">
          <span className="flex min-w-0 items-center gap-2">
            <DataOriginBadge origin={product.origin} compact />
            <span className={`truncate font-bold ${AVAIL[product.availability] ?? ""}`}>{product.availability}</span>
          </span>
          <span className="shrink-0">Checked {product.lastChecked}</span>
        </div>
      </div>
    </article>
  );
}
