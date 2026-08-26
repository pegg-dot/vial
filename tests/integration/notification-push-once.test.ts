import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// The inbox row dedupes on `dedupe_key`; the PUSH did not.
//
// `getAlertsForListingSlugs` has no time filter — it returns up to 150 alerts on a watched listing
// however old they are — and the sweep called `sendPushToUser` for every one of them on every run.
// Before the cron that only happened when a reader loaded the page, which was already wrong but at
// least bounded by their own behaviour. A daily cron turns it into "every alert you have ever been
// told about, pushed to your phone again, every day, forever" — and this suite could not see it,
// because VAPID is unset in tests so the real sender silently no-ops.
const sendPushToUser = vi.fn(async () => ({ sent: 1, pruned: 0 }));
vi.mock("@/server/push/delivery", () => ({ sendPushToUser }));

const { getDatabase, resetDatabaseForTests } = await import("@/server/db/client");
const { setFollow } = await import("@/server/consumer-intelligence/repository");
const { syncWatchlistNotifications } = await import("@/server/consumer-intelligence/service");
const { createAlert, createDomainEvent } = await import("@/server/intelligence/events");

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SEED_FIXTURES = "true";
process.env.VIALGRADE_SEED_DEMO_ACCOUNTS = "true";
process.env.VIALGRADE_SESSION_SECRET = "push-once-test-secret-at-least-32-characters";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "push-once-privacy-secret-at-least-32-characters";

const userId = "user:customer:nora";

/** Park quiet hours away from now and pin the digest to instant — otherwise this tests the clock. */
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

describe("a push goes out once, not on every sweep", () => {
  beforeAll(async () => { await resetDatabaseForTests(); await getDatabase(); });
  beforeEach(async () => { await neutraliseDeliveryTiming(); sendPushToUser.mockClear(); });
  afterAll(async () => { await resetDatabaseForTests(); });

  it("pushes a genuinely new alert", async () => {
    const db = await getDatabase();
    const target = await seedAlertedListing();
    await db.query(`DELETE FROM user_notifications WHERE user_id=$1`, [userId]);
    await setFollow(userId, "compound", target.compound_slug, true);

    await syncWatchlistNotifications(userId);
    expect(sendPushToUser).toHaveBeenCalled();
  });

  it("does NOT push the same alert again on the next sweep", async () => {
    // Nothing changed between the two runs. The reader has already been told.
    await syncWatchlistNotifications(userId);
    expect(
      sendPushToUser,
      "the same alert was pushed twice — a daily cron would re-notify every alert in history, every day",
    ).not.toHaveBeenCalled();
  });

  it("still records the notification on the repeat sweep", async () => {
    // Not pushing must not mean not recording: the inbox row has to stay present and correct.
    const db = await getDatabase();
    const rows = (await db.query<{ n: string }>(`SELECT COUNT(*) n FROM user_notifications WHERE user_id=$1`, [userId])).rows[0]!;
    expect(Number(rows.n)).toBeGreaterThan(0);
  });

  it("pushes again when a genuinely new alert arrives", async () => {
    await seedAlertedListing();
    await syncWatchlistNotifications(userId);
    expect(sendPushToUser, "a new alert must still reach the reader").toHaveBeenCalled();
  });

  // The hole opened by the first version of the fix above. Gating push on "was this row just
  // INSERTED" looked equivalent to "has it been delivered" and is not: a notification first written
  // during quiet hours is inserted with push withheld, and every later tick then sees an UPDATE and
  // never pushes it. Deferral has to be recoverable.
  it("pushes a notification that was deferred by quiet hours, once the quiet hours end", async () => {
    const db = await getDatabase();
    const target = await seedAlertedListing();
    await db.query(`DELETE FROM user_notifications WHERE user_id=$1`, [userId]);

    // First sweep lands inside the reader's quiet window: the row is written, the push withheld.
    const now = new Date();
    const current = now.getUTCHours() * 60 + now.getUTCMinutes();
    const fmt = (m: number) => `${String(Math.floor(((m % 1440) + 1440) % 1440 / 60)).padStart(2, "0")}:${String(((m % 60) + 60) % 60).padStart(2, "0")}`;
    await db.query(
      `UPDATE user_notification_preferences SET quiet_hours_start=$2, quiet_hours_end=$3, timezone='UTC' WHERE user_id=$1`,
      [userId, fmt(current - 60), fmt(current + 60)],
    );
    sendPushToUser.mockClear();
    await syncWatchlistNotifications(userId);
    expect(sendPushToUser, "quiet hours must withhold the push").not.toHaveBeenCalled();
    const stored = (await db.query<{ n: string }>(
      `SELECT COUNT(*) n FROM user_notifications WHERE user_id=$1 AND action_href=$2`,
      [userId, `/products/${target.listing_slug}`],
    )).rows[0]!;
    expect(Number(stored.n), "the notification itself must still be recorded").toBeGreaterThan(0);

    // Quiet hours are over. The same alert is now due, and has never been pushed.
    await neutraliseDeliveryTiming();
    sendPushToUser.mockClear();
    await syncWatchlistNotifications(userId);
    expect(
      sendPushToUser,
      "a notification deferred by quiet hours was never pushed at all — deferral has to be recoverable",
    ).toHaveBeenCalled();

    // And still only once.
    sendPushToUser.mockClear();
    await syncWatchlistNotifications(userId);
    expect(sendPushToUser).not.toHaveBeenCalled();
  });
});
