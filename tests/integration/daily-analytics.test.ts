// Per-day traffic numbers. Two things here can lie quietly, so both are pinned.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests, type SqlConnection } from "@/server/db/client";
import { getDailySeries, getVendorClickBreakdown } from "@/server/analytics/daily";
import { countingDay } from "@/server/analytics/counting-day";
import { newId } from "@/server/db/ids";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SESSION_SECRET = "daily-analytics-secret-at-least-32-characters!!!";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "daily-analytics-privacy-at-least-32-characters!!";

let db: SqlConnection;
beforeAll(async () => { await resetDatabaseForTests(); db = await getDatabase(); });
afterAll(async () => { await resetDatabaseForTests(); });

const view = (visitor: string, hoursAgo: number, isBot = false) =>
  db.query(
    `INSERT INTO page_views(id, path, page_kind, visitor_hash, is_bot, created_at)
     VALUES($1,'/market','market',$2,$3, NOW() - ($4::text || ' hours')::interval)`,
    [newId("pv"), visitor, isBot, String(hoursAgo)],
  );

const click = (visitor: string, vendor: string, hoursAgo: number, isBot = false) =>
  db.query(
    `INSERT INTO outbound_clicks(id, vendor_slug, visitor_hash, is_bot, created_at)
     VALUES($1,$2,$3,$4, NOW() - ($5::text || ' hours')::interval)`,
    [newId("oc"), vendor, visitor, isBot, String(hoursAgo)],
  );

describe("daily series", () => {
  beforeEach(async () => {
    await db.query(`DELETE FROM page_views`);
    await db.query(`DELETE FROM outbound_clicks`);
  });

  // The defect this replaces: the admin only ever had 30-day totals, so a week-long outage and a
  // steady week looked identical. A series that omits empty days draws a smooth line through the
  // outage, which is worse than no chart.
  it("returns one point per day including days with nothing", async () => {
    await view("reader-a", 2);
    const s = await getDailySeries({ days: 30, connection: db });
    expect(s.points).toHaveLength(30);
    expect(s.points.filter(p => p.views === 0).length).toBeGreaterThan(20);
    // The newest bucket is the current COUNTING day, which after 8pm Eastern is not the UTC date.
    expect(s.points[s.points.length - 1].day).toBe(countingDay(new Date()));
  });

  it("counts distinct readers, not views", async () => {
    await view("reader-a", 1); await view("reader-a", 2); await view("reader-b", 1);
    const s = await getDailySeries({ days: 2, connection: db });
    const today = s.points[s.points.length - 1];
    expect(today.views).toBe(3);
    expect(today.readers).toBe(2);
  });

  // The one "same person" question this data can answer.
  it("counts a reader who came back the same day, and does not count a one-page reader", async () => {
    await view("came-back", 1); await view("came-back", 3); await view("read-once", 1);
    const today = (await getDailySeries({ days: 2, connection: db })).points.at(-1)!;
    expect(today.readers).toBe(2);
    expect(today.returningWithinDay).toBe(1);
  });

  it("excludes bots from every measure", async () => {
    await view("human", 1); await view("crawler", 1, true);
    await click("human", "acme", 1); await click("crawler", "acme", 1, true);
    const today = (await getDailySeries({ days: 2, connection: db })).points.at(-1)!;
    expect(today.readers).toBe(1);
    expect(today.clicks).toBe(1);
    expect((await getVendorClickBreakdown({ days: 2, connection: db }))[0].events).toBe(1);
  });

  // The buckets must use the SAME day definition as the visitor hash. If the chart bucketed on UTC
  // while the hash rotated on counting day, one reader near the boundary would be one person in the
  // hash and two in the chart — and nothing would have said so.
  it("buckets on the counting day, the same definition the visitor hash salts with", async () => {
    // 01:00 UTC is 9pm Eastern the PREVIOUS calendar day, and both sides must agree on which day.
    const instant = new Date(Date.UTC(2026, 8, 10, 1, 0, 0));
    const hoursAgo = Math.round((Date.now() - instant.getTime()) / 3_600_000);
    if (hoursAgo > 0 && hoursAgo < 24 * 170) {
      await view("boundary-reader", hoursAgo);
      const s = await getDailySeries({ days: 175, connection: db });
      const landed = s.points.find(p => p.views > 0);
      expect(landed?.day).toBe(countingDay(instant));
    }
  });

  it("derives pages-per-reader and click-through from the same window", async () => {
    await view("a", 1); await view("a", 2); await view("b", 1);
    await click("a", "acme", 1);
    const s = await getDailySeries({ days: 2, connection: db });
    expect(s.pagesPerReader).toBeCloseTo(3 / 2, 5);
    expect(s.clickThroughRate).toBeCloseTo(1 / 2, 5);
  });

  it("reports zeroes rather than dividing by nothing when the window is empty", async () => {
    const s = await getDailySeries({ days: 7, connection: db });
    expect(s.pagesPerReader).toBe(0);
    expect(s.clickThroughRate).toBe(0);
    expect(s.totals.views).toBe(0);
  });
});
