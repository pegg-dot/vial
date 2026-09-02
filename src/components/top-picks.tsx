import type { Product } from "@/lib/types";
import { pickTopListings, type TestRowLike } from "@/lib/market-picks";
import { PickCard } from "./pick-card";

// The marketplace "buy box": category winners first (a listing that wins several categories
// shows once with all its stamps), then the next listings in leaderboard order stamped with
// their real rank, so a deep market fills the whole row. Column count follows the card count —
// three cards span three columns, five span five — because a half-empty row reads as a half-empty
// market. Selection logic is lib/market-picks.ts, shared with the leaderboard so the two
// surfaces can never disagree.
const COLS: Record<number, string> = {
  2: "xl:grid-cols-2",
  3: "xl:grid-cols-3",
  4: "xl:grid-cols-4",
  5: "xl:grid-cols-5",
};

export function TopPicks({ listings, labTests }: { listings: Product[]; labTests: TestRowLike[] }) {
  const picks = pickTopListings(listings, labTests);
  if (picks.length < 2) return null;
  return (
    <div className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${COLS[picks.length] ?? "xl:grid-cols-5"}`}>
      {picks.map((pick) => (
        <PickCard key={pick.product.slug} product={pick.product} wins={pick.wins} />
      ))}
    </div>
  );
}
