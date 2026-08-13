"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSellerPermission } from "@/server/auth/session";
import { getSellerContext, updateOnboardingStep, connectSandboxIntegration, runCatalogImport, acceptImportJob, confirmImportRow, createSellerProduct, createSellerBatch, createEvidenceDocument, proposeEvidenceLinks, confirmEvidenceLink, adjustInventory, inviteSellerTeamMember, type OnboardingStepKey } from "@/server/seller/ops";
import type { SellerConnectorProvider } from "@/server/seller/connectors";
import { getDatabase } from "@/server/db/client";
import { createShipment, submitDisputeEvidence } from "@/server/commerce/operations";
import { createProviderAccountForSeller, createProviderOnboarding, requestUnderwritingReview, syncProviderAccount } from "@/server/commerce/activation";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function number(formData: FormData, name: string, fallback = 0) {
  const value = Number(formData.get(name));
  return Number.isFinite(value) ? value : fallback;
}

async function seller(permission: Parameters<typeof requireSellerPermission>[0]) {
  const principal = await requireSellerPermission(permission);
  const context = await getSellerContext(principal.email);
  if (!context) redirect("/login");
  return { principal, context };
}

function refreshSeller() {
  revalidatePath("/seller", "layout");
  revalidatePath("/admin/commerce");
  revalidatePath("/admin/sellers");
}

export async function saveOnboardingStepAction(formData: FormData) {
  const { context } = await seller("seller:onboarding:write");
  const step = text(formData, "step") as OnboardingStepKey;
  const payload: Record<string, unknown> = {};
  if (step === "business") Object.assign(payload, { legalName: text(formData, "legalName"), displayName: text(formData, "displayName"), websiteUrl: text(formData, "websiteUrl"), countryCode: text(formData, "countryCode") });
  else if (step === "operations") Object.assign(payload, { supportEmail: text(formData, "supportEmail"), returnsPolicy: text(formData, "returnsPolicy"), fulfillmentSlaHours: number(formData, "fulfillmentSlaHours", 48), shippingOrigin: { country: text(formData, "originCountry"), region: text(formData, "originRegion"), city: text(formData, "originCity") } });
  else Object.assign(payload, { acknowledged: formData.get("acknowledged") === "on", note: text(formData, "note") });
  await updateOnboardingStep({ sellerId: context.sellerId, step, payload, complete: formData.get("complete") === "true" });
  refreshSeller();
  redirect(`/seller/onboarding?step=${encodeURIComponent(step)}&saved=1`);
}

export async function connectIntegrationAction(formData: FormData) {
  const { context } = await seller("seller:integrations:manage");
  const provider = text(formData, "provider") as SellerConnectorProvider;
  await connectSandboxIntegration({ sellerId: context.sellerId, provider, settings: { storeUrl: text(formData, "storeUrl"), connectedBy: context.membership.display_name } });
  await updateOnboardingStep({ sellerId: context.sellerId, step: provider === "stripe_connect" ? "payments" : "connect", payload: { provider, connected: true }, complete: true });
  refreshSeller();
  redirect(`/seller/integrations?connected=${encodeURIComponent(provider)}`);
}

export async function runCatalogImportAction(formData: FormData) {
  const { principal, context } = await seller("seller:catalog:write");
  const provider = text(formData, "provider") as SellerConnectorProvider;
  const result = await runCatalogImport({ sellerId: context.sellerId, provider, actorId: principal.id });
  refreshSeller();
  const job = result?.job as { id?: string } | undefined;
  redirect(`/seller/imports?job=${encodeURIComponent(String(job?.id ?? ""))}`);
}

export async function acceptImportJobAction(formData: FormData) {
  const { principal, context } = await seller("seller:catalog:write");
  const jobId = text(formData, "jobId");
  await acceptImportJob({ sellerId: context.sellerId, jobId, actorId: principal.id });
  await updateOnboardingStep({ sellerId: context.sellerId, step: "catalog", payload: { jobId, imported: true }, complete: true });
  refreshSeller();
  redirect(`/seller/catalog?imported=${encodeURIComponent(jobId)}`);
}

export async function confirmImportRowAction(formData: FormData) {
  const { context } = await seller("seller:catalog:write");
  const jobId = text(formData, "jobId");
  await confirmImportRow({ sellerId: context.sellerId, rowId: text(formData, "rowId"), compoundEntityId: text(formData, "compoundEntityId") || null, selected: formData.get("selected") === "on" });
  refreshSeller();
  redirect(`/seller/imports?job=${encodeURIComponent(jobId)}`);
}

export async function createProductAction(formData: FormData) {
  const { principal, context } = await seller("seller:catalog:write");
  await createSellerProduct({ sellerId: context.sellerId, title: text(formData, "title"), description: text(formData, "description"), compoundEntityId: text(formData, "compoundEntityId") || null, quantityLabel: text(formData, "quantityLabel"), sku: text(formData, "sku"), price: number(formData, "price"), inventory: number(formData, "inventory"), actorId: principal.id });
  refreshSeller();
  redirect("/seller/catalog?created=1");
}

export async function createBatchAction(formData: FormData) {
  const { context } = await seller("seller:batches:manage");
  await createSellerBatch({ sellerId: context.sellerId, productId: text(formData, "productId"), batchCode: text(formData, "batchCode"), quantity: number(formData, "quantity"), productionDate: text(formData, "productionDate") || undefined, expirationDate: text(formData, "expirationDate") || undefined });
  refreshSeller();
  redirect("/seller/batches?created=1");
}

export async function createEvidenceAction(formData: FormData) {
  const { context } = await seller("seller:evidence:manage");
  const documentId = await createEvidenceDocument({ sellerId: context.sellerId, filename: text(formData, "filename"), documentType: text(formData, "documentType") || "coa", issuer: text(formData, "issuer"), reportIdentifier: text(formData, "reportIdentifier"), reportDate: text(formData, "reportDate"), expiresAt: text(formData, "expiresAt"), sourceUrl: text(formData, "sourceUrl"), extractedFields: { identity: text(formData, "identity"), quantity: text(formData, "quantity"), batchCode: text(formData, "batchCode"), reportConfirmed: formData.get("reportConfirmed") === "on" } });
  await proposeEvidenceLinks({ sellerId: context.sellerId, documentId });
  refreshSeller();
  redirect(`/seller/evidence?uploaded=${encodeURIComponent(documentId)}`);
}

export async function reviewEvidenceLinkAction(formData: FormData) {
  const { context } = await seller("seller:evidence:manage");
  const status = text(formData, "status") as "confirmed" | "rejected";
  await confirmEvidenceLink({ sellerId: context.sellerId, linkId: text(formData, "linkId"), status });
  if (status === "confirmed") await updateOnboardingStep({ sellerId: context.sellerId, step: "evidence", payload: { confirmed: true }, complete: true });
  refreshSeller();
  redirect("/seller/evidence?reviewed=1");
}

export async function adjustInventoryAction(formData: FormData) {
  const { principal, context } = await seller("seller:inventory:manage");
  await adjustInventory({ sellerId: context.sellerId, productId: text(formData, "productId"), delta: number(formData, "delta"), actorId: principal.id });
  refreshSeller();
  redirect("/seller/inventory?updated=1");
}

export async function inviteTeamMemberAction(formData: FormData) {
  const { context } = await seller("seller:team:manage");
  await inviteSellerTeamMember({ sellerId: context.sellerId, email: text(formData, "email"), displayName: text(formData, "displayName"), role: text(formData, "role") });
  refreshSeller();
  redirect("/seller/team?invited=1");
}


export async function fulfillSellerOrderAction(formData: FormData) {
  const { context } = await seller("seller:orders:write");
  const orderId = text(formData, "orderId");
  const db = await getDatabase();
  const owned = (await db.query(`SELECT 1 FROM commerce_order_lines WHERE order_id=$1 AND seller_id=$2 LIMIT 1`, [orderId, context.sellerId])).rows[0];
  if (!owned) throw new Error("Order not found for this seller");
  await createShipment({ orderId, sellerId: context.sellerId, carrier: text(formData, "carrier") || "VialGrade Sandbox", trackingCode: text(formData, "trackingCode") });
  refreshSeller();
  redirect(`/seller/orders?shipped=${encodeURIComponent(orderId)}`);
}

export async function submitSellerDisputeEvidenceAction(formData: FormData) {
  const { principal, context } = await seller("seller:orders:write");
  const disputeId = text(formData, "disputeId");
  const db = await getDatabase();
  const owned = (await db.query(`SELECT 1 FROM commerce_disputes d JOIN commerce_order_lines ol ON ol.order_id=d.order_id WHERE d.id=$1 AND ol.seller_id=$2 LIMIT 1`, [disputeId, context.sellerId])).rows[0];
  if (!owned) throw new Error("Dispute not found for this seller");
  await submitDisputeEvidence({ disputeId, type: text(formData, "evidenceType") || "fulfillment", content: text(formData, "content"), actor: principal.id });
  refreshSeller();
  redirect(`/seller/disputes?submitted=${encodeURIComponent(disputeId)}`);
}


export async function createPaymentAccountAction() {
  const { principal, context } = await seller("seller:payments:manage");
  await createProviderAccountForSeller({ sellerId: context.sellerId, email: principal.email, actorId: principal.id });
  refreshSeller();
  redirect("/seller/payments?account=created");
}

export async function startPaymentOnboardingAction() {
  const { principal, context } = await seller("seller:payments:manage");
  const session = await createProviderOnboarding({ sellerId: context.sellerId, actorId: principal.id });
  refreshSeller();
  redirect(session.url);
}

export async function syncPaymentAccountAction() {
  const { principal, context } = await seller("seller:payments:manage");
  await syncProviderAccount({ sellerId: context.sellerId, actorId: principal.id });
  refreshSeller();
  redirect("/seller/payments?synced=1");
}

export async function requestUnderwritingAction(formData: FormData) {
  const { principal, context } = await seller("seller:payments:manage");
  const jurisdictions = text(formData, "jurisdictions").split(",").map((item) => item.trim()).filter(Boolean);
  await requestUnderwritingReview({ sellerId: context.sellerId, actorId: principal.id, jurisdictions: jurisdictions.length ? jurisdictions : ["US-SANDBOX"], notes: text(formData, "notes") });
  refreshSeller();
  redirect("/seller/payments?underwriting=requested");
}
