import type { QueryResultRow } from "pg";
import { getDatabase, withTransaction } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { evaluateCurrentCart } from "./activation";
import { getFraudProvider, getPaymentProcessor, getTaxProvider } from "./providers";
import { finalizePreparedCheckout, prepareApprovedCheckoutAttempt } from "./repository";
import { allocateOrderSettlement } from "./settlement";

function parseJson<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return value as T;
}

async function findExistingApprovedCheckout(idempotencyKey: string, customerKey: string) {
  const database = await getDatabase();
  const row = (await database.query<QueryResultRow & Record<string, unknown>>(
    `SELECT pi.id payment_intent_id,pi.provider_payment_id,pi.status payment_status,pi.provider,pi.mode,pi.charge_model,pi.merchant_of_record,
            ca.id checkout_attempt_id,ca.status checkout_status,o.id order_id,o.customer_key,
            ad.decision,ad.checks,ad.reason_codes,ad.policy_version,ad.seller_id,ad.listing_id,ad.jurisdiction,ad.customer_type
     FROM commerce_provider_payment_intents pi
     LEFT JOIN commerce_checkout_attempts ca ON ca.id=pi.checkout_attempt_id
     LEFT JOIN commerce_orders o ON o.checkout_attempt_id=ca.id
     LEFT JOIN commerce_activation_decisions ad ON ad.id=ca.activation_decision_id
     WHERE pi.idempotency_key=$1`,
    [idempotencyKey],
  )).rows[0];
  if (!row) return null;
  if (row.customer_key && String(row.customer_key) !== customerKey) throw new Error("Idempotency key is already associated with another customer");
  const [tax, fraud, transfers, reserves] = await Promise.all([
    row.checkout_attempt_id ? database.query(`SELECT * FROM commerce_tax_transactions WHERE checkout_attempt_id=$1 ORDER BY created_at DESC LIMIT 1`, [row.checkout_attempt_id]) : Promise.resolve({ rows: [] }),
    row.checkout_attempt_id ? database.query(`SELECT * FROM commerce_fraud_decisions WHERE checkout_attempt_id=$1 ORDER BY created_at DESC LIMIT 1`, [row.checkout_attempt_id]) : Promise.resolve({ rows: [] }),
    row.order_id ? database.query(`SELECT * FROM commerce_provider_transfers WHERE order_id=$1 ORDER BY seller_id`, [row.order_id]) : Promise.resolve({ rows: [] }),
    row.order_id ? database.query(`SELECT * FROM commerce_reserve_holds WHERE order_id=$1 ORDER BY seller_id`, [row.order_id]) : Promise.resolve({ rows: [] }),
  ]);
  return {
    orderId: row.order_id ? String(row.order_id) : null,
    status: String(row.checkout_status ?? row.payment_status),
    reused: true,
    paymentIntentId: String(row.payment_intent_id),
    providerPaymentId: String(row.provider_payment_id),
    activation: {
      decision: String(row.decision ?? "review"),
      mode: String(row.mode),
      provider: String(row.provider),
      policyVersion: String(row.policy_version ?? "unknown"),
      checks: parseJson(row.checks, []),
      reasonCodes: parseJson(row.reason_codes, []),
      chargeModel: String(row.charge_model),
      merchantOfRecord: String(row.merchant_of_record),
      sellerIds: row.seller_id ? [String(row.seller_id)] : [],
      listingIds: row.listing_id ? [String(row.listing_id)] : [],
      decisionId: row.checkout_attempt_id ? undefined : undefined,
    },
    tax: tax.rows[0] ?? null,
    fraud: fraud.rows[0] ?? null,
    allocations: { transfers: transfers.rows, reserves: reserves.rows },
  };
}

export async function createApprovedCheckout(input: {
  customerKey: string;
  customerType: string;
  email: string;
  address: { line1: string; city: string; region: string; postalCode: string };
  jurisdiction: string;
  idempotencyKey: string;
  actorId: string;
}) {
  const existing = await findExistingApprovedCheckout(input.idempotencyKey, input.customerKey);
  if (existing) return existing;
  const { cart, activation } = await evaluateCurrentCart({
    customerKey: input.customerKey,
    customerType: input.customerType,
    jurisdiction: input.jurisdiction,
    persist: true,
    actorId: input.actorId,
  });
  if (activation.decision === "deny" || (activation.decision === "review" && activation.mode !== "sandbox")) {
    throw new Error(`Commerce activation ${activation.decision}: ${activation.reasonCodes.join(", ")}`);
  }
  const fraud = await getFraudProvider().assess({
    amount: cart.total,
    itemCount: cart.lines.reduce((sum, line) => sum + line.quantity, 0),
    email: input.email,
    postalCode: input.address.postalCode,
    sellerCount: new Set(cart.lines.map((line) => line.sellerId)).size,
  });
  if (fraud.outcome === "block" || (fraud.outcome === "review" && activation.mode !== "sandbox")) {
    throw new Error(`Risk controls ${fraud.outcome === "block" ? "blocked" : "held"} checkout: ${fraud.signals.join(", ")}`);
  }
  const tax = await getTaxProvider().calculate({
    amount: cart.subtotal,
    currency: "USD",
    jurisdiction: input.jurisdiction,
    liableParty: activation.merchantOfRecord,
    sellerId: activation.sellerIds.length === 1 ? activation.sellerIds[0] : undefined,
  });
  const paymentProvider = getPaymentProcessor();
  const prepared = await prepareApprovedCheckoutAttempt({
    customerKey: input.customerKey,
    email: input.email,
    address: input.address,
    idempotencyKey: input.idempotencyKey,
    commerceMode: paymentProvider.mode,
    provider: paymentProvider.provider,
    activationDecisionId: activation.decisionId,
  });
  const database = await getDatabase();
  const sellerCommission = cart.lines.reduce((sum, line) => sum + Math.round(line.unitPrice * line.quantity * 0.025 * 100) / 100, 0);
  const directAccount = activation.chargeModel === "direct"
    ? (await database.query<QueryResultRow & { provider_account_id: string }>(`SELECT provider_account_id FROM commerce_provider_accounts WHERE seller_id=$1`, [activation.sellerIds[0]])).rows[0]?.provider_account_id
    : undefined;
  const transferGroup = activation.chargeModel === "platform_separate" ? `vial-order:${input.idempotencyKey}` : undefined;
  const payment = await paymentProvider.createPaymentIntent({
    amount: Math.round(cart.total * 100),
    currency: "USD",
    idempotencyKey: input.idempotencyKey,
    metadata: {
      cartId: cart.id,
      checkoutAttemptId: prepared.attemptId,
      activationDecisionId: activation.decisionId ?? "",
      policyVersion: activation.policyVersion,
    },
    chargeModel: activation.chargeModel,
    merchantOfRecord: activation.merchantOfRecord,
    connectedAccountId: directAccount,
    applicationFeeAmount: Math.round((cart.platformFee + sellerCommission) * 100),
    transferGroup,
  });

  const persisted = await withTransaction(async (transaction) => {
    const proposedProviderIntentId = newId("provider-intent");
    const providerIntentRow = (await transaction.query<QueryResultRow & { id: string }>(
      `INSERT INTO commerce_provider_payment_intents(id,checkout_attempt_id,provider,mode,provider_payment_id,provider_account_id,charge_model,merchant_of_record,amount,currency,application_fee,transfer_group,status,client_secret_reference,idempotency_key,metadata)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
       ON CONFLICT(idempotency_key) DO UPDATE SET status=EXCLUDED.status,client_secret_reference=EXCLUDED.client_secret_reference,updated_at=NOW()
       RETURNING id`,
      [proposedProviderIntentId, prepared.attemptId, paymentProvider.provider, paymentProvider.mode, payment.providerPaymentId, directAccount ?? null, activation.chargeModel, activation.merchantOfRecord, cart.total, "USD", cart.platformFee + sellerCommission, transferGroup ?? null, payment.status, payment.clientSecretReference ?? null, input.idempotencyKey, JSON.stringify({ activationDecisionId: activation.decisionId, customerType: input.customerType, jurisdiction: input.jurisdiction, sellerCommission })],
    )).rows[0];
    if (!providerIntentRow) throw new Error("Provider payment intent was not persisted");
    const taxId = newId("tax-v5");
    const fraudId = newId("fraud-v5");
    await transaction.query(
      `INSERT INTO commerce_tax_transactions(id,checkout_attempt_id,provider,mode,liable_party,seller_id,jurisdiction,taxable_amount,tax_amount,status,provider_reference,details)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
      [taxId, prepared.attemptId, tax.provider, paymentProvider.mode, tax.liableParty, activation.sellerIds.length === 1 ? activation.sellerIds[0] : null, tax.jurisdiction, tax.taxableAmount, tax.taxAmount, tax.status, tax.providerReference ?? null, JSON.stringify(tax.details)],
    );
    await transaction.query(
      `INSERT INTO commerce_fraud_decisions(id,cart_id,checkout_attempt_id,provider,mode,score,outcome,signals,provider_reference,rule_version)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)`,
      [fraudId, cart.id, prepared.attemptId, fraud.provider, paymentProvider.mode, fraud.score, fraud.outcome, JSON.stringify(fraud.signals), fraud.providerReference ?? null, fraud.ruleVersion],
    );
    await transaction.query(
      `UPDATE commerce_checkout_attempts SET status=$2,processor_payment_id=$3,payment_intent_id=$4,tax_transaction_id=$5,fraud_decision_id=$6 WHERE id=$1`,
      [prepared.attemptId, payment.status === "succeeded" ? "payment_succeeded" : payment.status, payment.providerPaymentId, providerIntentRow.id, taxId, fraudId],
    );
    return { providerIntentId: providerIntentRow.id, taxId, fraudId };
  });

  if (payment.status !== "succeeded") {
    return {
      status: payment.status,
      checkoutAttemptId: prepared.attemptId,
      paymentIntentId: persisted.providerIntentId,
      providerPaymentId: payment.providerPaymentId,
      clientSecret: payment.clientSecret,
      activation,
      fraud,
      tax,
      orderId: null,
    };
  }
  const checkout = await finalizePreparedCheckout({
    attemptId: prepared.attemptId,
    providerPaymentId: payment.providerPaymentId,
    chargeModel: activation.chargeModel,
    merchantOfRecord: activation.merchantOfRecord,
  });
  const allocations = checkout.orderId ? await allocateOrderSettlement(checkout.orderId) : [];
  return {
    ...checkout,
    checkoutAttemptId: prepared.attemptId,
    paymentIntentId: persisted.providerIntentId,
    providerPaymentId: payment.providerPaymentId,
    activation,
    fraud,
    tax,
    allocations,
  };
}
