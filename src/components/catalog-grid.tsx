"use client";
import { useState } from "react";
import type { Product } from "@/lib/types";
import { ProductCard } from "@/components/product-card";

// A vendor's full catalog can be 70+ listings; rendering every card made the vendor report a
// ~23,000px scroll on mobile with the History rail unreachable below it. The first rows always
// show (cheapest per mg first, so the preview is the useful part); the rest sit behind one
// expander, mirroring the leaderboard's pattern. Server page stays server — only this grid is
// client state.
const PREVIEW = 9;
const STEP = 24;

export function CatalogGrid({ products }: { products: Product[] }) {
  const [visible, setVisible] = useState(PREVIEW);
  const shown = products.slice(0, visible);
  const rest = products.length - visible;
  return (
    <>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((product) => <ProductCard key={product.slug} product={product} />)}
      </div>
      {rest > 0 && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <button type="button" onClick={() => setVisible((v) => v + STEP)} className="ink hard-sm press rounded-full bg-white px-5 py-2.5 text-sm font-bold">
            Show {Math.min(STEP, rest)} more of {products.length}
          </button>
          <p className="text-xs font-medium tabular-nums text-[var(--muted)]">Showing {shown.length} of {products.length}, cheapest per mg first</p>
        </div>
      )}
    </>
  );
}
