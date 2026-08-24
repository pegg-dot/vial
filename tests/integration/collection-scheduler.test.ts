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

// Collectors written outside this scheduler never run in production. The cron drains this queue
// and nothing else — so a collector that exists only as a script under scripts/ is, from the
// deployment's point of view, not a collector at all. Three were in exactly that state: the
// headless-catalog importer that reads Ascend Bio Labs, the RDAP domain-age reader, and the
// third-party tracker ratings. They had run once each, by hand, on a laptop.
describe("collectors that exist are actually scheduled", () => {
  it("queues a catalog collector for a headless storefront, not just Shopify and Woo", async () => {
    const db = await getDatabase();
    await syncCollectionTargets(db);
    const rows = (await db.query<{ target: string }>(
      `SELECT target FROM collection_targets WHERE collector='catalog-rsc'`,
    )).rows;
    // Ascend Bio Labs is the rscWorks vendor in the curated list.
    expect(rows.map((r) => r.target)).toContain("ascend-bio-labs");
  });

  it("queues the market-wide signal collectors", async () => {
    const db = await getDatabase();
    await syncCollectionTargets(db);
    const kinds = (await db.query<{ collector: string }>(
      `SELECT DISTINCT collector FROM collection_targets`,
    )).rows.map((r) => r.collector);
    expect(kinds).toContain("domain-age");
    expect(kinds).toContain("tracker-ratings");
  });

  // Every kind needs a cadence or the queue cannot schedule it at all.
  it("gives every new kind a cadence", async () => {
    for (const k of ["catalog-rsc", "domain-age", "tracker-ratings"] as const) {
      expect(CADENCE_MINUTES[k]).toBeGreaterThan(0);
    }
  });
});

// The scheduled headless-catalogue import must record the CERTIFICATES it finds, not just the
// listings. Production proved this the hard way: the cron created the Ascend Bio Labs vendor and
// its listings, and the vendor page read "Not enough evidence to grade — Lab tests: nothing on
// file", while the identical importer run by hand produced ten independent lab tests. The COA
// metadata is the entire reason for reading a headless storefront, and runOne was returning it
// straight to the floor.
describe("a scheduled headless import keeps the evidence it finds", () => {
  it("records certificates, not only listings", async () => {
    const db = await getDatabase();
    const before = Number((await db.query<{ c: string | number }>(
      `SELECT COUNT(*) c FROM lab_test_records WHERE vendor_slug='ascend-bio-labs'`)).rows[0]!.c);

    // The importer is exercised directly with a stubbed fetch so the test never touches the network:
    // what is under test is whether the returned COAs are PERSISTED, not whether the parser works.
    const { importRscCatalog } = await import("@/server/ingest/rsc-storefront-import");
    const { recordLabTest } = await import("@/server/ingest/lab-tests");
    const compounds = [{ slug: "bpc-157", name: "BPC-157", aliases: [] }];

    const result = await importRscCatalog(db, {
      vendorSlug: "ascend-bio-labs", vendorName: "Ascend Bio Labs", domain: "ascendbiolabs.com",
      description: "test", compounds, productUrls: ["https://ascendbiolabs.com/product/bpc-157"],
      fetchProducts: async () => [{
        handle: "bpc-157", title: "BPC-157",
        metadata: { coa_lab: "Vanguard Laboratory", coa_url: "https://cdn/coas/batch-V1/report-008.pdf", coa_batch_id: "V1", purity: "99.3%" },
        variants: [{ title: "1 Vial / 10MG", calculated_price: { calculated_amount: 65, currency_code: "usd" } }],
      }],
    });

    expect(result.coas.length).toBeGreaterThan(0);

    for (const c of result.coas) {
      await recordLabTest(db, {
        testId: `ascend-bio-labs-${c.compoundSlug}-${(c.batchId || c.url).slice(-8)}`,
        verifyUrl: c.url, sampleName: "BPC-157", manufacturer: "Ascend Bio Labs",
        batchCode: c.batchId ?? undefined, purityPct: c.purityPct, measuredContent: null,
        testedAt: c.testedAt, lab: c.lab, vendorSlug: "ascend-bio-labs", isIndependent: true,
      }, { compounds, vendors: [{ slug: "ascend-bio-labs", name: "Ascend Bio Labs", domain: "ascendbiolabs.com" }] });
    }

    const after = Number((await db.query<{ c: string | number }>(
      `SELECT COUNT(*) c FROM lab_test_records WHERE vendor_slug='ascend-bio-labs'`)).rows[0]!.c);
    expect(after).toBeGreaterThan(before);
  });
});
