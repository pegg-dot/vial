import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { upsertLiveVendor, upsertLiveCompound, upsertLiveListing } from "@/server/ingest/live-sources";
import { resolveAndRecordClick, getVendorClickStats } from "@/server/outbound/clicks";

process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SESSION_SECRET = "outbound-clicks-test-secret-at-least-32-characters";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "outbound-clicks-privacy-secret-at-least-32-chars";

describe("outbound click handoff", () => {
  beforeAll(async () => {
    await resetDatabaseForTests();
    const db = await getDatabase();
    await upsertLiveVendor(db, { slug: "acme-peptide", name: "Acme Peptide", domains: ["acme.test"], description: "t" });
    await upsertLiveCompound(db, { slug: "bpc-157", name: "BPC-157", shorthand: "BPC", aliases: ["bpc157"], category: "peptide", description: "s" });
    await upsertLiveListing(db, { compoundSlug: "bpc-157", vendorSlug: "acme-peptide", slug: "acme-bpc-157-5mg", name: "BPC-157 5mg", quantity: "5mg", externalUrl: "https://www.acme.test/products/bpc-157-5mg?variant=1" });
  });
  afterAll(async () => { await resetDatabaseForTests(); });

  it("resolves a live listing to the vendor URL and records the click", async () => {
    const db = await getDatabase();
    const r = await resolveAndRecordClick("acme-bpc-157-5mg", db);
    // The destination now carries attribution tags — that is what lets a vendor confirm our
    // traffic in their OWN analytics without any integration. The vendor's own query params must
    // survive untouched.
    const dest = new URL(r!.destination);
    expect(dest.origin + dest.pathname).toBe("https://www.acme.test/products/bpc-157-5mg");
    expect(dest.searchParams.get("variant")).toBe("1");
    expect(dest.searchParams.get("utm_source")).toBe("vialgrade");
    expect(dest.searchParams.get("vg")).toBe(r!.clickRef);
    expect(r?.vendorSlug).toBe("acme-peptide");
    expect(r?.affiliateApplied).toBe(false); // no deal configured
    const clicks = (await db.query<{ n: string | number }>(`SELECT COUNT(*) n FROM outbound_clicks WHERE listing_slug='acme-bpc-157-5mg'`)).rows[0];
    expect(Number(clicks.n)).toBe(1);
    const stats = await getVendorClickStats(db);
    expect(stats.find((s) => s.vendorSlug === "acme-peptide")?.clicks).toBe(1);
  });

  it("refuses an unknown listing — no destination, no open redirect", async () => {
    const db = await getDatabase();
    expect(await resolveAndRecordClick("does-not-exist", db)).toBeNull();
  });

  it("refuses a demo listing (only real vendor pages get handed off)", async () => {
    const db = await getDatabase();
    // Flip the listing to demo → must no longer resolve.
    await db.query(`UPDATE listings SET origin='demo' WHERE slug='acme-bpc-157-5mg'`);
    expect(await resolveAndRecordClick("acme-bpc-157-5mg", db)).toBeNull();
  });
});
