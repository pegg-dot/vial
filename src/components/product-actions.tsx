"use client";

import { ArrowUpRight, Bookmark, GitCompareArrows, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useMarketplace } from "./marketplace-state";

// Standing affiliate disclosure. It renders next to the outbound link, always, uncollapsed — the FTC
// endorsement guides (16 CFR 255.5) want it where the click happens, not in a policy page or behind
// a "read more". It says "may earn" because no deal is live today (AFFILIATE_RULES is empty in
// server/outbound/affiliate.ts) and that file is built to start earning with no UI change: the
// disclosure has to be already standing when it flips, not added afterwards.
//
// tests/unit/affiliate-disclosure.test.ts fails if this string leaves this file while any affiliate
// rule exists. Change the wording there and here together.
const AFFILIATE_DISCLOSURE = "Some vendor links may earn VialGrade a commission. It never changes a grade, a price, or where a listing ranks.";

export function ProductActions({ slug, vendorName, origin = "demo", externalUrl }: { slug: string; vendorName: string; origin?: "demo" | "live"; externalUrl?: string }) {
  const { isWatched, isCompared, toggleWatchlist, toggleCompare } = useMarketplace();
  const [notice, setNotice] = useState<string | null>(null);
  const watched = isWatched(slug);
  const compared = isCompared(slug);

  const destinationHost = externalUrl ? (() => { try { return new URL(externalUrl).host.replace(/^www\./, ""); } catch { return null; } })() : null;
  const live = origin === "live" && Boolean(destinationHost);
  const demoNotice = `This is a demo listing, so the vendor link is switched off. VialGrade never sells anything or touches your money — on real listings it hands you to the vendor's own site.`;

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
        <div className="mt-2 text-center text-xs font-medium leading-5 text-[var(--muted)]">
          <p>Hands you to {destinationHost} — VialGrade doesn&rsquo;t sell or take payment</p>
          <p className="mt-1">{AFFILIATE_DISCLOSURE}</p>
        </div>
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
