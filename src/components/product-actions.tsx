"use client";

import { Bookmark, GitCompareArrows } from "lucide-react";
import { useMarketplace } from "./marketplace-state";

// No outbound CTA: a public listing or COA cannot establish whether a delivered vial
// is authentic, sterile, lawful, or suitable for human use.
export function ProductActions({ slug }: {
  slug: string;
  vendorName: string;
  origin?: "demo" | "live";
  externalUrl?: string;
}) {
  const { isWatched, isCompared, toggleWatchlist, toggleCompare } = useMarketplace();
  const watched = isWatched(slug);
  const compared = isCompared(slug);

  return (
    <div>
      <p className="rounded-[12px] border border-[#111214]/15 bg-[var(--background)] px-4 py-3 text-[12px] font-medium leading-5 text-[var(--muted)]">
        Historical listing for research and documentation. No purchasing or vendor referrals are provided.
        A reported lab result does not establish what any delivered vial contains, sterility, legal status, or fitness for human use.
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button type="button" onClick={() => toggleWatchlist(slug)}
          className={`ink-1 hard-sm press flex min-h-12 items-center justify-center gap-2 rounded-[14px] text-sm font-bold ${watched ? "bg-[#111214] text-white" : "bg-white text-[#111214]"}`}>
          <Bookmark className={`size-4 ${watched ? "fill-current" : ""}`} /> {watched ? "Watching" : "Watch"}
        </button>
        <button type="button" onClick={() => toggleCompare(slug)}
          className={`ink-1 hard-sm press flex min-h-12 items-center justify-center gap-2 rounded-[14px] text-sm font-bold ${compared ? "bg-[#6d5dfc] text-white" : "bg-white text-[#111214]"}`}>
          <GitCompareArrows className="size-4" /> {compared ? "Added" : "Compare"}
        </button>
      </div>
    </div>
  );
}
