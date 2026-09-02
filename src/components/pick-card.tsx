"use client";
import Link from "next/link";
import type { Product } from "@/lib/types";
import type { PickWin } from "@/lib/market-picks";
import { formatCurrency, formatPricePerMg } from "@/lib/format";
import { valueVsMarketPerMg } from "@/lib/curation";
import { displayProductName, displaySize } from "@/lib/product-title";
import { useMarketplace } from "./marketplace-state";
import { VialGradeMark } from "./vial-grade-card";

// A top pick, at pick density: no photo, no save/compare chrome — the stamp, the name, the
// vendor, one black number, and the reason it won. The full product card was too much here
// (vendor banner images and "SAVE 30%" graphics were doing the talking); everything a buyer
// needs before clicking through fits in five quiet lines.
const AVAIL: Record<Product["availability"], string> = {
  "In stock": "text-[#0e8f80]",
  "Low stock": "text-[#b26a00]",
  Unavailable: "text-[#d3372c]",
};

export function PickCard({ product, wins }: { product: Product; wins: PickWin[] }) {
  const { catalog } = useMarketplace();
  const vendor = catalog.vendors.find((item) => item.slug === product.vendorSlug);
  const medPerMg = catalog.compounds.find((item) => item.slug === product.compoundSlug)?.medianPricePerMg ?? null;
  const vsMed = valueVsMarketPerMg(product.pricePerMg, medPerMg);
  const size = displaySize(product.name, product.quantity);
  return (
    <Link href={`/products/${product.slug}`} className="group ink-1 hard-sm press flex flex-col gap-2.5 rounded-[14px] bg-white p-4 transition duration-200 hover:-translate-y-0.5">
      <div className="flex flex-wrap items-center gap-1.5">
        {wins.map((w) => (
          <span key={w.key} className="rounded-full border-2 border-[#111214] bg-white px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[.07em] text-[#111214]">{w.label}</span>
        ))}
      </div>
      <p className="line-clamp-2 text-[14px] font-extrabold leading-[1.25] tracking-[-.02em] group-hover:underline group-hover:decoration-black/20 group-hover:underline-offset-4">
        {displayProductName(product.name)}
        {size ? <span className="font-semibold text-[var(--muted)]"> {size}</span> : null}
      </p>
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--muted)]">
        <span className="truncate">{vendor?.name ?? product.vendorSlug}</span>
        {vendor?.grade ? <VialGradeMark grade={vendor.grade} vendorName={vendor.name} /> : null}
      </p>
      <p className="flex items-baseline gap-2">
        <span className="text-[20px] font-extrabold leading-none tabular-nums tracking-[-.03em]">{formatCurrency(product.price)}</span>
        {product.pricePerMg ? <span className="text-[11px] font-semibold tabular-nums text-[var(--muted)]">{formatPricePerMg(product.pricePerMg)}</span> : null}
        {vsMed !== null && vsMed !== 0 ? (
          <span className={`text-[11px] font-extrabold tabular-nums ${vsMed <= 0 ? "text-[#0e8f80]" : "text-[#d3372c]"}`} title="Cost per milligram against this compound's market median">{vsMed > 0 ? "+" : ""}{vsMed}% vs median</span>
        ) : null}
      </p>
      <p className="text-[12px] font-medium leading-5 text-black/60">{wins[0].why}</p>
      <p className="mt-auto flex items-center justify-between gap-2 border-t-2 border-[#111214]/10 pt-2 text-[11px] font-semibold text-[var(--muted)]">
        <span className={`font-bold ${AVAIL[product.availability] ?? ""}`}>{product.availability}</span>
        <span className="shrink-0">Checked {product.lastChecked}</span>
      </p>
    </Link>
  );
}
