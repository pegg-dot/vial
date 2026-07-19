import type { QueryResultRow } from "pg";
import { type SqlConnection, withTransaction } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { failPreparedCheckoutInTransaction, finalizePreparedCheckoutInTransaction } from "./repository";
import { allocateOrderSettlementInTransaction } from "./settlement";
import { getPaymentProcessor } from "./providers";
import type { VerifiedProviderEvent } from "./types";

function objectId(payload: unknown) {
  if (payload && typeof payload === "object" && "id" in payload) return String((payload as { id?: unknown }).id ?? "");
  return "";
}

function jsonArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

async function processVerifiedEvent(transaction: SqlConnection, event: VerifiedProviderEvent, providerName: string) {
  const id = objectId(event.payload);
  if (event.type === "payment_intent.succeeded") {
    const payment = (await transaction.query<QueryResultRow & {
      checkout_attempt_id: string | null;
      charge_model: "direct" | "platform_separate";
      merchant_of_record: "seller" | "platform";
    }>(
      `SELECT checkout_attempt_id,charge_model,merchant_of_record FROM commerce_provider_payment_intents WHERE provider_payment_id=$1 FOR UPDATE`,
      [id],
    )).rows[0];
    await transaction.query(`UPDATE commerce_provider_payment_intents SET status='succeeded',updated_at=NOW() WHERE provider_payment_id=$1`, [id]);
    if (!payment?.checkout_attempt_id) return { orderId: null, paymentIntentId: id };
    const finalized = await finalizePreparedCheckoutInTransaction(transaction, {
      attemptId: payment.checkout_attempt_id,
      providerPaymentId: id,
      chargeModel: payment.charge_model,
      merchantOfRecord: payment.merchant_of_record,
    });
    if (finalized.orderId) await allocateOrderSettlementInTransaction(transaction, finalized.orderId);
    return { orderId: finalized.orderId, paymentIntentId: id };
  }

  if (event.type === "payment_intent.payment_failed") {
    const payment = (await transaction.query<QueryResultRow & { checkout_attempt_id: string | null }>(
      `SELECT checkout_attempt_id FROM commerce_provider_payment_intents WHERE provider_payment_id=$1 FOR UPDATE`,
      [id],
    )).rows[0];
    await transaction.query(`UPDATE commerce_provider_payment_intents SET status='failed',updated_at=NOW() WHERE provider_payment_id=$1`, [id]);
    if (payment?.checkout_attempt_id) await failPreparedCheckoutInTransaction(transaction, { attemptId: payment.checkout_attempt_id, reason: "provider_payment_failed" });
    return { orderId: null, paymentIntentId: id };
  }

  if (event.type === "account.updated" && event.connectedAccountId) {
    const payload = event.payload as Record<string, unknown>;
    const requirements = (payload.requirements && typeof payload.requirements === "object" ? payload.requirements : {}) as Record<string, unknown>;
    await transaction.query(
      `UPDATE commerce_provider_accounts SET
         charges_enabled=COALESCE($2,charges_enabled),payouts_enabled=COALESCE($3,payouts_enabled),
         transfers_enabled=COALESCE($4,transfers_enabled),details_submitted=COALESCE($5,details_submitted),
         requirements_currently_due=$6::jsonb,requirements_eventually_due=$7::jsonb,requirements_past_due=$8::jsonb,
         capabilities=$9::jsonb,disabled_reason=$10,last_synced_at=NOW(),updated_at=NOW()
       WHERE provider_account_id=$1`,
      [
        event.connectedAccountId,
        typeof payload.charges_enabled === "boolean" ? payload.charges_enabled : null,
        typeof payload.payouts_enabled === "boolean" ? payload.payouts_enabled : null,
        payload.capabilities && typeof payload.capabilities === "object" ? (payload.capabilities as Record<string, unknown>).transfers === "active" : null,
        typeof payload.details_submitted === "boolean" ? payload.details_submitted : null,
        JSON.stringify(jsonArray(requirements.currently_due)),
        JSON.stringify(jsonArray(requirements.eventually_due)),
        JSON.stringify(jsonArray(requirements.past_due)),
        JSON.stringify(payload.capabilities && typeof payload.capabilities === "object" ? payload.capabilities : {}),
        typeof requirements.disabled_reason === "string" ? requirements.disabled_reason : null,
      ],
    );
    return { accountId: event.connectedAccountId };
  }

  if (event.type === "charge.dispute.created") {
    const payload = event.payload as Record<string, unknown>;
    const paymentIntent = String(payload.payment_intent ?? "");
    const amount = Number(payload.amount ?? 0) / 100;
    const order = (await transaction.query<QueryResultRow & { id: string; merchant_of_record: string }>(
      `SELECT o.id,o.merchant_of_record FROM commerce_orders o
       JOIN commerce_provider_payment_intents pi ON pi.checkout_attempt_id=o.checkout_attempt_id
       WHERE pi.provider_payment_id=$1`,
      [paymentIntent],
    )).rows[0];
    if (order) {
      await transaction.query(
        `INSERT INTO commerce_disputes(id,order_id,amount,reason,status,provider,provider_dispute_id,liability,evidence_due_at)
         VALUES($1,$2,$3,$4,'needs_response',$5,$6,$7,NOW()+INTERVAL '7 days')`,
        [newId("dispute"), order.id, amount, String(payload.reason ?? "provider dispute"), providerName, id, order.merchant_of_record],
      );
      await transaction.query(`UPDATE commerce_orders SET status='disputed',updated_at=NOW() WHERE id=$1`, [order.id]);
    }
    return { disputeId: id, orderId: order?.id ?? null };
  }

  return { ignored: true, type: event.type };
}

export async function ingestProviderWebhook(input: { payload: string | Buffer; signature?: string; secret?: string }) {
  const provider = getPaymentProcessor();
  const event = await provider.verifyWebhook(input);
  return withTransaction(async (transaction) => {
    const recordId = newId("provider-event");
    const inserted = await transaction.query(
      `INSERT INTO commerce_webhook_events(id,provider,provider_event_id,event_type,payload,status,signature_verified,livemode,connected_account_id,api_version)
       VALUES($1,$2,$3,$4,$5::jsonb,'received',TRUE,$6,$7,$8)
       ON CONFLICT(provider_event_id) DO NOTHING RETURNING id`,
      [recordId, provider.provider, event.providerEventId, event.type, JSON.stringify(event.payload), event.livemode, event.connectedAccountId ?? null, event.apiVersion ?? null],
    );
    if (Number(inserted.rowCount ?? 0) === 0) return { duplicate: true, eventId: event.providerEventId, processed: false };
    try {
      const result = await processVerifiedEvent(transaction, event, provider.provider);
      await transaction.query(`UPDATE commerce_webhook_events SET status='processed',processed_at=NOW() WHERE id=$1`, [recordId]);
      return { duplicate: false, eventId: event.providerEventId, processed: true, type: event.type, result };
    } catch (error) {
      await transaction.query(
        `UPDATE commerce_webhook_events SET status='failed',processing_error=$2,processed_at=NOW() WHERE id=$1`,
        [recordId, error instanceof Error ? error.message : "Provider event failed"],
      );
      throw error;
    }
  });
}

export async function replayProviderEvent(id: string) {
  const provider = getPaymentProcessor();
  return withTransaction(async (transaction) => {
    const row = (await transaction.query<QueryResultRow & {
      provider_event_id: string;
      event_type: string;
      payload: unknown;
      signature_verified: boolean;
      livemode: boolean;
      connected_account_id: string | null;
      api_version: string | null;
    }>(`SELECT * FROM commerce_webhook_events WHERE id=$1 FOR UPDATE`, [id])).rows[0];
    if (!row) throw new Error("Provider event not found");
    if (!row.signature_verified) throw new Error("Unverified provider events cannot be replayed");
    await transaction.query(`UPDATE commerce_webhook_events SET status='replaying',processed_at=NULL,processing_error=NULL WHERE id=$1`, [id]);
    try {
      const result = await processVerifiedEvent(transaction, {
        providerEventId: row.provider_event_id,
        type: row.event_type,
        payload: row.payload,
        livemode: row.livemode,
        connectedAccountId: row.connected_account_id ?? undefined,
        apiVersion: row.api_version ?? undefined,
      }, provider.provider);
      await transaction.query(`UPDATE commerce_webhook_events SET status='processed',processed_at=NOW() WHERE id=$1`, [id]);
      return { id, providerEventId: row.provider_event_id, type: row.event_type, status: "processed", result };
    } catch (error) {
      await transaction.query(`UPDATE commerce_webhook_events SET status='failed',processing_error=$2,processed_at=NOW() WHERE id=$1`, [id, error instanceof Error ? error.message : "Replay failed"]);
      throw error;
    }
  });
}
