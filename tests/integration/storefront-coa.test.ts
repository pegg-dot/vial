import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { upsertLiveCompound } from "@/server/ingest/live-sources";
import { importShopifyCatalog } from "@/server/ingest/shopify-import";
import { crossCheckCoa } from "@/server/verify/coa-cross-check";

process.env.VIAL_PGLITE_MEMORY = "true";
process.env.VIAL_SESSION_SECRET = "storefront-coa-test-secret-at-least-32chars";
process.env.VIAL_PRIVACY_HASH_SECRET = "storefront-coa-privacy-secret-at-least-32chars";

const VERIFY = "https://verify.janoshik.com/tests/551234-BPC157_K9Z";
const BATCH = "2026-05-01-A"; // normalizes to "20260501a" (9 chars, over the >=6 floor)

async function seedLabTest(row: { vendor_slug: string | null; manufacturer: string; compound_slug: string; verify: string; batch_code?: string; purity?: number; independent?: boolean }) {
  const db = await getDatabase();
  await db.query(
    `INSERT INTO lab_test_records (id,lab,verify_url,verify_key,compound_slug,sample_name,manufacturer,vendor_slug,batch_code,purity_pct,is_independent,origin)
     VALUES ($1,'Janoshik Analytical',$2,$3,$4,$5,$6,$7,$8,$9,$10,'live')`,
    [newId("labtest"), row.verify, "K" + Math.floor(row.purity ?? 99), row.compound_slug, row.compound_slug, row.manufacturer, row.vendor_slug, row.batch_code ?? null, row.purity ?? 99, row.independent ?? true],
  );
}

async function seedCompound(slug: string, name: string) {
  const db = await getDatabase();
  await upsertLiveCompound(db, { slug, name, shorthand: name, category: "Peptide", description: `${name} desc`, aliases: [name] });
}

function product(over: Partial<{ title: string; handle: string; price: string; body_html: string }> = {}) {
  return {
    title: over.title ?? "BPC-157 5mg",
    handle: over.handle ?? "bpc-157-5mg",
    variants: [{ title: "5mg", price: over.price ?? "42.00", available: true }],
    body_html: over.body_html ?? `<p>Third-party tested — <a href="${VERIFY}">view Janoshik COA</a></p>`,
  };
}

async function runImport(vendorSlug: string, products: ReturnType<typeof product>[]) {
  const db = await getDatabase();
  return importShopifyCatalog(db, {
    vendorSlug, vendorName: "Stake Labs", domain: "stakelabs.com", description: "test store",
    compounds: [{ slug: "bpc-157", name: "BPC-157", aliases: ["BPC 157"] }, { slug: "tb-500", name: "TB-500", aliases: ["TB500"] }],
    products,
  });
}

async function listing(slug: string) {
  const db = await getDatabase();
  return (await db.query<{ report_issuer: string; report_confirmed: boolean; batch_code: string }>(
    `SELECT report_issuer, report_confirmed, batch_code FROM listings WHERE slug = $1`, [slug],
  )).rows[0];
}

describe("storefront-published COA linking — the coverage wedge", () => {
  beforeAll(async () => { await resetDatabaseForTests(); await getDatabase(); });
  afterAll(async () => { await resetDatabaseForTests(); });
  beforeEach(async () => { await resetDatabaseForTests(); await getDatabase(); await seedCompound("bpc-157", "BPC-157"); await seedCompound("tb-500", "TB-500"); });

  it("stamps a listing's testing claim when its published Janoshik link resolves to a held cert for that compound", async () => {
    await seedLabTest({ vendor_slug: "stakelabs", manufacturer: "Stake Labs", compound_slug: "bpc-157", verify: VERIFY, batch_code: BATCH });
    await runImport("stakelabs", [product()]);
    const l = await listing("stakelabs-bpc-157");
    expect(l.report_issuer).toBe("Janoshik");
    expect(l.report_confirmed).toBe(true);
    expect(l.batch_code).toBe(BATCH);
  });

  it("that stamp makes the hardened crossCheckCoa return batch-verified for the seller's own tested batch", async () => {
    await seedLabTest({ vendor_slug: "stakelabs", manufacturer: "Stake Labs", compound_slug: "bpc-157", verify: VERIFY, batch_code: BATCH, purity: 99.4 });
    await runImport("stakelabs", [product()]);
    const db = await getDatabase();
    const r = await crossCheckCoa(db, { vendorSlug: "stakelabs", vendorName: "Stake Labs", compoundSlug: "bpc-157", compoundName: "BPC-157", reportIssuer: "Janoshik", reportConfirmed: true, batchCode: BATCH });
    expect(r.status).toBe("batch-verified");
    expect(r.independentPurity).toBeCloseTo(99.4, 1);
  });

  it("NEVER invents evidence — a published link VIAL does not hold leaves the listing no-claim", async () => {
    // No lab record seeded for this verify URL.
    await runImport("stakelabs", [product({ body_html: `<a href="${VERIFY}">COA</a>` })]);
    const l = await listing("stakelabs-bpc-157");
    expect(l.report_issuer).toBe("");
    expect(l.report_confirmed).toBe(false);
  });

  it("NEVER attaches a cert for a DIFFERENT compound than the product it's embedded on", async () => {
    // The held cert for this verify URL is for tb-500, but it's embedded on a bpc-157 product page.
    await seedLabTest({ vendor_slug: "stakelabs", manufacturer: "Stake Labs", compound_slug: "tb-500", verify: VERIFY, batch_code: BATCH });
    await runImport("stakelabs", [product()]); // a BPC-157 product citing a tb-500 cert
    const l = await listing("stakelabs-bpc-157");
    expect(l.report_issuer).toBe(""); // compound mismatch → not stamped
  });

  it("NEVER links to a self-published (non-independent) held record", async () => {
    await seedLabTest({ vendor_slug: "stakelabs", manufacturer: "Stake Labs", compound_slug: "bpc-157", verify: VERIFY, batch_code: BATCH, independent: false });
    await runImport("stakelabs", [product()]);
    const l = await listing("stakelabs-bpc-157");
    expect(l.report_issuer).toBe(""); // self-published → not resolved
  });

  it("a boilerplate footer link shared across compounds does NOT leak the claim to the wrong compound", async () => {
    // The held cert is for BPC-157, but the SAME verify link is pasted into a TB-500 product's body too.
    await seedLabTest({ vendor_slug: "stakelabs", manufacturer: "Stake Labs", compound_slug: "bpc-157", verify: VERIFY, batch_code: BATCH });
    await runImport("stakelabs", [
      product(), // BPC-157, cites VERIFY
      product({ title: "TB-500 5mg", handle: "tb-500-5mg", body_html: `<a href="${VERIFY}">same footer COA</a>` }),
    ]);
    expect((await listing("stakelabs-bpc-157")).report_issuer).toBe("Janoshik"); // correct compound → stamped
    expect((await listing("stakelabs-tb-500")).report_issuer).toBe("");          // wrong compound → NOT stamped
  });

  it("a FOREIGN maker's cert is issuer-only (advertises testing) — NEVER a manufactured counterfeit accusation", async () => {
    // Storefront honestly publishes a link to a cert VIAL holds under a DIFFERENT maker (a reseller).
    await seedLabTest({ vendor_slug: "othermaker", manufacturer: "Other Maker", compound_slug: "bpc-157", verify: VERIFY, batch_code: BATCH });
    await runImport("stakelabs", [product()]);
    const l = await listing("stakelabs-bpc-157");
    expect(l.report_issuer).toBe("Janoshik"); // vendor advertises a real test...
    expect(l.batch_code).toBe("");            // ...but we do NOT stamp the foreign batch
    const db = await getDatabase();
    const r = await crossCheckCoa(db, { vendorSlug: "stakelabs", vendorName: "Stake Labs", compoundSlug: "bpc-157", compoundName: "BPC-157", reportIssuer: "Janoshik", reportConfirmed: true, batchCode: "" });
    expect(r.status).toBe("unbacked");        // honest "advertises testing, unconfirmed" — NOT mismatch, NOT batch-verified
  });
});
