import { getEnvironment } from "@/server/config/env";
import type { CommerceMode, FraudProviderAdapter, PaymentProcessorAdapter, TaxProviderAdapter } from "../types";
import { MockCommerceProvider, MockFraudProvider, MockTaxProvider } from "./mock";
import { StripeConnectAdapter } from "./stripe";

export function getCommerceMode(): CommerceMode {
  return getEnvironment().VIAL_COMMERCE_MODE;
}

export function getPaymentProcessor(): PaymentProcessorAdapter {
  const env = getEnvironment();
  if (env.VIAL_PAYMENT_PROVIDER === "stripe") {
    if (!env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is required for Stripe mode");
    return new StripeConnectAdapter(env.VIAL_COMMERCE_MODE, env.STRIPE_SECRET_KEY);
  }
  return new MockCommerceProvider(env.VIAL_COMMERCE_MODE);
}

export function getTaxProvider(): TaxProviderAdapter {
  return new MockTaxProvider();
}

export function getFraudProvider(): FraudProviderAdapter {
  return new MockFraudProvider();
}
