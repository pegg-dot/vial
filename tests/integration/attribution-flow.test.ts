import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabaseForTests, getDatabase } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { resolveAndRecordClick } from "@/server/outbound/clicks";
import { getPartnerReport, getAttributionOverview } from "@/server/outbound/partner-report";
import { upsertLiveCompound, upsertLiveListing, upsertLiveVendor } from "@/server/ingest/live-sources";

// Historical attribution records can still be reconciled, but the system may
// no longer mint a new user-to-peptide-vendor referral. Keep both invariants.
beforeEach(async () => {
  process.env.VIALGRADE_PGLITE_MEMORY = "true";
  process.env.VIALGRADE_SEED_FIXTURES = "true";
  process.env.VIALGRADE_SEED_DEMO_ACCOUNTS = "true";
  delete (globalThis as { __vialEvidenceSeedPromise?: unknown }).__vialEvidenceSeedPromise;
  delete (globalThis as { __vialSellerOpsSeedPromise?: unknown }).__vialSellerOpsSeedPromise;
  await resetDatabaseForTests();
});

async function seedOldVendor() {
  const db = await getDatabase();
  await upsertLiveCompound(db, {
    slug: "attr-compound", name: "Attr Compound", shorthand: "ATTR",
    category: "Peptide", description: "test compound", aliases: ["Attr"],
  });
  await upsertLiveVendor(db, {
    slug: "attr-vendor", name: "Attr Vendor", domains: ["attrvendor.example"], description: "test vendor",
  });
  await upsertLiveListing(db, {
    compoundSlug: "attr-compound", vendorSlug: "attr-vendor", slug: "attr-listing",
    name: "Attr 5mg", quantity: "5mg",
    externalUrl: "https://attrvendor.example/product/attr", price: 49,
  } as Parameters<typeof upsertLiveListing>[1]);
  return db;
}

describe("attribution history is readable but new referrals stay disabled", () => {
  it("fails closed for a real listing even when an internal caller bypasses the HTTP route", async () => {
    const db = await seedOldVendor();
    const resolution = await resolveAndRecordClick("attr-listing", db, {
      ip: "9.9.9.9", userAgent: "Mozilla/5.0 (iPhone)",
    });
    expect(resolution).toBeNull();
    const rows = await db.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM outbound_clicks WHERE listing_slug='attr-listing'",
    );
    expect(rows.rows[0]!.count).toBe(0);
  });

  it("does not invent clickers, commissions or partner revenue when referrals are frozen", async () => {
    const db = await seedOldVendor();
    const report = await getPartnerReport("attr-vendor", { connection: db });
    expect(report).not.toBeNull();
    expect(report!.clicks).toBe(0);
    expect(report!.visitorDays).toBe(0);
    expect(report!.conversions).toBe(0);
    expect(report!.revenueCents).toBe(0);
    const overview = await getAttributionOverview({ connection: db });
    expect(overview.totals.clicks).toBe(0);
    expect(overview.totals.revenueCents).toBe(0);
  });

  it("can reconcile preexisting recorded obligations without enabling new vendor referrals", async () => {
    const db = await seedOldVendor();
    await db.query(
      `INSERT INTO outbound_clicks (
        id, listing_slug, vendor_slug, compound_slug, visitor_hash, device,
        is_bot, created_at, converted_at, order_value_cents, conversion_source
      ) VALUES ($1, 'attr-listing', 'attr-vendor', 'attr-compound',
        'legacy-hashed-visitor', 'desktop', FALSE, NOW(), NOW(), 12900, 'postback')`,
      [newId("legacy-click")],
    );
    const report = await getPartnerReport("attr-vendor", { connection: db });
    expect(report!.clicks).toBe(1);
    expect(report!.visitorDays).toBe(1);
    expect(report!.conversions).toBe(1);
    expect(report!.revenueCents).toBe(12900);
    const overview = await getAttributionOverview({ connection: db });
    expect(overview.totals.clicks).toBe(1);
    expect(overview.totals.conversions).toBe(1);
    expect(overview.vendors[0]!.vendorSlug).toBe("attr-vendor");
    // Existing data can be reconciled, but an active outbound resolve still refuses.
    expect(await resolveAndRecordClick("attr-listing", db)).toBeNull();
  });
});
