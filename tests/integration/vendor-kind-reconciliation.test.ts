import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { runCollectionTick } from "@/server/collect/scheduler";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SESSION_SECRET = "vendor-kind-secret-at-least-32-characters-long";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "vendor-kind-privacy-at-least-32-characters-long";

// `organizations.vendor_kind` defaults to 'storefront'. The classifier that would correct it was
// only ever called from an offline script, so in production every vendor the lab feed discovered
// kept that default: 41 upstream factories were counted as shops a buyer could walk into. This
// pins the reconciliation to the tick itself, where both of its inputs actually move.
async function addLabFeedVendor(slug: string, name: string) {
  const db = await getDatabase();
  await db.query(
    `INSERT INTO organizations (id,slug,organization_type,display_name,description,location,founded,initials,profile_status,participation_status,origin)
     VALUES ($1,$2,'vendor',$3,'','','','XX','unclaimed','independent','live')
     ON CONFLICT (slug) DO NOTHING`,
    [`org:${slug}`, slug, name],
  );
}

async function kindOf(slug: string): Promise<string> {
  const db = await getDatabase();
  return (await db.query<{ vendor_kind: string }>(`SELECT vendor_kind FROM organizations WHERE slug=$1`, [slug])).rows[0]!.vendor_kind;
}

describe("vendor kind is reconciled by the collection tick", () => {
  beforeAll(async () => { await resetDatabaseForTests(); await getDatabase(); });
  afterAll(async () => { await resetDatabaseForTests(); });

  it("demotes a lab-feed vendor from the schema default to manufacturer", async () => {
    await addLabFeedVendor("hh-peptide-factory", "HH Peptide Factory");
    // The bug in one line: it arrives calling itself a shop because the column says so.
    expect(await kindOf("hh-peptide-factory")).toBe("storefront");

    await runCollectionTick({ budgetMs: 1, maxTargets: 0 });

    expect(await kindOf("hh-peptide-factory")).toBe("manufacturer");
  }, 120000);

  it("keeps a curated retail vendor a storefront even with no catalogue captured", async () => {
    // Chemyo sells to the public; we simply had not read its catalogue. Demoting it would tell a
    // buyer a real shop is a factory — the mirror image of the bug above.
    await addLabFeedVendor("chemyo", "Chemyo");
    await runCollectionTick({ budgetMs: 1, maxTargets: 0 });
    expect(await kindOf("chemyo")).toBe("storefront");
  }, 120000);

  it("promotes a vendor back to storefront once it has a catalogue", async () => {
    const db = await getDatabase();
    await addLabFeedVendor("later-a-shop", "Later A Shop");
    await runCollectionTick({ budgetMs: 1, maxTargets: 0 });
    expect(await kindOf("later-a-shop")).toBe("manufacturer");

    const compound = (await db.query<{ id: string }>(`SELECT id FROM compounds LIMIT 1`)).rows[0]!;
    await db.query(
      `INSERT INTO products (id,slug,name,compound_id,vendor_id,declared_quantity,declared_form,status,origin)
       VALUES ('p:las','las-product','LAS Product',$1,'org:later-a-shop','10 mg','vial','active','live')`,
      [compound.id],
    );

    await runCollectionTick({ budgetMs: 1, maxTargets: 0 });
    // Self-correcting: the classification is re-derived every tick, never stored by hand.
    expect(await kindOf("later-a-shop")).toBe("storefront");
  }, 120000);
});
