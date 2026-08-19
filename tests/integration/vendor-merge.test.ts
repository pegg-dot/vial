import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { planVendorMerges, applyVendorMerges, describeMalformedName, SLUG_REFERENCES, ORG_REFERENCES } from "@/server/vendors/merge";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SESSION_SECRET = "vendor-merge-test-secret-at-least-32-characters";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "vendor-merge-privacy-at-least-32-characters-x";

// Duplicate vendor rows inflate the headline vendor count the site publishes, and one row was not a
// company at all — an email address parsed into a directory entry, graded and browsable. Merging is
// the riskiest operation in this codebase: a wrong merge destroys a real distinction and is far
// harder to undo than a missed one, and a careless one silently drops evidence.
describe("vendor merge", () => {
  beforeAll(async () => { await resetDatabaseForTests(); await getDatabase(); });
  afterAll(async () => { await resetDatabaseForTests(); });

  const vendorCount = async () => {
    const db = await getDatabase();
    return Number((await db.query<{ n: number }>(
      `SELECT COUNT(*)::int n FROM organizations WHERE organization_type='vendor'`)).rows[0].n);
  };
  const evidenceTotals = async () => {
    const db = await getDatabase();
    const out: Record<string, number> = {};
    for (const r of [...SLUG_REFERENCES, ...ORG_REFERENCES]) {
      out[r.table] = Number((await db.query<{ n: number }>(`SELECT COUNT(*)::int n FROM ${r.table}`)).rows[0].n);
    }
    return out;
  };

  it("recognises a display name that is not a business name", () => {
    // `admin@rayshine-peptide` was being served as a vendor.
    expect(describeMalformedName("admin@rayshine-peptide")).toBeTruthy();
    expect(describeMalformedName("Rayshine Peptide")).toBeNull();
  });

  it("dry-runs by default and changes nothing", async () => {
    const db = await getDatabase();
    const before = await vendorCount();
    const plan = await planVendorMerges(db);
    const result = await applyVendorMerges(db, plan);
    expect(result.dryRun).toBe(true);
    expect(await vendorCount()).toBe(before);
  });

  it("preserves every evidence row it does not deliberately drop", async () => {
    const db = await getDatabase();
    const before = await evidenceTotals();
    await applyVendorMerges(db, await planVendorMerges(db), { apply: true });
    const after = await evidenceTotals();

    for (const table of Object.keys(before)) {
      // vendor_links is the one legitimate exception: a link BETWEEN two rows that just became the
      // same vendor is a self-link, which carries no information. Everything else must survive.
      if (table === "vendor_links") continue;
      expect(after[table], `${table} lost rows during a merge`).toBe(before[table]);
    }
  });

  it("converges — a second plan proposes nothing", async () => {
    const db = await getDatabase();
    await applyVendorMerges(db, await planVendorMerges(db), { apply: true });
    const again = await planVendorMerges(db);
    expect(again.clusters).toHaveLength(0);
  });

  it("never leaves a vendor linked to itself", async () => {
    const db = await getDatabase();
    await applyVendorMerges(db, await planVendorMerges(db), { apply: true });
    const self = Number((await db.query<{ n: number }>(
      `SELECT COUNT(*)::int n FROM vendor_links WHERE vendor_slug = linked_slug`)).rows[0].n);
    expect(self).toBe(0);
  });
});
