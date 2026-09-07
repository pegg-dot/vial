// A cadence equal to the cron interval must not become "every other day".
//
// Both queues write their next-due time as COMPLETION time plus the cadence, and both claim on
// `next_due <= NOW()`. That is fine while the cron fires far more often than the cadence — the old
// 15- and 30-minute crons always had another tick along shortly. Once the schedule went daily on
// 2026-09-07 and the cadences moved to 24h to match it, the two numbers became equal, and equal is
// the one case that breaks:
//
//   Day 1  cron 05:00:00 -> target settles 05:00:03 -> next due Day 2 05:00:03
//   Day 2  cron 05:00:00 -> 05:00:03 <= 05:00:00 is false -> skipped
//   Day 3  cron 05:00:00 -> due
//
// Every target served every other day, at half the freshness the cadence promises, with every run
// green and the capacity arithmetic reporting 2.4x headroom. The seconds a run takes to reach a
// target are enough to do it, and Vercel's cron firing time drifts by minutes on top.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests, type SqlConnection } from "@/server/db/client";
import { claimDueTargets } from "@/server/collect/scheduler";
import { enqueueDueRefreshJobs } from "@/server/refresh/repository";
import { applyRetention } from "@/server/db/retention";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SESSION_SECRET = "due-grace-test-secret-at-least-32-characters-ok!";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "due-grace-test-privacy-secret-at-least-32-chars!";

let db: SqlConnection;
beforeAll(async () => { await resetDatabaseForTests(); db = await getDatabase(); });
afterAll(async () => { await resetDatabaseForTests(); });

describe("the collection queue survives a cadence equal to its cron interval", () => {
  beforeEach(async () => { await db.query(`DELETE FROM collection_targets`); });

  const seed = async (id: string, dueInSeconds: number) => {
    await db.query(
      `INSERT INTO collection_targets (id, collector, target, cadence_minutes, next_due_at, enabled)
       VALUES ($1, 'vendor-status', $1, 1440, NOW() + ($2::text || ' seconds')::interval, TRUE)`,
      [id, String(dueInSeconds)],
    );
  };

  it("claims a target that came due a moment ago", async () => {
    await seed("past", -60);
    expect((await claimDueTargets(db, 10)).map((t) => t.id)).toContain("past");
  });

  // The defect. Yesterday's run reached this target three seconds after the cron fired, so today it
  // is due three seconds from now — and today's run would walk straight past it.
  it("claims a target that comes due seconds AFTER this run started", async () => {
    await seed("just-missed", 3);
    expect((await claimDueTargets(db, 10)).map((t) => t.id)).toContain("just-missed");
  });

  it("claims one that drifted by several minutes, which cron firing times do", async () => {
    await seed("drifted", 8 * 60);
    expect((await claimDueTargets(db, 10)).map((t) => t.id)).toContain("drifted");
  });

  // The grace window is a nudge, not an amnesty. A weekly target is not dragged forward a day.
  it("does not claim a target that is genuinely not due for hours", async () => {
    await seed("tomorrow", 6 * 3600);
    expect((await claimDueTargets(db, 10)).map((t) => t.id)).not.toContain("tomorrow");
  });

  it("still refuses a disabled target however overdue", async () => {
    await seed("off", -86_400);
    await db.query(`UPDATE collection_targets SET enabled = FALSE WHERE id = 'off'`);
    expect((await claimDueTargets(db, 10)).map((t) => t.id)).not.toContain("off");
  });
});

describe("the provenance queue survives the same thing", () => {
  beforeEach(async () => {
    await db.query(`DELETE FROM refresh_jobs`);
    await db.query(`DELETE FROM source_refresh_policies`);
    await db.query(`DELETE FROM sources WHERE id LIKE 'src-pol-%'`);
  });

  // A policy needs a real source and a real listing to point at. The seeded fixture catalogue
  // supplies the listing, which keeps this test about scheduling rather than about how many tables
  // it takes to make one row.
  const seedPolicy = async (id: string, dueInSeconds: number) => {
    const listing = (await db.query<{ id: string }>(`SELECT id FROM listings LIMIT 1`)).rows[0];
    expect(listing, "the fixture catalogue should provide a listing to attach a policy to").toBeTruthy();
    await db.query(
      `INSERT INTO sources (id, source_type, canonical_location, label)
       VALUES ($1, 'http', $2, $1) ON CONFLICT (id) DO NOTHING`,
      [`src-${id}`, `https://example.test/${id}`],
    );
    await db.query(
      `INSERT INTO source_refresh_policies (id, source_id, target_listing_id, interval_minutes, enabled, next_run_at)
       VALUES ($1, $2, $3, 1440, TRUE, NOW() + ($4::text || ' seconds')::interval)`,
      [id, `src-${id}`, listing!.id, String(dueInSeconds)],
    );
  };

  it("enqueues a policy that comes due seconds after the sweep started", async () => {
    await seedPolicy("pol-just-missed", 3);
    expect(await enqueueDueRefreshJobs()).toHaveLength(1);
  });

  it("leaves a policy that is genuinely hours away", async () => {
    await seedPolicy("pol-tomorrow", 6 * 3600);
    expect(await enqueueDueRefreshJobs()).toHaveLength(0);
  });
});

// The demand log is written by an unauthenticated public endpoint, so it needs a retention rule or
// it grows with nothing but time. The rule keys on last_seen_at, and that choice is the test: an
// upsert-with-counter table has ancient first_seen_at values on its MOST valuable rows, so keying
// on first_seen_at would delete precisely what the table exists to surface.
describe("the verify demand log is bounded, and bounded on the right column", () => {
  beforeEach(async () => { await db.query(`DELETE FROM verify_queries`); });

  const seed = async (name: string, firstSeenDaysAgo: number, lastSeenDaysAgo: number, checks = 1) => {
    await db.query(
      `INSERT INTO verify_queries (normalized, display, kind, last_verdict, checks, first_seen_at, last_seen_at)
       VALUES ($1, $1, 'unknown-domain', 'unproven', $2,
               NOW() - ($3::text || ' days')::interval,
               NOW() - ($4::text || ' days')::interval)`,
      [name, checks, String(firstSeenDaysAgo), String(lastSeenDaysAgo)],
    );
  };

  it("keeps a long-running query that is still being asked", async () => {
    // First asked a year ago, asked again yesterday, 400 times in between: the best row in the
    // table. A first_seen_at rule would delete it.
    await seed("still-asked.com", 365, 1, 400);
    await applyRetention(db);
    const left = await db.query<{ normalized: string }>(`SELECT normalized FROM verify_queries`);
    expect(left.rows.map((r) => r.normalized)).toContain("still-asked.com");
  });

  it("drops a query nobody has asked in half a year", async () => {
    await seed("forgotten.com", 400, 200);
    await applyRetention(db);
    const left = await db.query<{ normalized: string }>(`SELECT normalized FROM verify_queries`);
    expect(left.rows.map((r) => r.normalized)).not.toContain("forgotten.com");
  });

  it("reports the table it swept, so the rule cannot silently no-op", async () => {
    await seed("forgotten-too.com", 400, 200);
    const results = await applyRetention(db);
    const row = results.find((r) => r.table === "verify_queries");
    expect(row, "verify_queries must appear in the retention results").toBeTruthy();
    expect(row!.deleted).toBeGreaterThan(0);
  });
});
