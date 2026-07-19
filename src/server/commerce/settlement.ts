import type { QueryResultRow } from "pg";
import { getDatabase, withTransaction, type SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { getPaymentProcessor } from "./providers";

function money(value: unknown) {
  return Math.round(Number(value ?? 0) * 100) / 100;
}

function reservePercentForTier(tier: string) {
  if (tier === "high") return 0.25;
  if (tier === "elevated") return 0.15;
  if (tier === "standard") return 0.1;
  return 0;
}

export async function allocateOrderSettlementInTransaction(transaction: SqlConnection, orderId: string) {
  const provider = getPaymentProcessor();
    const order = (await transaction.query<QueryResultRow & { id: string; charge_model: string; provider: string; commerce_mode: string; checkout_attempt_id: string }>(
      `SELECT id,charge_model,provider,commerce_mode,checkout_attempt_id FROM commerce_orders WHERE id=$1 FOR UPDATE`, [orderId],
    )).rows[0];
    if (!order) throw new Error("Order not found");
    const payment = (await transaction.query<QueryResultRow & { provider_payment_id: string; transfer_group: string | null }>(
      `SELECT provider_payment_id,transfer_group FROM commerce_provider_payment_intents WHERE checkout_attempt_id=$1`, [order.checkout_attempt_id],
    )).rows[0];
    if (!payment) throw new Error("Provider payment was not recorded");
    const lines = await transaction.query<QueryResultRow & { seller_id: string; payable: string | number; processor_account_id: string; risk_tier: string }>(
      `SELECT ol.seller_id,SUM(ol.line_total-ol.platform_fee) payable,pa.provider_account_id,pa.risk_tier
       FROM commerce_order_lines ol JOIN commerce_provider_accounts pa ON pa.seller_id=ol.seller_id
       WHERE ol.order_id=$1 GROUP BY ol.seller_id,pa.provider_account_id,pa.risk_tier ORDER BY ol.seller_id`,
      [orderId],
    );
    const allocations = [];
    for (const line of lines.rows) {
      const grossPayable = money(line.payable);
      const reservePercent = order.charge_model === "platform_separate" ? reservePercentForTier(line.risk_tier) : 0;
      const reserveAmount = money(grossPayable * reservePercent);
      const transferable = money(grossPayable - reserveAmount);
      if (reserveAmount > 0) {
        const reserveId = newId("reserve");
        const inserted = await transaction.query<QueryResultRow & { id: string }>(
          `INSERT INTO commerce_reserve_holds(id,order_id,seller_id,amount,reserve_percent,status,reason,release_at)
           VALUES($1,$2,$3,$4,$5,'held','risk-tier rolling reserve',NOW()+INTERVAL '30 days')
           ON CONFLICT(order_id,seller_id) WHERE order_id IS NOT NULL DO NOTHING
           RETURNING id`,
          [reserveId, orderId, line.seller_id, reserveAmount, reservePercent],
        );
        if (inserted.rows[0]) {
          await transaction.query(
            `INSERT INTO commerce_ledger_entries(id,order_id,seller_id,entry_type,amount,direction,reference_type,reference_id,root_event_id)
             VALUES($1,$2,$3,'reserve_hold',$4,'debit','reserve',$5,$6)`,
            [newId("ledger"), orderId, line.seller_id, reserveAmount, reserveId, newId("settlement-root")],
          );
        }
      }
      if (order.charge_model === "platform_separate" && transferable > 0) {
        const transfer = await provider.createTransfer({
          amount: Math.round(transferable * 100),
          currency: "USD",
          destinationAccountId: line.processor_account_id,
          sourcePaymentId: payment.provider_payment_id,
          transferGroup: payment.transfer_group ?? undefined,
          idempotencyKey: `transfer:${orderId}:${line.seller_id}`,
        });
        await transaction.query(
          `INSERT INTO commerce_provider_transfers(id,order_id,seller_id,provider,mode,provider_transfer_id,source_payment_id,transfer_group,amount,status)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT(provider_transfer_id) DO NOTHING`,
          [newId("transfer"), orderId, line.seller_id, order.provider, order.commerce_mode, transfer.providerTransferId, payment.provider_payment_id, payment.transfer_group, transferable, transfer.status],
        );
      }
      allocations.push({ sellerId: line.seller_id, grossPayable, reserveAmount, transferable, transferred: order.charge_model === "platform_separate" });
    }
    return allocations;

}

export async function allocateOrderSettlement(orderId: string) {
  return withTransaction((transaction) => allocateOrderSettlementInTransaction(transaction, orderId));
}
export async function releaseDueReserves(actorId: string) {
  const database = await getDatabase();
  const result = await database.query<QueryResultRow & { id: string; seller_id: string; order_id: string | null; amount: string | number }>(
    `SELECT id,seller_id,order_id,amount FROM commerce_reserve_holds WHERE status='held' AND release_at<=NOW() ORDER BY release_at`,
  );
  for (const hold of result.rows) {
    await withTransaction(async (transaction) => {
      await transaction.query(`UPDATE commerce_reserve_holds SET status='released',released_at=NOW() WHERE id=$1 AND status='held'`, [hold.id]);
      await transaction.query(
        `INSERT INTO commerce_ledger_entries(id,order_id,seller_id,entry_type,amount,direction,reference_type,reference_id,root_event_id)
         VALUES($1,$2,$3,'reserve_release',$4,'credit','reserve',$5,$6)`,
        [newId("ledger"), hold.order_id, hold.seller_id, money(hold.amount), hold.id, newId("reserve-release")],
      );
    });
  }
  return { released: result.rows.length, actorId };
}

export async function runV5Settlement(input: { actorId: string; periodStart?: string; periodEnd?: string }) {
  const provider = getPaymentProcessor();
  return withTransaction(async (transaction) => {
    const start = input.periodStart ?? "1970-01-01T00:00:00.000Z";
    const end = input.periodEnd ?? new Date().toISOString();
    const orders = money((await transaction.query<QueryResultRow & { total: string | number }>(
      `SELECT COALESCE(SUM(grand_total),0) total FROM commerce_orders WHERE created_at>=$1 AND created_at<=$2`, [start, end],
    )).rows[0]?.total);
    const refunds = money((await transaction.query<QueryResultRow & { total: string | number }>(
      `SELECT COALESCE(SUM(amount),0) total FROM commerce_refunds WHERE created_at>=$1 AND created_at<=$2 AND status IN ('sandbox_succeeded','succeeded')`, [start, end],
    )).rows[0]?.total);
    const disputes = money((await transaction.query<QueryResultRow & { total: string | number }>(
      `SELECT COALESCE(SUM(amount),0) total FROM commerce_disputes WHERE created_at>=$1 AND created_at<=$2 AND status NOT IN ('won','closed')`, [start, end],
    )).rows[0]?.total);
    const reserves = money((await transaction.query<QueryResultRow & { total: string | number }>(
      `SELECT COALESCE(SUM(amount),0) total FROM commerce_reserve_holds WHERE created_at>=$1 AND created_at<=$2 AND status='held'`, [start, end],
    )).rows[0]?.total);
    const sellerPayable = money((await transaction.query<QueryResultRow & { total: string | number }>(
      `SELECT COALESCE(SUM(amount),0) total FROM commerce_ledger_entries WHERE entry_type='seller_payable' AND created_at>=$1 AND created_at<=$2`, [start, end],
    )).rows[0]?.total);
    const platformRevenue = money((await transaction.query<QueryResultRow & { total: string | number }>(
      `SELECT COALESCE(SUM(amount),0) total FROM commerce_ledger_entries WHERE entry_type IN ('platform_fee','platform_checkout_fee') AND created_at>=$1 AND created_at<=$2`, [start, end],
    )).rows[0]?.total);
    const passthrough = money((await transaction.query<QueryResultRow & { total: string | number }>(
      `SELECT COALESCE(SUM(amount),0) total FROM commerce_ledger_entries WHERE entry_type IN ('shipping','tax') AND created_at>=$1 AND created_at<=$2`, [start, end],
    )).rows[0]?.total);
    const expectedNet = money(orders - refunds - disputes);
    const allocated = money(sellerPayable + platformRevenue + passthrough - refunds - disputes);
    const variance = money(expectedNet - allocated);
    const id = newId("settlement");
    const issueCount = Math.abs(variance) > 0.01 ? 1 : 0;
    await transaction.query(
      `INSERT INTO commerce_settlement_runs(id,provider,mode,status,period_start,period_end,gross_amount,refund_amount,dispute_amount,reserve_amount,seller_payable,platform_revenue,variance,issue_count,details,completed_at)
       VALUES($1,$2,$3,'completed',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,NOW())`,
      [id, provider.provider, provider.mode, start, end, orders, refunds, disputes, reserves, sellerPayable, platformRevenue, variance, issueCount, JSON.stringify({ actorId: input.actorId, passthrough, expectedNet, equation: "net gross = seller payable + platform revenue + shipping + tax - refunds - open disputes; reserves are a hold within seller payable" })],
    );
    return { id, grossAmount: orders, refundAmount: refunds, disputeAmount: disputes, reserveAmount: reserves, sellerPayable, platformRevenue, variance, issueCount };
  });
}
