import { beforeEach, describe, expect, it } from "vitest";
import { addCartLine, commerceDashboard, createSandboxCheckout, getOrder, getOrCreateCart } from "@/server/commerce/repository";

describe("commerce sandbox", () => {
  beforeEach(() => {
    process.env.VIALGRADE_PGLITE_MEMORY = "true";
    delete globalThis.__vialDbPromise;
  });

  it("creates one idempotent sandbox order with ledger entries", async () => {
    const dashboard = await commerceDashboard();
    const eligible = dashboard.eligibility.find((row) => row.state === "checkout_sandbox");
    expect(eligible).toBeTruthy();
    await addCartLine({ customerKey: "commerce-test", listingSlug: String(eligible!.slug), quantity: 2 });
    const cart = await getOrCreateCart("commerce-test");
    expect(cart.eligible).toBe(true);
    const input = {
      customerKey: "commerce-test",
      email: "test@vialgrade.example",
      address: { line1: "1 Test", city: "Miami", region: "FL", postalCode: "33101" },
      idempotencyKey: "commerce-idempotency-1",
    };
    const first = await createSandboxCheckout(input);
    const second = await createSandboxCheckout(input);
    expect(first.orderId).toBeTruthy();
    expect(second.orderId).toBe(first.orderId);
    expect(second.reused).toBe(true);
    const order = await getOrder(first.orderId!);
    expect(order?.lines).toHaveLength(1);
    const after = await commerceDashboard();
    expect(after.ledger.filter((row) => row.order_id === first.orderId).length).toBeGreaterThanOrEqual(6);
  });
});
