import type { QueryResultRow } from "pg";
import { getEnvironment } from "@/server/config/env";
import { getDatabase, type SqlConnection, withTransaction } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { ensureCommerceSeed, getOrCreateCart } from "./repository";
import { getCommerceMode, getPaymentProcessor } from "./providers";
import type { ChargeModel, CommerceMode, MerchantOfRecord, ProviderAccountSnapshot } from "./types";

export interface ActivationCheck {
  key: string;
  label: string;
  passed: boolean;
  required: boolean;
  detail: string;
}

export interface ActivationResult {
  decision: "allow" | "review" | "deny";
  mode: CommerceMode;
  provider: string;
  policyVersion: string;
  checks: ActivationCheck[];
  reasonCodes: string[];
  chargeModel: ChargeModel;
  merchantOfRecord: MerchantOfRecord;
  sellerIds: string[];
  listingIds: string[];
}

function parsed<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try { return JSON.parse(value) as T; } catch { return fallback; }
  }
  return value as T;
}

function normalizeStatus(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function isAvailableListing(value: unknown) {
  const status = normalizeStatus(value).replaceAll("_", " ").replaceAll("-", " ");
  return ["available", "in stock", "low stock", "limited stock"].includes(status);
}

function decisionFromChecks(checks: ActivationCheck[]) {
  const failedRequired = checks.filter((check) => check.required && !check.passed);
  if (failedRequired.length) return "deny" as const;
  return checks.some((check) => !check.passed) ? "review" as const : "allow" as const;
}

async function seedActivePolicy(connection: SqlConnection) {
  const version = getEnvironment().VIAL_COMMERCE_POLICY_VERSION;
  await connection.query(
    `INSERT INTO commerce_activation_policies(id,version,status,rules,created_by,activated_at)
     VALUES($1,$2,'active',$3::jsonb,'system:v5-seed',NOW())
     ON CONFLICT(version) DO UPDATE SET rules=EXCLUDED.rules,status='active',activated_at=COALESCE(commerce_activation_policies.activated_at,NOW())`,
    [
      `policy:${version}`,
      version,
      JSON.stringify({
        supportedModes: ["sandbox", "test"],
        requiredCapabilities: ["charges", "payouts", "transfers"],
        requireUnderwriting: true,
        requireLegalReview: true,
        requireEvidence: true,
        allowPlatformMerchantInTest: true,
        allowPlatformMerchantInLive: false,
        maxOrderAmount: 1000,
        reservePercentByRiskTier: { low: 0, standard: 0.1, elevated: 0.15, high: 0.25 },
      }),
    ],
  );
}

async function upsertProviderAccount(connection: SqlConnection, sellerId: string, snapshot: ProviderAccountSnapshot) {
  const id = `provider-account:${sellerId}`;
  const underwritingStatus = snapshot.mode === "sandbox" ? "sandbox_approved" : snapshot.mode === "test" ? "test_pending" : "not_submitted";
  await connection.query(
    `INSERT INTO commerce_provider_accounts(
       id,seller_id,provider,mode,provider_account_id,account_configuration,merchant_of_record,fees_collector,losses_collector,onboarding_type,
       country,default_currency,charges_enabled,payouts_enabled,transfers_enabled,details_submitted,underwriting_status,risk_tier,
       requirements_currently_due,requirements_eventually_due,requirements_past_due,capabilities,disabled_reason,last_synced_at)
     VALUES($1,$2,$3,$4,$5,'seller_merchant','seller','platform','platform','hosted',$6,$7,$8,$9,$10,$11,$12,'standard',$13::jsonb,$14::jsonb,$15::jsonb,$16::jsonb,$17,NOW())
     ON CONFLICT(seller_id) DO UPDATE SET
       provider=EXCLUDED.provider, mode=EXCLUDED.mode, provider_account_id=EXCLUDED.provider_account_id,
       country=EXCLUDED.country, default_currency=EXCLUDED.default_currency, charges_enabled=EXCLUDED.charges_enabled,
       payouts_enabled=EXCLUDED.payouts_enabled, transfers_enabled=EXCLUDED.transfers_enabled, details_submitted=EXCLUDED.details_submitted,
       requirements_currently_due=EXCLUDED.requirements_currently_due, requirements_eventually_due=EXCLUDED.requirements_eventually_due,
       requirements_past_due=EXCLUDED.requirements_past_due, capabilities=EXCLUDED.capabilities, disabled_reason=EXCLUDED.disabled_reason,
       last_synced_at=NOW(), updated_at=NOW()`,
    [
      id,
      sellerId,
      snapshot.provider,
      snapshot.mode,
      snapshot.providerAccountId,
      snapshot.country,
      snapshot.defaultCurrency,
      snapshot.chargesEnabled,
      snapshot.payoutsEnabled,
      snapshot.transfersEnabled,
      snapshot.detailsSubmitted,
      underwritingStatus,
      JSON.stringify(snapshot.requirementsCurrentlyDue),
      JSON.stringify(snapshot.requirementsEventuallyDue),
      JSON.stringify(snapshot.requirementsPastDue),
      JSON.stringify(snapshot.capabilities),
      snapshot.disabledReason ?? null,
    ],
  );
  await connection.query(
    `UPDATE commerce_sellers SET processor_provider=$2,processor_account_id=$3,charges_enabled=$4,payouts_enabled=$5,
       requirements_due=$6::jsonb,status=CASE WHEN status LIKE 'sandbox%' THEN 'sandbox_active' ELSE status END,updated_at=NOW()
     WHERE id=$1`,
    [sellerId, snapshot.provider, snapshot.providerAccountId, snapshot.chargesEnabled, snapshot.payoutsEnabled, JSON.stringify(snapshot.requirementsCurrentlyDue)],
  );
  return id;
}

export async function ensureApprovedCommerceSeed() {
  await ensureCommerceSeed();
  const database = await getDatabase();
  await seedActivePolicy(database);
  const mode = getCommerceMode();
  const provider = getPaymentProcessor();
  const sellers = await database.query<QueryResultRow & { id: string; display_name: string }>(
    `SELECT cs.id,o.display_name FROM commerce_sellers cs JOIN organizations o ON o.id=cs.organization_id ORDER BY cs.id`,
  );
  for (const seller of sellers.rows) {
    const exists = (await database.query<QueryResultRow & { id: string }>(`SELECT id FROM commerce_provider_accounts WHERE seller_id=$1`, [seller.id])).rows[0];
    if (exists) continue;
    if (provider.provider === "stripe_connect") {
      await database.query(
        `INSERT INTO commerce_provider_accounts(id,seller_id,provider,mode,provider_account_id,underwriting_status,risk_tier)
         VALUES($1,$2,'stripe_connect',$3,$4,'not_submitted','unrated') ON CONFLICT(seller_id) DO NOTHING`,
        [`provider-account:${seller.id}`, seller.id, mode, `pending:${seller.id}`],
      );
      continue;
    }
    const snapshot = await provider.createConnectedAccount({ sellerId: seller.id, businessName: seller.display_name, country: getEnvironment().VIAL_PLATFORM_COUNTRY });
    await upsertProviderAccount(database, seller.id, snapshot);
  }
}

export async function createProviderAccountForSeller(input: { sellerId: string; email?: string; actorId: string }) {
  await ensureApprovedCommerceSeed();
  const database = await getDatabase();
  const seller = (await database.query<QueryResultRow & { display_name: string }>(
    `SELECT o.display_name FROM commerce_sellers cs JOIN organizations o ON o.id=cs.organization_id WHERE cs.id=$1`, [input.sellerId],
  )).rows[0];
  if (!seller) throw new Error("Seller not found");
  const provider = getPaymentProcessor();
  const snapshot = await provider.createConnectedAccount({ sellerId: input.sellerId, businessName: seller.display_name, email: input.email, country: getEnvironment().VIAL_PLATFORM_COUNTRY });
  const id = await upsertProviderAccount(database, input.sellerId, snapshot);
  await database.query(
    `INSERT INTO commerce_underwriting_reviews(id,seller_id,provider_account_id,mode,status,requested_by,catalog_scope,jurisdictions)
     VALUES($1,$2,$3,$4,'pending',$5,'[]'::jsonb,$6::jsonb)`,
    [newId("underwriting"), input.sellerId, id, snapshot.mode, input.actorId, JSON.stringify(["US-SANDBOX"])],
  );
  return { id, snapshot };
}

export async function createProviderOnboarding(input: { sellerId: string; actorId: string }) {
  await ensureApprovedCommerceSeed();
  const database = await getDatabase();
  const account = (await database.query<QueryResultRow & { id: string; provider_account_id: string; provider: string; mode: CommerceMode }>(
    `SELECT id,provider_account_id,provider,mode FROM commerce_provider_accounts WHERE seller_id=$1`, [input.sellerId],
  )).rows[0];
  if (!account) throw new Error("Provider account is not configured");
  const origin = getEnvironment().NEXT_PUBLIC_SITE_URL;
  const session = await getPaymentProcessor().createOnboardingSession({
    providerAccountId: account.provider_account_id,
    returnUrl: `${origin}/seller/onboarding?payment=returned`,
    refreshUrl: `${origin}/seller/onboarding?payment=refresh`,
    collectFutureRequirements: true,
  });
  const id = newId("provider-onboarding");
  await database.query(
    `INSERT INTO commerce_provider_onboarding_sessions(id,seller_id,provider_account_id,provider,mode,onboarding_type,status,provider_session_id,url,collection_options,expires_at)
     VALUES($1,$2,$3,$4,$5,$6,'created',$7,$8,$9::jsonb,$10)`,
    [id, input.sellerId, account.id, account.provider, account.mode, session.onboardingType, session.providerSessionId, session.url, JSON.stringify({ future_requirements: "include", actorId: input.actorId }), session.expiresAt],
  );
  return { id, ...session };
}

export async function syncProviderAccount(input: { sellerId: string; actorId: string }) {
  await ensureApprovedCommerceSeed();
  const database = await getDatabase();
  const account = (await database.query<QueryResultRow & { provider_account_id: string }>(
    `SELECT provider_account_id FROM commerce_provider_accounts WHERE seller_id=$1`, [input.sellerId],
  )).rows[0];
  if (!account) throw new Error("Provider account not found");
  const snapshot = await getPaymentProcessor().retrieveConnectedAccount(account.provider_account_id);
  await upsertProviderAccount(database, input.sellerId, snapshot);
  return { snapshot, actorId: input.actorId };
}

async function sellerActivationChecks(connection: SqlConnection, sellerId: string, mode: CommerceMode): Promise<ActivationCheck[]> {
  const row = (await connection.query<QueryResultRow & Record<string, unknown>>(
    `SELECT cs.status seller_status,cs.agreement_accepted_at,cs.reserve_percent,
            pa.provider,pa.mode,pa.charges_enabled,pa.payouts_enabled,pa.transfers_enabled,pa.details_submitted,
            pa.underwriting_status,pa.requirements_currently_due,pa.requirements_past_due,pa.disabled_reason,
            sp.readiness_state,sp.submitted_at
     FROM commerce_sellers cs
     LEFT JOIN commerce_provider_accounts pa ON pa.seller_id=cs.id
     LEFT JOIN seller_profiles sp ON sp.seller_id=cs.id
     WHERE cs.id=$1`, [sellerId],
  )).rows[0];
  if (!row) return [{ key: "seller_exists", label: "Seller exists", passed: false, required: true, detail: "Seller record was not found" }];
  const currentDue = parsed<string[]>(row.requirements_currently_due, []);
  const pastDue = parsed<string[]>(row.requirements_past_due, []);
  const underwriting = normalizeStatus(row.underwriting_status);
  const approved = mode === "live" ? underwriting === "approved" : ["sandbox_approved", "test_approved", "approved"].includes(underwriting);
  return [
    { key: "seller_active", label: "Seller standing", passed: !["suspended", "removed", "blocked"].includes(normalizeStatus(row.seller_status)), required: true, detail: `Seller status: ${String(row.seller_status)}` },
    { key: "agreement", label: "Seller agreement", passed: Boolean(row.agreement_accepted_at), required: true, detail: row.agreement_accepted_at ? "Current agreement accepted" : "Agreement has not been accepted" },
    { key: "provider_mode", label: "Processor mode", passed: row.mode === mode, required: true, detail: row.mode ? `Account is in ${String(row.mode)} mode` : "No processor account" },
    { key: "underwriting", label: "Processor underwriting", passed: approved, required: true, detail: `Underwriting: ${underwriting || "not submitted"}` },
    { key: "details", label: "Identity details", passed: Boolean(row.details_submitted), required: true, detail: row.details_submitted ? "Provider details submitted" : "Provider details incomplete" },
    { key: "charges", label: "Charge capability", passed: Boolean(row.charges_enabled), required: true, detail: row.disabled_reason ? String(row.disabled_reason) : "Charge capability state" },
    { key: "payouts", label: "Payout capability", passed: Boolean(row.payouts_enabled), required: true, detail: "Payout capability state" },
    { key: "transfers", label: "Transfer capability", passed: Boolean(row.transfers_enabled), required: true, detail: "Transfer capability state" },
    { key: "requirements", label: "Outstanding requirements", passed: currentDue.length === 0 && pastDue.length === 0, required: true, detail: currentDue.length || pastDue.length ? `${currentDue.length + pastDue.length} requirements outstanding` : "No due requirements" },
    { key: "seller_readiness", label: "VIAL seller readiness", passed: !["blocked", "not_ready"].includes(normalizeStatus(row.readiness_state)), required: false, detail: row.readiness_state ? `Readiness: ${String(row.readiness_state)}` : "Seller readiness profile not completed" },
  ];
}

async function listingActivationChecks(connection: SqlConnection, listingId: string, mode: CommerceMode, customerType: string, jurisdiction: string): Promise<ActivationCheck[]> {
  const row = (await connection.query<QueryResultRow & Record<string, unknown>>(
    `SELECT e.*,l.report_confirmed,l.batch_linked,l.evidence_level,l.availability,p.status product_status
     FROM commerce_listing_eligibility e JOIN listings l ON l.id=e.listing_id JOIN products p ON p.id=l.product_id WHERE e.listing_id=$1`,
    [listingId],
  )).rows[0];
  if (!row) return [{ key: "listing_exists", label: "Listing exists", passed: false, required: true, detail: "Listing record was not found" }];
  const customerTypes = parsed<string[]>(row.allowed_customer_types, []);
  const jurisdictions = parsed<string[]>(row.allowed_jurisdictions, []);
  const state = normalizeStatus(row.state);
  const legal = normalizeStatus(row.legal_review_status);
  const processor = normalizeStatus(row.processor_review_status);
  const stateAllowed = mode === "live" ? state === "commerce_approved" : ["checkout_sandbox", "processor_review", "commerce_approved"].includes(state);
  const legalAllowed = mode === "live" ? legal === "approved" : ["sandbox_only", "sandbox_approved", "test_approved", "approved"].includes(legal);
  const processorAllowed = mode === "live" ? processor === "approved" : ["sandbox_approved", "test_approved", "approved"].includes(processor);
  const customerAllowed = customerTypes.includes(customerType) || customerTypes.includes("sandbox") || customerTypes.includes("all");
  const jurisdictionAllowed = jurisdictions.includes(jurisdiction) || jurisdictions.includes("US-SANDBOX") || jurisdictions.includes("all");
  return [
    { key: "listing_state", label: "Listing commerce state", passed: stateAllowed, required: true, detail: `State: ${state}` },
    { key: "legal_review", label: "Legal review", passed: legalAllowed, required: true, detail: `Legal review: ${legal}` },
    { key: "processor_review", label: "Processor catalog review", passed: processorAllowed, required: true, detail: `Processor review: ${processor}` },
    { key: "customer_type", label: "Customer type", passed: customerAllowed, required: true, detail: `Requested: ${customerType}` },
    { key: "jurisdiction", label: "Shipping jurisdiction", passed: jurisdictionAllowed, required: true, detail: `Requested: ${jurisdiction}` },
    { key: "availability", label: "Availability", passed: isAvailableListing(row.availability), required: true, detail: `Availability: ${String(row.availability)}` },
    { key: "product_status", label: "Product status", passed: normalizeStatus(row.product_status) === "active", required: true, detail: `Product: ${String(row.product_status)}` },
    { key: "evidence", label: "Current evidence", passed: Boolean(row.report_confirmed || row.batch_linked), required: mode === "live", detail: row.report_confirmed || row.batch_linked ? "Report or batch linkage is present" : `Evidence level: ${String(row.evidence_level)}` },
  ];
}

export async function evaluateCommerceActivation(input: {
  listingIds: string[];
  sellerIds: string[];
  customerType: string;
  jurisdiction: string;
  total?: number;
  decidedBy?: string;
  persist?: boolean;
}): Promise<ActivationResult & { decisionId?: string }> {
  await ensureApprovedCommerceSeed();
  const mode = getCommerceMode();
  const provider = getPaymentProcessor();
  const database = await getDatabase();
  const checks: ActivationCheck[] = [];
  for (const sellerId of [...new Set(input.sellerIds)]) checks.push(...await sellerActivationChecks(database, sellerId, mode));
  for (const listingId of [...new Set(input.listingIds)]) checks.push(...await listingActivationChecks(database, listingId, mode, input.customerType, input.jurisdiction));
  const sellerCount = new Set(input.sellerIds).size;
  const chargeModel: ChargeModel = sellerCount === 1 ? "direct" : "platform_separate";
  const merchantOfRecord: MerchantOfRecord = chargeModel === "direct" ? "seller" : "platform";
  checks.push({
    key: "merchant_model",
    label: "Merchant model",
    passed: mode !== "live" || merchantOfRecord === "seller",
    required: true,
    detail: merchantOfRecord === "seller" ? "Single-seller direct charge" : "Multi-seller platform charge requires separate marketplace approval",
  });
  if (input.total != null) checks.push({ key: "order_limit", label: "Order amount", passed: input.total <= 1000, required: true, detail: `Order total: $${input.total.toFixed(2)}` });
  const decision = decisionFromChecks(checks);
  const reasonCodes = checks.filter((check) => !check.passed).map((check) => check.key);
  const result: ActivationResult = {
    decision,
    mode,
    provider: provider.provider,
    policyVersion: getEnvironment().VIAL_COMMERCE_POLICY_VERSION,
    checks,
    reasonCodes,
    chargeModel,
    merchantOfRecord,
    sellerIds: [...new Set(input.sellerIds)],
    listingIds: [...new Set(input.listingIds)],
  };
  if (!input.persist) return result;
  const id = newId("activation");
  await database.query(
    `INSERT INTO commerce_activation_decisions(id,subject_type,subject_id,seller_id,listing_id,customer_type,jurisdiction,provider,mode,decision,checks,reason_codes,policy_version,root_event_id,decided_by,expires_at)
     VALUES($1,'checkout',$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,NOW()+INTERVAL '20 minutes')`,
    [id, input.listingIds.join(","), input.sellerIds.length === 1 ? input.sellerIds[0] : null, input.listingIds.length === 1 ? input.listingIds[0] : null, input.customerType, input.jurisdiction, provider.provider, mode, decision, JSON.stringify(checks), JSON.stringify(reasonCodes), result.policyVersion, newId("commerce-root"), input.decidedBy ?? "system:activation"],
  );
  return { ...result, decisionId: id };
}

export async function approveUnderwriting(input: { sellerId: string; status: "test_approved" | "approved" | "rejected"; actorId: string; notes?: string }) {
  await ensureApprovedCommerceSeed();
  const mode = getCommerceMode();
  if (input.status === "approved" && mode !== "live") throw new Error("Full underwriting approval can only be recorded in live mode");
  if (input.status === "approved" && !getEnvironment().VIAL_LIVE_COMMERCE_ENABLED) throw new Error("Live commerce is disabled");
  return withTransaction(async (transaction) => {
    const account = (await transaction.query<QueryResultRow & { id: string }>(`SELECT id FROM commerce_provider_accounts WHERE seller_id=$1 FOR UPDATE`, [input.sellerId])).rows[0];
    if (!account) throw new Error("Provider account not found");
    await transaction.query(`UPDATE commerce_provider_accounts SET underwriting_status=$2,updated_at=NOW() WHERE id=$1`, [account.id, input.status]);
    await transaction.query(
      `INSERT INTO commerce_underwriting_reviews(id,seller_id,provider_account_id,mode,status,risk_notes,requested_by,reviewed_by,reviewed_at,expires_at)
       VALUES($1,$2,$3,$4,$5,$6,$7,$7,NOW(),NOW()+INTERVAL '180 days')`,
      [newId("underwriting"), input.sellerId, account.id, mode, input.status, input.notes ?? "", input.actorId],
    );
    return { sellerId: input.sellerId, status: input.status };
  });
}

export async function setListingActivation(input: {
  listingId: string;
  state: "checkout_sandbox" | "processor_review" | "commerce_approved" | "commerce_suspended" | "prohibited";
  processorReviewStatus: string;
  legalReviewStatus: string;
  allowedCustomerTypes: string[];
  allowedJurisdictions: string[];
  actorId: string;
}) {
  const mode = getCommerceMode();
  if (input.state === "commerce_approved" && mode !== "live") throw new Error("Production commerce approval requires live mode");
  if (input.state === "commerce_approved" && !getEnvironment().VIAL_LIVE_COMMERCE_ENABLED) throw new Error("Live commerce is disabled");
  const database = await getDatabase();
  await database.query(
    `UPDATE commerce_listing_eligibility SET state=$2,processor_review_status=$3,legal_review_status=$4,
       allowed_customer_types=$5::jsonb,allowed_jurisdictions=$6::jsonb,policy_version=$7,reason_codes=$8::jsonb,updated_at=NOW()
     WHERE listing_id=$1`,
    [input.listingId, input.state, input.processorReviewStatus, input.legalReviewStatus, JSON.stringify(input.allowedCustomerTypes), JSON.stringify(input.allowedJurisdictions), getEnvironment().VIAL_COMMERCE_POLICY_VERSION, JSON.stringify([`updated-by:${input.actorId}`])],
  );
  return { listingId: input.listingId, state: input.state };
}

export async function evaluateCurrentCart(input: { customerKey: string; customerType: string; jurisdiction: string; persist?: boolean; actorId?: string }) {
  const cart = await getOrCreateCart(input.customerKey);
  return {
    cart,
    activation: await evaluateCommerceActivation({
      listingIds: cart.lines.map((line) => line.listingId),
      sellerIds: cart.lines.map((line) => line.sellerId),
      customerType: input.customerType,
      jurisdiction: input.jurisdiction,
      total: cart.total,
      persist: input.persist,
      decidedBy: input.actorId,
    }),
  };
}

export async function approvedCommerceDashboard() {
  await ensureApprovedCommerceSeed();
  const database = await getDatabase();
  const [accounts, onboarding, policies, decisions, underwriting, paymentIntents, transfers, reserves, settlements, tax, fraud] = await Promise.all([
    database.query(`SELECT pa.*,o.display_name FROM commerce_provider_accounts pa JOIN commerce_sellers cs ON cs.id=pa.seller_id JOIN organizations o ON o.id=cs.organization_id ORDER BY o.display_name`),
    database.query(`SELECT * FROM commerce_provider_onboarding_sessions ORDER BY created_at DESC LIMIT 50`),
    database.query(`SELECT * FROM commerce_activation_policies ORDER BY created_at DESC`),
    database.query(`SELECT * FROM commerce_activation_decisions ORDER BY created_at DESC LIMIT 100`),
    database.query(`SELECT ur.*,o.display_name FROM commerce_underwriting_reviews ur JOIN commerce_sellers cs ON cs.id=ur.seller_id JOIN organizations o ON o.id=cs.organization_id ORDER BY requested_at DESC`),
    database.query(`SELECT * FROM commerce_provider_payment_intents ORDER BY created_at DESC LIMIT 100`),
    database.query(`SELECT * FROM commerce_provider_transfers ORDER BY created_at DESC LIMIT 100`),
    database.query(`SELECT * FROM commerce_reserve_holds ORDER BY created_at DESC LIMIT 100`),
    database.query(`SELECT * FROM commerce_settlement_runs ORDER BY started_at DESC LIMIT 50`),
    database.query(`SELECT * FROM commerce_tax_transactions ORDER BY created_at DESC LIMIT 100`),
    database.query(`SELECT * FROM commerce_fraud_decisions ORDER BY created_at DESC LIMIT 100`),
  ]);
  return {
    mode: getCommerceMode(),
    provider: getPaymentProcessor().provider,
    liveEnabled: getEnvironment().VIAL_LIVE_COMMERCE_ENABLED,
    accounts: accounts.rows,
    onboarding: onboarding.rows,
    policies: policies.rows,
    decisions: decisions.rows,
    underwriting: underwriting.rows,
    paymentIntents: paymentIntents.rows,
    transfers: transfers.rows,
    reserves: reserves.rows,
    settlements: settlements.rows,
    tax: tax.rows,
    fraud: fraud.rows,
  };
}

export async function requestUnderwritingReview(input: { sellerId: string; actorId: string; jurisdictions: string[]; catalogScope?: string[]; notes?: string }) {
  await ensureApprovedCommerceSeed();
  const database = await getDatabase();
  const account = (await database.query<QueryResultRow & { id: string; mode: CommerceMode }>(`SELECT id,mode FROM commerce_provider_accounts WHERE seller_id=$1`, [input.sellerId])).rows[0];
  if (!account) throw new Error("Provider account not found");
  const id = newId("underwriting");
  await database.query(
    `INSERT INTO commerce_underwriting_reviews(id,seller_id,provider_account_id,mode,status,catalog_scope,jurisdictions,risk_notes,requested_by)
     VALUES($1,$2,$3,$4,'pending',$5::jsonb,$6::jsonb,$7,$8)`,
    [id, input.sellerId, account.id, account.mode, JSON.stringify(input.catalogScope ?? []), JSON.stringify(input.jurisdictions), input.notes ?? "", input.actorId],
  );
  await database.query(`UPDATE commerce_provider_accounts SET underwriting_status='pending',updated_at=NOW() WHERE id=$1`, [account.id]);
  return { id, status: "pending" as const };
}

export async function getSellerPaymentWorkspace(sellerId: string) {
  await ensureApprovedCommerceSeed();
  const database = await getDatabase();
  const [account, onboarding, underwriting, decisions, transfers, reserves, payouts, orders] = await Promise.all([
    database.query(`SELECT * FROM commerce_provider_accounts WHERE seller_id=$1`, [sellerId]),
    database.query(`SELECT * FROM commerce_provider_onboarding_sessions WHERE seller_id=$1 ORDER BY created_at DESC`, [sellerId]),
    database.query(`SELECT * FROM commerce_underwriting_reviews WHERE seller_id=$1 ORDER BY requested_at DESC`, [sellerId]),
    database.query(`SELECT * FROM commerce_activation_decisions WHERE seller_id=$1 ORDER BY created_at DESC LIMIT 50`, [sellerId]),
    database.query(`SELECT * FROM commerce_provider_transfers WHERE seller_id=$1 ORDER BY created_at DESC LIMIT 50`, [sellerId]),
    database.query(`SELECT * FROM commerce_reserve_holds WHERE seller_id=$1 ORDER BY created_at DESC LIMIT 50`, [sellerId]),
    database.query(`SELECT * FROM commerce_payouts WHERE seller_id=$1 ORDER BY created_at DESC LIMIT 50`, [sellerId]),
    database.query(`SELECT o.*,COUNT(ol.id)::int line_count,SUM(ol.line_total-ol.platform_fee) seller_gross FROM commerce_orders o JOIN commerce_order_lines ol ON ol.order_id=o.id WHERE ol.seller_id=$1 GROUP BY o.id ORDER BY o.created_at DESC LIMIT 50`, [sellerId]),
  ]);
  return {
    account: account.rows[0] ?? null,
    onboarding: onboarding.rows,
    underwriting: underwriting.rows,
    decisions: decisions.rows,
    transfers: transfers.rows,
    reserves: reserves.rows,
    payouts: payouts.rows,
    orders: orders.rows,
  };
}
