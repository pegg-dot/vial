import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { confirmedClaimRepairSql } from "@/server/db/confirmed-claim-repair";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SESSION_SECRET = "claim-repair-test-secret-at-least-32-characters";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "claim-repair-privacy-secret-at-least-32-chars";

// The product page rendered `report_confirmed` as "Lab confirmed it's theirs: Yes". 144 live
// listings held that flag from before `advertises_testing` existed, every one of them scraped off
// the vendor's own catalogue — evidence_level 'public-only', a placeholder issuer of "Third-party
// lab", no report date, no batch code. The site was presenting a vendor's marketing claim as a
// laboratory's confirmation on the page where a buyer decides to click through.
describe("confirmed-claim repair", () => {
  beforeAll(async () => { await resetDatabaseForTests(); await getDatabase(); });
  afterAll(async () => { await resetDatabaseForTests(); });

  it("leaves no catalogue-scraped listing claiming a lab confirmation", async () => {
    const db = await getDatabase();
    const { rows } = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int n FROM listings WHERE report_confirmed = TRUE AND evidence_level = 'public-only'`,
    );
    expect(Number(rows[0].n)).toBe(0);
  });

  it("mints no fake laboratory from the placeholder issuer", async () => {
    // The schema comment warns that writing a generic "Third-party lab" into report_issuer would
    // mint a fake lab entity in the canonical graph and relate listings to it.
    const db = await getDatabase();
    const { rows } = await db.query<{ n: number }>(
      `SELECT COUNT(*)::int n FROM listings WHERE report_issuer = 'Third-party lab'`,
    );
    expect(Number(rows[0].n)).toBe(0);
  });

  it("demotes a claim to advertised testing instead of deleting it, and is idempotent", async () => {
    const db = await getDatabase();
    const before = (await db.query<{ n: number }>(`SELECT COUNT(*)::int n FROM listings`)).rows[0].n;

    // Reintroduce exactly the shape that shipped, then repair it.
    await db.query(
      `UPDATE listings SET report_confirmed = TRUE, report_issuer = 'Third-party lab',
              evidence_level = 'public-only', advertises_testing = FALSE, advertised_issuer = NULL
       WHERE slug = (SELECT slug FROM listings LIMIT 1)`,
    );
    await db.query(confirmedClaimRepairSql);
    await db.query(confirmedClaimRepairSql); // converges

    const repaired = (await db.query<{ advertises_testing: boolean; advertised_issuer: string | null; report_confirmed: boolean }>(
      `SELECT advertises_testing, advertised_issuer, report_confirmed FROM listings WHERE advertised_issuer = 'Third-party lab' LIMIT 1`,
    )).rows[0];

    expect(repaired?.report_confirmed).toBe(false);   // no longer asserts a confirmation
    expect(repaired?.advertises_testing).toBe(true);  // the claim is kept
    expect(repaired?.advertised_issuer).toBe("Third-party lab");
    // Evidence is never destroyed by a repair.
    expect((await db.query<{ n: number }>(`SELECT COUNT(*)::int n FROM listings`)).rows[0].n).toBe(before);
  });
});
