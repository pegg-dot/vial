import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { getEnvironment, resetEnvironmentForTests } from "@/server/config/env";
import { MockCommerceProvider, MockFraudProvider, MockTaxProvider } from "@/server/commerce/providers/mock";

const tracked = ["NODE_ENV", "VIALGRADE_COMMERCE_MODE", "VIALGRADE_PAYMENT_PROVIDER", "STRIPE_SECRET_KEY", "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "STRIPE_WEBHOOK_SECRET", "VIALGRADE_LIVE_COMMERCE_ENABLED", "VIALGRADE_LIVE_COMMERCE_ACK"] as const;
const mutableEnv = process.env as Record<string, string | undefined>;
const original = Object.fromEntries(tracked.map((key) => [key, mutableEnv[key]]));

afterEach(() => {
  for (const key of tracked) {
    const value = original[key];
    if (value == null) delete mutableEnv[key]; else mutableEnv[key] = value;
  }
  resetEnvironmentForTests();
});

describe("VIAL 5 commerce contracts", () => {
  it("rejects live Stripe keys outside live mode", () => {
    Object.assign(process.env, { NODE_ENV: "test" });
    process.env.VIALGRADE_PAYMENT_PROVIDER = "stripe";
    process.env.VIALGRADE_COMMERCE_MODE = "test";
    process.env.STRIPE_SECRET_KEY = "sk_live_forbidden";
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_live_forbidden";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_forbidden";
    resetEnvironmentForTests();
    expect(() => getEnvironment()).toThrow(/Live Stripe keys are forbidden/);
  });

  it("requires independent gates before live commerce", () => {
    Object.assign(process.env, { NODE_ENV: "test" });
    process.env.VIALGRADE_PAYMENT_PROVIDER = "stripe";
    process.env.VIALGRADE_COMMERCE_MODE = "live";
    process.env.STRIPE_SECRET_KEY = "sk_live_example";
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_live_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
    process.env.VIALGRADE_LIVE_COMMERCE_ENABLED = "false";
    resetEnvironmentForTests();
    expect(() => getEnvironment()).toThrow(/Live commerce is disabled/);
  });



  it("accepts a complete Stripe test configuration", () => {
    Object.assign(process.env, { NODE_ENV: "test" });
    process.env.VIALGRADE_PAYMENT_PROVIDER = "stripe";
    process.env.VIALGRADE_COMMERCE_MODE = "test";
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_example";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_example";
    resetEnvironmentForTests();
    expect(getEnvironment().VIALGRADE_COMMERCE_MODE).toBe("test");
  });

  it("requires a webhook secret for Stripe because order finalization is asynchronous", () => {
    Object.assign(process.env, { NODE_ENV: "test" });
    process.env.VIALGRADE_PAYMENT_PROVIDER = "stripe";
    process.env.VIALGRADE_COMMERCE_MODE = "test";
    process.env.STRIPE_SECRET_KEY = "sk_test_example";
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY = "pk_test_example";
    delete process.env.STRIPE_WEBHOOK_SECRET;
    resetEnvironmentForTests();
    expect(() => getEnvironment()).toThrow(/webhook keys are required/);
  });

  it("verifies signed mock provider events and rejects tampering", async () => {
    const provider = new MockCommerceProvider("test");
    const secret = "test-webhook-secret";
    const payload = JSON.stringify({ id: "evt_test_123", type: "payment_intent.succeeded", data: { object: { id: "pi_test_123" } } });
    const signature = createHmac("sha256", secret).update(payload).digest("hex");
    const event = await provider.verifyWebhook({ payload, signature, secret });
    expect(event.providerEventId).toBe("evt_test_123");
    await expect(provider.verifyWebhook({ payload: `${payload}x`, signature, secret })).rejects.toThrow(/Invalid mock webhook signature/);
  });

  it("keeps tax and fraud decisions explicit and deterministic", async () => {
    const tax = await new MockTaxProvider().calculate({ amount: 100, currency: "USD", jurisdiction: "US-FL", liableParty: "seller" });
    expect(tax.taxAmount).toBe(7);
    expect(tax.liableParty).toBe("seller");
    const fraud = await new MockFraudProvider().assess({ amount: 700, itemCount: 10, email: "bad", postalCode: "1", sellerCount: 4 });
    expect(fraud.outcome).toBe("block");
    expect(fraud.signals).toContain("high_order_value");
  });
});
