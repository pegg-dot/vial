import { randomUUID } from "node:crypto";
import type { SqlConnection } from "@/server/db/client";
import { DIGEST_CONSENT_VERSION, confirmationEmail } from "@/lib/digest-content";
import { emailConfig, sendEmail, type EmailConfig, type OutboundEmail } from "@/server/email/resend";
import { normalizeEmail, signDigestToken, verifyDigestToken } from "./tokens";

export const PENDING_TTL_DAYS = 3;
const RESEND_CONFIRM_AFTER_MINUTES = 10;
const GLOBAL_PENDING_PER_HOUR = 100;

export type Mailer = (message: OutboundEmail) => Promise<{ ok: boolean }>;
export type SubscribeResult = "sent" | "invalid" | "unavailable";

export function confirmUrl(siteUrl: string, id: string): string {
  return siteUrl + "/intelligence/updates/confirm?id=" + encodeURIComponent(id) + "&t=" + signDigestToken(id, "confirm");
}
export function unsubscribeUrl(siteUrl: string, id: string): string {
  return siteUrl + "/intelligence/updates/unsubscribe?id=" + encodeURIComponent(id) + "&t=" + signDigestToken(id, "unsubscribe");
}

/**
 * Starts a double opt-in. The result never says whether an address was already on the list, so the
 * form cannot be used to probe who subscribes. Nothing is kept for an address we could not mail.
 */
export async function requestSubscription(
  db: SqlConnection, rawEmail: unknown, mail: { config: EmailConfig; send: Mailer } | null,
): Promise<SubscribeResult> {
  const email = normalizeEmail(rawEmail);
  if (!email) return "invalid";
  if (!mail) return "unavailable";

  const existing = (await db.query<{ id: string; status: string; confirm_sent_at: Date | string | null }>(
    `SELECT id, status, confirm_sent_at FROM digest_subscribers WHERE email=$1`, [email])).rows[0];
  if (existing?.status === "active") return "sent";
  if (existing) {
    const last = existing.confirm_sent_at ? new Date(existing.confirm_sent_at).getTime() : 0;
    if (Date.now() - last < RESEND_CONFIRM_AFTER_MINUTES * 60_000) return "sent";
    const message = confirmationEmail(confirmUrl(mail.config.siteUrl, existing.id));
    const result = await mail.send({ to: email, ...message });
    if (result.ok) await db.query(`UPDATE digest_subscribers SET confirm_sent_at=NOW() WHERE id=$1`, [existing.id]);
    return result.ok ? "sent" : "unavailable";
  }

  const recent = Number((await db.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM digest_subscribers WHERE status='pending' AND created_at > NOW() - INTERVAL '1 hour'`)).rows[0]?.n ?? 0);
  if (recent >= GLOBAL_PENDING_PER_HOUR) return "unavailable";

  const id = randomUUID();
  await db.query(
    `INSERT INTO digest_subscribers(id,email,status,consent_version,confirm_sent_at) VALUES($1,$2,'pending',$3,NOW()) ON CONFLICT (email) DO NOTHING`,
    [id, email, DIGEST_CONSENT_VERSION]);
  const result = await mail.send({ to: email, ...confirmationEmail(confirmUrl(mail.config.siteUrl, id)) });
  if (!result.ok) {
    await db.query(`DELETE FROM digest_subscribers WHERE id=$1 AND status='pending'`, [id]);
    return "unavailable";
  }
  return "sent";
}

export async function confirmSubscription(db: SqlConnection, id: string, token: string | null): Promise<boolean> {
  if (!verifyDigestToken(id, "confirm", token)) return false;
  const r = await db.query(
    `UPDATE digest_subscribers SET status='active', confirmed_at=COALESCE(confirmed_at, NOW()) WHERE id=$1 AND (status='active' OR created_at > NOW() - INTERVAL '${PENDING_TTL_DAYS} days')`, [id]);
  return (r.rowCount ?? 0) > 0;
}

/** Unsubscribing IS deleting: the address and its consent record are removed, not flagged. */
export async function unsubscribeAndDelete(db: SqlConnection, id: string, token: string | null): Promise<boolean> {
  if (!verifyDigestToken(id, "unsubscribe", token)) return false;
  await db.query(`DELETE FROM digest_subscribers WHERE id=$1`, [id]);
  return true;
}

export async function purgeStalePending(db: SqlConnection): Promise<number> {
  const r = await db.query(`DELETE FROM digest_subscribers WHERE status='pending' AND created_at < NOW() - INTERVAL '${PENDING_TTL_DAYS} days'`);
  return r.rowCount ?? 0;
}

export function defaultMailer(): { config: EmailConfig; send: Mailer } | null {
  const config = emailConfig();
  return config ? { config, send: message => sendEmail(message, config) } : null;
}
