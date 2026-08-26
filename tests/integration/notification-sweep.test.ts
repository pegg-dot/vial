import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Two readers whose sweep behaves badly on purpose, so "a budget stop is not a fault" and "a real
// failure still is" are each proven by something the sweep actually hit rather than by a
// hand-written collector_runs row asserting the outcome it was supposed to measure.
const injected = vi.hoisted(() => ({ slow: "user:customer:zy-slow", broken: "user:customer:zz-broken" }));
vi.mock("@/server/consumer-intelligence/service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/server/consumer-intelligence/service")>();
  return {
    ...actual,
    syncWatchlistNotifications: async (userId: string, now?: Date) => {
      if (userId === injected.broken) throw new Error("simulated reader failure");
      if (userId === injected.slow) await new Promise((resolve) => setTimeout(resolve, 1_200));
      return actual.syncWatchlistNotifications(userId, now);
    },
  };
});

import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { createSavedSearch, listUserNotifications, setFollow } from "@/server/consumer-intelligence/repository";
import { updateNotificationPreferences } from "@/server/account/repository";
import { getNotificationSweepHealth, isSweepHealthy, isSweepKeepingUp, runNotificationSweep } from "@/server/notifications/sweep";
import { SAVED_SEARCH_ALERTS_PER_USER, runSavedSearchAlerts } from "@/server/notifications/saved-search-alerts";
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
function parkedQuietHours() {
  const now = new Date();
  const current = now.getUTCHours() * 60 + now.getUTCMinutes();
  const fmt = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return { start: fmt(current + 120), end: fmt(current + 180) };
}

async function neutraliseDeliveryTiming() {
  const db = await getDatabase();
  const parked = parkedQuietHours();
  await db.query(
    `UPDATE user_notification_preferences SET quiet_hours_start=$2, quiet_hours_end=$3, timezone='UTC', digest_frequency='instant', relevance_threshold=0 WHERE user_id=$1`,
    [userId, parked.start, parked.end],
  );
}

/**
 * A real reader, written by the real writers.
 *
 * The digest is OFF deliberately: `generateMarketChangeSummary` notifies on unrelated market
 * movement, and a queue test needs a reader who can genuinely have nothing waiting for them.
 */
async function makeReader(id: string) {
  const db = await getDatabase();
  await db.query(
    `INSERT INTO auth_users(id,email,display_name,account_type,roles,status) VALUES($1,$2,$3,'customer','["customer"]'::jsonb,'active') ON CONFLICT(id) DO NOTHING`,
    [id, `${id}@example.test`, id],
  );
  const parked = parkedQuietHours();
  await updateNotificationPreferences(id, {
    inAppEnabled: true, emailEnabled: false, priceAlerts: true, evidenceAlerts: true, availabilityAlerts: true,
    orderAlerts: true, savedSearchAlerts: true, followedEntityAlerts: true, marketDigest: false,
    digestFrequency: "instant", quietHoursStart: parked.start, quietHoursEnd: parked.end, timezone: "UTC",
    relevanceThreshold: 0,
  });
  await db.query(`DELETE FROM user_notifications WHERE user_id=$1`, [id]);
  await db.query(`DELETE FROM user_visit_state WHERE user_id=$1`, [id]);
}

async function forgetReader(id: string) {
  const db = await getDatabase();
  await db.query(`DELETE FROM auth_users WHERE id=$1`, [id]);
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

  // THE PROVEN BUG. The queue ordered by the newest NOTIFICATION a reader held, and being swept
  // does not create one. A subscribed reader whose listings never moved therefore stayed NULL
  // forever, held the head of the queue on every tick, and everyone past the per-tick cap waited
  // behind them permanently — for free, from any authenticated account.
  describe("the queue advances on being swept, not on being notified", () => {
    const SILENT = "user:customer:aaa-silent";
    const WAITING = "user:customer:aab-waiting";

    afterAll(async () => { await forgetReader(SILENT); await forgetReader(WAITING); });

    it("does not let a reader with nothing to report camp at the head of the queue", async () => {
      const db = await getDatabase();
      const target = await seedAlertedListing();
      await makeReader(SILENT);
      await makeReader(WAITING);
      // SILENT subscribes with an active saved search. A first run never alerts, and a count that
      // does not move never alerts afterwards, so sweeping this reader produces nothing at all.
      await createSavedSearch(SILENT, { name: "A quiet standing question", query: "bpc", alertMode: "important" });
      // WAITING follows the compound the alert above was written against, so the first tick that
      // REACHES them delivers something. Whether they are reached is the entire question.
      await setFollow(WAITING, "compound", target.compound_slug, true);

      // Both ids sort ahead of every seeded reader, so a cap of one lands on SILENT.
      const first = await runNotificationSweep({ maxUsers: 1 });
      expect(first.swept).toBe(1);
      expect(await listUserNotifications(SILENT, { limit: 50 }), "this reader has to have nothing waiting for the test to mean anything").toEqual([]);
      expect(await listUserNotifications(WAITING, { limit: 50 })).toEqual([]);

      // Being considered has to count. Under the old ordering SILENT still held no notification, so
      // SILENT still sorted first — on this tick and on every tick after it.
      const second = await runNotificationSweep({ maxUsers: 1 });
      expect(second.swept).toBe(1);
      expect(
        (await listUserNotifications(WAITING, { limit: 50 })).length,
        "the reader queued behind a silent reader never got a turn",
      ).toBeGreaterThan(0);

      const state = (await db.query<{ notification_swept_at: string | null; previous_seen_at: string | null; last_seen_at: string }>(
        `SELECT notification_swept_at, previous_seen_at, last_seen_at FROM user_visit_state WHERE user_id=$1`, [SILENT],
      )).rows[0];
      expect(state?.notification_swept_at, "a reader with nothing to report must still advance").toBeTruthy();
      // And the sweep must not have counted itself as a visit: `previous_seen_at` is the window
      // "since your last review" is measured from, and a cron is not a reader looking at the page.
      expect(state?.previous_seen_at).toBeNull();
    });
  });

  // One reader could spend the whole tick: the budget was checked only BETWEEN readers, while
  // inside one reader every active saved search ran a full scan of search_documents with no cap.
  describe("one reader cannot spend the whole tick", () => {
    const HOARDER = "user:customer:zx-hoarder";

    afterAll(async () => { await forgetReader(HOARDER); });

    it("caps the saved searches one reader runs, rotates them, and says what it dropped", async () => {
      const db = await getDatabase();
      await makeReader(HOARDER);
      for (let index = 0; index < 8; index += 1) {
        await createSavedSearch(HOARDER, { name: `Standing question ${index}`, query: "bpc", alertMode: "important" });
      }
      await createSavedSearch(HOARDER, { name: "Muted", query: "bpc", alertMode: "off" });
      const ranSoFar = async () => Number((await db.query<{ n: string }>(
        `SELECT COUNT(*) n FROM saved_searches WHERE user_id=$1 AND last_run_at IS NOT NULL`, [HOARDER],
      )).rows[0]!.n);

      const capped = await runSavedSearchAlerts(HOARDER, new Date(), db, { maxSearches: 3 });
      expect(capped.checked).toBe(3);
      // The muted search is not eligible work, so it cannot consume one of the three slots.
      expect(capped.eligible).toBe(8);
      expect(capped.dropped).toBe(5);
      expect(capped.stoppedEarly).toBe(false);
      expect(await ranSoFar()).toBe(3);

      // "off" is still skipped without running: dropped by the cap and never run are different, and
      // a muted search must never move last_run_at.
      const muted = (await db.query<{ last_run_at: string | null }>(
        `SELECT last_run_at FROM saved_searches WHERE user_id=$1 AND alert_mode='off'`, [HOARDER],
      )).rows[0];
      expect(muted?.last_run_at).toBeNull();

      // The cap has to ROTATE. Re-running the same three every night would starve the tail of one
      // reader's searches exactly the way the reader queue itself was starved.
      const next = await runSavedSearchAlerts(HOARDER, new Date(), db, { maxSearches: 3 });
      expect(next.checked).toBe(3);
      expect(await ranSoFar()).toBe(6);

      // The sweep's budget is visible INSIDE the per-reader work, so a reader holding a lot of
      // searches is interrupted mid-reader instead of running the tick past its ceiling.
      const outOfTime = await runSavedSearchAlerts(HOARDER, new Date(), db, { deadlineAt: Date.now() - 1 });
      expect(outOfTime.stoppedEarly).toBe(true);
      expect(outOfTime.checked).toBe(0);
      expect(outOfTime.dropped).toBe(8);

      // And the default cap is a real ceiling this reader is under, not an accidental truncation.
      expect(SAVED_SEARCH_ALERTS_PER_USER).toBeGreaterThanOrEqual(8);
      const uncapped = await runSavedSearchAlerts(HOARDER, new Date(), db);
      expect(uncapped.checked).toBe(8);
      expect(uncapped.dropped).toBe(0);
    });
  });

  // /status has exactly one job: telling a real fault from a quiet one. Recording a clean budget
  // stop as ok:false made it say "the alert sweep has not completed on schedule" on every healthy
  // tick — with a 200-reader cap in 90s, any per-reader cost over ~450ms is enough.
  describe("stopping on the budget is not a failure", () => {
    // Never-swept readers queued BEHIND the slow one, so the budget trips on someone still waiting
    // rather than on the end of the list. Their ids sort after it, and every other candidate has
    // already been swept, so the slow reader is reached first and these two are not reached at all.
    const queued = ["user:customer:zza-queued", "user:customer:zzb-queued"];

    afterAll(async () => {
      await forgetReader(injected.slow);
      await forgetReader(injected.broken);
      for (const id of queued) await forgetReader(id);
    });

    it("records a budget-stopped tick as healthy and reports the backlog instead", async () => {
      const db = await getDatabase();
      await makeReader(injected.slow);
      await setFollow(injected.slow, "compound", "bpc-157", true);
      for (const id of queued) { await makeReader(id); await setFollow(id, "compound", "bpc-157", true); }
      await db.query(`DELETE FROM collector_runs WHERE collector='notification-sweep'`);

      // The slow reader costs more than the whole budget on its own, so the tick stops on its own
      // terms with readers still queued behind it.
      const result = await runNotificationSweep({ maxUsers: 10, budgetMs: 1_000 });
      expect(result.stoppedEarly, "the budget has to actually bite for this test to mean anything").toBe(true);
      expect(result.failures).toBe(0);
      expect(result.deferred).toBeGreaterThan(0);

      const receipt = (await db.query<{ items: number; ok: boolean }>(
        `SELECT items, ok FROM collector_runs WHERE collector='notification-sweep' ORDER BY ran_at DESC LIMIT 1`,
      )).rows[0]!;
      expect(receipt.ok, "a sweep that did exactly what it was built to do is not a fault").toBe(true);

      const health = await getNotificationSweepHealth();
      expect(isSweepHealthy(health)).toBe(true);
      // But it is not silent about the cost: the readers it did not reach are counted, so a backlog
      // that keeps growing is visible without a healthy tick having to report itself as broken.
      expect(health.backlogReaders).toBeGreaterThan(0);
      expect(isSweepKeepingUp({ ...health, backlogReaders: 5_000 }), "a backlog past a tick's capacity is worth saying").toBe(false);

      await forgetReader(injected.slow);
      for (const id of queued) await forgetReader(id);
    });

    it("still records a genuine reader failure as a fault", async () => {
      const db = await getDatabase();
      await makeReader(injected.broken);
      await setFollow(injected.broken, "compound", "bpc-157", true);
      await db.query(`DELETE FROM collector_runs WHERE collector='notification-sweep'`);

      const result = await runNotificationSweep({ maxUsers: 10 });
      expect(result.failures).toBeGreaterThan(0);

      const receipt = (await db.query<{ ok: boolean }>(
        `SELECT ok FROM collector_runs WHERE collector='notification-sweep' ORDER BY ran_at DESC LIMIT 1`,
      )).rows[0]!;
      expect(receipt.ok, "a reader that threw is a real fault and must still be reported").toBe(false);
      expect(isSweepHealthy(await getNotificationSweepHealth())).toBe(false);

      // A reader who fails every night must still advance, or a permanently broken account holds
      // the head of the queue forever — the starvation bug wearing a different hat.
      const stamped = (await db.query<{ notification_swept_at: string | null }>(
        `SELECT notification_swept_at FROM user_visit_state WHERE user_id=$1`, [injected.broken],
      )).rows[0];
      expect(stamped?.notification_swept_at).toBeTruthy();

      await forgetReader(injected.broken);
    });
  });
});
