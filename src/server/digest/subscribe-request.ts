import { getDatabase } from "@/server/db/client";
import { getRequestContext } from "@/server/auth/request-context";
import { consumeRateLimit } from "@/server/security/rate-limit";
import type { SubscribeStatus } from "@/lib/updates-signup";
import { defaultMailer, requestSubscription, type Mailer } from "./subscribers";
import type { EmailConfig } from "@/server/email/resend";

/**
 * One email signup, from the signup page or the first-visit prompt. Consent is an unticked box the
 * reader must tick; nothing is stored without it. `mail` is null while the update email is not
 * sending, in which case the address is kept and confirmed later (see requestSubscription).
 */
export async function handleSubscribeRequest(
  fields: { email: unknown; consent: unknown; company: unknown },
  mail: { config: EmailConfig; send: Mailer } | null = defaultMailer(),
): Promise<Exclude<SubscribeStatus, "idle">> {
  // A field real readers never see. A bot that fills it gets the same reply a real signup gets.
  if (typeof fields.company === "string" && fields.company.trim() !== "") return mail ? "sent" : "saved";
  if (fields.consent !== "yes") return "needs-consent";
  const ctx = await getRequestContext();
  const limit = await consumeRateLimit({ bucket: "digest-subscribe-ip", key: ctx.ipHash, limit: 5, windowSeconds: 3600 });
  if (!limit.allowed) return "slow-down";
  return requestSubscription(await getDatabase(), fields.email, mail);
}
