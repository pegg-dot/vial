import { beforeEach, describe, expect, it } from "vitest";
import { addCartLine, commerceDashboard, createSandboxCheckout, getOrCreateCart } from "@/server/commerce/repository";
import { getDatabase } from "@/server/db/client";
import { createRefund, createReturnRequest, createSandboxDispute, createShipment, operationsDashboard, recordWebhook, replayWebhook, reviewReturn, runReconciliation, submitDisputeEvidence } from "@/server/commerce/operations";

describe("commerce operations", () => {
  beforeEach(() => { process.env.VIALGRADE_PGLITE_MEMORY="true"; delete globalThis.__vialDbPromise; });
  it("runs the post-purchase operations with auditable records", async () => {
    const dashboard=await commerceDashboard();
    const eligible=dashboard.eligibility.find((r)=>r.state==="checkout_sandbox");
    await addCartLine({customerKey:"ops-test",listingSlug:String(eligible!.slug),quantity:1});
    const cart=await getOrCreateCart("ops-test");
    expect(cart.eligible).toBe(true);
    const checkout=await createSandboxCheckout({customerKey:"ops-test",email:"ops@vialgrade.test",address:{line1:"1 Test",city:"Miami",region:"FL",postalCode:"33101"},idempotencyKey:"ops-checkout-1"});
    expect(checkout.orderId).toBeTruthy();
    const db=await getDatabase();
    const seller=(await db.query<{seller_id:string}>(`SELECT seller_id FROM commerce_order_lines WHERE order_id=$1 LIMIT 1`,[checkout.orderId!])).rows[0];
    await createShipment({orderId:checkout.orderId!,sellerId:String(seller!.seller_id),carrier:"Sandbox Carrier",trackingCode:"TRACK-1"});
    const ret=await createReturnRequest({orderId:checkout.orderId!,customerKey:"ops-test",reason:"Changed mind"});
    await reviewReturn({returnId:ret.id,decision:"approved",actor:"admin"});
    await createRefund({orderId:checkout.orderId!,amount:5,reason:"Approved partial refund",actor:"admin"});
    const dispute=await createSandboxDispute({orderId:checkout.orderId!,amount:10,reason:"Test dispute"});
    await submitDisputeEvidence({disputeId:dispute.id,type:"tracking",content:"TRACK-1",actor:"seller"});
    const hook=await recordWebhook({providerEventId:"evt-ops-1",eventType:"charge.updated",payload:{ok:true}});
    expect(hook.duplicate).toBe(false);
    expect((await recordWebhook({providerEventId:"evt-ops-1",eventType:"charge.updated",payload:{ok:true}})).duplicate).toBe(true);
    await replayWebhook(hook.id!);
    const recon=await runReconciliation();
    expect(recon.issueCount).toBe(0);
    const ops=await operationsDashboard();
    expect(ops.returns.length).toBe(1);
    expect(ops.refunds.length).toBe(1);
    expect(ops.shipments.length).toBeGreaterThan(0);
    expect(ops.disputes.length).toBe(1);
    expect(ops.disputeEvidence.length).toBe(1);
    expect(ops.reconciliation.length).toBe(1);
    expect(ops.risk.length).toBe(1);
  });
});
