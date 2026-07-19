import type { QueryResultRow } from "pg";
import { getDatabase, withTransaction, type SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { getPaymentProvider } from "./provider";

export type CommerceState =
  | "information_only"
  | "outbound_only"
  | "checkout_sandbox"
  | "processor_review"
  | "commerce_approved"
  | "commerce_suspended"
  | "prohibited";

export interface CartLine {
  id: string;
  listingId: string;
  slug: string;
  name: string;
  quantityLabel: string;
  vendor: string;
  vendorSlug: string;
  quantity: number;
  unitPrice: number;
  sellerId: string;
  state: CommerceState;
}

export interface Cart {
  id: string;
  customerKey: string;
  lines: CartLine[];
  subtotal: number;
  shipping: number;
  platformFee: number;
  tax: number;
  total: number;
  eligible: boolean;
  issues: string[];
}

function asMoney(value: unknown) {
  return Number(value ?? 0);
}

async function seedCommerce(connection: SqlConnection) {
  const sellers = await connection.query<QueryResultRow & { organization_id: string; display_name: string }>(
    `SELECT id AS organization_id, display_name
     FROM organizations
     WHERE organization_type = 'vendor'
     ORDER BY display_name
     LIMIT 4`,
  );
  const provider = getPaymentProvider();
  for (const seller of sellers.rows) {
    const sellerId = `seller:${seller.organization_id.replace(/^org:/, "")}`;
    const account = await provider.createConnectedAccount({ sellerId, businessName: seller.display_name });
    await connection.query(
      `INSERT INTO commerce_sellers
       (id, organization_id, status, processor_account_id, charges_enabled, payouts_enabled, requirements_due, agreement_version, agreement_accepted_at)
       VALUES ($1, $2, 'sandbox_active', $3, $4, $5, $6::jsonb, 'seller-v1', NOW())
       ON CONFLICT (organization_id) DO UPDATE SET
         processor_account_id = EXCLUDED.processor_account_id,
         charges_enabled = EXCLUDED.charges_enabled,
         payouts_enabled = EXCLUDED.payouts_enabled,
         status = 'sandbox_active',
         updated_at = NOW()`,
      [sellerId, seller.organization_id, account.id, account.chargesEnabled, account.payoutsEnabled, JSON.stringify(account.requirementsDue)],
    );
  }
  await connection.query(
    `INSERT INTO commerce_listing_eligibility
     (listing_id, state, processor_review_status, legal_review_status, reason_codes)
     SELECT l.id,
       CASE WHEN cs.id IS NOT NULL THEN 'checkout_sandbox' ELSE 'information_only' END,
       CASE WHEN cs.id IS NOT NULL THEN 'sandbox_approved' ELSE 'not_submitted' END,
       CASE WHEN cs.id IS NOT NULL THEN 'sandbox_only' ELSE 'not_reviewed' END,
       CASE WHEN cs.id IS NOT NULL THEN '["sandbox-only","production-disabled"]'::jsonb ELSE '["seller-not-participating"]'::jsonb END
     FROM listings l
     JOIN products p ON p.id = l.product_id
     LEFT JOIN commerce_sellers cs ON cs.organization_id = p.vendor_id
     ON CONFLICT (listing_id) DO NOTHING`,
  );
  await connection.query(
    `INSERT INTO commerce_inventory(listing_id, seller_id, available, reserved)
     SELECT l.id, cs.id, 25, 0
     FROM listings l
     JOIN products p ON p.id=l.product_id
     JOIN commerce_sellers cs ON cs.organization_id=p.vendor_id
     ON CONFLICT(listing_id) DO NOTHING`,
  );
}

export async function ensureCommerceSeed() {
  const database = await getDatabase();
  await seedCommerce(database);
}

async function loadCartLines(connection: SqlConnection, cartId: string): Promise<CartLine[]> {
  const result = await connection.query<QueryResultRow & {
    id: string;
    listing_id: string;
    slug: string;
    name: string;
    declared_quantity: string;
    display_name: string;
    vendor_slug: string;
    quantity: number;
    unit_price: string | number;
    seller_id: string;
    state: CommerceState;
  }>(
    `SELECT cl.id, cl.listing_id, l.slug, p.name, p.declared_quantity, o.display_name, o.slug AS vendor_slug,
            cl.quantity, cl.unit_price, cl.seller_id, e.state
     FROM commerce_cart_lines cl
     JOIN listings l ON l.id = cl.listing_id
     JOIN products p ON p.id = l.product_id
     JOIN organizations o ON o.id = p.vendor_id
     JOIN commerce_listing_eligibility e ON e.listing_id = l.id
     WHERE cl.cart_id = $1
     ORDER BY cl.created_at`,
    [cartId],
  );
  return result.rows.map((row) => ({
    id: row.id,
    listingId: row.listing_id,
    slug: row.slug,
    name: row.name,
    quantityLabel: row.declared_quantity,
    vendor: row.display_name,
    vendorSlug: row.vendor_slug,
    quantity: Number(row.quantity),
    unitPrice: asMoney(row.unit_price),
    sellerId: row.seller_id,
    state: row.state,
  }));
}

function summarizeCart(id: string, customerKey: string, lines: CartLine[]): Cart {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const sellerCount = new Set(lines.map((line) => line.sellerId)).size;
  const shipping = lines.length ? sellerCount * 6 : 0;
  const platformFee = lines.length ? Math.round((subtotal * 0.025 + 0.5) * 100) / 100 : 0;
  const tax = Math.round(subtotal * 0.07 * 100) / 100;
  const issues = lines.filter((line) => line.state !== "checkout_sandbox").map((line) => `${line.name} is ${line.state.replaceAll("_", " ")}`);
  return {
    id,
    customerKey,
    lines,
    subtotal,
    shipping,
    platformFee,
    tax,
    total: Math.round((subtotal + shipping + platformFee + tax) * 100) / 100,
    eligible: lines.length > 0 && issues.length === 0,
    issues,
  };
}

export async function getOrCreateCart(customerKey = "demo-browser"): Promise<Cart> {
  await ensureCommerceSeed();
  const database = await getDatabase();
  let cart = (await database.query<QueryResultRow & { id: string }>(
    `SELECT id FROM commerce_carts WHERE customer_key = $1 AND status = 'open' ORDER BY created_at DESC LIMIT 1`,
    [customerKey],
  )).rows[0];
  if (!cart) {
    cart = { id: newId("cart") };
    await database.query(`INSERT INTO commerce_carts(id, customer_key, expires_at) VALUES($1, $2, NOW() + INTERVAL '7 days')`, [cart.id, customerKey]);
  }
  return summarizeCart(cart.id, customerKey, await loadCartLines(database, cart.id));
}

export async function addCartLine(input: { customerKey: string; listingSlug: string; quantity: number }) {
  const cart = await getOrCreateCart(input.customerKey);
  const database = await getDatabase();
  const listing = (await database.query<QueryResultRow & { id: string; price: string | number; seller_id: string | null; state: CommerceState }>(
    `SELECT l.id, l.price, cs.id AS seller_id, e.state
     FROM listings l
     JOIN products p ON p.id = l.product_id
     LEFT JOIN commerce_sellers cs ON cs.organization_id = p.vendor_id
     JOIN commerce_listing_eligibility e ON e.listing_id = l.id
     WHERE l.slug = $1`,
    [input.listingSlug],
  )).rows[0];
  if (!listing) throw new Error("Listing not found");
  if (listing.state !== "checkout_sandbox" || !listing.seller_id) throw new Error("Listing is not eligible for sandbox checkout");
  const quantity = Math.max(1, Math.min(20, Math.floor(input.quantity || 1)));
  await database.query(
    `INSERT INTO commerce_cart_lines(id, cart_id, listing_id, quantity, unit_price, seller_id)
     VALUES($1, $2, $3, $4, $5, $6)
     ON CONFLICT(cart_id, listing_id) DO UPDATE SET
       quantity = LEAST(20, commerce_cart_lines.quantity + EXCLUDED.quantity), updated_at = NOW()`,
    [newId("cartline"), cart.id, listing.id, quantity, asMoney(listing.price), listing.seller_id],
  );
  return getOrCreateCart(input.customerKey);
}

export async function setCartQuantity(input: { customerKey: string; lineId: string; quantity: number }) {
  const cart = await getOrCreateCart(input.customerKey);
  const database = await getDatabase();
  if (input.quantity <= 0) {
    await database.query(`DELETE FROM commerce_cart_lines WHERE id = $1 AND cart_id = $2`, [input.lineId, cart.id]);
  } else {
    await database.query(`UPDATE commerce_cart_lines SET quantity = $3, updated_at = NOW() WHERE id = $1 AND cart_id = $2`, [input.lineId, cart.id, Math.min(20, input.quantity)]);
  }
  return getOrCreateCart(input.customerKey);
}


export async function prepareApprovedCheckoutAttempt(input: {
  customerKey: string;
  email: string;
  address: { line1: string; city: string; region: string; postalCode: string };
  idempotencyKey: string;
  commerceMode: "sandbox" | "test" | "live";
  provider: string;
  activationDecisionId?: string;
}) {
  return withTransaction(async (transaction) => {
    await seedCommerce(transaction);
    const existing = (await transaction.query<QueryResultRow & { id: string; cart_id: string; status: string }>(
      `SELECT id,cart_id,status FROM commerce_checkout_attempts WHERE idempotency_key=$1 FOR UPDATE`,
      [input.idempotencyKey],
    )).rows[0];
    if (existing) {
      if (["failed", "cancelled"].includes(existing.status)) throw new Error(`Checkout attempt is ${existing.status}`);
      const lines = await loadCartLines(transaction, existing.cart_id);
      return { attemptId: existing.id, cart: summarizeCart(existing.cart_id, input.customerKey, lines), reused: true };
    }

    const cartRow = (await transaction.query<QueryResultRow & { id: string }>(
      `SELECT id FROM commerce_carts WHERE customer_key=$1 AND status='open' ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [input.customerKey],
    )).rows[0];
    if (!cartRow) throw new Error("Cart is empty");
    const cart = summarizeCart(cartRow.id, input.customerKey, await loadCartLines(transaction, cartRow.id));
    if (!cart.eligible) throw new Error(cart.issues[0] ?? "Cart is not eligible");

    for (const line of cart.lines) {
      const inventory = (await transaction.query<QueryResultRow & { available: number; reserved: number }>(
        `SELECT available,reserved FROM commerce_inventory WHERE listing_id=$1 FOR UPDATE`,
        [line.listingId],
      )).rows[0];
      if (!inventory) throw new Error(`${line.name} has no inventory record`);
      const reservation = (await transaction.query<QueryResultRow & { id: string; quantity: number; expires_at: string }>(
        `SELECT id,quantity,expires_at FROM commerce_inventory_reservations WHERE cart_id=$1 AND listing_id=$2 AND status='active' FOR UPDATE`,
        [cart.id, line.listingId],
      )).rows[0];
      let existingQuantity = 0;
      if (reservation) {
        if (new Date(reservation.expires_at).getTime() <= Date.now()) {
          await transaction.query(`UPDATE commerce_inventory SET reserved=GREATEST(0,reserved-$2),version=version+1,updated_at=NOW() WHERE listing_id=$1`, [line.listingId, reservation.quantity]);
          await transaction.query(`UPDATE commerce_inventory_reservations SET status='expired' WHERE id=$1`, [reservation.id]);
        } else {
          existingQuantity = Number(reservation.quantity);
        }
      }
      const availableAfterExistingReservation = Number(inventory.available) - Number(inventory.reserved) + existingQuantity;
      if (availableAfterExistingReservation < line.quantity) throw new Error(`${line.name} has insufficient inventory`);
      const delta = line.quantity - existingQuantity;
      if (delta !== 0) await transaction.query(`UPDATE commerce_inventory SET reserved=reserved+$2,version=version+1,updated_at=NOW() WHERE listing_id=$1`, [line.listingId, delta]);
      if (reservation && existingQuantity > 0) {
        await transaction.query(`UPDATE commerce_inventory_reservations SET quantity=$2,expires_at=NOW()+INTERVAL '20 minutes' WHERE id=$1`, [reservation.id, line.quantity]);
      } else {
        await transaction.query(
          `INSERT INTO commerce_inventory_reservations(id,cart_id,listing_id,quantity,status,expires_at)
           VALUES($1,$2,$3,$4,'active',NOW()+INTERVAL '20 minutes')`,
          [newId("reservation"), cart.id, line.listingId, line.quantity],
        );
      }
    }

    const attemptId = newId("checkout");
    await transaction.query(
      `INSERT INTO commerce_checkout_attempts
       (id,cart_id,status,idempotency_key,customer_email,shipping_address,subtotal,shipping_total,platform_fee_total,tax_total,grand_total,commerce_mode,provider,activation_decision_id)
       VALUES($1,$2,'payment_pending',$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [attemptId, cart.id, input.idempotencyKey, input.email, JSON.stringify(input.address), cart.subtotal, cart.shipping, cart.platformFee, cart.tax, cart.total, input.commerceMode, input.provider, input.activationDecisionId ?? null],
    );
    return { attemptId, cart, reused: false };
  });
}

export async function finalizePreparedCheckoutInTransaction(transaction: SqlConnection, input: {
  attemptId: string;
  providerPaymentId: string;
  chargeModel: "direct" | "platform_separate";
  merchantOfRecord: "seller" | "platform";
}) {
  const attempt = (await transaction.query<QueryResultRow & {
    id: string; cart_id: string; status: string; customer_email: string; subtotal: number; shipping_total: number;
    platform_fee_total: number; tax_total: number; grand_total: number; provider: string; commerce_mode: "sandbox" | "test" | "live";
  }>(`SELECT * FROM commerce_checkout_attempts WHERE id=$1 FOR UPDATE`, [input.attemptId])).rows[0];
  if (!attempt) throw new Error("Checkout attempt not found");
  const existingOrder = (await transaction.query<QueryResultRow & { id: string }>(`SELECT id FROM commerce_orders WHERE checkout_attempt_id=$1`, [attempt.id])).rows[0];
  if (existingOrder) return { orderId: existingOrder.id, status: "succeeded", reused: true };
  if (["failed", "cancelled"].includes(attempt.status)) throw new Error(`Checkout attempt is ${attempt.status}`);

  const cartOwner = (await transaction.query<QueryResultRow & { customer_key: string }>(`SELECT customer_key FROM commerce_carts WHERE id=$1`, [attempt.cart_id])).rows[0];
  if (!cartOwner) throw new Error("Checkout cart was not found");
  const cart = summarizeCart(attempt.cart_id, cartOwner.customer_key, await loadCartLines(transaction, attempt.cart_id));
  if (!cart.lines.length) throw new Error("Checkout cart has no lines");
  for (const line of cart.lines) {
    const reservation = (await transaction.query<QueryResultRow & { id: string; quantity: number; expires_at: string }>(
      `SELECT id,quantity,expires_at FROM commerce_inventory_reservations WHERE cart_id=$1 AND listing_id=$2 AND status='active' FOR UPDATE`,
      [cart.id, line.listingId],
    )).rows[0];
    if (!reservation || Number(reservation.quantity) < line.quantity) throw new Error(`${line.name} inventory reservation is missing`);
    if (new Date(reservation.expires_at).getTime() <= Date.now()) throw new Error(`${line.name} inventory reservation expired`);
  }

  const orderId = newId("order");
  const rootEventId = newId("commerce");
  await transaction.query(`UPDATE commerce_checkout_attempts SET status='succeeded',processor_payment_id=$2,completed_at=NOW(),failure_reason=NULL WHERE id=$1`, [attempt.id, input.providerPaymentId]);
  await transaction.query(
    `INSERT INTO commerce_orders(id,checkout_attempt_id,customer_key,customer_email,subtotal,shipping_total,platform_fee_total,tax_total,grand_total,provider,commerce_mode,merchant_of_record,charge_model)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [orderId, attempt.id, cart.customerKey, attempt.customer_email, attempt.subtotal, attempt.shipping_total, attempt.platform_fee_total, attempt.tax_total, attempt.grand_total, attempt.provider, attempt.commerce_mode, input.merchantOfRecord, input.chargeModel],
  );
  for (const line of cart.lines) {
    const lineTotal = Math.round(line.unitPrice * line.quantity * 100) / 100;
    const fee = Math.round(lineTotal * 0.025 * 100) / 100;
    await transaction.query(
      `INSERT INTO commerce_order_lines(id,order_id,listing_id,seller_id,product_name,vendor_name,quantity,unit_price,platform_fee,line_total)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [newId("orderline"), orderId, line.listingId, line.sellerId, line.name, line.vendor, line.quantity, line.unitPrice, fee, lineTotal],
    );
    for (const [entryType, amount] of [["customer_charge", lineTotal], ["seller_payable", lineTotal - fee], ["platform_fee", fee]] as const) {
      await transaction.query(
        `INSERT INTO commerce_ledger_entries(id,order_id,seller_id,entry_type,amount,direction,reference_type,reference_id,root_event_id)
         VALUES($1,$2,$3,$4,$5,'credit','payment',$6,$7)`,
        [newId("ledger"), orderId, line.sellerId, entryType, amount, input.providerPaymentId, rootEventId],
      );
    }
    await transaction.query(`UPDATE commerce_inventory SET available=GREATEST(0,available-$2),reserved=GREATEST(0,reserved-$2),version=version+1,updated_at=NOW() WHERE listing_id=$1`, [line.listingId, line.quantity]);
  }
  for (const [entryType, amount] of [["shipping", Number(attempt.shipping_total)], ["tax", Number(attempt.tax_total)], ["platform_checkout_fee", Number(attempt.platform_fee_total)]] as const) {
    await transaction.query(
      `INSERT INTO commerce_ledger_entries(id,order_id,entry_type,amount,direction,reference_type,reference_id,root_event_id)
       VALUES($1,$2,$3,$4,'credit','payment',$5,$6)`,
      [newId("ledger"), orderId, entryType, amount, input.providerPaymentId, rootEventId],
    );
  }
  for (const sellerId of [...new Set(cart.lines.map((line) => line.sellerId))]) {
    await transaction.query(`INSERT INTO commerce_shipments(id,order_id,seller_id,status) VALUES($1,$2,$3,'pending')`, [newId("shipment"), orderId, sellerId]);
  }
  await transaction.query(`UPDATE commerce_inventory_reservations SET status='consumed' WHERE cart_id=$1 AND status='active'`, [cart.id]);
  await transaction.query(`UPDATE commerce_carts SET status='converted',updated_at=NOW() WHERE id=$1`, [cart.id]);
  return { orderId, status: "succeeded", reused: false };
}

export async function finalizePreparedCheckout(input: {
  attemptId: string;
  providerPaymentId: string;
  chargeModel: "direct" | "platform_separate";
  merchantOfRecord: "seller" | "platform";
}) {
  return withTransaction((transaction) => finalizePreparedCheckoutInTransaction(transaction, input));
}

export async function failPreparedCheckoutInTransaction(transaction: SqlConnection, input: { attemptId: string; reason: string }) {
  const attempt = (await transaction.query<QueryResultRow & { cart_id: string; status: string }>(`SELECT cart_id,status FROM commerce_checkout_attempts WHERE id=$1 FOR UPDATE`, [input.attemptId])).rows[0];
  if (!attempt || attempt.status === "succeeded") return { released: 0 };
  const reservations = await transaction.query<QueryResultRow & { listing_id: string; quantity: number }>(
    `SELECT listing_id,quantity FROM commerce_inventory_reservations WHERE cart_id=$1 AND status='active' FOR UPDATE`,
    [attempt.cart_id],
  );
  for (const reservation of reservations.rows) {
    await transaction.query(`UPDATE commerce_inventory SET reserved=GREATEST(0,reserved-$2),version=version+1,updated_at=NOW() WHERE listing_id=$1`, [reservation.listing_id, reservation.quantity]);
  }
  await transaction.query(`UPDATE commerce_inventory_reservations SET status='released' WHERE cart_id=$1 AND status='active'`, [attempt.cart_id]);
  await transaction.query(`UPDATE commerce_checkout_attempts SET status='failed',failure_reason=$2,completed_at=NOW() WHERE id=$1`, [input.attemptId, input.reason]);
  return { released: reservations.rows.length };
}

export async function createSandboxCheckout(input: {
  customerKey: string;
  email: string;
  address: { line1: string; city: string; region: string; postalCode: string };
  idempotencyKey: string;
  paymentOverride?: { id: string; status: "succeeded" };
  commerceMode?: "sandbox" | "test" | "live";
  provider?: string;
  activationDecisionId?: string;
  chargeModel?: "direct" | "platform_separate";
  merchantOfRecord?: "seller" | "platform";
}) {
  return withTransaction(async (transaction) => {
    await seedCommerce(transaction);
    const existing = (await transaction.query<QueryResultRow & { id: string; status: string }>(
      `SELECT id, status FROM commerce_checkout_attempts WHERE idempotency_key = $1`,
      [input.idempotencyKey],
    )).rows[0];
    if (existing) {
      const order = (await transaction.query<QueryResultRow & { id: string }>(`SELECT id FROM commerce_orders WHERE checkout_attempt_id = $1`, [existing.id])).rows[0];
      return { orderId: order?.id, status: existing.status, reused: true };
    }

    const cartRow = (await transaction.query<QueryResultRow & { id: string }>(
      `SELECT id FROM commerce_carts WHERE customer_key = $1 AND status = 'open' ORDER BY created_at DESC LIMIT 1`,
      [input.customerKey],
    )).rows[0];
    if (!cartRow) throw new Error("Cart is empty");
    const cart = summarizeCart(cartRow.id, input.customerKey, await loadCartLines(transaction, cartRow.id));
    if (!cart.eligible) throw new Error(cart.issues[0] ?? "Cart is not eligible");

    const riskRules: string[] = [];
    let riskScore = 8;
    if (cart.total > 500) { riskScore += 35; riskRules.push("high_order_value"); }
    if (cart.lines.reduce((sum, line) => sum + line.quantity, 0) > 8) { riskScore += 25; riskRules.push("high_item_count"); }
    if (!input.email.includes("@")) { riskScore += 60; riskRules.push("invalid_email"); }
    if (input.address.postalCode.length < 4) { riskScore += 30; riskRules.push("weak_postal_code"); }
    const riskOutcome = riskScore >= 70 ? "block" : riskScore >= 40 ? "review" : "allow";
    if (riskOutcome === "block") throw new Error("Sandbox risk controls blocked this checkout");

    for (const line of cart.lines) {
      const inventory = (await transaction.query<QueryResultRow & { available: number; reserved: number }>(
        `SELECT available,reserved FROM commerce_inventory WHERE listing_id=$1 FOR UPDATE`, [line.listingId],
      )).rows[0];
      if (!inventory || Number(inventory.available) - Number(inventory.reserved) < line.quantity) throw new Error(`${line.name} has insufficient sandbox inventory`);
      await transaction.query(`UPDATE commerce_inventory SET reserved=reserved+$2,version=version+1,updated_at=NOW() WHERE listing_id=$1`, [line.listingId,line.quantity]);
      await transaction.query(`INSERT INTO commerce_inventory_reservations(id,cart_id,listing_id,quantity,expires_at) VALUES($1,$2,$3,$4,NOW()+INTERVAL '20 minutes')`, [newId("reservation"),cart.id,line.listingId,line.quantity]);
    }

    const attemptId = newId("checkout");
    await transaction.query(
      `INSERT INTO commerce_checkout_attempts
       (id, cart_id, idempotency_key, customer_email, shipping_address, subtotal, shipping_total, platform_fee_total, tax_total, grand_total, commerce_mode, provider, activation_decision_id)
       VALUES($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [attemptId, cart.id, input.idempotencyKey, input.email, JSON.stringify(input.address), cart.subtotal, cart.shipping, cart.platformFee, cart.tax, cart.total, input.commerceMode ?? "sandbox", input.provider ?? "mock_connect", input.activationDecisionId ?? null],
    );
    await transaction.query(`INSERT INTO commerce_tax_calculations(id,checkout_attempt_id,provider,jurisdiction,taxable_amount,rate,tax_amount) VALUES($1,$2,'vial_tax_sandbox_v1',$3,$4,0.07,$5)`, [newId("tax"),attemptId,input.address.region || "US-SANDBOX",cart.subtotal,cart.tax]);
    await transaction.query(`INSERT INTO commerce_risk_assessments(id,cart_id,checkout_attempt_id,score,outcome,rules) VALUES($1,$2,$3,$4,$5,$6::jsonb)`, [newId("risk"),cart.id,attemptId,Math.min(riskScore,100),riskOutcome,JSON.stringify(riskRules)]);

    const payment = input.paymentOverride ?? await getPaymentProvider().createPayment({ amount: Math.round(cart.total * 100), currency: "USD", idempotencyKey: input.idempotencyKey, metadata: { cartId: cart.id } });
    const orderId = newId("order");
    const rootEventId = newId("commerce");
    await transaction.query(`UPDATE commerce_checkout_attempts SET status = 'succeeded', processor_payment_id = $2, completed_at = NOW() WHERE id = $1`, [attemptId, payment.id]);
    await transaction.query(
      `INSERT INTO commerce_orders(id, checkout_attempt_id, customer_key, customer_email, subtotal, shipping_total, platform_fee_total, tax_total, grand_total, provider, commerce_mode, merchant_of_record, charge_model)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [orderId, attemptId, input.customerKey, input.email, cart.subtotal, cart.shipping, cart.platformFee, cart.tax, cart.total, input.provider ?? "mock_connect", input.commerceMode ?? "sandbox", input.merchantOfRecord ?? "platform", input.chargeModel ?? "platform_separate"],
    );

    for (const line of cart.lines) {
      const lineTotal = line.unitPrice * line.quantity;
      const fee = Math.round(lineTotal * 0.025 * 100) / 100;
      await transaction.query(
        `INSERT INTO commerce_order_lines
         (id, order_id, listing_id, seller_id, product_name, vendor_name, quantity, unit_price, platform_fee, line_total)
         VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [newId("orderline"), orderId, line.listingId, line.sellerId, line.name, line.vendor, line.quantity, line.unitPrice, fee, lineTotal],
      );
      for (const [entryType, amount] of [["customer_charge", lineTotal], ["seller_payable", lineTotal - fee], ["platform_fee", fee]] as const) {
        await transaction.query(
          `INSERT INTO commerce_ledger_entries(id, order_id, seller_id, entry_type, amount, direction, reference_type, reference_id, root_event_id)
           VALUES($1, $2, $3, $4, $5, 'credit', 'payment', $6, $7)`,
          [newId("ledger"), orderId, line.sellerId, entryType, amount, payment.id, rootEventId],
        );
      }
    }
    for (const [entryType, amount] of [["shipping", cart.shipping], ["tax", cart.tax], ["platform_checkout_fee", cart.platformFee]] as const) {
      await transaction.query(
        `INSERT INTO commerce_ledger_entries(id, order_id, entry_type, amount, direction, reference_type, reference_id, root_event_id)
         VALUES($1, $2, $3, $4, 'credit', 'payment', $5, $6)`,
        [newId("ledger"), orderId, entryType, amount, payment.id, rootEventId],
      );
    }
    const sellers = [...new Set(cart.lines.map((line) => line.sellerId))];
    for (const sellerId of sellers) {
      await transaction.query(`INSERT INTO commerce_shipments(id,order_id,seller_id,status) VALUES($1,$2,$3,'pending')`, [newId("shipment"),orderId,sellerId]);
    }
    for (const line of cart.lines) {
      await transaction.query(`UPDATE commerce_inventory SET available=GREATEST(0,available-$2),reserved=GREATEST(0,reserved-$2),version=version+1,updated_at=NOW() WHERE listing_id=$1`, [line.listingId,line.quantity]);
    }
    await transaction.query(`UPDATE commerce_inventory_reservations SET status='consumed' WHERE cart_id=$1 AND status='active'`, [cart.id]);
    await transaction.query(`INSERT INTO commerce_webhook_events(id,provider,provider_event_id,event_type,payload,status,processed_at,signature_verified,livemode) VALUES($1,$4,$2,'payment_intent.succeeded',$3::jsonb,'processed',NOW(),TRUE,$5) ON CONFLICT(provider_event_id) DO NOTHING`, [newId("webhook"),`evt_${payment.id}`,JSON.stringify({paymentId:payment.id,orderId}),input.provider ?? "mock_connect",(input.commerceMode ?? "sandbox") === "live"]);
    await transaction.query(`UPDATE commerce_carts SET status = 'converted', updated_at = NOW() WHERE id = $1`, [cart.id]);
    return { orderId, status: "succeeded", reused: false, riskOutcome };
  });
}

export async function getOrder(orderId: string) {
  await ensureCommerceSeed();
  const normalizedOrderId = decodeURIComponent(orderId);
  const database = await getDatabase();
  const order = (await database.query<QueryResultRow & Record<string, unknown>>(`SELECT * FROM commerce_orders WHERE id = $1`, [normalizedOrderId])).rows[0];
  if (!order) return null;
  const lines = (await database.query<QueryResultRow & Record<string, unknown>>(`SELECT * FROM commerce_order_lines WHERE order_id = $1 ORDER BY created_at`, [normalizedOrderId])).rows;
  return { order, lines };
}

export async function getOrderForCustomer(orderId: string, customerKey: string) {
  const data = await getOrder(orderId);
  if (!data || String((data.order as Record<string, unknown>).customer_key) !== customerKey) return null;
  return data;
}

export async function listOrders(customerKey?: string) {
  await ensureCommerceSeed();
  const database = await getDatabase();
  const result = await database.query<QueryResultRow & Record<string, unknown>>(
    `SELECT o.*, COUNT(ol.id)::int AS line_count, MIN(ol.vendor_name) AS vendor_name
     FROM commerce_orders o
     LEFT JOIN commerce_order_lines ol ON ol.order_id = o.id
     ${customerKey ? "WHERE o.customer_key = $1" : ""}
     GROUP BY o.id
     ORDER BY o.created_at DESC`,
    customerKey ? [customerKey] : [],
  );
  return result.rows;
}

export async function commerceDashboard() {
  await ensureCommerceSeed();
  const database = await getDatabase();
  const [sellers, eligibility, orders, ledger, disputes] = await Promise.all([
    database.query(`SELECT cs.*, o.display_name, o.slug FROM commerce_sellers cs JOIN organizations o ON o.id = cs.organization_id ORDER BY o.display_name`),
    database.query(`SELECT e.*, l.slug, p.name, o.display_name FROM commerce_listing_eligibility e JOIN listings l ON l.id = e.listing_id JOIN products p ON p.id = l.product_id JOIN organizations o ON o.id = p.vendor_id ORDER BY e.state, p.name`),
    database.query(`SELECT o.*, COUNT(ol.id)::int AS line_count FROM commerce_orders o LEFT JOIN commerce_order_lines ol ON ol.order_id = o.id GROUP BY o.id ORDER BY o.created_at DESC`),
    database.query(`SELECT * FROM commerce_ledger_entries ORDER BY created_at DESC LIMIT 100`),
    database.query(`SELECT * FROM commerce_disputes ORDER BY created_at DESC`),
  ]);
  return { sellers: sellers.rows, eligibility: eligibility.rows, orders: orders.rows, ledger: ledger.rows, disputes: disputes.rows };
}

export async function getCheckoutStatusForCustomer(attemptId: string, customerKey: string) {
  await ensureCommerceSeed();
  const database = await getDatabase();
  const row = (await database.query<QueryResultRow & Record<string, unknown>>(
    `SELECT ca.id,ca.status,ca.failure_reason,ca.processor_payment_id,ca.completed_at,o.id order_id,o.status order_status
     FROM commerce_checkout_attempts ca
     JOIN commerce_carts c ON c.id=ca.cart_id
     LEFT JOIN commerce_orders o ON o.checkout_attempt_id=ca.id
     WHERE ca.id=$1 AND c.customer_key=$2`,
    [attemptId, customerKey],
  )).rows[0];
  return row ?? null;
}
