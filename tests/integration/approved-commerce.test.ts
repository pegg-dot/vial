import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addCartLine, getOrCreateCart, prepareApprovedCheckoutAttempt } from "@/server/commerce/repository";
import { approvedCommerceDashboard, ensureApprovedCommerceSeed, evaluateCurrentCart } from "@/server/commerce/activation";
import { createApprovedCheckout } from "@/server/commerce/orchestrator";
import { ingestProviderWebhook, replayProviderEvent } from "@/server/commerce/provider-events";
import { runV5Settlement } from "@/server/commerce/settlement";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { resetEnvironmentForTests } from "@/server/config/env";

Object.assign(process.env, { NODE_ENV: "test" });
process.env.VIALGRADE_PGLITE_MEMORY = "true";
process.env.VIALGRADE_SEED_FIXTURES = "true";
process.env.VIALGRADE_SEED_DEMO_ACCOUNTS = "true";
process.env.VIALGRADE_SESSION_SECRET = "commerce-v5-session-secret-at-least-32";
process.env.VIALGRADE_PRIVACY_HASH_SECRET = "commerce-v5-privacy-secret-at-least-32";
process.env.VIALGRADE_COMMERCE_MODE = "sandbox";
process.env.VIALGRADE_PAYMENT_PROVIDER = "mock";
process.env.VIALGRADE_MOCK_WEBHOOK_SECRET = "commerce-v5-webhook-secret";

describe("VIAL 5 approved commerce", () => {
  beforeAll(async () => {
    resetEnvironmentForTests();
    await resetDatabaseForTests();
    await ensureApprovedCommerceSeed();
  });
  afterAll(async () => { await resetDatabaseForTests(); });

  it("persists seller, SKU, customer, jurisdiction, and merchant-model activation checks", async () => {
    const database = await getDatabase();
    const listing = (await database.query<{ slug: string }>(`SELECT l.slug FROM listings l JOIN commerce_listing_eligibility e ON e.listing_id=l.id WHERE e.state='checkout_sandbox' ORDER BY l.slug LIMIT 1`)).rows[0];
    expect(listing).toBeTruthy();
    await addCartLine({ customerKey: "customer:v5-preflight", listingSlug: listing.slug, quantity: 1 });
    const result = await evaluateCurrentCart({ customerKey: "customer:v5-preflight", customerType: "sandbox_customer", jurisdiction: "US-FL", persist: true, actorId: "test:activation" });
    expect(result.activation.decision).not.toBe("deny");
    expect(result.activation.chargeModel).toBe("direct");
    expect(result.activation.merchantOfRecord).toBe("seller");
    expect(result.activation.checks.some((check) => check.key === "underwriting")).toBe(true);
    expect(result.activation.decisionId).toBeTruthy();
    const checkout = await createApprovedCheckout({
      customerKey: "customer:v5-preflight",
      customerType: "sandbox_customer",
      email: "direct-v5@example.test",
      address: { line1: "101 Direct Way", city: "Miami", region: "FL", postalCode: "33101" },
      jurisdiction: "US-FL",
      idempotencyKey: "commerce-v5-direct",
      actorId: "test:direct-checkout",
    });
    expect(checkout.orderId).toBeTruthy();
    expect(checkout.activation.chargeModel).toBe("direct");
    const directTransfers = await database.query(`SELECT * FROM commerce_provider_transfers WHERE order_id=$1`, [checkout.orderId]);
    const directReserves = await database.query(`SELECT * FROM commerce_reserve_holds WHERE order_id=$1`, [checkout.orderId]);
    expect(directTransfers.rows).toHaveLength(0);
    expect(directReserves.rows).toHaveLength(0);
  });

  it("creates a multi-seller provider payment, order, transfers, reserves, tax, and fraud records", async () => {
    const database = await getDatabase();
    const listings = await database.query<{ slug: string }>(
      `SELECT DISTINCT ON (cs.id) l.slug FROM listings l JOIN products p ON p.id=l.product_id JOIN commerce_sellers cs ON cs.organization_id=p.vendor_id JOIN commerce_listing_eligibility e ON e.listing_id=l.id WHERE e.state='checkout_sandbox' ORDER BY cs.id,l.slug LIMIT 2`,
    );
    expect(listings.rows).toHaveLength(2);
    const customerKey = "customer:v5-checkout";
    for (const listing of listings.rows) await addCartLine({ customerKey, listingSlug: listing.slug, quantity: 1 });
    const cart = await getOrCreateCart(customerKey);
    expect(new Set(cart.lines.map((line) => line.sellerId)).size).toBe(2);
    const checkout = await createApprovedCheckout({
      customerKey,
      customerType: "sandbox_customer",
      email: "customer-v5@example.test",
      address: { line1: "100 Test Mode Way", city: "Miami", region: "FL", postalCode: "33101" },
      jurisdiction: "US-FL",
      idempotencyKey: "commerce-v5-multi-seller",
      actorId: "test:checkout",
    });
    expect(checkout.orderId).toBeTruthy();
    expect(checkout.activation.chargeModel).toBe("platform_separate");
    expect(checkout.activation.merchantOfRecord).toBe("platform");
    if (!("allocations" in checkout)) throw new Error("Expected settled checkout");
    expect(checkout.allocations).toHaveLength(2);
    const intents = await database.query(`SELECT * FROM commerce_provider_payment_intents WHERE id=$1`, [checkout.paymentIntentId]);
    const transfers = await database.query(`SELECT * FROM commerce_provider_transfers WHERE order_id=$1`, [checkout.orderId]);
    const reserves = await database.query(`SELECT * FROM commerce_reserve_holds WHERE order_id=$1`, [checkout.orderId]);
    const tax = await database.query(`SELECT * FROM commerce_tax_transactions WHERE checkout_attempt_id=(SELECT checkout_attempt_id FROM commerce_orders WHERE id=$1)`, [checkout.orderId]);
    const fraud = await database.query(`SELECT * FROM commerce_fraud_decisions WHERE checkout_attempt_id=(SELECT checkout_attempt_id FROM commerce_orders WHERE id=$1)`, [checkout.orderId]);
    expect(intents.rows).toHaveLength(1);
    expect(transfers.rows).toHaveLength(2);
    expect(reserves.rows).toHaveLength(2);
    expect(tax.rows).toHaveLength(1);
    expect(fraud.rows).toHaveLength(1);
    const reused = await createApprovedCheckout({
      customerKey,
      customerType: "sandbox_customer",
      email: "customer-v5@example.test",
      address: { line1: "100 Test Mode Way", city: "Miami", region: "FL", postalCode: "33101" },
      jurisdiction: "US-FL",
      idempotencyKey: "commerce-v5-multi-seller",
      actorId: "test:checkout-retry",
    });
    expect("reused" in reused && reused.reused).toBe(true);
    expect(reused.orderId).toBe(checkout.orderId);
    expect((await database.query(`SELECT * FROM commerce_provider_payment_intents WHERE idempotency_key='commerce-v5-multi-seller'`)).rows).toHaveLength(1);
    expect((await database.query(`SELECT * FROM commerce_provider_transfers WHERE order_id=$1`, [checkout.orderId])).rows).toHaveLength(2);
    expect((await database.query(`SELECT * FROM commerce_reserve_holds WHERE order_id=$1`, [checkout.orderId])).rows).toHaveLength(2);
  });

  it("deduplicates signed provider events", async () => {
    const payload = JSON.stringify({ id: "evt_v5_dedupe", type: "payment_intent.succeeded", data: { object: { id: "pi_missing" } } });
    const signature = createHmac("sha256", process.env.VIALGRADE_MOCK_WEBHOOK_SECRET!).update(payload).digest("hex");
    const first = await ingestProviderWebhook({ payload, signature, secret: process.env.VIALGRADE_MOCK_WEBHOOK_SECRET });
    const second = await ingestProviderWebhook({ payload, signature, secret: process.env.VIALGRADE_MOCK_WEBHOOK_SECRET });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
  });

  it("finalizes an asynchronous payment exactly once from a signed webhook and supports safe replay", async () => {
    const database = await getDatabase();
    const listing = (await database.query<{ id: string; slug: string; seller_id: string }>(
      `SELECT l.id,l.slug,cs.id seller_id FROM listings l JOIN products p ON p.id=l.product_id JOIN commerce_sellers cs ON cs.organization_id=p.vendor_id JOIN commerce_listing_eligibility e ON e.listing_id=l.id WHERE e.state='checkout_sandbox' ORDER BY l.slug LIMIT 1`,
    )).rows[0];
    const customerKey = "customer:v5-async";
    await addCartLine({ customerKey, listingSlug: listing.slug, quantity: 1 });
    const evaluated = await evaluateCurrentCart({ customerKey, customerType: "sandbox_customer", jurisdiction: "US-FL", persist: true, actorId: "test:async" });
    const prepared = await prepareApprovedCheckoutAttempt({
      customerKey,
      email: "async@example.test",
      address: { line1: "200 Webhook Way", city: "Miami", region: "FL", postalCode: "33101" },
      idempotencyKey: "commerce-v5-async",
      commerceMode: "sandbox",
      provider: "mock_connect_v5",
      activationDecisionId: evaluated.activation.decisionId,
    });
    const providerPaymentId = "pi_async_v5";
    await database.query(
      `INSERT INTO commerce_provider_payment_intents(id,checkout_attempt_id,provider,mode,provider_payment_id,provider_account_id,charge_model,merchant_of_record,amount,currency,application_fee,status,idempotency_key)
       VALUES('provider-intent:async',$1,'mock_connect_v5','sandbox',$2,(SELECT provider_account_id FROM commerce_provider_accounts WHERE seller_id=$3),'direct','seller',$4,'USD',1,'requires_action','commerce-v5-async')`,
      [prepared.attemptId, providerPaymentId, listing.seller_id, prepared.cart.total],
    );
    await database.query(`UPDATE commerce_checkout_attempts SET payment_intent_id='provider-intent:async',status='requires_action',processor_payment_id=$2 WHERE id=$1`, [prepared.attemptId, providerPaymentId]);
    const payload = JSON.stringify({ id: "evt_v5_async_success", type: "payment_intent.succeeded", data: { object: { id: providerPaymentId } } });
    const signature = createHmac("sha256", process.env.VIALGRADE_MOCK_WEBHOOK_SECRET!).update(payload).digest("hex");
    const processed = await ingestProviderWebhook({ payload, signature, secret: process.env.VIALGRADE_MOCK_WEBHOOK_SECRET });
    expect(processed.processed).toBe(true);
    const orders = await database.query<{ id: string }>(`SELECT id FROM commerce_orders WHERE checkout_attempt_id=$1`, [prepared.attemptId]);
    expect(orders.rows).toHaveLength(1);
    const event = (await database.query<{ id: string }>(`SELECT id FROM commerce_webhook_events WHERE provider_event_id='evt_v5_async_success'`)).rows[0];
    await replayProviderEvent(event.id);
    expect((await database.query(`SELECT id FROM commerce_orders WHERE checkout_attempt_id=$1`, [prepared.attemptId])).rows).toHaveLength(1);
    expect((await database.query(`SELECT id FROM commerce_inventory_reservations WHERE cart_id=$1 AND status='consumed'`, [prepared.cart.id])).rows).toHaveLength(1);
  });

  it("releases inventory when a signed provider failure arrives", async () => {
    const database = await getDatabase();
    const listing = (await database.query<{ id: string; slug: string; seller_id: string }>(
      `SELECT l.id,l.slug,cs.id seller_id FROM listings l JOIN products p ON p.id=l.product_id JOIN commerce_sellers cs ON cs.organization_id=p.vendor_id JOIN commerce_listing_eligibility e ON e.listing_id=l.id WHERE e.state='checkout_sandbox' ORDER BY l.slug DESC LIMIT 1`,
    )).rows[0];
    const customerKey = "customer:v5-failure";
    await addCartLine({ customerKey, listingSlug: listing.slug, quantity: 1 });
    const evaluated = await evaluateCurrentCart({ customerKey, customerType: "sandbox_customer", jurisdiction: "US-FL", persist: true, actorId: "test:failure" });
    const prepared = await prepareApprovedCheckoutAttempt({ customerKey, email: "failed@example.test", address: { line1: "201 Webhook Way", city: "Miami", region: "FL", postalCode: "33101" }, idempotencyKey: "commerce-v5-failure", commerceMode: "sandbox", provider: "mock_connect_v5", activationDecisionId: evaluated.activation.decisionId });
    const providerPaymentId = "pi_failed_v5";
    await database.query(
      `INSERT INTO commerce_provider_payment_intents(id,checkout_attempt_id,provider,mode,provider_payment_id,provider_account_id,charge_model,merchant_of_record,amount,currency,application_fee,status,idempotency_key)
       VALUES('provider-intent:failed',$1,'mock_connect_v5','sandbox',$2,(SELECT provider_account_id FROM commerce_provider_accounts WHERE seller_id=$3),'direct','seller',$4,'USD',1,'requires_action','commerce-v5-failure')`,
      [prepared.attemptId, providerPaymentId, listing.seller_id, prepared.cart.total],
    );
    await database.query(`UPDATE commerce_checkout_attempts SET payment_intent_id='provider-intent:failed',status='requires_action',processor_payment_id=$2 WHERE id=$1`, [prepared.attemptId, providerPaymentId]);
    const payload = JSON.stringify({ id: "evt_v5_async_failed", type: "payment_intent.payment_failed", data: { object: { id: providerPaymentId } } });
    const signature = createHmac("sha256", process.env.VIALGRADE_MOCK_WEBHOOK_SECRET!).update(payload).digest("hex");
    await ingestProviderWebhook({ payload, signature, secret: process.env.VIALGRADE_MOCK_WEBHOOK_SECRET });
    const attempt = (await database.query<{ status: string }>(`SELECT status FROM commerce_checkout_attempts WHERE id=$1`, [prepared.attemptId])).rows[0];
    expect(attempt.status).toBe("failed");
    expect((await database.query(`SELECT id FROM commerce_orders WHERE checkout_attempt_id=$1`, [prepared.attemptId])).rows).toHaveLength(0);
    expect((await database.query(`SELECT id FROM commerce_inventory_reservations WHERE cart_id=$1 AND status='released'`, [prepared.cart.id])).rows).toHaveLength(1);
  });

  it("reconciles the V5 financial invariant with zero variance", async () => {
    const result = await runV5Settlement({ actorId: "test:finance" });
    expect(result.variance).toBe(0);
    expect(result.issueCount).toBe(0);
    const dashboard = await approvedCommerceDashboard();
    expect(dashboard.settlements.length).toBeGreaterThan(0);
    expect(dashboard.paymentIntents.length).toBeGreaterThan(0);
  });
});
