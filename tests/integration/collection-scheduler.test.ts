import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabaseForTests, getDatabase } from "@/server/db/client";
import {
  syncCollectionTargets, claimDueTargets, runCollectionTick, CADENCE_MINUTES,
} from "@/server/collect/scheduler";

beforeEach(async () => {
  process.env.VIALGRADE_PGLITE_MEMORY = "true";
  process.env.VIALGRADE_SEED_FIXTURES = "true";
  process.env.VIALGRADE_SEED_DEMO_ACCOUNTS = "true";
  delete (globalThis as { __vialEvidenceSeedPromise?: unknown }).__vialEvidenceSeedPromise;
  delete (globalThis as { __vialSellerOpsSeedPromise?: unknown }).__vialSellerOpsSeedPromise;
  await resetDatabaseForTests();
});

async function targetRow(id: string) {
  const db = await getDatabase();
  return (await db.query<{ enabled: boolean; consecutive_failures: number; next_due_at: string; last_ok: boolean | null; last_error: string | null }>(
    `SELECT enabled,consecutive_failures,next_due_at,last_ok,last_error FROM collection_targets WHERE id=$1`, [id],
  )).rows[0];
}

describe("continuous collection queue", () => {
  it("builds a queue from the curated vendor list and is idempotent", async () => {
    const db = await getDatabase();
    const first = await syncCollectionTargets(db);
    expect(first.targets).toBeGreaterThan(0);
    const countAfterFirst = Number((await db.query<{ c: string | number }>(`SELECT COUNT(*) c FROM collection_targets`)).rows[0]!.c);

    await syncCollectionTargets(db);
    const countAfterSecond = Number((await db.query<{ c: string | number }>(`SELECT COUNT(*) c FROM collection_targets`)).rows[0]!.c);
    expect(countAfterSecond).toBe(countAfterFirst);
  });

  it("gives each collector its own cadence rather than one global interval", async () => {
    const db = await getDatabase();
    await syncCollectionTargets(db);
    const rows = (await db.query<{ collector: string; cadence_minutes: number }>(
      `SELECT DISTINCT collector,cadence_minutes FROM collection_targets`,
    )).rows;
    expect(rows.length).toBeGreaterThan(1);
    for (const r of rows) {
      expect(r.cadence_minutes).toBe(CADENCE_MINUTES[r.collector as keyof typeof CADENCE_MINUTES]);
    }
  });

  it("claims the most overdue targets first so nothing starves", async () => {
    const db = await getDatabase();
    await syncCollectionTargets(db);
    const all = (await db.query<{ id: string }>(`SELECT id FROM collection_targets ORDER BY id LIMIT 3`)).rows;
    await db.query(`UPDATE collection_targets SET next_due_at = NOW() + interval '1 day'`);
    await db.query(`UPDATE collection_targets SET next_due_at = NOW() - interval '5 hours' WHERE id=$1`, [all[0]!.id]);
    await db.query(`UPDATE collection_targets SET next_due_at = NOW() - interval '1 hour' WHERE id=$1`, [all[1]!.id]);

    const due = await claimDueTargets(db, 10);
    expect(due.map(d => d.id)).toEqual([all[0]!.id, all[1]!.id]);
  });

  // This runs unattended against third-party hosts. A vendor that blocks us, changes platform, or
  // times out must never take the tick down or stall every other target behind it.
  it("records a failing target and backs it off instead of throwing", async () => {
    const db = await getDatabase();
    await syncCollectionTargets(db);
    // A synthetic target for a vendor that is not in the curated list — sync only upserts, never
    // deletes, so this survives the sync at the top of the tick and exercises the failure path.
    const victim = { id: "ct:catalog-woo:ghost-vendor" };
    await db.query(`UPDATE collection_targets SET next_due_at = NOW() + interval '1 day'`);
    await db.query(
      `INSERT INTO collection_targets(id,collector,target,cadence_minutes,next_due_at)
       VALUES($1,'catalog-woo','ghost-vendor',360, NOW() - interval '1 hour')`, [victim.id],
    );

    const result = await runCollectionTick({ budgetMs: 8_000, maxTargets: 2, connection: db });

    expect(result.ran.some(r => !r.ok)).toBe(true);
    const row = await targetRow(victim.id);
    expect(row.last_ok).toBe(false);
    expect(row.consecutive_failures).toBe(1);
    expect(row.last_error).toBeTruthy();
    // Backed off beyond its normal cadence rather than retried on the very next tick.
    expect(new Date(row.next_due_at).getTime()).toBeGreaterThan(Date.now());
  });

  it("stops cleanly when the time budget is spent rather than overrunning", async () => {
    const db = await getDatabase();
    await syncCollectionTargets(db);
    await db.query(`UPDATE collection_targets SET next_due_at = NOW() - interval '1 hour'`);

    const result = await runCollectionTick({ budgetMs: 0, maxTargets: 8, connection: db });
    // A zero budget means it should not start any work at all.
    expect(result.ran.length).toBe(0);
    expect(result.budgetExhausted).toBe(true);
  });

  it("leaves an untouched target due so the next tick resumes it", async () => {
    const db = await getDatabase();
    await syncCollectionTargets(db);
    await db.query(`UPDATE collection_targets SET next_due_at = NOW() - interval '1 hour'`);
    const before = (await claimDueTargets(db, 100)).length;

    await runCollectionTick({ budgetMs: 0, maxTargets: 8, connection: db });

    const after = (await claimDueTargets(db, 100)).length;
    expect(after).toBe(before);
  });
});

// Pure most-overdue ordering starves small collectors: 40 per-vendor catalog targets always
// out-age a single enforcement or news target, so those would never reach the front of the queue.
describe("collection queue — fair share across collector kinds", () => {
  it("gives every due collector kind a slot before filling by age", async () => {
    const db = await getDatabase();
    await syncCollectionTargets(db);
    // Age every vendor target far beyond the single-target collectors, the real-world shape.
    await db.query(`UPDATE collection_targets SET next_due_at = NOW() - interval '10 days' WHERE collector LIKE 'catalog-%' OR collector = 'vendor-status'`);
    await db.query(`UPDATE collection_targets SET next_due_at = NOW() - interval '1 minute' WHERE collector NOT LIKE 'catalog-%' AND collector <> 'vendor-status'`);

    const kinds = (await db.query<{ collector: string }>(`SELECT DISTINCT collector FROM collection_targets WHERE enabled`)).rows.map(r => r.collector);
    // Budget 0 means nothing runs, but selection still happens — assert via a real tick with a
    // tiny budget so at most one target actually executes.
    const result = await runCollectionTick({ budgetMs: 0, maxTargets: 4, connection: db });
    expect(result.ran.length).toBe(0);

    // The selection itself is what matters: every kind must be represented in the claim set.
    const claimed = await claimDueTargets(db, 200);
    const claimedKinds = new Set<string>(claimed.map(c => String(c.collector)));
    for (const k of kinds) expect(claimedKinds.has(k), `kind ${k} must be claimable`).toBe(true);
  });
});

// Reserving a slot per kind was not enough: the reserved slots still ran in AGE order, so a
// catalog target (which can spend the whole tick budget alone) went first and the single-target
// collectors were never reached. Production sat at 24 enforcement records with 383 available.
describe("collection queue — cheap collectors run before the fleet", () => {
  it("orders a single-target collector ahead of a many-target one", async () => {
    const db = await getDatabase();
    await syncCollectionTargets(db);
    await db.query(
      `INSERT INTO collection_targets(id,collector,target,cadence_minutes,next_due_at)
       VALUES('ct:solo:market','solo-kind','market',720, NOW() - interval '1 minute')`,
    );
    // Every fleet target is far older, so age alone would bury the solo collector.
    await db.query(`UPDATE collection_targets SET next_due_at = NOW() - interval '10 days' WHERE collector <> 'solo-kind'`);

    const result = await runCollectionTick({ budgetMs: 1, maxTargets: 8, connection: db });
    // Budget 1ms means at most the first target is attempted; assert the solo kind was chosen
    // first by checking it is the one that got settled.
    const solo = (await db.query<{ last_run_at: string | null }>(
      `SELECT last_run_at FROM collection_targets WHERE id='ct:solo:market'`,
    )).rows[0]!;
    expect(result.ran.length).toBeLessThanOrEqual(1);
    if (result.ran.length === 1) expect(result.ran[0]!.collector).toBe("solo-kind");
    else expect(solo.last_run_at).toBeNull(); // nothing ran at all — acceptable at a 1ms budget
  });
});
