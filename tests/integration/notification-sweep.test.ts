import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { listUserNotifications, setFollow } from "@/server/consumer-intelligence/repository";
import { runNotificationSweep } from "@/server/notifications/sweep";
import { createAlert, createDomainEvent } from "@/server/intelligence/events";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SEED_FIXTURES = "true";
process.env.VIALGRADE_SEED_DEMO_ACCOUNTS = "true";
process.env.VIALGRADE_SESSION_SECRET = "notification-sweep-test-secret-at-least-32";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "notification-sweep-privacy-secret-at-least-32";

const userId = "user:customer:nora";

/**
 * Park quiet hours where they cannot contain "now" and pin the digest to instant.
 *
 * The seeded default window is 22:00-08:00 America/New_York, so without this the suite passes all
 * afternoon and fails after 10pm — and it would be failing for a CORRECT reason, which is the worst
 * kind of red. A test about the sweep must not secretly be a test about the clock.
 */
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

/** A real alert on a real listing, written by the production writer rather than a hand-rolled INSERT. */
async function seedAlertedListing() {
  const db = await getDatabase();
  const row = (await db.query<{ listing_id: string; listing_slug: string; compound_slug: string }>(
    `SELECT l.id listing_id, l.slug listing_slug, c.slug compound_slug
     FROM listings l JOIN products p ON p.id=l.product_id AND p.status='active'
     JOIN compounds c ON c.id=p.compound_id ORDER BY l.slug LIMIT 1`,
  )).rows[0]!;
  const root = await createDomainEvent(db, { eventType: "listing.observed", entityType: "listing", entityId: row.listing_id, actor: "test:fixture" });
  await createAlert(db, {
    rootEventId: root.rootEventId, parentEventId: root.id,
    category: "price-change", severity: "notice", entityType: "listing", entityId: row.listing_id,
    title: "Price moved", message: "The observed price changed since the last reviewed snapshot.",
  });
  return row;
}

describe("the scheduled notification sweep", () => {
  beforeAll(async () => { await resetDatabaseForTests(); await getDatabase(); });
  beforeEach(neutraliseDeliveryTiming);
  afterAll(async () => { await resetDatabaseForTests(); });

  // THE POINT. Before the sweep existed, syncWatchlistNotifications had three callers and every one
  // of them was a page load. Nothing arrived while the reader was away, so "we'll tell you when a
  // price moves" was only true if you came back and asked.
  it("notifies a reader who never opened the app", async () => {
    const db = await getDatabase();
    const target = await seedAlertedListing();
    await db.query(`DELETE FROM user_notifications WHERE user_id=$1`, [userId]);
    await setFollow(userId, "compound", target.compound_slug, true);

    const before = await listUserNotifications(userId, { limit: 100 });
    expect(before.filter((n) => n.actionHref === `/products/${target.listing_slug}`)).toEqual([]);

    // No page load anywhere in this test — only the scheduler runs.
    const result = await runNotificationSweep({ maxUsers: 50 });
    expect(result.swept).toBeGreaterThan(0);

    const after = await listUserNotifications(userId, { limit: 100 });
    const forListing = after.filter((n) => n.actionHref === `/products/${target.listing_slug}`);
    expect(forListing.length).toBeGreaterThan(0);
    expect(
      forListing.some((n) => /You follow /.test(n.body)),
      "matched a notification from the digest path rather than the alert sync — this assertion has to name the sync",
    ).toBe(true);
  });

  it("leaves a receipt so a quiet tick is distinguishable from no tick at all", async () => {
    const db = await getDatabase();
    await db.query(`DELETE FROM collector_runs WHERE collector='notification-sweep'`);
    await runNotificationSweep({ maxUsers: 50 });
    const runs = (await db.query<{ items: number; ok: boolean }>(
      `SELECT items, ok FROM collector_runs WHERE collector='notification-sweep'`,
    )).rows;
    // "0 swept" with a receipt means "ran, nothing to do". No receipt means "never ran". Those look
    // identical from the outside unless something writes the difference down.
    expect(runs.length).toBe(1);
    expect(runs[0]!.ok).toBe(true);
  });

  it("honours the per-tick ceiling instead of walking the whole table", async () => {
    const db = await getDatabase();
    const extras = ["sweep-a", "sweep-b", "sweep-c", "sweep-d"];
    for (const suffix of extras) {
      const id = `user:customer:${suffix}`;
      await db.query(
        `INSERT INTO auth_users(id,email,display_name,account_type,roles,status) VALUES($1,$2,$3,'customer','["customer"]'::jsonb,'active') ON CONFLICT(id) DO NOTHING`,
        [id, `${suffix}@example.test`, suffix],
      );
      // Each one needs a real subscription, or they are not candidates and the cap is untested.
      await setFollow(id, "compound", "bpc-157", true);
    }
    const uncapped = await runNotificationSweep({ maxUsers: 50 });
    expect(uncapped.candidates, "need more subscribed readers than the cap for this to mean anything").toBeGreaterThan(2);

    const capped = await runNotificationSweep({ maxUsers: 2 });
    expect(capped.candidates).toBe(2);
    expect(capped.swept).toBeLessThanOrEqual(2);

    for (const suffix of extras) await db.query(`DELETE FROM auth_users WHERE id=$1`, [`user:customer:${suffix}`]);
  });

  it("stops cleanly on its own budget rather than being killed mid-user", async () => {
    const result = await runNotificationSweep({ maxUsers: 50, budgetMs: 1_000 });
    // Either it finished inside the budget or it stopped itself — never neither.
    expect(result.stoppedEarly || result.swept === result.candidates).toBe(true);
  });

  it("only considers readers who actually subscribed to something", async () => {
    const db = await getDatabase();
    await db.query(`DELETE FROM user_watchlists WHERE user_id=$1`, [userId]);
    await db.query(`DELETE FROM entity_follows WHERE user_id=$1`, [userId]);
    await db.query(`UPDATE saved_searches SET active=FALSE WHERE user_id=$1`, [userId]);
    const result = await runNotificationSweep({ maxUsers: 50 });
    const swept = (await db.query<{ n: string }>(
      `SELECT COUNT(*) n FROM auth_users u WHERE u.id=$1`, [userId],
    )).rows[0];
    expect(swept).toBeTruthy();
    // Nora unsubscribed from everything, so she must not be a candidate any more.
    expect(result.candidates).toBe(0);
    await db.query(`UPDATE saved_searches SET active=TRUE WHERE user_id=$1`, [userId]);
  });
});
