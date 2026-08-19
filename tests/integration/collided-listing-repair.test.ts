import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { collidedListingRepairSql } from "@/server/db/collided-listing-repair";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SESSION_SECRET = "collision-repair-secret-at-least-32-characters";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "collision-repair-privacy-at-least-32-characters";

// Two aliases are short enough to match a different substance: "Ipam" (ipamorelin) also matches
// INDOLEPROPIONAMIDE, a tryptophan metabolite; "GnRH" (gonadorelin) also matches Triptorelin.
// matchCompound guards both — but only at ingest, and nothing re-checked stored rows. Seven
// listings predating the guard stayed mis-filed, so a visitor comparing ipamorelin saw five
// products that are not ipamorelin, priced per mg against it. Selling the wrong molecule as the
// right one is the most dangerous mistake this product can make.
describe("collided-listing repair", () => {
  beforeAll(async () => { await resetDatabaseForTests(); await getDatabase(); });
  afterAll(async () => { await resetDatabaseForTests(); });

  const activeUnder = async (compound: string, like: string) => {
    const db = await getDatabase();
    return Number((await db.query<{ n: number }>(
      `SELECT COUNT(*)::int n FROM products p JOIN compounds c ON c.id=p.compound_id
        WHERE c.slug=$1 AND UPPER(p.name) LIKE $2 AND p.status='active'`, [compound, like],
    )).rows[0].n);
  };

  it("leaves no wrong-molecule listing active under either collided compound", async () => {
    expect(await activeUnder("ipamorelin", "%INDOLEPROPIONAMIDE%")).toBe(0);
    expect(await activeUnder("gonadorelin", "%TRIPTORELIN%")).toBe(0);
  });

  it("retires rather than deletes, and converges on re-run", async () => {
    const db = await getDatabase();
    const before = Number((await db.query<{ n: number }>(`SELECT COUNT(*)::int n FROM products`)).rows[0].n);

    // Build the fixture explicitly. The seeded test database carries only a handful of compounds
    // and ipamorelin is not among them, so relying on seed data would make this test silently
    // vacuous — it would pass by matching nothing at all.
    await db.query(
      `INSERT INTO compounds (id, slug, canonical_name, shorthand, category, description, aliases)
       VALUES ('cmp-ipam-test','ipamorelin','Ipamorelin','IPAM','Research chemical','fixture','["Ipam"]'::jsonb)
       ON CONFLICT (slug) DO NOTHING`,
    );
    const vendorId = (await db.query<{ id: string }>(
      `SELECT id FROM organizations WHERE organization_type='vendor' LIMIT 1`,
    )).rows[0].id;
    const compoundId = (await db.query<{ id: string }>(`SELECT id FROM compounds WHERE slug='ipamorelin'`)).rows[0].id;
    await db.query(
      `INSERT INTO products (id, slug, vendor_id, compound_id, name, declared_quantity, declared_form, status)
       VALUES ('prd-ipam-test','ipam-collision-fixture',$1,$2,'INDOLEPROPIONAMIDE (IPAM) 30ML LIQUID','30ml','liquid','active')
       ON CONFLICT (slug) DO UPDATE SET status='active'`,
      [vendorId, compoundId],
    );
    // The fixture must actually reproduce the defect, or the assertions below prove nothing.
    expect(await activeUnder("ipamorelin", "%INDOLEPROPIONAMIDE%")).toBe(1);

    await db.query(collidedListingRepairSql);
    await db.query(collidedListingRepairSql); // idempotent

    expect(await activeUnder("ipamorelin", "%INDOLEPROPIONAMIDE%")).toBe(0);
    // The row survives — retiring keeps a record of what was scraped and stays reversible.
    // (before + 1, because this test inserted the fixture row.)
    expect(Number((await db.query<{ n: number }>(`SELECT COUNT(*)::int n FROM products`)).rows[0].n)).toBe(before + 1);
    expect(Number((await db.query<{ n: number }>(
      `SELECT COUNT(*)::int n FROM products WHERE status='retired-wrong-compound'`,
    )).rows[0].n)).toBeGreaterThan(0);
  });

  it("does not retire a genuine listing of the compound itself", async () => {
    // The guard must key on the colliding molecule, never on the compound alone.
    const db = await getDatabase();
    const compoundId = (await db.query<{ id: string }>(`SELECT id FROM compounds WHERE slug='ipamorelin'`)).rows[0]?.id;
    const vendorId = (await db.query<{ id: string }>(`SELECT id FROM organizations WHERE organization_type='vendor' LIMIT 1`)).rows[0].id;
    await db.query(
      `INSERT INTO products (id, slug, vendor_id, compound_id, name, declared_quantity, declared_form, status)
       VALUES ('prd-ipam-real','ipam-genuine-fixture',$1,$2,'Ipamorelin 5mg','5mg','powder','active')
       ON CONFLICT (slug) DO UPDATE SET status='active'`,
      [vendorId, compoundId],
    );
    const genuine = { id: "prd-ipam-real" };
    await db.query(collidedListingRepairSql);
    const still = (await db.query<{ status: string }>(`SELECT status FROM products WHERE id=$1`, [genuine.id])).rows[0];
    expect(still.status).toBe("active");
  });
});
