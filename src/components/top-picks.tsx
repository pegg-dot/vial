import type { Product } from "@/lib/types";
import { pickTopListings, type TestRowLike } from "@/lib/market-picks";
import { PickCard } from "./pick-card";

// The marketplace "buy box": instead of 48 undifferentiated cards, up to four listings that each
// answer a different buyer question. A listing that wins several categories shows once with all
// its stamps, and the freed slot goes to the next honest category, so the row stays full without
// ever labeling a runner-up as "best". Selection logic is lib/market-picks.ts, shared with the
// leaderboard so the two surfaces can never disagree.
export function TopPicks({ listings, labTests }: { listings: Product[]; labTests: TestRowLike[] }) {
  const picks = pickTopListings(listings, labTests);
  if (picks.length < 2) return null;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {picks.map((pick) => (
        <PickCard key={pick.product.slug} product={pick.product} wins={pick.wins} />
      ))}
    </div>
  );
}
