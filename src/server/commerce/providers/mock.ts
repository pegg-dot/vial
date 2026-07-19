import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { newId } from "@/server/db/ids";
import type {
  CommerceMode,
  FraudAssessment,
  FraudProviderAdapter,
  PaymentProcessorAdapter,
  ProviderAccountSnapshot,
  ProviderOnboardingSession,
  ProviderPaymentIntent,
  ProviderRefund,
  ProviderTransfer,
  TaxProviderAdapter,
  TaxQuote,
  VerifiedProviderEvent,
} from "../types";

function centsToMoney(cents: number) {
  return Math.round(cents) / 100;
}

function deterministicProviderId(prefix: string, value: string) {
  return `${prefix}_${createHash("sha256").update(value).digest("hex").slice(0, 24)}`;
}

export class MockCommerceProvider implements PaymentProcessorAdapter {
  readonly provider = "mock_connect_v5";
  constructor(readonly mode: CommerceMode = "sandbox") {}

  async createConnectedAccount(input: { sellerId: string; businessName: string; country: string }): Promise<ProviderAccountSnapshot> {
    return {
      provider: this.provider,
      mode: this.mode,
      providerAccountId: `acct_test_${input.sellerId.replace(/\W/g, "").slice(-16)}`,
      chargesEnabled: true,
      payoutsEnabled: true,
      transfersEnabled: true,
      detailsSubmitted: true,
      requirementsCurrentlyDue: [],
      requirementsEventuallyDue: [],
      requirementsPastDue: [],
      capabilities: { card_payments: "active", transfers: "active" },
      country: input.country,
      defaultCurrency: "USD",
    };
  }

  async createOnboardingSession(input: { providerAccountId: string; returnUrl: string }): Promise<ProviderOnboardingSession> {
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
    return {
      providerSessionId: newId("onboarding_test"),
      url: `${input.returnUrl}${input.returnUrl.includes("?") ? "&" : "?"}sandbox_onboarding=complete&account=${encodeURIComponent(input.providerAccountId)}`,
      expiresAt,
      onboardingType: "hosted",
    };
  }

  async retrieveConnectedAccount(providerAccountId: string): Promise<ProviderAccountSnapshot> {
    return {
      provider: this.provider,
      mode: this.mode,
      providerAccountId,
      chargesEnabled: true,
      payoutsEnabled: true,
      transfersEnabled: true,
      detailsSubmitted: true,
      requirementsCurrentlyDue: [],
      requirementsEventuallyDue: [],
      requirementsPastDue: [],
      capabilities: { card_payments: "active", transfers: "active" },
      country: "US",
      defaultCurrency: "USD",
    };
  }

  async createPaymentIntent(input: {
    amount: number;
    currency: string;
    idempotencyKey: string;
    metadata: Record<string, string>;
    chargeModel: "direct" | "platform_separate";
    merchantOfRecord: "seller" | "platform";
    connectedAccountId?: string;
    applicationFeeAmount?: number;
    transferGroup?: string;
  }): Promise<ProviderPaymentIntent> {
    if (input.amount <= 0) throw new Error("Payment amount must be positive");
    return {
      providerPaymentId: deterministicProviderId("pi_test", input.idempotencyKey),
      status: "succeeded",
      amount: centsToMoney(input.amount),
      currency: input.currency.toUpperCase(),
      clientSecret: `mock_client_secret_${input.idempotencyKey}`,
      clientSecretReference: "mock-secret-reference",
      connectedAccountId: input.connectedAccountId,
      chargeModel: input.chargeModel,
      merchantOfRecord: input.merchantOfRecord,
    };
  }

  async refundPayment(input: { idempotencyKey: string }): Promise<ProviderRefund> {
    return { providerRefundId: deterministicProviderId("re_test", input.idempotencyKey), status: "succeeded" };
  }

  async createTransfer(input: { idempotencyKey: string }): Promise<ProviderTransfer> {
    return { providerTransferId: deterministicProviderId("tr_test", input.idempotencyKey), status: "succeeded" };
  }

  async verifyWebhook(input: { payload: string | Buffer; signature?: string; secret?: string }): Promise<VerifiedProviderEvent> {
    const payload = Buffer.isBuffer(input.payload) ? input.payload : Buffer.from(input.payload);
    if (input.secret) {
      if (!input.signature) throw new Error("Missing mock webhook signature");
      const expected = createHmac("sha256", input.secret).update(payload).digest("hex");
      const actual = Buffer.from(input.signature);
      const target = Buffer.from(expected);
      if (actual.length !== target.length || !timingSafeEqual(actual, target)) throw new Error("Invalid mock webhook signature");
    }
    const parsed = JSON.parse(payload.toString("utf8")) as Record<string, unknown>;
    const data = parsed.data && typeof parsed.data === "object" ? parsed.data as Record<string, unknown> : undefined;
    const object = data?.object && typeof data.object === "object" ? data.object : parsed;
    return {
      providerEventId: String(parsed.id ?? newId("evt_test")),
      type: String(parsed.type ?? "payment_intent.succeeded"),
      livemode: false,
      connectedAccountId: typeof parsed.account === "string" ? parsed.account : undefined,
      apiVersion: "mock-v5",
      payload: object,
    };
  }
}

export class MockTaxProvider implements TaxProviderAdapter {
  readonly provider = "vial_tax_v5";
  async calculate(input: { amount: number; currency: string; jurisdiction: string; liableParty: "seller" | "platform"; sellerId?: string }): Promise<TaxQuote> {
    const rates: Record<string, number> = { "US-FL": 0.07, "US-NY": 0.08875, "US-CA": 0.0825, "US-SANDBOX": 0.07 };
    const rate = rates[input.jurisdiction] ?? 0.06;
    return {
      provider: this.provider,
      liableParty: input.liableParty,
      jurisdiction: input.jurisdiction,
      taxableAmount: input.amount,
      taxAmount: Math.round(input.amount * rate * 100) / 100,
      status: "calculated",
      providerReference: newId("tax_test"),
      details: { rate, basis: "sandbox-jurisdiction-table" },
    };
  }
}

export class MockFraudProvider implements FraudProviderAdapter {
  readonly provider = "vial_risk_v5";
  async assess(input: { amount: number; itemCount: number; email: string; postalCode: string; sellerCount: number }): Promise<FraudAssessment> {
    const signals: string[] = [];
    let score = 6;
    if (input.amount > 500) { score += 35; signals.push("high_order_value"); }
    if (input.itemCount > 8) { score += 25; signals.push("high_item_count"); }
    if (!input.email.includes("@")) { score += 65; signals.push("invalid_email"); }
    if (input.postalCode.trim().length < 4) { score += 30; signals.push("weak_postal_code"); }
    if (input.sellerCount > 3) { score += 10; signals.push("many_sellers"); }
    score = Math.min(100, score);
    return {
      provider: this.provider,
      score,
      outcome: score >= 70 ? "block" : score >= 40 ? "review" : "allow",
      signals,
      ruleVersion: "vial-risk-v5.0",
      providerReference: newId("risk_test"),
    };
  }
}
