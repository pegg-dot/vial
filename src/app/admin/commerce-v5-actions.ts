"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/server/auth/session";
import { approveUnderwriting, setListingActivation, syncProviderAccount } from "@/server/commerce/activation";
import { releaseDueReserves, runV5Settlement } from "@/server/commerce/settlement";
import { replayProviderEvent } from "@/server/commerce/provider-events";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function refreshCommerce() {
  revalidatePath("/admin/commerce");
  revalidatePath("/admin/underwriting");
  revalidatePath("/admin/activation");
  revalidatePath("/admin/settlements");
  revalidatePath("/admin/provider-events");
  revalidatePath("/seller", "layout");
}

export async function decideUnderwritingAction(formData: FormData) {
  const session = await requirePermission("commerce:write");
  const status = text(formData, "status") as "test_approved" | "approved" | "rejected";
  await approveUnderwriting({ sellerId: text(formData, "sellerId"), status, actorId: session.principal.id, notes: text(formData, "notes") });
  refreshCommerce();
  redirect("/admin/underwriting?updated=1");
}

export async function syncProviderAccountAdminAction(formData: FormData) {
  const session = await requirePermission("commerce:write");
  await syncProviderAccount({ sellerId: text(formData, "sellerId"), actorId: session.principal.id });
  refreshCommerce();
  redirect("/admin/underwriting?synced=1");
}

export async function updateListingActivationAction(formData: FormData) {
  const session = await requirePermission("commerce:write");
  const state = text(formData, "state") as "checkout_sandbox" | "processor_review" | "commerce_approved" | "commerce_suspended" | "prohibited";
  await setListingActivation({
    listingId: text(formData, "listingId"),
    state,
    processorReviewStatus: text(formData, "processorReviewStatus"),
    legalReviewStatus: text(formData, "legalReviewStatus"),
    allowedCustomerTypes: text(formData, "allowedCustomerTypes").split(",").map((item) => item.trim()).filter(Boolean),
    allowedJurisdictions: text(formData, "allowedJurisdictions").split(",").map((item) => item.trim()).filter(Boolean),
    actorId: session.principal.id,
  });
  refreshCommerce();
  redirect("/admin/activation?updated=1");
}

export async function runSettlementAction(formData: FormData) {
  const session = await requirePermission("finance:write");
  await runV5Settlement({ actorId: session.principal.id, periodStart: text(formData, "periodStart") || undefined, periodEnd: text(formData, "periodEnd") || undefined });
  refreshCommerce();
  redirect("/admin/settlements?run=1");
}

export async function releaseReservesAction() {
  const session = await requirePermission("finance:write");
  await releaseDueReserves(session.principal.id);
  refreshCommerce();
  redirect("/admin/settlements?released=1");
}

export async function replayProviderEventAction(formData: FormData) {
  await requirePermission("commerce:write");
  await replayProviderEvent(text(formData, "eventId"));
  refreshCommerce();
  redirect("/admin/provider-events?replay=1");
}
