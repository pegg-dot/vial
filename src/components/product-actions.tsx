"use client";

import { ArrowUpRight, Bookmark, GitCompareArrows, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useMarketplace } from "./marketplace-state";

export function ProductActions({ slug, vendorName, origin = "demo", externalUrl }: { slug: string; vendorName: string; origin?: "demo" | "live"; externalUrl?: string }) {
  const { isWatched, isCompared, toggleWatchlist, toggleCompare } = useMarketplace();
  const [notice, setNotice] = useState<string | null>(null);
  const watched = isWatched(slug);
  const compared = isCompared(slug);

  const destinationHost = externalUrl ? (() => { try { return new URL(externalUrl).host.replace(/^www\./, ""); } catch { return null; } })() : null;
  const live = origin === "live" && Boolean(destinationHost);
  const demoNotice = `This is a demo listing, so the vendor link is switched off. VIAL never sells anything or touches your money — on real listings it hands you to the vendor's own site.`;

  return (
    <div>
      {live ? (
        <a
          href={`/go?l=${encodeURIComponent(slug)}`}
          target="_blank"
          rel="noopener noreferrer nofollow sponsored"
          className="ink hard-sm press flex min-h-13 w-full items-center justify-center gap-2 rounded-[14px] bg-[#111214] px-5 py-3.5 text-sm font-bold text-white"
        >
          Buy at {vendorName} <ArrowUpRight className="size-4" />
        </a>
      ) : (
        <button
          onClick={() => setNotice(demoNotice)}
          className="ink hard-sm press flex min-h-13 w-full items-center justify-center gap-2 rounded-[14px] bg-[#111214] px-5 py-3.5 text-sm font-bold text-white"
        >
          Buy at {vendorName} <ArrowUpRight className="size-4" />
        </button>
      )}
      {live && (
        <p className="mt-2 text-center text-xs font-medium text-[var(--muted)]">Hands you to {destinationHost} — VIAL doesn&rsquo;t sell or take payment</p>
      )}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <button
          onClick={() => toggleWatchlist(slug)}
          className={`ink-1 hard-sm press flex min-h-12 items-center justify-center gap-2 rounded-[14px] text-sm font-bold ${watched ? "bg-[#111214] text-white" : "bg-white text-[#111214]"}`}
        >
          <Bookmark className={`size-4 ${watched ? "fill-current" : ""}`} /> {watched ? "Watching" : "Watch"}
        </button>
        <button
          onClick={() => toggleCompare(slug)}
          className={`ink-1 hard-sm press flex min-h-12 items-center justify-center gap-2 rounded-[14px] text-sm font-bold ${compared ? "bg-[#6d5dfc] text-white" : "bg-white text-[#111214]"}`}
        >
          <GitCompareArrows className="size-4" /> {compared ? "Added" : "Compare"}
        </button>
      </div>
      {notice && (
        <div className="ink-1 mt-3 rounded-[14px] bg-[#f0edff] p-4 text-sm font-medium leading-6 text-[#111214]">
          <ShieldCheck className="mr-2 inline size-4" />
          {notice}
          <button onClick={() => setNotice(null)} className="ml-2 font-semibold underline">Dismiss</button>
        </div>
      )}
    </div>
  );
}
