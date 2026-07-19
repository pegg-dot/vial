import { newId } from "@/server/db/ids";

export interface ProcessorAccount {
  id: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  requirementsDue: string[];
}

export interface ProcessorPayment {
  id: string;
  status: "succeeded";
  amount: number;
  currency: "USD";
  createdAt: string;
}

export interface PaymentProvider {
  createConnectedAccount(input: { sellerId: string; businessName: string }): Promise<ProcessorAccount>;
  createPayment(input: { amount: number; currency: "USD"; idempotencyKey: string; metadata: Record<string, string> }): Promise<ProcessorPayment>;
  refundPayment(input: { paymentId: string; amount: number; reason: string }): Promise<{ id: string; status: "succeeded" }>;
}

export class MockConnectProvider implements PaymentProvider {
  async createConnectedAccount(input: { sellerId: string }): Promise<ProcessorAccount> {
    return {
      id: `acct_test_${input.sellerId.replace(/\W/g, "").slice(-10)}`,
      chargesEnabled: true,
      payoutsEnabled: true,
      requirementsDue: [],
    };
  }

  async createPayment(input: { amount: number; currency: "USD" }): Promise<ProcessorPayment> {
    if (input.amount <= 0) throw new Error("Payment amount must be positive");
    return { id: newId("pay_test"), status: "succeeded", amount: input.amount, currency: input.currency, createdAt: new Date().toISOString() };
  }

  async refundPayment(): Promise<{ id: string; status: "succeeded" }> {
    return { id: newId("re_test"), status: "succeeded" };
  }
}

export function getPaymentProvider(): PaymentProvider {
  return new MockConnectProvider();
}
