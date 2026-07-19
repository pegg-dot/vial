import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { matchSellerBusiness, matchSellerProduct } from "@/server/seller/matching";
import {
  acceptImportJob,
  adjustInventory,
  authenticateSellerApiToken,
  confirmEvidenceLink,
  connectSandboxIntegration,
  createEvidenceDocument,
  createSellerApiToken,
  createSellerBatch,
  ensureSellerOpsSeed,
  getImportJob,
  getSellerContext,
  proposeEvidenceLinks,
  runCatalogImport,
} from "@/server/seller/ops";

process.env.VIAL_PGLITE_MEMORY = "true";
process.env.VIAL_SEED_FIXTURES = "true";
process.env.VIAL_SEED_DEMO_ACCOUNTS = "true";
process.env.VIAL_SESSION_SECRET = "seller-ops-session-secret-at-least-32";
process.env.VIAL_PRIVACY_HASH_SECRET = "seller-ops-privacy-secret-at-least-32";

describe("VIAL 4.0 seller operating system", () => {
  beforeAll(async () => { await resetDatabaseForTests(); await ensureSellerOpsSeed(); });
  afterAll(async () => { await resetDatabaseForTests(); });

  it("seeds a tenant-scoped self-serve workspace and readiness map", async () => {
    const context = await getSellerContext("marcus@helixtest.test");
    expect(context?.sellerId).toBeTruthy();
    expect(context?.integrations.length).toBeGreaterThanOrEqual(7);
    expect(context?.products.length).toBeGreaterThan(0);
    expect((context?.readiness as { dimensions?: unknown[] })?.dimensions).toHaveLength(8);
    expect(await getSellerContext("unknown@example.test")).toBeNull();
  });

  it("matches products and existing business profiles without auto-claiming", async () => {
    const product = await matchSellerProduct({ title: "BPC157 Research Vial 10 mg", sku: "BPC10" });
    expect(product.status).toBe("auto_matched");
    expect(product.compoundName).toBe("BPC-157");
    expect(product.quantityLabel).toBe("10 mg");
    const context = await getSellerContext("marcus@helixtest.test");
    const profile = context?.profile as Record<string, unknown>;
    const candidates = await matchSellerBusiness({ name: String(profile.display_name), websiteUrl: String(profile.website_url) });
    expect(candidates[0]?.score).toBeGreaterThan(.8);
  });

  it("runs an idempotent dry-run import and accepts reviewable rows", async () => {
    const context = await getSellerContext("marcus@helixtest.test");
    expect(context).toBeTruthy();
    await connectSandboxIntegration({ sellerId: context!.sellerId, provider: "shopify", settings: { shop: "demo-store.myshopify.com" } });
    const first = await runCatalogImport({ sellerId: context!.sellerId, provider: "shopify", actorId: "integration-test" });
    const second = await runCatalogImport({ sellerId: context!.sellerId, provider: "shopify", actorId: "integration-test" });
    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(second!.idempotent).toBe(true);
    const job = await getImportJob((first!.job as { id: string }).id, context!.sellerId);
    expect(job?.rows.length).toBe(3);
    const accepted = await acceptImportJob({ sellerId: context!.sellerId, jobId: (first!.job as { id: string }).id, actorId: "integration-test" });
    expect(accepted.imported).toBeGreaterThan(0);
    expect((await getSellerContext("marcus@helixtest.test"))!.products.length).toBeGreaterThan(context!.products.length);
  });

  it("links evidence to a seller-owned product and batch through review", async () => {
    const context = await getSellerContext("marcus@helixtest.test");
    const product = context!.products[0] as Record<string, unknown>;
    const batchId = await createSellerBatch({ sellerId: context!.sellerId, productId: String(product.id), batchCode: "TEST-BATCH-4", quantity: 5 });
    const documentId = await createEvidenceDocument({ sellerId: context!.sellerId, filename: "TEST-BATCH-4-COA.pdf", documentType: "coa", issuer: "Fictional Lab", reportIdentifier: "TEST-4", extractedFields: { identity: String(product.compound_name), quantity: String(product.quantity_label), batchCode: "TEST-BATCH-4" } });
    const proposals = await proposeEvidenceLinks({ sellerId: context!.sellerId, documentId });
    const proposal = proposals.find((item) => item.batchId === batchId);
    expect(proposal?.confidence).toBeGreaterThan(.7);
    await confirmEvidenceLink({ sellerId: context!.sellerId, linkId: proposal!.id, status: "confirmed" });
    const db = await getDatabase();
    const link = (await db.query<{ status: string }>(`SELECT status FROM seller_evidence_links WHERE id=$1`, [proposal!.id])).rows[0];
    expect(link?.status).toBe("confirmed");
  });

  it("records idempotent inventory events and scoped MCP tokens", async () => {
    const context = await getSellerContext("marcus@helixtest.test");
    const product = context!.products[0] as Record<string, unknown>;
    const before = Number(product.inventory);
    const first = await adjustInventory({ sellerId: context!.sellerId, productId: String(product.id), delta: 3, actorId: "integration-test", idempotencyKey: "seller-v4-inventory" });
    const repeated = await adjustInventory({ sellerId: context!.sellerId, productId: String(product.id), delta: 3, actorId: "integration-test", idempotencyKey: "seller-v4-inventory" });
    expect(first).toBe(before + 3);
    expect(repeated).toBe(before + 3);
    const token = await createSellerApiToken({ sellerId: context!.sellerId, name: "Integration MCP", scopes: ["seller:read", "catalog:propose"], actorId: "integration-test" });
    const authenticated = await authenticateSellerApiToken(token.token);
    expect(authenticated?.sellerId).toBe(context!.sellerId);
    expect(authenticated?.scopes).toContain("catalog:propose");
    expect(await authenticateSellerApiToken("vial_seller_invalid")).toBeNull();
  });
});
