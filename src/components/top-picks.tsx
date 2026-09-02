import type { Product } from "@/lib/types";
import { pickTopListings, type TestRowLike } from "@/lib/market-picks";
import { ProductCard } from "./product-card";

// The marketplace "buy box": instead of 48 undifferentiated cards, up to four listings that each
// answer a different buyer question — cheapest, best real value, best-tested purity, most-tested
// vendor. Everything else lives in the leaderboard table below. Selection logic is
// lib/market-picks.ts, shared with the table so the two surfaces can never disagree.
export function TopPicks({ listings, labTests }: { listings: Product[]; labTests: TestRowLike[] }) {
  const picks = pickTopListings(listings, labTests);
  if (picks.length < 2) return null;
  return (
    <div className="grid gap-x-4 gap-y-6 sm:grid-cols-2 xl:grid-cols-4">
      {picks.map((pick) => (
        <div key={pick.key} className="flex flex-col gap-2.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className="ink-1 shrink-0 rounded-full bg-[#111214] px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.08em] text-white">{pick.label}</span>
            <span className="truncate text-[11px] font-semibold text-[var(--muted)]" title={pick.why}>{pick.why}</span>
          </div>
          <ProductCard product={pick.product} />
        </div>
      ))}
    </div>
  );
}
