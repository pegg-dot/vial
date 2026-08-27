import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { listUserNotifications, setFollow } from "@/server/consumer-intelligence/repository";
import { generateMarketChangeSummary, syncWatchlistNotifications } from "@/server/consumer-intelligence/service";
import { setWatchlistItem } from "@/server/account/repository";
import { createAlert, createDomainEvent } from "@/server/intelligence/events";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SEED_FIXTURES = "true";
process.env.VIALGRADE_SEED_DEMO_ACCOUNTS = "true";
process.env.VIALGRADE_SESSION_SECRET = "digest-scoping-test-secret-at-least-32-chars";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "digest-scoping-privacy-secret-at-least-32-chars";

const userId = "user:customer:nora";

async function neutraliseDeliveryTiming() {
  const db = await getDatabase();
  const now = new Date();
  const current = now.getUTCHours() * 60 + now.getUTCMinutes();
  const fmt = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  await db.query(
    `UPDATE user_notification_preferences SET quiet_hours_start=$2, quiet_hours_end=$3, timezone='UTC', digest_frequency='instant', relevance_threshold=0 WHERE user_id=$1`,
    [userId, fmt(current + 120), fmt(current + 180)],
  );
}

/** Writes a real alert on a listing, via the production writer. */
async function alertOn(listingId: string, title = "Price moved") {
  const db = await getDatabase();
  const root = await createDomainEvent(db, { eventType: "listing.observed", entityType: "listing", entityId: listingId, actor: "test:fixture" });
  await createAlert(db, {
    rootEventId: root.rootEventId, parentEventId: root.id,
    category: "price-change", severity: "notice", entityType: "listing", entityId: listingId,
    title, message: "The observed price changed since the last reviewed snapshot.",
  });
}

async function twoListings() {
  const db = await getDatabase();
  const rows = (await db.query<{ id: string; slug: string }>(
    `SELECT l.id, l.slug FROM listings l JOIN products p ON p.id=l.product_id AND p.status='active' ORDER BY l.slug LIMIT 2`,
  )).rows;
  return { mine: rows[0]!, theirs: rows[1]! };
}

describe("the digest is the reader's, not the market's", () => {
  beforeAll(async () => { await resetDatabaseForTests(); await getDatabase(); });
  beforeEach(async () => {
    await neutraliseDeliveryTiming();
    const db = await getDatabase();
    await db.query(`DELETE FROM user_notifications WHERE user_id=$1`, [userId]);
    await db.query(`DELETE FROM entity_follows WHERE user_id=$1`, [userId]);
    await db.query(`DELETE FROM user_watchlists WHERE user_id=$1`, [userId]);
    await db.query(`DELETE FROM alert_events`);
  });
  afterAll(async () => { await resetDatabaseForTests(); });

  // The query used to be global with a LIMIT 100 applied BEFORE relevance was computed in JS.
  // Collectors run hourly across the whole catalogue, so on a busy day a hundred alerts about
  // listings a reader has no relationship with pushed their own watchlist change out of the
  // window — and the digest then reported "No meaningful changes since your last review" while
  // the thing they were watching had moved.
  it("does not let unrelated market noise crowd out the reader's own change", async () => {
    const db = await getDatabase();
    const { mine, theirs } = await twoListings();
    await setWatchlistItem(userId, mine.slug, true);

    // Their change happens FIRST, then a wall of newer noise buries it. Ordering is by created_at
    // DESC, so an unscoped LIMIT 100 never reaches back far enough to see it.
    await alertOn(mine.id, "The one that matters");
    await db.query(
      `UPDATE alert_events SET created_at = NOW() - INTERVAL '2 hours' WHERE title = 'The one that matters'`,
    );
    for (let i = 0; i < 120; i += 1) await alertOn(theirs.id, `Unrelated ${i}`);

    const summary = await generateMarketChangeSummary(userId);
    expect(summary, "the digest returned nothing at all").toBeTruthy();
    const hrefs = summary!.items.map((item) => item.href);
    expect(hrefs, "the reader's own change was crowded out of the window by unrelated alerts").toContain(`/products/${mine.slug}`);
    expect(hrefs.every((href) => href === `/products/${mine.slug}`), "the digest included listings the reader never subscribed to").toBe(true);
  });

  it("reports nothing rather than someone else's news when the reader subscribes to nothing", async () => {
    const { theirs } = await twoListings();
    await alertOn(theirs.id);
    const summary = await generateMarketChangeSummary(userId);
    expect(summary!.items).toEqual([]);
  });

  // One alert used to produce TWO inbox rows — the sync wrote `alert:<id>` and the digest wrote
  // `change:<kind>:<href>:<date>` for the same event, same headline, same link.
  it("writes one inbox row per alert, not one per code path", async () => {
    const { mine } = await twoListings();
    await setFollow(userId, "compound", (await (await getDatabase()).query<{ slug: string }>(
      `SELECT c.slug FROM listings l JOIN products p ON p.id=l.product_id JOIN compounds c ON c.id=p.compound_id WHERE l.id=$1`, [mine.id],
    )).rows[0]!.slug, true);
    await alertOn(mine.id, "A single change");

    await syncWatchlistNotifications(userId);
    await generateMarketChangeSummary(userId);

    const rows = (await listUserNotifications(userId, { limit: 100 })).filter((n) => n.actionHref === `/products/${mine.slug}`);
    expect(rows.length, `one alert produced ${rows.length} inbox rows: ${rows.map((r) => r.title).join(" | ")}`).toBe(1);
  });
});
