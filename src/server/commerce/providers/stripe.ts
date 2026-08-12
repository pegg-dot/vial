import Stripe from "stripe";
import type {
  CommerceMode,
  PaymentProcessorAdapter,
  ProviderAccountSnapshot,
  ProviderOnboardingSession,
  ProviderPaymentIntent,
  ProviderRefund,
  ProviderTransfer,
  VerifiedProviderEvent,
} from "../types";

function accountSnapshot(account: Stripe.Account, mode: CommerceMode): ProviderAccountSnapshot {
  const requirements = account.requirements;
  return {
    provider: "stripe_connect",
    mode,
    providerAccountId: account.id,
    chargesEnabled: Boolean(account.charges_enabled),
    payoutsEnabled: Boolean(account.payouts_enabled),
    transfersEnabled: account.capabilities?.transfers === "active",
    detailsSubmitted: Boolean(account.details_submitted),
    requirementsCurrentlyDue: requirements?.currently_due ?? [],
    requirementsEventuallyDue: requirements?.eventually_due ?? [],
    requirementsPastDue: requirements?.past_due ?? [],
    disabledReason: requirements?.disabled_reason ?? undefined,
    capabilities: Object.fromEntries(Object.entries(account.capabilities ?? {}).map(([key, value]) => [key, String(value ?? "inactive")])),
    country: account.country ?? "US",
    defaultCurrency: account.default_currency?.toUpperCase() ?? "USD",
  };
}

export class StripeConnectAdapter implements PaymentProcessorAdapter {
  readonly provider = "stripe_connect";
  private readonly stripe: Stripe;

  constructor(readonly mode: CommerceMode, secretKey: string) {
    if (!secretKey) throw new Error("Stripe secret key is required");
    if (mode !== "live" && !secretKey.startsWith("sk_test_")) throw new Error("VialGrade test commerce requires a Stripe test key");
    if (mode === "live" && !secretKey.startsWith("sk_live_")) throw new Error("VialGrade live commerce requires a Stripe live key");
    this.stripe = new Stripe(secretKey, { appInfo: { name: "VialGrade", version: "5.0.0" } });
  }

  async createConnectedAccount(input: { businessName: string; email?: string; country: string }): Promise<ProviderAccountSnapshot> {
    const account = await this.stripe.accounts.create({
      type: "express",
      country: input.country,
      email: input.email,
      business_profile: { name: input.businessName, product_description: "VialGrade marketplace seller" },
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { platform: "vial", release: "5.0.0" },
    });
    return accountSnapshot(account, this.mode);
  }

  async createOnboardingSession(input: { providerAccountId: string; returnUrl: string; refreshUrl: string; collectFutureRequirements: boolean }): Promise<ProviderOnboardingSession> {
    const link = await this.stripe.accountLinks.create({
      account: input.providerAccountId,
      return_url: input.returnUrl,
      refresh_url: input.refreshUrl,
      type: "account_onboarding",
      collection_options: {
        fields: "eventually_due",
        future_requirements: input.collectFutureRequirements ? "include" : "omit",
      },
    });
    return {
      providerSessionId: link.object === "account_link" ? `account_link:${input.providerAccountId}:${link.expires_at}` : input.providerAccountId,
      url: link.url,
      expiresAt: new Date(link.expires_at * 1000).toISOString(),
      onboardingType: "hosted",
    };
  }

  async retrieveConnectedAccount(providerAccountId: string): Promise<ProviderAccountSnapshot> {
    const account = await this.stripe.accounts.retrieve(providerAccountId);
    if (account.deleted) throw new Error("Stripe connected account was deleted");
    return accountSnapshot(account, this.mode);
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
    const params: Stripe.PaymentIntentCreateParams = {
      amount: input.amount,
      currency: input.currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: input.metadata,
      transfer_group: input.transferGroup,
    };
    let intent: Stripe.PaymentIntent;
    if (input.chargeModel === "direct") {
      if (!input.connectedAccountId) throw new Error("Direct charges require a connected account");
      params.application_fee_amount = input.applicationFeeAmount;
      intent = await this.stripe.paymentIntents.create(params, { stripeAccount: input.connectedAccountId, idempotencyKey: input.idempotencyKey });
    } else {
      intent = await this.stripe.paymentIntents.create(params, { idempotencyKey: input.idempotencyKey });
    }
    const status: ProviderPaymentIntent["status"] = intent.status === "succeeded" ? "succeeded" : intent.status === "processing" ? "processing" : intent.status === "requires_action" ? "requires_action" : intent.status === "requires_payment_method" ? "requires_payment_method" : "processing";
    return {
      providerPaymentId: intent.id,
      status,
      amount: intent.amount / 100,
      currency: intent.currency.toUpperCase(),
      clientSecret: intent.client_secret ?? undefined,
      clientSecretReference: intent.client_secret ? `stripe-secret:${intent.id}` : undefined,
      connectedAccountId: input.connectedAccountId,
      chargeModel: input.chargeModel,
      merchantOfRecord: input.merchantOfRecord,
    };
  }

  async refundPayment(input: { providerPaymentId: string; amount: number; reason: string; connectedAccountId?: string; idempotencyKey: string }): Promise<ProviderRefund> {
    const refund = await this.stripe.refunds.create(
      { payment_intent: input.providerPaymentId, amount: input.amount, reason: "requested_by_customer", metadata: { vial_reason: input.reason } },
      { stripeAccount: input.connectedAccountId, idempotencyKey: input.idempotencyKey },
    );
    return { providerRefundId: refund.id, status: refund.status === "succeeded" ? "succeeded" : refund.status === "failed" ? "failed" : "pending" };
  }

  async createTransfer(input: { amount: number; currency: string; destinationAccountId: string; sourcePaymentId?: string; transferGroup?: string; idempotencyKey: string }): Promise<ProviderTransfer> {
    const transfer = await this.stripe.transfers.create({
      amount: input.amount,
      currency: input.currency.toLowerCase(),
      destination: input.destinationAccountId,
      source_transaction: input.sourcePaymentId?.startsWith("ch_") ? input.sourcePaymentId : undefined,
      transfer_group: input.transferGroup,
    }, { idempotencyKey: input.idempotencyKey });
    return { providerTransferId: transfer.id, status: transfer.reversed ? "failed" : "succeeded" };
  }

  async verifyWebhook(input: { payload: string | Buffer; signature?: string; secret?: string }): Promise<VerifiedProviderEvent> {
    if (!input.signature || !input.secret) throw new Error("Stripe webhook signature and secret are required");
    const event = this.stripe.webhooks.constructEvent(input.payload, input.signature, input.secret);
    return {
      providerEventId: event.id,
      type: event.type,
      livemode: event.livemode,
      connectedAccountId: event.account ?? undefined,
      apiVersion: event.api_version ?? undefined,
      payload: event.data.object,
    };
  }
}
