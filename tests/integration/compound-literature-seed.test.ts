import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { ensureCompoundLiterature } from "@/server/db/compound-literature-seed";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SESSION_SECRET = "literature-seed-test-secret-at-least-32-characters";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "literature-seed-privacy-secret-at-least-32-chars";

// The curated compound research reaches production ONLY through this seed, and it has failed to
// arrive twice already for two different reasons: the data file sat outside the deployment bundle,
// and then the seed was a numbered migration that runs once, so the next edit to the data would
// never have shipped. These tests pin the behaviour that fixes both — the seed is content-addressed,
// so editing the JSON is sufficient to change production on the next boot.
describe("compound literature seed", () => {
  beforeAll(async () => { await resetDatabaseForTests(); await getDatabase(); });
  afterAll(async () => { await resetDatabaseForTests(); });

  const statusOf = async (slug: string) => {
    const db = await getDatabase();
    return (await db.query<{ s: string | null }>(`SELECT regulatory_status s FROM compounds WHERE slug=$1`, [slug])).rows[0]?.s ?? null;
  };

  it("seeds the curated regulatory status on boot", async () => {
    // Booting the database is what runs the seed; no explicit call needed. MOTS-C is one of the
    // compounds the foundation seed creates, and one of the nine whose copy was too terse to
    // mention that the FDA had flagged it at all.
    const status = await statusOf("mots-c");
    expect(status).toMatch(/not fda-approved/i);
    expect(status).toMatch(/category 2/i);
  });

  it("declares the approval fact rather than leaving it unknown", async () => {
    const db = await getDatabase();
    const unknown = (await db.query<{ n: number }>(
      `SELECT COUNT(*)::int n FROM compounds WHERE regulatory_status IS NOT NULL AND fda_approved_drug_exists IS NULL`,
    )).rows[0].n;
    // A NULL flag renders as "Approval status not established". Any compound we have written a
    // regulatory status for should also have said, explicitly, whether an approved drug exists.
    expect(Number(unknown)).toBe(0);
  });

  it("never marks an unapproved substance as having an approved drug", async () => {
    const db = await getDatabase();
    // GHK-Cu is the specific record that once rendered a green FDA-APPROVED badge, because its
    // copy read "Not AN FDA-approved drug" and the badge was inferred from the prose.
    const row = (await db.query<{ f: boolean | null }>(`SELECT fda_approved_drug_exists f FROM compounds WHERE slug='ghk-cu'`)).rows[0];
    expect(row?.f).toBe(false);
  });

  it("skips re-seeding while the curated content is unchanged", async () => {
    const db = await getDatabase();
    await db.query(`UPDATE compounds SET regulatory_status='SENTINEL' WHERE slug='mots-c'`);
    await ensureCompoundLiterature(db);
    // The hash still matches, so the seed must not have run — this is what keeps boot cheap.
    expect(await statusOf("mots-c")).toBe("SENTINEL");
  });

  it("re-seeds when the stored content hash no longer matches", async () => {
    const db = await getDatabase();
    // Standing in for an edit to the curated JSON, which changes the computed hash.
    await db.query(`DELETE FROM app_meta WHERE key='compound_literature_hash'`);
    await ensureCompoundLiterature(db);
    // Restored from SENTINEL by the previous test — this is the path that carries a data edit to
    // production, and the path that a once-only migration silently would not have.
    expect(await statusOf("mots-c")).toMatch(/not fda-approved/i);
  });

  it("survives a database error instead of taking the boot down", async () => {
    // The seed runs on the boot path. An earlier migration bug threw there and took production
    // offline for four minutes, so this must degrade rather than propagate.
    const exploding = { query: async () => { throw new Error("simulated database failure"); } };
    await expect(ensureCompoundLiterature(exploding as never)).resolves.toBeUndefined();
  });
});
