import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabaseForTests, getDatabase } from "@/server/db/client";
import { resolveAndRecordClick } from "@/server/outbound/clicks";
import { getPartnerReport, getAttributionOverview } from "@/server/outbound/partner-report";
import { upsertLiveCompound, upsertLiveListing, upsertLiveVendor } from "@/server/ingest/live-sources";

// Clicks without a browser agent are recorded as automated and excluded from vendor-facing figures.
const BROWSER = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

beforeEach(async () => {
  process.env.VIALGRADE_PGLITE_MEMORY = "true";
  process.env.VIALGRADE_SEED_FIXTURES = "true";
  process.env.VIALGRADE_SEED_DEMO_ACCOUNTS = "true";
  delete (globalThis as { __vialEvidenceSeedPromise?: unknown }).__vialEvidenceSeedPromise;
  delete (globalThis as { __vialSellerOpsSeedPromise?: unknown }).__vialSellerOpsSeedPromise;
  await resetDatabaseForTests();
});

// Seed through the REAL writers, not hand-built rows. A fabricated row can satisfy a test while
// diverging from what production actually writes — and this is a revenue path, where that would
// certify an attribution bug as working.
async function seedClickable(slug = "attr-vendor") {
  const db = await getDatabase();
  await upsertLiveCompound(db, {
    slug: "attr-compound", name: "Attr Compound", shorthand: "ATTR",
    category: "Peptide", description: "test compound", aliases: ["Attr"],
  });
  await upsertLiveVendor(db, { slug, name: "Attr Vendor", domains: ["attrvendor.example"], description: "test vendor" });
  await upsertLiveListing(db, {
    compoundSlug: "attr-compound", vendorSlug: slug, slug: "attr-listing",
    name: "Attr 5mg", quantity: "5mg", externalUrl: "https://attrvendor.example/product/attr",
    price: 49,
  } as Parameters<typeof upsertLiveListing>[1]);
  return db;
}

describe("attribution — click to partner report", () => {
  it("tags the destination so the vendor can verify us in their own analytics", async () => {
    const db = await seedClickable();
    const r = await resolveAndRecordClick("attr-listing", db, { ip: "9.9.9.9", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" });
    expect(r).toBeTruthy();
    const url = new URL(r!.destination);
    expect(url.searchParams.get("utm_source")).toBe("vialgrade");
    expect(url.searchParams.get("vg")).toBe(r!.clickRef);
  });

  it("records the click with a privacy-safe visitor hash and no raw address", async () => {
    const db = await seedClickable();
    await resolveAndRecordClick("attr-listing", db, { ip: "9.9.9.9", userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" });
    const row = (await db.query<{ visitor_hash: string; device: string; click_ref: string }>(
      `SELECT visitor_hash, device, click_ref FROM outbound_clicks WHERE listing_slug='attr-listing'`,
    )).rows[0]!;
    expect(row.visitor_hash).toBeTruthy();
    expect(row.visitor_hash).not.toContain("9.9.9.9");
    expect(row.device).toBe("mobile");
    expect(row.click_ref).toBeTruthy();
  });

  // "People" not "hits" — the number you can defensibly say out loud to a vendor.
  it("counts distinct people, not raw clicks", async () => {
    const db = await seedClickable();
    for (let i = 0; i < 3; i++) await resolveAndRecordClick("attr-listing", db, { ip: "1.1.1.1", userAgent: BROWSER });
    await resolveAndRecordClick("attr-listing", db, { ip: "2.2.2.2", userAgent: BROWSER });

    const report = await getPartnerReport("attr-vendor", { connection: db });
    expect(report!.clicks).toBe(4);
    expect(report!.people).toBe(2);
  });

  it("reports zero revenue until a partner actually confirms an order", async () => {
    const db = await seedClickable();
    await resolveAndRecordClick("attr-listing", db, { ip: "1.1.1.1", userAgent: BROWSER });
    const report = await getPartnerReport("attr-vendor", { connection: db });
    expect(report!.conversions).toBe(0);
    expect(report!.revenueCents).toBe(0);
    expect(report!.status).toBe("prospect");
  });

  it("attributes a confirmed order to the exact click", async () => {
    const db = await seedClickable();
    const r = await resolveAndRecordClick("attr-listing", db, { ip: "1.1.1.1", userAgent: BROWSER });
    await db.query(
      `UPDATE outbound_clicks SET converted_at=NOW(), order_value_cents=12900, conversion_source='postback' WHERE click_ref=$1`,
      [r!.clickRef],
    );
    const report = await getPartnerReport("attr-vendor", { connection: db });
    expect(report!.conversions).toBe(1);
    expect(report!.revenueCents).toBe(12900);
  });

  it("ranks vendors by traffic in the overview", async () => {
    const db = await seedClickable();
    await resolveAndRecordClick("attr-listing", db, { ip: "1.1.1.1", userAgent: BROWSER });
    const overview = await getAttributionOverview({ connection: db });
    expect(overview.totals.clicks).toBeGreaterThan(0);
    expect(overview.vendors[0]!.vendorSlug).toBe("attr-vendor");
  });

  it("tells the vendor exactly where to check our claim", async () => {
    const db = await seedClickable();
    await resolveAndRecordClick("attr-listing", db, { ip: "1.1.1.1", userAgent: BROWSER });
    const report = await getPartnerReport("attr-vendor", { connection: db });
    expect(report!.verification.utmSource).toBe("vialgrade");
    expect(report!.verification.where.join(" ")).toMatch(/Shopify|Google Analytics/);
  });
});
