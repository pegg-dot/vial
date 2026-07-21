"use client";

import { ArrowUpRight, Bookmark, GitCompareArrows, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useMarketplace } from "./marketplace-state";

export function ProductActions({ slug, vendorName }: { slug: string; vendorName: string }) {
  const { isWatched, isCompared, toggleWatchlist, toggleCompare } = useMarketplace();
  const [notice, setNotice] = useState<string | null>(null);
  const watched = isWatched(slug);
  const compared = isCompared(slug);

  return (
    <div>
      <button
        onClick={() => setNotice(`In the live product this button opens ${vendorName}'s own site — VIAL never sells anything or touches your money. Vendor links stay off while the data is fictional.`)}
        className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-[#111214] px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-black/85"
      >
        Buy at {vendorName} <ArrowUpRight className="size-4" />
      </button>
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
          {notice}
          <button onClick={() => setNotice(null)} className="ml-2 font-semibold underline">Dismiss</button>
        </div>
      )}
    </div>
  );
}
