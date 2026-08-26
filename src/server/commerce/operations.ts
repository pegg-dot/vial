import type { QueryResultRow } from "pg";
import { notifyOrderShipped } from "@/server/notifications/order-alerts";
import { getDatabase, withTransaction } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { getPaymentProvider } from "./provider";
import { getPaymentProcessor } from "./providers";
import { ensureCommerceSeed, getOrder } from "./repository";

const money = (value: unknown) => Math.round(Number(value ?? 0) * 100) / 100;

export interface TaxQuote {
  provider: string;
  jurisdiction: string;
  taxableAmount: number;
  rate: number;
  taxAmount: number;
}

export function calculateSandboxTax(input: { subtotal: number; shipping: number; region: string }): TaxQuote {
  const rates: Record<string, number> = { FL: 0.07, NY: 0.08875, CA: 0.0825, TX: 0.0625 };
  const region = input.region.trim().toUpperCase() || "US-SANDBOX";
  const rate = rates[region] ?? 0.07;
  const taxableAmount = money(input.subtotal);
  return { provider: "vial_tax_sandbox_v1", jurisdiction: region, taxableAmount, rate, taxAmount: money(taxableAmount * rate) };
}

export function assessSandboxRisk(input: { total: number; email: string; postalCode: string; lineCount: number }) {
  const rules: string[] = [];
  let score = 8;
  if (input.total > 500) { score += 35; rules.push("high_order_value"); }
  if (input.lineCount > 8) { score += 25; rules.push("high_item_count"); }
  if (!input.email.includes("@")) { score += 60; rules.push("invalid_email"); }
  if (input.postalCode.length < 4) { score += 30; rules.push("weak_postal_code"); }
  const outcome = score >= 70 ? "block" : score >= 40 ? "review" : "allow";
  return { score: Math.min(score, 100), outcome, rules };
}

export async function reserveInventoryForCart(cartId: string) {
  await ensureCommerceSeed();
  return withTransaction(async (tx) => {
    await tx.query(`DELETE FROM commerce_inventory_reservations WHERE cart_id = $1 AND status = 'active'`, [cartId]);
    const lines = await tx.query<QueryResultRow & { listing_id: string; seller_id: string; quantity: number }>(
      `SELECT listing_id, seller_id, quantity FROM commerce_cart_lines WHERE cart_id = $1`, [cartId],
    );
    for (const line of lines.rows) {
      await tx.query(
        `INSERT INTO commerce_inventory(listing_id, seller_id, available, reserved)
         VALUES($1,$2,25,0) ON CONFLICT(listing_id) DO NOTHING`, [line.listing_id, line.seller_id],
      );
      const inventory = (await tx.query<QueryResultRow & { available: number; reserved: number }>(
        `SELECT available, reserved FROM commerce_inventory WHERE listing_id = $1 FOR UPDATE`, [line.listing_id],
      )).rows[0];
      if (!inventory || Number(inventory.available) - Number(inventory.reserved) < Number(line.quantity)) {
        throw new Error("Insufficient sandbox inventory");
      }
      await tx.query(`UPDATE commerce_inventory SET reserved = reserved + $2, version = version + 1, updated_at = NOW() WHERE listing_id = $1`, [line.listing_id, line.quantity]);
      await tx.query(
        `INSERT INTO commerce_inventory_reservations(id,cart_id,listing_id,quantity,expires_at)
         VALUES($1,$2,$3,$4,NOW()+INTERVAL '20 minutes')`,
        [newId("reservation"), cartId, line.listing_id, line.quantity],
      );
    }
    return lines.rowCount ?? lines.rows.length;
  });
}

export async function consumeReservations(cartId: string) {
  const db = await getDatabase();
  const rows = await db.query<QueryResultRow & { listing_id: string; quantity: number }>(
    `SELECT listing_id, quantity FROM commerce_inventory_reservations WHERE cart_id=$1 AND status='active'`, [cartId],
  );
  for (const row of rows.rows) {
    await db.query(
      `UPDATE commerce_inventory SET available = GREATEST(0, available-$2), reserved=GREATEST(0,reserved-$2), version=version+1, updated_at=NOW() WHERE listing_id=$1`,
      [row.listing_id, row.quantity],
    );
  }
  await db.query(`UPDATE commerce_inventory_reservations SET status='consumed' WHERE cart_id=$1 AND status='active'`, [cartId]);
}

export async function createReturnRequest(input: { orderId: string; customerKey: string; reason: string; orderLineId?: string }) {
  const order = await getOrder(input.orderId);
  if (!order || String(order.order.customer_key) !== input.customerKey) throw new Error("Order not found");
  const db = await getDatabase();
  const id = newId("return");
  await db.query(
    `INSERT INTO commerce_returns(id,order_id,order_line_id,customer_key,reason) VALUES($1,$2,$3,$4,$5)`,
    [id, input.orderId, input.orderLineId ?? null, input.customerKey, input.reason.slice(0,500)],
  );
  return { id, status: "requested" };
}

export async function reviewReturn(input: { returnId: string; decision: "approved" | "denied"; actor: string }) {
  return withTransaction(async (tx) => {
    const row = (await tx.query<QueryResultRow & { order_id: string; status: string }>(
      `SELECT order_id,status FROM commerce_returns WHERE id=$1 FOR UPDATE`, [input.returnId],
    )).rows[0];
    if (!row) throw new Error("Return not found");
    if (row.status !== "requested") return { id: input.returnId, status: row.status };
    await tx.query(
      `UPDATE commerce_returns SET status=$2,resolution=$3,reviewed_at=NOW(),updated_at=NOW() WHERE id=$1`,
      [input.returnId, input.decision, `${input.decision} by ${input.actor}`],
    );
    return { id: input.returnId, status: input.decision, orderId: row.order_id };
  });
}

export async function createRefund(input: { orderId: string; amount: number; reason: string; actor: string }) {
  return withTransaction(async (tx) => {
    const order = (await tx.query<QueryResultRow & { grand_total: string | number; checkout_attempt_id: string }>(
      `SELECT grand_total,checkout_attempt_id FROM commerce_orders WHERE id=$1 FOR UPDATE`, [input.orderId],
    )).rows[0];
    if (!order) throw new Error("Order not found");
    const prior = await tx.query<QueryResultRow & { total: string | number }>(
      `SELECT COALESCE(SUM(amount),0) total FROM commerce_refunds WHERE order_id=$1 AND status IN ('sandbox_succeeded','succeeded')`, [input.orderId],
    );
    const remaining = money(order.grand_total) - money(prior.rows[0]?.total);
    const amount = money(input.amount);
    if (amount <= 0 || amount > remaining) throw new Error("Refund exceeds refundable balance");
    const payment = (await tx.query<QueryResultRow & { processor_payment_id: string; provider_payment_id: string | null; provider_account_id: string | null; provider: string | null; mode: string | null }>(
      `SELECT ca.processor_payment_id,pi.provider_payment_id,pi.provider_account_id,pi.provider,pi.mode
       FROM commerce_checkout_attempts ca LEFT JOIN commerce_provider_payment_intents pi ON pi.checkout_attempt_id=ca.id
       WHERE ca.id=$1`, [order.checkout_attempt_id],
    )).rows[0];
    if (!payment) throw new Error("Payment record not found");
    let refundId: string;
    let refundStatus: string;
    const currentProvider = getPaymentProcessor();
    if (payment.provider_payment_id && payment.provider === currentProvider.provider) {
      const refund = await currentProvider.refundPayment({
        providerPaymentId: payment.provider_payment_id,
        amount: Math.round(amount * 100),
        reason: input.reason,
        connectedAccountId: payment.provider_account_id ?? undefined,
        idempotencyKey: `refund:${input.orderId}:${money(prior.rows[0]?.total) + amount}`,
      });
      refundId = refund.providerRefundId;
      refundStatus = refund.status === "succeeded" ? "succeeded" : refund.status;
    } else {
      const refund = await getPaymentProvider().refundPayment({ paymentId: payment.processor_payment_id, amount: Math.round(amount * 100), reason: input.reason });
      refundId = refund.id;
      refundStatus = refund.status === "succeeded" ? "sandbox_succeeded" : refund.status;
    }
    const id = newId("refund");
    const root = newId("commerce");
    await tx.query(
      `INSERT INTO commerce_refunds(id,order_id,amount,reason,status,processor_refund_id,created_by,provider,mode)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id,input.orderId,amount,input.reason,refundStatus,refundId,input.actor,payment.provider ?? "mock_connect",payment.mode ?? "sandbox"],
    );
    await tx.query(
      `INSERT INTO commerce_ledger_entries(id,order_id,entry_type,amount,direction,reference_type,reference_id,root_event_id)
       VALUES($1,$2,'refund',$3,'debit','refund',$4,$5)`,
      [newId("ledger"),input.orderId,amount,id,root],
    );
    await tx.query(
      `UPDATE commerce_orders SET status=CASE WHEN $2 >= grand_total THEN 'refunded' ELSE 'partially_refunded' END,updated_at=NOW() WHERE id=$1`,
      [input.orderId, money(prior.rows[0]?.total)+amount],
    );
    return { id, status: refundStatus, amount };
  });
}

export async function createShipment(input: { orderId: string; sellerId: string; carrier: string; trackingCode: string }) {
  const result = await withTransaction(async (db) => {
    const owned = (await db.query(`SELECT 1 FROM commerce_order_lines WHERE order_id=$1 AND seller_id=$2 LIMIT 1`, [input.orderId,input.sellerId])).rows[0];
    if (!owned) throw new Error("Seller order allocation not found");
    const current = (await db.query<QueryResultRow & { id: string; status: string; tracking_code: string | null }>(`SELECT id,status,tracking_code FROM commerce_shipments WHERE order_id=$1 AND seller_id=$2 ORDER BY created_at LIMIT 1 FOR UPDATE`, [input.orderId,input.sellerId])).rows[0];
    if (current?.status === "shipped" && current.tracking_code === input.trackingCode) return { id: current.id, status: "shipped", idempotent: true };
    const id = current?.id ?? newId("shipment");
    if (current) await db.query(`UPDATE commerce_shipments SET carrier=$3,service='sandbox_ground',tracking_code=$4,status='shipped',shipped_at=NOW(),updated_at=NOW() WHERE id=$1 AND seller_id=$2`, [id,input.sellerId,input.carrier,input.trackingCode]);
    else await db.query(`INSERT INTO commerce_shipments(id,order_id,seller_id,carrier,service,tracking_code,status,shipped_at) VALUES($1,$2,$3,$4,'sandbox_ground',$5,'shipped',NOW())`, [id,input.orderId,input.sellerId,input.carrier,input.trackingCode]);
    await db.query(`UPDATE commerce_order_lines SET fulfillment_status='shipped',tracking_code=$3 WHERE order_id=$1 AND seller_id=$2`, [input.orderId,input.sellerId,input.trackingCode]);
    const unshipped = Number((await db.query<QueryResultRow & { count: string | number }>(`SELECT COUNT(*) count FROM commerce_order_lines WHERE order_id=$1 AND fulfillment_status<>'shipped'`, [input.orderId])).rows[0]?.count ?? 0);
    await db.query(`UPDATE commerce_orders SET status=$2,updated_at=NOW() WHERE id=$1`, [input.orderId,unshipped===0?"shipped":"partially_shipped"]);
    return { id, status: "shipped", idempotent: false };
  });
  if (!result.idempotent) await notifyOrderShipped({ orderId: input.orderId, trackingCode: input.trackingCode });
  return result;
}

export async function createSandboxDispute(input: { orderId: string; amount: number; reason: string }) {
  const db = await getDatabase();
  const id = newId("dispute");
  await db.query(`INSERT INTO commerce_disputes(id,order_id,amount,reason,evidence_due_at) VALUES($1,$2,$3,$4,NOW()+INTERVAL '7 days')`, [id,input.orderId,money(input.amount),input.reason]);
  await db.query(`UPDATE commerce_orders SET status='disputed',updated_at=NOW() WHERE id=$1`, [input.orderId]);
  return { id, status: "needs_response" };
}

export async function submitDisputeEvidence(input: { disputeId: string; type: string; content: string; actor: string }) {
  const db = await getDatabase();
  const id = newId("evidence");
  await db.query(`INSERT INTO commerce_dispute_evidence(id,dispute_id,evidence_type,content,submitted_by) VALUES($1,$2,$3,$4,$5)`, [id,input.disputeId,input.type,input.content.slice(0,2000),input.actor]);
  await db.query(`UPDATE commerce_disputes SET status='under_review',updated_at=NOW() WHERE id=$1`, [input.disputeId]);
  return { id, status: "under_review" };
}

export async function recordWebhook(input: { providerEventId: string; eventType: string; payload: unknown }) {
  const db = await getDatabase();
  const id = newId("webhook");
  const result = await db.query(
    `INSERT INTO commerce_webhook_events(id,provider,provider_event_id,event_type,payload,status,processed_at)
     VALUES($1,'mock_connect',$2,$3,$4::jsonb,'processed',NOW()) ON CONFLICT(provider_event_id) DO NOTHING RETURNING id`,
    [id,input.providerEventId,input.eventType,JSON.stringify(input.payload)],
  );
  return { id: result.rows[0]?.id ?? null, duplicate: result.rowCount === 0 };
}

export async function replayWebhook(id: string) {
  const db = await getDatabase();
  const row = (await db.query<QueryResultRow & { id: string }>(`SELECT id FROM commerce_webhook_events WHERE id=$1`, [id])).rows[0];
  if (!row) throw new Error("Webhook not found");
  await db.query(`UPDATE commerce_webhook_events SET status='replayed',processed_at=NOW() WHERE id=$1`, [id]);
  return { id, status: "replayed" };
}

export async function runReconciliation() {
  await ensureCommerceSeed();
  return withTransaction(async (tx) => {
    const expected = money((await tx.query<QueryResultRow & { total: string | number }>(`SELECT COALESCE(SUM(grand_total),0) total FROM commerce_orders`)).rows[0]?.total);
    const refunds = money((await tx.query<QueryResultRow & { total: string | number }>(`SELECT COALESCE(SUM(amount),0) total FROM commerce_refunds WHERE status='sandbox_succeeded'`)).rows[0]?.total);
    const chargeLedger = money((await tx.query<QueryResultRow & { total: string | number }>(`SELECT COALESCE(SUM(amount),0) total FROM commerce_ledger_entries WHERE entry_type IN ('customer_charge','shipping','tax','platform_checkout_fee')`)).rows[0]?.total);
    const observed = money(chargeLedger - refunds);
    const target = money(expected - refunds);
    const variance = money(observed - target);
    const id = newId("recon");
    await tx.query(`INSERT INTO commerce_reconciliation_runs(id,status,provider,expected_amount,observed_amount,variance,issue_count,details,completed_at) VALUES($1,'completed','mock_connect',$2,$3,$4,$5,$6::jsonb,NOW())`, [id,target,observed,variance,Math.abs(variance)>0.01?1:0,JSON.stringify({ordersExpected:expected,refunds})]);
    return { id, expected: target, observed, variance, issueCount: Math.abs(variance)>0.01?1:0 };
  });
}

export async function operationsDashboard() {
  await ensureCommerceSeed();
  const db = await getDatabase();
  const [returns,refunds,shipments,inventory,reservations,webhooks,recon,risk,disputes,evidence,payouts] = await Promise.all([
    db.query(`SELECT * FROM commerce_returns ORDER BY requested_at DESC`),
    db.query(`SELECT * FROM commerce_refunds ORDER BY created_at DESC`),
    db.query(`SELECT * FROM commerce_shipments ORDER BY created_at DESC`),
    db.query(`SELECT i.*,l.slug,p.name,o.display_name FROM commerce_inventory i JOIN listings l ON l.id=i.listing_id JOIN products p ON p.id=l.product_id JOIN organizations o ON o.id=p.vendor_id ORDER BY o.display_name,p.name`),
    db.query(`SELECT * FROM commerce_inventory_reservations ORDER BY created_at DESC`),
    db.query(`SELECT * FROM commerce_webhook_events ORDER BY received_at DESC LIMIT 100`),
    db.query(`SELECT * FROM commerce_reconciliation_runs ORDER BY started_at DESC LIMIT 50`),
    db.query(`SELECT * FROM commerce_risk_assessments ORDER BY created_at DESC LIMIT 100`),
    db.query(`SELECT * FROM commerce_disputes ORDER BY created_at DESC`),
    db.query(`SELECT * FROM commerce_dispute_evidence ORDER BY created_at DESC`),
    db.query(`SELECT * FROM commerce_payouts ORDER BY created_at DESC`),
  ]);
  return {returns:returns.rows,refunds:refunds.rows,shipments:shipments.rows,inventory:inventory.rows,reservations:reservations.rows,webhooks:webhooks.rows,reconciliation:recon.rows,risk:risk.rows,disputes:disputes.rows,disputeEvidence:evidence.rows,payouts:payouts.rows};
}
