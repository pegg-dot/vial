"use server";

import { redirect } from "next/navigation";
import { getDatabase } from "@/server/db/client";
import { getRequestContext } from "@/server/auth/request-context";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { confirmSubscription, defaultMailer, requestSubscription, unsubscribeAndDelete } from "@/server/digest/subscribers";

export type SubscribeState = { status: "idle" | "sent" | "invalid" | "unavailable" | "needs-consent" | "slow-down" };

/** The email form. Consent is an unticked checkbox the reader must tick; nothing is stored without it. */
export async function subscribeAction(_previous: SubscribeState, form: FormData): Promise<SubscribeState> {
  // A field real readers never see. A bot that fills it gets the same reply a real signup gets.
  if (String(form.get("company") ?? "").trim() !== "") return { status: "sent" };
  if (form.get("consent") !== "yes") return { status: "needs-consent" };
  const ctx = await getRequestContext();
  const limit = await consumeRateLimit({ bucket: "digest-subscribe-ip", key: ctx.ipHash, limit: 5, windowSeconds: 3600 });
  if (!limit.allowed) return { status: "slow-down" };
  return { status: await requestSubscription(await getDatabase(), form.get("email"), defaultMailer()) };
}

/** Confirm and unsubscribe are POSTs, so a mail scanner that opens the link cannot trigger them. */
export async function confirmAction(form: FormData): Promise<void> {
  const ok = await confirmSubscription(await getDatabase(), String(form.get("id") ?? ""), String(form.get("t") ?? ""));
  redirect("/intelligence/updates/confirm?result=" + (ok ? "ok" : "invalid"));
}

export async function unsubscribeAction(form: FormData): Promise<void> {
  const ok = await unsubscribeAndDelete(await getDatabase(), String(form.get("id") ?? ""), String(form.get("t") ?? ""));
  redirect("/intelligence/updates/unsubscribe?result=" + (ok ? "ok" : "invalid"));
}
