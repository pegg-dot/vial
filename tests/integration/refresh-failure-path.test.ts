import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.VIALGRADE_PGLITE_MEMORY = "true";

// 2026-08-29, production: the provenance cron 500'd on every tick from 18:15Z with Postgres 42P18
// "could not determine data type of parameter $2". The refresh job FAILURE path built intervals
// as `($2 || ' seconds')` — an untyped parameter next to an untyped literal, which Postgres cannot
// resolve. The path had never run in production until the reclaim of orphaned jobs made those
// jobs run and fail; the handler then threw, the tick died, the job stayed `running`, and the next
// tick reclaimed it again. A failing fetch must settle as a retry, and the sweep must keep going.

type Modules = {
  getDatabase: typeof import("@/server/db/client").getDatabase;
  createRefreshJob: typeof import("@/server/refresh/repository").createRefreshJob;
  processRefreshJob: typeof import("@/server/refresh/scheduler").processRefreshJob;
  runRefreshSweep: typeof import("@/server/refresh/scheduler").runRefreshSweep;
};

describe("a refresh job whose fetch fails settles as a retry instead of killing the tick", () => {
  let m: Modules;
  let policyId: string;

  beforeAll(async () => {
    (globalThis as typeof globalThis & { __vialDbPromise?: unknown }).__vialDbPromise = undefined;
    const [database, repository, scheduler] = await Promise.all([import("@/server/db/client"), import("@/server/refresh/repository"), import("@/server/refresh/scheduler")]);
    m = { getDatabase: database.getDatabase, createRefreshJob: repository.createRefreshJob, processRefreshJob: scheduler.processRefreshJob, runRefreshSweep: scheduler.runRefreshSweep };
    const db = await m.getDatabase();
    // A live listing whose source is a loopback URL: safeFetch refuses private networks, so the
    // fetch fails deterministically and fast, exactly like a page that refuses us in production.
    const live = await import("@/server/ingest/live-sources");
    await live.upsertLiveVendor(db, { slug: "refusing-vendor", name: "Refusing Vendor", domains: ["127.0.0.1"], description: "fixture" });
    await live.recordCatalogListing(db, { compoundSlug: "bpc-157", vendorSlug: "refusing-vendor", slug: "refusing-vendor-bpc-157", name: "BPC-157", quantity: "5mg", externalUrl: "https://127.0.0.1/p/bpc", price: 34.95, availability: "In stock", sourceUrl: "https://127.0.0.1/p/bpc", sourceLabel: "Refusing" });
    policyId = "policy:catalog:lst:refusing-vendor-bpc-157";
    await db.query(`UPDATE source_refresh_policies SET next_run_at = NOW() + INTERVAL '1 day'`);
    await db.query(`UPDATE source_refresh_policies SET next_run_at = NOW() - INTERVAL '1 hour' WHERE id = $1`, [policyId]);
  });

  afterAll(async () => {
    const db = await m.getDatabase();
    await db.close();
    (globalThis as typeof globalThis & { __vialDbPromise?: unknown }).__vialDbPromise = undefined;
  });

  it("records the failure as a retry with a future available_at, and advances the policy", async () => {
    // Fails with 42P18 while the failure path concatenates untyped parameters into an interval.
    const jobId = await m.createRefreshJob({ policyId, triggerType: "manual", createdBy: "test:failure-path" });
    const result = await m.processRefreshJob(jobId);
    expect(result.status).toBe("retrying");
    const db = await m.getDatabase();
    const job = (await db.query<{ status: string; ahead: boolean }>(`SELECT status, available_at > NOW() AS ahead FROM refresh_jobs WHERE id = $1`, [jobId])).rows[0];
    expect(job).toMatchObject({ status: "retrying", ahead: true });
    const policy = (await db.query<{ ahead: boolean; consecutive_failures: number }>(`SELECT next_run_at > NOW() AS ahead, consecutive_failures FROM source_refresh_policies WHERE id = $1`, [policyId])).rows[0];
    expect(policy.ahead).toBe(true);
    expect(Number(policy.consecutive_failures)).toBe(1);
  });

  it("a job on its FINAL attempt settles as failed with a receipt — it does not throw and stay running", async () => {
    // Production 2026-08-29: the non-retry UPDATE referenced $1 and $3 but was bound three
    // parameters, so Postgres raised 42P18 "could not determine data type of parameter $2" at the
    // job's last attempt. The transaction rolled back, the job stayed `running`, and the policy
    // was never served again — 48 of them by the time it was found.
    const db = await m.getDatabase();
    const jobId = await m.createRefreshJob({ policyId, triggerType: "manual", createdBy: "test:final-attempt" });
    await db.query(`UPDATE refresh_jobs SET attempt_count = max_attempts - 1 WHERE id = $1`, [jobId]);
    const result = await m.processRefreshJob(jobId);
    expect(result.status).toBe("failed");
    const job = (await db.query<{ status: string; completed: boolean }>(`SELECT status, completed_at IS NOT NULL AS completed FROM refresh_jobs WHERE id = $1`, [jobId])).rows[0];
    expect(job).toMatchObject({ status: "failed", completed: true });
    const policy = (await db.query<{ ahead: boolean }>(`SELECT next_run_at > NOW() + INTERVAL '1 hour' AS ahead FROM source_refresh_policies WHERE id = $1`, [policyId])).rows[0];
    expect(policy.ahead).toBe(true);
    const stuck = (await db.query<{ n: string }>(`SELECT COUNT(*) AS n FROM refresh_jobs WHERE status = 'running'`)).rows[0];
    expect(Number(stuck.n)).toBe(0);
  });

  it("counts a source as failing only while its LATEST job failed — never cumulatively", async () => {
    // Fails while getRefreshMetrics counts every failed job ever: the count could only ever grow.
    const db = await m.getDatabase();
    const { getRefreshMetrics } = await import("@/server/refresh/repository");
    const before = await getRefreshMetrics();
    expect(before.failed).toBe(1);
    await db.query(
      `INSERT INTO refresh_jobs (id, policy_id, trigger_type, status, priority, available_at, completed_at, attempt_count, idempotency_key, created_by)
       VALUES ('job:recovered', $1, 'manual', 'succeeded', 100, NOW(), NOW(), 1, 'recovered', 'test')`,
      [policyId],
    );
    const after = await getRefreshMetrics();
    expect(after.failed).toBe(0);
  });

  it("the sweep itself survives a failing job (control for the tick)", async () => {
    const db = await m.getDatabase();
    await db.query(`UPDATE refresh_jobs SET available_at = NOW() - INTERVAL '1 minute', status = 'retrying' WHERE policy_id = $1`, [policyId]);
    await expect(m.runRefreshSweep(5, 20_000)).resolves.toMatchObject({ processed: expect.any(Number) });
  });
});
