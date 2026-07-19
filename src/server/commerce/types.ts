export type CommerceMode = "sandbox" | "test" | "live";
export type ChargeModel = "direct" | "platform_separate";
export type MerchantOfRecord = "seller" | "platform";

export interface ProviderAccountSnapshot {
  provider: string;
  mode: CommerceMode;
  providerAccountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  transfersEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsCurrentlyDue: string[];
  requirementsEventuallyDue: string[];
  requirementsPastDue: string[];
  disabledReason?: string;
  capabilities: Record<string, string>;
  country: string;
  defaultCurrency: string;
}

export interface ProviderOnboardingSession {
  providerSessionId: string;
  url: string;
  expiresAt: string;
  onboardingType: "hosted" | "embedded";
}

export interface ProviderPaymentIntent {
  providerPaymentId: string;
  status: "requires_payment_method" | "requires_action" | "processing" | "succeeded" | "failed";
  amount: number;
  currency: string;
  clientSecret?: string;
  clientSecretReference?: string;
  connectedAccountId?: string;
  chargeModel: ChargeModel;
  merchantOfRecord: MerchantOfRecord;
}

export interface ProviderRefund {
  providerRefundId: string;
  status: "pending" | "succeeded" | "failed";
}

export interface ProviderTransfer {
  providerTransferId: string;
  status: "pending" | "succeeded" | "failed";
}

export interface VerifiedProviderEvent {
  providerEventId: string;
  type: string;
  livemode: boolean;
  connectedAccountId?: string;
  apiVersion?: string;
  payload: unknown;
}

export interface PaymentProcessorAdapter {
  readonly provider: string;
  readonly mode: CommerceMode;
  createConnectedAccount(input: { sellerId: string; businessName: string; email?: string; country: string }): Promise<ProviderAccountSnapshot>;
  createOnboardingSession(input: { providerAccountId: string; returnUrl: string; refreshUrl: string; collectFutureRequirements: boolean }): Promise<ProviderOnboardingSession>;
  retrieveConnectedAccount(providerAccountId: string): Promise<ProviderAccountSnapshot>;
  createPaymentIntent(input: {
    amount: number;
    currency: string;
    idempotencyKey: string;
    metadata: Record<string, string>;
    chargeModel: ChargeModel;
    merchantOfRecord: MerchantOfRecord;
    connectedAccountId?: string;
    applicationFeeAmount?: number;
    transferGroup?: string;
  }): Promise<ProviderPaymentIntent>;
  refundPayment(input: { providerPaymentId: string; amount: number; reason: string; connectedAccountId?: string; idempotencyKey: string }): Promise<ProviderRefund>;
  createTransfer(input: { amount: number; currency: string; destinationAccountId: string; sourcePaymentId?: string; transferGroup?: string; idempotencyKey: string }): Promise<ProviderTransfer>;
  verifyWebhook(input: { payload: string | Buffer; signature?: string; secret?: string }): Promise<VerifiedProviderEvent>;
}

export interface TaxQuote {
  provider: string;
  liableParty: MerchantOfRecord;
  jurisdiction: string;
  taxableAmount: number;
  taxAmount: number;
  status: "estimated" | "calculated" | "failed";
  providerReference?: string;
  details: Record<string, unknown>;
}

export interface TaxProviderAdapter {
  readonly provider: string;
  calculate(input: { amount: number; currency: string; jurisdiction: string; liableParty: MerchantOfRecord; sellerId?: string }): Promise<TaxQuote>;
}

export interface FraudAssessment {
  provider: string;
  score: number;
  outcome: "allow" | "review" | "block";
  signals: string[];
  ruleVersion: string;
  providerReference?: string;
}

export interface FraudProviderAdapter {
  readonly provider: string;
  assess(input: { amount: number; itemCount: number; email: string; postalCode: string; sellerCount: number }): Promise<FraudAssessment>;
}
