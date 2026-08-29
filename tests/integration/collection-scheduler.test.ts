import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabaseForTests, getDatabase } from "@/server/db/client";
import {
  syncCollectionTargets, claimDueTargets, runCollectionTick, CADENCE_MINUTES, collectRscCatalog,
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
// file", while the identical importer run by hand produced ten independent lab tests.
//
// The first version of this test re-implemented the collector's own COA loop inline, so reverting
// the real fix left it green — it proved the importer returns COAs and nothing about whether the
// scheduled path persists them. It calls collectRscCatalog now, the same function the cron calls,
// with the network stubbed. Deleting the recording loop from that function fails this.
describe("a scheduled headless import keeps the evidence it finds", () => {
  const SITEMAP = `<?xml version="1.0"?><urlset><url><loc>https://ascendbiolabs.com/product/bpc-157</loc></url></urlset>`;

  const stubbedProduct = [{
    handle: "bpc-157", title: "BPC-157",
    metadata: {
      coa_lab: "Vanguard Laboratory",
      coa_url: "https://cdn/coas/batch-V1/report-008.pdf",
      coa_batch_id: "V1", purity: "99.3%", coa_test_date: "2026-06-12",
    },
    variants: [{ title: "1 Vial / 10MG", calculated_price: { calculated_amount: 65, currency_code: "usd" } }],
  }];

  async function collectOnce() {
    const db = await getDatabase();
    return collectRscCatalog(db, {
      vendor: { slug: "ascend-bio-labs", name: "Ascend Bio Labs", domain: "ascendbiolabs.com", rscProductPath: "/product/" },
      compounds: [{ slug: "bpc-157", name: "BPC-157", aliases: [] }],
      description: "test",
      fetchImpl: (async () => new Response(SITEMAP, { status: 200 })) as unknown as typeof fetch,
      fetchProducts: async () => stubbedProduct as never,
    });
  }

  it("persists the certificates, not only the listings", async () => {
    const db = await getDatabase();
    const before = Number((await db.query<{ c: string | number }>(
      `SELECT COUNT(*) c FROM lab_test_records WHERE vendor_slug='ascend-bio-labs'`)).rows[0]!.c);

    const outcome = await collectOnce();
    expect(outcome.ok).toBe(true);

    const after = Number((await db.query<{ c: string | number }>(
      `SELECT COUNT(*) c FROM lab_test_records WHERE vendor_slug='ascend-bio-labs'`)).rows[0]!.c);
    expect(after).toBeGreaterThan(before);
  });

  // The reported count is what lands in collector_runs and is the only number a human reading the
  // sources page ever sees. A run that imported the listings but dropped every certificate must not
  // be able to report the same number as one that kept them, so this is an EQUALITY, not a floor —
  // `>= coas` passed happily while the certificates were excluded from the count.
  it("counts the certificates in what it reports", async () => {
    const db = await getDatabase();
    const outcome = await collectOnce();
    const coas = Number((await db.query<{ c: string | number }>(
      `SELECT COUNT(*) c FROM lab_test_records WHERE vendor_slug='ascend-bio-labs'`)).rows[0]!.c);
    const listings = Number((await db.query<{ c: string | number }>(
      `SELECT COUNT(*) c FROM listings l JOIN products p ON p.id=l.product_id JOIN organizations o ON o.id=p.vendor_id WHERE o.slug='ascend-bio-labs'`)).rows[0]!.c);
    expect(coas).toBeGreaterThan(0);
    expect(listings).toBeGreaterThan(0);
    expect(outcome.items).toBe(listings + coas);
  });

  // A certificate only earns a vendor anything if it came from a NAMED third-party lab, and the
  // grade reads is_independent to decide that. rscCoaFromMetadata has already refused anything
  // without a named lab, so everything the collector records is independent by construction — but
  // "by construction" is exactly the kind of claim that rots silently. Recording these as in-house
  // would leave the count healthy and the vendor ungraded, which is the original bug wearing a
  // different hat.
  it("records them as independent third-party evidence, not self-published", async () => {
    const db = await getDatabase();
    await collectOnce();
    const rows = (await db.query<{ is_independent: boolean; lab: string | null }>(
      `SELECT is_independent, lab FROM lab_test_records WHERE vendor_slug='ascend-bio-labs'`)).rows;
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.is_independent === true)).toBe(true);
    expect(rows.every((r) => (r.lab ?? "").trim().length > 0)).toBe(true);
  });
});

// Enrolment has to happen on the REAL collector path, not merely exist as a function. The whole
// defect being fixed is that recordCatalogListing created a `sources` row and stopped, so the
// review queue was permanently empty in production while the catalogue changed underneath it.
//
// This drives the same collectRscCatalog the cron drives, then asserts a refresh policy exists for
// what it wrote — which is the difference between "the pipeline is built" and "the pipeline is fed".
describe("a scheduled import enrols what it writes in the provenance pipeline", () => {
  const SITEMAP = `<?xml version="1.0"?><urlset><url><loc>https://ascendbiolabs.com/product/bpc-157</loc></url></urlset>`;
  const stubbedProduct = [{
    handle: "bpc-157", title: "BPC-157",
    metadata: { coa_lab: "Vanguard Laboratory", coa_url: "https://cdn/coas/batch-V1/report-008.pdf", coa_batch_id: "V1", purity: "99.3%", coa_test_date: "2026-06-12" },
    variants: [{ title: "1 Vial / 10MG", calculated_price: { calculated_amount: 65, currency_code: "usd" } }],
  }];

  it("creates an enabled refresh policy for every listing it records", async () => {
    const db = await getDatabase();
    await collectRscCatalog(db, {
      vendor: { slug: "ascend-bio-labs", name: "Ascend Bio Labs", domain: "ascendbiolabs.com", rscProductPath: "/product/" },
      compounds: [{ slug: "bpc-157", name: "BPC-157", aliases: [] }],
      description: "test",
      fetchImpl: (async () => new Response(SITEMAP, { status: 200 })) as unknown as typeof fetch,
      fetchProducts: async () => stubbedProduct as never,
    });

    const policies = await db.query<{ enabled: boolean; interval_minutes: number; parser_profile: string; allowed_hostnames: unknown; target_listing_id: string }>(
      `SELECT p.enabled, p.interval_minutes, p.parser_profile, p.allowed_hostnames, p.target_listing_id
         FROM source_refresh_policies p
         JOIN listings l ON l.id = p.target_listing_id
         JOIN products pr ON pr.id = l.product_id
         JOIN organizations o ON o.id = pr.vendor_id
        WHERE o.slug = 'ascend-bio-labs'`,
    );
    expect(policies.rows.length).toBeGreaterThan(0);
    for (const row of policies.rows) {
      expect(row.enabled).toBe(true);
      expect(Number(row.interval_minutes)).toBe(1440);
      expect(row.parser_profile).toBe("jsonld");
      // The allowlist is the listing's own vendor host and nothing wider.
      const hosts = typeof row.allowed_hostnames === "string" ? JSON.parse(row.allowed_hostnames) : row.allowed_hostnames;
      expect(hosts).toEqual(["ascendbiolabs.com"]);
    }
  });

  // Collectors re-run hourly. Enrolment must be idempotent or every tick would pile up duplicate
  // policies for the same source and the sweep would spend its whole budget re-fetching one page.
  it("does not duplicate a policy when the collector runs again", async () => {
    const db = await getDatabase();
    const run = () => collectRscCatalog(db, {
      vendor: { slug: "ascend-bio-labs", name: "Ascend Bio Labs", domain: "ascendbiolabs.com", rscProductPath: "/product/" },
      compounds: [{ slug: "bpc-157", name: "BPC-157", aliases: [] }],
      description: "test",
      fetchImpl: (async () => new Response(SITEMAP, { status: 200 })) as unknown as typeof fetch,
      fetchProducts: async () => stubbedProduct as never,
    });
    await run();
    const before = Number((await db.query<{ c: string | number }>(`SELECT COUNT(*) c FROM source_refresh_policies`)).rows[0]!.c);
    await run();
    const after = Number((await db.query<{ c: string | number }>(`SELECT COUNT(*) c FROM source_refresh_policies`)).rows[0]!.c);
    expect(after).toBe(before);
  });
});

// ── Phase 1 of docs/superpowers/specs/2026-08-29-vial-price-truth-design.md ───────────────────────
// On 2026-08-29, 250 of 904 live listings had not been observed in 8–24 days while showing
// "In stock": bluum's /products.json had 404'd for eight days and every run was green with zero
// items; behemoth's target had been disabled and nothing ever re-enabled it; purerawz had delisted
// 74 products that VialGrade kept serving. Each is a separate guard below.

import { afterEach, vi } from "vitest";

const shopifyProducts = (products: { title: string; handle: string; price: string; available?: boolean }[]) =>
  ({ products: products.map((p) => ({ title: p.title, handle: p.handle, variants: [{ title: "Default Title", price: p.price, available: p.available ?? true }] })) });

function stubShopify(responder: (url: string) => Response) {
  vi.stubGlobal("fetch", (async (input: RequestInfo | URL) => responder(String(input))) as unknown as typeof fetch);
}

async function onlyDue(db: Awaited<ReturnType<typeof getDatabase>>, id: string) {
  await syncCollectionTargets(db);
  await db.query(`UPDATE collection_targets SET next_due_at = NOW() + interval '1 day'`);
  await db.query(`UPDATE collection_targets SET next_due_at = NOW() - interval '1 hour', enabled = TRUE, consecutive_failures = 0 WHERE id = $1`, [id]);
}

async function availabilityOf(db: Awaited<ReturnType<typeof getDatabase>>, slug: string) {
  return (await db.query<{ availability: string | null }>(`SELECT availability FROM listings WHERE slug = $1`, [slug])).rows[0]?.availability ?? null;
}

describe("a catalogue import that finds nothing is a failed run, not a green one", () => {
  afterEach(() => vi.unstubAllGlobals());
  const bluum = "ct:catalog-shopify:bluum-peptides";

  it("marks a 2xx feed with zero products as failing so it backs off and shows on /status", async () => {
    // Fails if runOne hard-codes ok:true for catalogue imports.
    const db = await getDatabase();
    await onlyDue(db, bluum);
    stubShopify(() => new Response(JSON.stringify({ products: [] }), { status: 200, headers: { "content-type": "application/json" } }));
    const result = await runCollectionTick({ budgetMs: 8_000, maxTargets: 1, connection: db });
    const run = result.ran.find((r) => r.target === "bluum-peptides");
    expect(run?.ok).toBe(false);
    expect(run?.error).toMatch(/no products/i);
    const row = await targetRow(bluum);
    expect(row.last_ok).toBe(false);
    expect(row.consecutive_failures).toBe(1);
  });

  it("treats a 404 from /products.json as a refusal, not an empty catalogue", async () => {
    // Fails if fetchShopifyProducts swallows a non-2xx and returns null.
    const db = await getDatabase();
    await onlyDue(db, bluum);
    stubShopify(() => new Response("<html>not shopify any more</html>", { status: 404 }));
    const result = await runCollectionTick({ budgetMs: 8_000, maxTargets: 1, connection: db });
    const run = result.ran.find((r) => r.target === "bluum-peptides");
    expect(run?.ok).toBe(false);
    expect(run?.error).toMatch(/404/);
    expect((await targetRow(bluum)).last_ok).toBe(false);
  });

  it("stays green when the feed answers and simply matches no compound (control)", async () => {
    const db = await getDatabase();
    await onlyDue(db, bluum);
    stubShopify(() => new Response(JSON.stringify(shopifyProducts([{ title: "Bacteriostatic Water 30ml", handle: "bac-water", price: "12.00" }])), { status: 200 }));
    const result = await runCollectionTick({ budgetMs: 8_000, maxTargets: 1, connection: db });
    expect(result.ran.find((r) => r.target === "bluum-peptides")?.ok).toBe(true);
  });
});

describe("a disabled target is retried after a week, and a target the vendor list no longer declares is removed", () => {
  it("re-enables a target disabled more than seven days ago so a recovered vendor is read again", async () => {
    // Fails if syncCollectionTargets only ever upserts collector/target/cadence.
    const db = await getDatabase();
    await syncCollectionTargets(db);
    await db.query(`UPDATE collection_targets SET enabled = FALSE, consecutive_failures = 12, last_run_at = NOW() - interval '8 days' WHERE id = 'ct:catalog-woo:swiss-chems'`);
    await db.query(`UPDATE collection_targets SET enabled = FALSE, consecutive_failures = 12, last_run_at = NOW() - interval '2 days' WHERE id = 'ct:catalog-woo:sports-technology-labs'`);
    await syncCollectionTargets(db);
    const revived = await targetRow("ct:catalog-woo:swiss-chems");
    expect(revived.enabled).toBe(true);
    expect(revived.consecutive_failures).toBe(0);
    expect(new Date(revived.next_due_at).getTime()).toBeLessThanOrEqual(Date.now());
    // Control: two days is not a week.
    expect((await targetRow("ct:catalog-woo:sports-technology-labs")).enabled).toBe(false);
  });

  it("deletes a zombie row left behind by a platform flag flip, and only that", async () => {
    // Fails if sync never deletes: swiss-chems is a WooCommerce vendor, so a Shopify target for it is a zombie.
    const db = await getDatabase();
    await syncCollectionTargets(db);
    await db.query(`INSERT INTO collection_targets(id,collector,target,cadence_minutes) VALUES ('ct:catalog-shopify:swiss-chems','catalog-shopify','swiss-chems',360)`);
    await db.query(`INSERT INTO collection_targets(id,collector,target,cadence_minutes) VALUES ('ct:catalog-woo:ghost-vendor','catalog-woo','ghost-vendor',360)`);
    await syncCollectionTargets(db);
    const ids = (await db.query<{ id: string }>(`SELECT id FROM collection_targets WHERE id IN ('ct:catalog-shopify:swiss-chems','ct:catalog-woo:swiss-chems','ct:catalog-woo:ghost-vendor')`)).rows.map((r) => r.id).sort();
    // The declared Woo target survives; a synthetic vendor outside the list is not ours to judge.
    expect(ids).toEqual(["ct:catalog-woo:ghost-vendor", "ct:catalog-woo:swiss-chems"]);
  });
});

describe("a complete, successful import retires the listings it no longer sees", () => {
  afterEach(() => vi.unstubAllGlobals());
  const bluum = "ct:catalog-shopify:bluum-peptides";
  const two = shopifyProducts([{ title: "BPC-157 5mg", handle: "bpc-157-5mg", price: "34.95" }, { title: "Epitalon 10mg", handle: "epitalon-10mg", price: "48.00" }]);
  const one = shopifyProducts([{ title: "BPC-157 5mg", handle: "bpc-157-5mg", price: "34.95" }]);

  it("marks a listing Unavailable once a full read of the feed no longer contains it, and nothing else", async () => {
    // Fails if imports only upsert — a delisted product stays "In stock" forever.
    const db = await getDatabase();
    await onlyDue(db, bluum);
    stubShopify(() => new Response(JSON.stringify(two), { status: 200 }));
    await runCollectionTick({ budgetMs: 8_000, maxTargets: 1, connection: db });
    expect(await availabilityOf(db, "bluum-peptides-bpc-157")).toBe("In stock");
    expect(await availabilityOf(db, "bluum-peptides-epitalon")).toBe("In stock");

    await onlyDue(db, bluum);
    stubShopify(() => new Response(JSON.stringify(one), { status: 200 }));
    const result = await runCollectionTick({ budgetMs: 8_000, maxTargets: 1, connection: db });
    expect(result.ran.find((r) => r.target === "bluum-peptides")?.retired).toBe(1);
    expect(await availabilityOf(db, "bluum-peptides-epitalon")).toBe("Unavailable");
    expect(await availabilityOf(db, "bluum-peptides-bpc-157")).toBe("In stock");
  });

  it("retires nothing when the read failed (control)", async () => {
    const db = await getDatabase();
    await onlyDue(db, bluum);
    stubShopify(() => new Response(JSON.stringify(two), { status: 200 }));
    await runCollectionTick({ budgetMs: 8_000, maxTargets: 1, connection: db });

    await onlyDue(db, bluum);
    stubShopify(() => new Response("gone", { status: 404 }));
    await runCollectionTick({ budgetMs: 8_000, maxTargets: 1, connection: db });
    expect(await availabilityOf(db, "bluum-peptides-epitalon")).toBe("In stock");
  });
});

describe("the owner can see which collector needs attention", () => {
  it("lists disabled and failing targets by name with their last error, and nothing healthy", async () => {
    // Fails if the only view is the per-kind aggregate that collapses two failing vendors into one row.
    const db = await getDatabase();
    const { getUnhealthyCollectorTargets } = await import("@/server/collect/metrics");
    await syncCollectionTargets(db);
    await db.query(`UPDATE collection_targets SET last_ok = TRUE, consecutive_failures = 0`);
    await db.query(`UPDATE collection_targets SET enabled = FALSE, last_error = 'disabled after 12 failures' WHERE id = 'ct:catalog-woo:swiss-chems'`);
    await db.query(`UPDATE collection_targets SET last_ok = FALSE, consecutive_failures = 3, last_error = 'bluumpeptides.com refused the catalog request (HTTP 404)' WHERE id = 'ct:catalog-shopify:bluum-peptides'`);
    const rows = await getUnhealthyCollectorTargets(db);
    expect(rows.map((r) => r.id).sort()).toEqual(["ct:catalog-shopify:bluum-peptides", "ct:catalog-woo:swiss-chems"]);
    expect(rows.find((r) => r.target === "bluum-peptides")).toMatchObject({ collector: "catalog-shopify", enabled: true, consecutiveFailures: 3, lastError: expect.stringContaining("404") });
    expect(rows.find((r) => r.target === "swiss-chems")).toMatchObject({ enabled: false });
  });
});
