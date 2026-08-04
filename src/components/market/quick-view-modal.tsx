"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Compound, Product } from "@/lib/types";
import { shelfForCompound } from "@/lib/market-taxonomy";
import { bestValue, compoundPriceRange, compoundTrustTier } from "@/lib/curation";
import { formatCurrency, formatPricePerMg } from "@/lib/format";
import { educationFor } from "@/lib/compound-education";
import { DataOriginBadge } from "@/components/data-origin-badge";
import { GoalTags } from "@/components/goal-tags";
import { PriceSparkline } from "@/components/price-sparkline";
import { TrustTierChip } from "./trust-tier-chip";

function humanize(slug: string) {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// The middle rung of the density ladder: a compound snapshot over the browse page,
// with ←/→ paging across the row (a VIAL-specific enhancement Nate asked for).
export function QuickViewModal({
  items,
  index,
  onClose,
  onNavigate,
  products,
}: {
  items: Compound[];
  index: number | null;
  onClose: () => void;
  onNavigate: (next: number) => void;
  products: Product[];
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<Element | null>(null);
  const open = index !== null && items.length > 0;

  // Focus management runs ONLY on open/close — capture the opener when the modal opens,
  // focus the panel, and restore focus to the opener when it closes. Keyed on `open` so
  // paging (index change) never re-runs it and never yanks focus back to the page.
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement;
    panelRef.current?.focus();
    return () => {
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus();
    };
  }, [open]);

  // The keydown listener re-binds freely as index/handlers change; its cleanup only
  // removes the listener — no focus side effects.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") onNavigate((index! - 1 + items.length) % items.length);
      else if (e.key === "ArrowRight") onNavigate((index! + 1) % items.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, index, items.length, onClose, onNavigate]);

  if (!open) return null;
  const current = items[index!];
  const shelf = shelfForCompound(current);
  const productsFor = products.filter((p) => p.compoundSlug === current.slug);
  const range = compoundPriceRange(current.slug, products);
  const tier = compoundTrustTier(current);
  const bv = bestValue(productsFor, 1)[0];
  const vendors = [...new Set(productsFor.map((p) => p.vendorSlug))].slice(0, 3);
  const cheapest = productsFor.filter((p) => p.priceHistory?.length).sort((a, b) => a.price - b.price)[0];
  const history = cheapest?.priceHistory?.length ? cheapest.priceHistory : [current.medianPrice];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${current.name} snapshot`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="ink hard-lg max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[20px] bg-white p-6 outline-none"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.08em] text-[var(--muted)]">{shelf.label}</p>
            <h2 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-extrabold tracking-[-.04em]">
              {current.name}
              {current.origin === "live" && <DataOriginBadge origin="live" />}
            </h2>
            <p className="text-xs font-semibold text-[var(--muted)]">{current.shorthand}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="ink-1 grid size-9 shrink-0 place-items-center rounded-full press">
            <X className="size-4" />
          </button>
        </div>

        <div className="ink-1 mt-5 grid grid-cols-3 gap-3 rounded-2xl bg-[var(--background)] p-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[var(--muted)]">Market low</p>
            <p className="mt-1 text-lg font-extrabold tabular-nums tracking-[-.03em]">{range.from != null ? formatCurrency(range.from) : "—"}</p>
            <p className="text-[11px] font-semibold text-[var(--muted)]">{current.listings} listing{current.listings === 1 ? "" : "s"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[var(--muted)]">Median</p>
            <p className="mt-1 text-lg font-extrabold tabular-nums tracking-[-.03em]">{current.medianPrice > 0 ? formatCurrency(current.medianPrice) : "—"}</p>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[var(--muted)]">Best / mg</p>
            <p className="mt-1 text-lg font-extrabold tabular-nums tracking-[-.03em] text-[#0e8f80]">
              {bv?.pricePerMg ? formatPricePerMg(bv.pricePerMg) : "—"}
            </p>
            {current.medianPurity != null && <p className="text-[11px] font-semibold text-[var(--muted)]">{current.medianPurity.toFixed(1)}% pure</p>}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <TrustTierChip tier={tier} />
          <GoalTags goals={educationFor(current.slug)?.goals} limit={3} />
        </div>
        <ul className="mt-3 space-y-1">
          {tier.reasons.map((r) => (
            <li key={r} className="text-[13px] font-medium text-[var(--muted)]">• {r}</li>
          ))}
        </ul>

        {vendors.length > 0 && (
          <div className="mt-4">
            <p className="text-[10px] font-bold uppercase tracking-[.1em] text-[var(--muted)]">Top vendors</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {vendors.map((slug) => (
                <Link key={slug} href={`/vendors/${slug}`} onClick={(e) => e.stopPropagation()} className="ink-1 rounded-full px-2.5 py-1 text-[12px] font-bold press">
                  {humanize(slug)}
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="ink-1 mt-4 rounded-2xl bg-white p-3">
          <PriceSparkline values={history} accent="#12b3a6" />
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onNavigate((index! - 1 + items.length) % items.length)} aria-label="Previous compound" className="ink-1 grid size-10 place-items-center rounded-full press">
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-xs font-bold tabular-nums text-[var(--muted)]">{index! + 1} / {items.length}</span>
            <button type="button" onClick={() => onNavigate((index! + 1) % items.length)} aria-label="Next compound" className="ink-1 grid size-10 place-items-center rounded-full press">
              <ChevronRight className="size-4" />
            </button>
          </div>
          <Link href={`/compounds/${current.slug}`} className="ink hard press inline-flex items-center gap-1.5 rounded-full bg-[#111214] px-5 py-3 text-sm font-bold text-white">
            Open full ticker <ArrowUpRight className="size-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
