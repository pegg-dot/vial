import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { getCatalogCoverage } from "@/server/collect/coverage";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SESSION_SECRET = "coverage-test-secret-at-least-32-characters-long";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "coverage-privacy-secret-at-least-32-characters-long";

// The panel this feeds is the only place that can say "these storefronts can never be graded".
// Local fixtures give every storefront a catalogue, so the populated table never appears in
// development — it is this test, not the page, that proves the query and the states are right.
async function addVendor(slug: string, name: string, kind: "storefront" | "manufacturer") {
  const db = await getDatabase();
  await db.query(
    `INSERT INTO organizations (id,slug,organization_type,display_name,description,location,founded,initials,profile_status,participation_status,origin,vendor_kind)
     VALUES ($1,$2,'vendor',$3,'','','','XX','unclaimed','independent','live',$4)
     ON CONFLICT (slug) DO UPDATE SET vendor_kind=EXCLUDED.vendor_kind`,
    [`org:${slug}`, slug, name, kind],
  );
}

describe("catalog coverage", () => {
  beforeAll(async () => { await resetDatabaseForTests(); await getDatabase(); });
  afterAll(async () => { await resetDatabaseForTests(); });

  it("names every zero-listing storefront and says which kind of gap it is", async () => {
    // `chemyo` is really in known-vendors.json with no import method; the other two are not in it
    // at all — the shape production is actually in.
    await addVendor("chemyo", "Chemyo", "storefront");
    await addVendor("surfaced-from-a-coa", "Surfaced From A COA", "storefront");
    await addVendor("another-uncurated", "Another Uncurated", "storefront");

    const coverage = await getCatalogCoverage();
    const bySlug = new Map(coverage.ungradable.map((row) => [row.slug, row]));

    // Curated and polled daily for status and domain age, but nothing ever reads its catalogue.
    // This is the bucket an operator can act on, so it must be named, not merely counted.
    expect(bySlug.get("chemyo")?.state).toBe("no-method");
    expect(bySlug.get("surfaced-from-a-coa")?.state).toBe("uncurated");
    expect(coverage.counts["no-method"]).toBeGreaterThanOrEqual(1);
    expect(coverage.counts.uncurated).toBeGreaterThanOrEqual(2);
    expect(coverage.storefronts).toBeGreaterThanOrEqual(3);
  });

  it("leaves manufacturers out — the buyer grade scale never applied to them", async () => {
    // Over half of production's directory is makers. Counting them as a coverage failure would
    // bury the storefronts an operator can actually do something about.
    await addVendor("some-upstream-maker", "Some Upstream Maker", "manufacturer");
    const coverage = await getCatalogCoverage();
    expect(coverage.ungradable.some((row) => row.slug === "some-upstream-maker")).toBe(false);
  });

  it("stops reporting a storefront once its catalogue is read", async () => {
    const db = await getDatabase();
    await addVendor("now-collected", "Now Collected", "storefront");
    expect((await getCatalogCoverage()).ungradable.some((r) => r.slug === "now-collected")).toBe(true);

    // One active listing is the whole difference between "nothing to rate" and gradeable.
    const compound = (await db.query<{ id: string }>(`SELECT id FROM compounds LIMIT 1`)).rows[0];
    const org = (await db.query<{ id: string }>(`SELECT id FROM organizations WHERE slug='now-collected'`)).rows[0];
    await db.query(
      `INSERT INTO products (id,slug,name,compound_id,vendor_id,declared_quantity,declared_form,status,origin)
       VALUES ('p:nc','nc-product','NC Product',$1,$2,'10 mg','vial','active','live')`,
      [compound.id, org.id],
    );
    await db.query(
      `INSERT INTO listings (id,slug,product_id,price,currency,availability,shipping_claim,
                             evidence_level,evidence_label,report_date,report_issuer,batch_code,
                             sample_origin,last_checked,origin)
       VALUES ('l:nc','nc-listing','p:nc',100,'USD','In stock','','none','No document','','','',
               '','','live')`,
    );

    expect((await getCatalogCoverage()).ungradable.some((r) => r.slug === "now-collected")).toBe(false);
  });
});
