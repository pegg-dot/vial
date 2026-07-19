"use client";

import { Bookmark, GitCompareArrows, LockKeyhole, ShieldCheck, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useCommerceCart } from "./commerce-cart-provider";
import { useMarketplace } from "./marketplace-state";

export function ProductActions({ slug, checkoutPending }: { slug: string; checkoutPending: boolean }) {
  const { isWatched, isCompared, toggleWatchlist, toggleCompare } = useMarketplace();
  const { add } = useCommerceCart();
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const watched = isWatched(slug);
  const compared = isCompared(slug);

  async function addToCart() {
    setAdding(true);
    try {
      await add(slug);
      setNotice("Added to the test-mode cart. No real payment will be processed.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "This listing is not sandbox eligible.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <div>
      {checkoutPending ? (
        <button
          onClick={addToCart}
          disabled={adding}
          className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#111214] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-black/85 disabled:opacity-60"
        >
          <ShoppingBag className="size-4" />
          {adding ? "Adding…" : "Add to sandbox cart"}
        </button>
      ) : (
        <button
          onClick={() => setNotice("This listing remains information-only and cannot enter checkout.")}
          className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#111214] px-5 py-3.5 text-sm font-semibold text-white"
        >
          <LockKeyhole className="size-4" /> Information-only listing
        </button>
      )}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          onClick={() => toggleWatchlist(slug)}
          className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border text-sm font-semibold ${watched ? "border-black bg-black text-white" : "border-black/[.09] bg-white"}`}
        >
          <Bookmark className={`size-4 ${watched ? "fill-current" : ""}`} /> {watched ? "Watching" : "Watch"}
        </button>
        <button
          onClick={() => toggleCompare(slug)}
          className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border text-sm font-semibold ${compared ? "border-violet-500 bg-violet-500 text-white" : "border-black/[.09] bg-white"}`}
        >
          <GitCompareArrows className="size-4" /> {compared ? "Added" : "Compare"}
        </button>
      </div>
      {notice && (
        <div className="mt-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-900">
          <ShieldCheck className="mr-2 inline size-4" />
          {notice} <Link href="/cart" className="font-semibold underline">Open cart</Link>
          <button onClick={() => setNotice(null)} className="ml-2 font-semibold underline">Dismiss</button>
        </div>
      )}
    </div>
  );
}
