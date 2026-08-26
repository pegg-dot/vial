import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import {
  getNotificationChannelPreferences,
  listFollowedListingSlugs,
  setFollow,
} from "@/server/consumer-intelligence/repository";
import { syncWatchlistNotifications } from "@/server/consumer-intelligence/service";
import { setWatchlistItem } from "@/server/account/repository";
import { createAlert, createDomainEvent } from "@/server/intelligence/events";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SEED_FIXTURES = "true";
process.env.VIALGRADE_SEED_DEMO_ACCOUNTS = "true";
process.env.VIALGRADE_SESSION_SECRET = "follow-notifications-test-secret-at-least-32";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "follow-notifications-privacy-secret-at-least-32";

const userId = "user:customer:nora";

/**
 * A REAL listing/compound/vendor triple out of the seeded catalogue, carrying a REAL alert.
 *
 * The alert is written by `createAlert` — the same function Watchtower uses in production — rather
 * than by an INSERT written here. A hand-inserted row would keep passing after the real writer's
 * shape changed, which is the failure mode that makes a green suite worthless.
 */
let fixture: { listing_slug: string; compound_slug: string; vendor_slug: string } | null = null;

async function pickAlertedListing() {
  if (fixture) return fixture;
  const db = await getDatabase();
  const row = (await db.query<{ listing_id: string; listing_slug: string; compound_slug: string; vendor_slug: string }>(
    `SELECT l.id listing_id, l.slug listing_slug, c.slug compound_slug, o.slug vendor_slug
     FROM listings l
     JOIN products p ON p.id=l.product_id AND p.status='active'
     JOIN compounds c ON c.id=p.compound_id
     JOIN organizations o ON o.id=p.vendor_id
     ORDER BY l.slug
     LIMIT 1`,
  )).rows[0];
  if (!row) return null;
  const root = await createDomainEvent(db, { eventType: "listing.observed", entityType: "listing", entityId: row.listing_id, actor: "test:fixture" });
  await createAlert(db, {
    rootEventId: root.rootEventId,
    parentEventId: root.id,
    category: "price_change",
    severity: "notice",
    entityType: "listing",
    entityId: row.listing_id,
    title: "Price moved",
    message: "The observed price changed since the last reviewed snapshot.",
  });
  fixture = { listing_slug: row.listing_slug, compound_slug: row.compound_slug, vendor_slug: row.vendor_slug };
  return fixture;
}

async function neutraliseDeliveryTiming() {
  const db = await getDatabase();
  const now = new Date();
  const current = now.getUTCHours() * 60 + now.getUTCMinutes();
  const fmt = (minutes: number) => `${String(Math.floor((minutes % 1440) / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  await db.query(
    `UPDATE user_notification_preferences SET quiet_hours_start=$2, quiet_hours_end=$3, timezone='UTC', digest_frequency='instant', relevance_threshold=0 WHERE user_id=$1`,
    [userId, fmt(current + 120), fmt(current + 180)],
  );
}

describe("following produces notifications", () => {
  beforeAll(async () => { await resetDatabaseForTests(); await getDatabase(); });
  beforeEach(neutraliseDeliveryTiming);
  afterAll(async () => { await resetDatabaseForTests(); });

  it("resolves a followed compound to its listings", async () => {
    const target = await pickAlertedListing();
    expect(target, "the seeded catalogue holds no alerted listing to test against").toBeTruthy();
    await setFollow(userId, "compound", target!.compound_slug, true);
    const covered = await listFollowedListingSlugs(userId);
    expect(covered.map((item) => item.listingSlug)).toContain(target!.listing_slug);
    await setFollow(userId, "compound", target!.compound_slug, false);
  });

  it("resolves a followed vendor to its listings", async () => {
    const target = await pickAlertedListing();
    await setFollow(userId, "vendor", target!.vendor_slug, true);
    const covered = await listFollowedListingSlugs(userId);
    expect(covered.map((item) => item.listingSlug)).toContain(target!.listing_slug);
    await setFollow(userId, "vendor", target!.vendor_slug, false);
  });

  it("returns nothing when the user follows nothing", async () => {
    // The fixture user ships with seeded follows (src/server/consumer-intelligence/seed.ts), so
    // this asserts the empty case explicitly rather than assuming a clean slate.
    const db = await getDatabase();
    const seeded = (await db.query<{ entity_type: string; entity_slug: string }>(`SELECT entity_type, entity_slug FROM entity_follows WHERE user_id=$1`, [userId])).rows;
    await db.query(`DELETE FROM entity_follows WHERE user_id=$1`, [userId]);
    expect(await listFollowedListingSlugs(userId)).toEqual([]);
    for (const row of seeded) await setFollow(userId, row.entity_type, row.entity_slug, true);
  });

  // The point of the change. Before it, this listing could only reach the inbox via the watchlist.
  it("delivers an alert for a followed compound the user has NOT watchlisted", async () => {
    const db = await getDatabase();
    const target = await pickAlertedListing();
    await db.query(`DELETE FROM user_notifications WHERE user_id=$1`, [userId]);
    await db.query(`DELETE FROM user_watchlists WHERE user_id=$1`, [userId]);
    await db.query(`UPDATE user_notification_preferences SET relevance_threshold=0 WHERE user_id=$1`, [userId]);

    const withoutFollow = await syncWatchlistNotifications(userId);
    const before = withoutFollow.filter((item) => item.actionHref === `/products/${target!.listing_slug}`);
    expect(before, "an empty watchlist must not deliver this listing yet").toEqual([]);

    await setFollow(userId, "compound", target!.compound_slug, true);
    const withFollow = await syncWatchlistNotifications(userId);
    const after = withFollow.filter((item) => item.actionHref === `/products/${target!.listing_slug}`);
    expect(after.length).toBeGreaterThan(0);
    // It must also say WHY it arrived.
    expect(after[0]!.body).toMatch(/You follow /);
  });

  it("ranks a follow-derived alert below the same alert from an explicit watchlist save", async () => {
    const db = await getDatabase();
    const target = await pickAlertedListing();
    const href = `/products/${target!.listing_slug}`;

    await db.query(`DELETE FROM user_notifications WHERE user_id=$1`, [userId]);
    const followOnly = (await syncWatchlistNotifications(userId)).find((item) => item.actionHref === href);

    await db.query(`DELETE FROM user_notifications WHERE user_id=$1`, [userId]);
    await setWatchlistItem(userId, target!.listing_slug, true);
    const watched = (await syncWatchlistNotifications(userId)).find((item) => item.actionHref === href);

    expect(followOnly).toBeTruthy();
    expect(watched).toBeTruthy();
    expect(watched!.relevanceScore).toBeGreaterThan(followOnly!.relevanceScore);
    expect(watched!.body).toMatch(/On your watchlist/);
    await setWatchlistItem(userId, target!.listing_slug, false);
  });

  it("honours followed_entity_alerts=false — the setting binds instead of only saving", async () => {
    const db = await getDatabase();
    const target = await pickAlertedListing();
    const href = `/products/${target!.listing_slug}`;

    await db.query(`UPDATE user_notification_preferences SET followed_entity_alerts=FALSE WHERE user_id=$1`, [userId]);
    expect((await getNotificationChannelPreferences(userId)).followedEntityAlerts).toBe(false);
    await db.query(`DELETE FROM user_notifications WHERE user_id=$1`, [userId]);
    await db.query(`DELETE FROM user_watchlists WHERE user_id=$1`, [userId]);

    const muted = await syncWatchlistNotifications(userId);
    expect(muted.filter((item) => item.actionHref === href)).toEqual([]);

    await db.query(`UPDATE user_notification_preferences SET followed_entity_alerts=TRUE WHERE user_id=$1`, [userId]);
    const unmuted = await syncWatchlistNotifications(userId);
    expect(unmuted.filter((item) => item.actionHref === href).length).toBeGreaterThan(0);
  });

  it("treats a user with no preferences row as opted IN, matching the schema default", async () => {
    const db = await getDatabase();
    await db.query(`DELETE FROM user_notification_preferences WHERE user_id=$1`, [userId]);
    expect((await getNotificationChannelPreferences(userId)).followedEntityAlerts).toBe(true);
    await db.query(`INSERT INTO user_notification_preferences(user_id) VALUES($1) ON CONFLICT DO NOTHING`, [userId]);
  });

});
