import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { retireDuplicateListings } from "@/server/db/duplicate-listing-repair";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SESSION_SECRET = "dup-listing-test-secret-at-least-32-characters";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "dup-listing-privacy-at-least-32-characters-x";

// Some storefronts expose one product under several URLs, and the importer stored each as its own
// listing. Two rows with the same URL, price and product name are one thing counted twice — which
// inflates vendor and compound listing counts and skews the published median price.
describe("duplicate-listing repair", () => {
  beforeAll(async () => { await resetDatabaseForTests(); await getDatabase(); });
  afterAll(async () => { await resetDatabaseForTests(); });

  const seedPair = async () => {
    const db = await getDatabase();
    const vendorId = (await db.query<{ id: string }>(`SELECT id FROM organizations WHERE organization_type='vendor' LIMIT 1`)).rows[0].id;
    const compoundId = (await db.query<{ id: string }>(`SELECT id FROM compounds LIMIT 1`)).rows[0].id;
    for (const [pid, slug, qty] of [["prd-dup-a", "dup-measurable", "5MG"], ["prd-dup-b", "dup-vague", "1 vial"]]) {
      await db.query(
        `INSERT INTO products (id, slug, vendor_id, compound_id, name, declared_quantity, declared_form, status)
         VALUES ($1,$2,$3,$4,'GHK-CU COPPER LIQUID',$5,'liquid','active')
         ON CONFLICT (slug) DO UPDATE SET status='active', declared_quantity=EXCLUDED.declared_quantity`,
        [pid, slug, vendorId, compoundId, qty],
      );
      await db.query(
        `INSERT INTO listings (id, slug, product_id, price, currency, availability, shipping_claim,
                               evidence_level, evidence_label, report_date, report_issuer, batch_code,
                               sample_origin, last_checked, external_url, origin)
         VALUES ($1,$2,$3,49.99,'USD','in_stock','','public-only','Vendor catalog','','','','','2026-08-20','https://example.invalid/ghk','live')
         ON CONFLICT (slug) DO UPDATE SET external_url=EXCLUDED.external_url, price=EXCLUDED.price`,
        [`lst-${pid}`, `lst-${slug}`, pid],
      );
    }
  };
  const statusOf = async (slug: string) => {
    const db = await getDatabase();
    return (await db.query<{ status: string }>(`SELECT status FROM products WHERE slug=$1`, [slug])).rows[0]?.status;
  };

  it("keeps the row whose quantity can actually be measured", async () => {
    const db = await getDatabase();
    await seedPair();
    await retireDuplicateListings(db);
    // "5MG" parses to a weight and therefore has a price per mg; "1 vial" does not, so between
    // identical twins it carries no comparison and is the one to retire.
    expect(await statusOf("dup-measurable")).toBe("active");
    expect(await statusOf("dup-vague")).toBe("retired-duplicate");
  });

  it("retires rather than deletes, and converges", async () => {
    const db = await getDatabase();
    await seedPair();
    const before = Number((await db.query<{ n: number }>(`SELECT COUNT(*)::int n FROM products`)).rows[0].n);
    await retireDuplicateListings(db);
    await retireDuplicateListings(db);
    expect(Number((await db.query<{ n: number }>(`SELECT COUNT(*)::int n FROM products`)).rows[0].n)).toBe(before);
    expect(await statusOf("dup-measurable")).toBe("active");
  });

  it("leaves genuine variants alone when the price differs", async () => {
    const db = await getDatabase();
    await seedPair();
    // A 10-vial kit at a different price shares a URL but is a real, separate SKU.
    const vendorId = (await db.query<{ id: string }>(`SELECT id FROM organizations WHERE organization_type='vendor' LIMIT 1`)).rows[0].id;
    const compoundId = (await db.query<{ id: string }>(`SELECT id FROM compounds LIMIT 1`)).rows[0].id;
    await db.query(
      `INSERT INTO products (id, slug, vendor_id, compound_id, name, declared_quantity, declared_form, status)
       VALUES ('prd-dup-kit','dup-kit',$1,$2,'GHK-CU COPPER LIQUID','KIT (10 vials)','liquid','active')
       ON CONFLICT (slug) DO UPDATE SET status='active'`, [vendorId, compoundId]);
    await db.query(
      `INSERT INTO listings (id, slug, product_id, price, currency, availability, shipping_claim,
                             evidence_level, evidence_label, report_date, report_issuer, batch_code,
                             sample_origin, last_checked, external_url, origin)
       VALUES ('lst-prd-dup-kit','lst-dup-kit','prd-dup-kit',479.50,'USD','in_stock','','public-only','Vendor catalog','','','','','2026-08-20','https://example.invalid/ghk','live')
       ON CONFLICT (slug) DO UPDATE SET price=EXCLUDED.price`);
    await retireDuplicateListings(db);
    expect(await statusOf("dup-kit")).toBe("active");
  });
});
