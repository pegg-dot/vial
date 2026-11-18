"use server";

import { redirect } from "next/navigation";
import { getDatabase } from "@/server/db/client";
import { confirmSubscription, unsubscribeAndDelete } from "@/server/digest/subscribers";

// Signing up goes through POST /intelligence/updates/subscribe (see its route), so the first-visit
// prompt can use it from any page.

/** Confirm and unsubscribe are POSTs, so a mail scanner that opens the link cannot trigger them. */
export async function confirmAction(form: FormData): Promise<void> {
  const ok = await confirmSubscription(await getDatabase(), String(form.get("id") ?? ""), String(form.get("t") ?? ""));
  redirect("/intelligence/updates/confirm?result=" + (ok ? "ok" : "invalid"));
}

export async function unsubscribeAction(form: FormData): Promise<void> {
  const ok = await unsubscribeAndDelete(await getDatabase(), String(form.get("id") ?? ""), String(form.get("t") ?? ""));
  redirect("/intelligence/updates/unsubscribe?result=" + (ok ? "ok" : "invalid"));
}
