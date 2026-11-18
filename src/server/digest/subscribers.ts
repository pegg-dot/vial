import { randomUUID } from "node:crypto";
import type { SqlConnection } from "@/server/db/client";
import { DIGEST_CONSENT_VERSION, confirmationEmail } from "@/lib/digest-content";
import { emailConfig, sendEmail, type EmailConfig, type OutboundEmail } from "@/server/email/resend";
import { normalizeEmail, signDigestToken, verifyDigestToken } from "./tokens";

export const PENDING_TTL_DAYS = 3;
const RESEND_CONFIRM_AFTER_MINUTES = 10;
const GLOBAL_PENDING_PER_HOUR = 100;

export type Mailer = (message: OutboundEmail) => Promise<{ ok: boolean }>;
/**
 * "sent": a confirmation link was mailed (or the address was already on the list). "saved": the
 * update email is not sending yet, so the address is kept and the link goes out when it starts.
 */
export type SubscribeResult = "sent" | "saved" | "invalid" | "unavailable";

export function confirmUrl(siteUrl: string, id: string): string {
  return siteUrl + "/intelligence/updates/confirm?id=" + encodeURIComponent(id) + "&t=" + signDigestToken(id, "confirm");
}
export function unsubscribeUrl(siteUrl: string, id: string): string {
  return siteUrl + "/intelligence/updates/unsubscribe?id=" + encodeURIComponent(id) + "&t=" + signDigestToken(id, "unsubscribe");
}

/**
 * Starts a double opt-in. The result never says whether an address was already on the list, so the
 * form cannot be used to probe who subscribes.
 *
 * With mail configured, nothing is kept for an address we could not mail. With no mail configured
 * (the update email has not started), the address is kept as a pending row with NO confirmation
 * sent: the reader ticked the consent box, and sendWaitingConfirmations mails the link once sending
 * starts. Such a row is never mailed anything else until it is confirmed.
 */
export async function requestSubscription(
  db: SqlConnection, rawEmail: unknown, mail: { config: EmailConfig; send: Mailer } | null,
): Promise<SubscribeResult> {
  const email = normalizeEmail(rawEmail);
  if (!email) return "invalid";

  const existing = (await db.query<{ id: string; status: string; confirm_sent_at: Date | string | null }>(
    `SELECT id, status, confirm_sent_at FROM digest_subscribers WHERE email=$1`, [email])).rows[0];
  if (!mail) {
    // Same reply whether or not the address was already here.
    if (existing) return "saved";
    if (await pendingThisHour(db) >= GLOBAL_PENDING_PER_HOUR) return "unavailable";
    await db.query(
      `INSERT INTO digest_subscribers(id,email,status,consent_version,confirm_sent_at) VALUES($1,$2,'pending',$3,NULL) ON CONFLICT (email) DO NOTHING`,
      [randomUUID(), email, DIGEST_CONSENT_VERSION]);
    return "saved";
  }
  if (existing?.status === "active") return "sent";
  if (existing) {
    const last = existing.confirm_sent_at ? new Date(existing.confirm_sent_at).getTime() : 0;
    if (Date.now() - last < RESEND_CONFIRM_AFTER_MINUTES * 60_000) return "sent";
    const message = confirmationEmail(confirmUrl(mail.config.siteUrl, existing.id));
    const result = await mail.send({ to: email, ...message });
    if (result.ok) await db.query(`UPDATE digest_subscribers SET confirm_sent_at=NOW() WHERE id=$1`, [existing.id]);
    return result.ok ? "sent" : "unavailable";
  }

  if (await pendingThisHour(db) >= GLOBAL_PENDING_PER_HOUR) return "unavailable";

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

async function pendingThisHour(db: SqlConnection): Promise<number> {
  return Number((await db.query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM digest_subscribers WHERE status='pending' AND created_at > NOW() - INTERVAL '1 hour'`)).rows[0]?.n ?? 0);
}

/**
 * Mails the confirmation link to addresses saved while the update email was not sending, oldest
 * first, at most `limit` a run. A failed send leaves the row waiting for the next run.
 */
export async function sendWaitingConfirmations(
  db: SqlConnection, mail: { config: EmailConfig; send: Mailer }, limit = 200,
): Promise<{ sent: number; failed: number; remaining: number }> {
  const waiting = (await db.query<{ id: string; email: string }>(
    `SELECT id, email FROM digest_subscribers WHERE status='pending' AND confirm_sent_at IS NULL ORDER BY created_at, id`)).rows;
  let sent = 0, failed = 0;
  for (const row of waiting.slice(0, limit)) {
    const result = await mail.send({ to: row.email, ...confirmationEmail(confirmUrl(mail.config.siteUrl, row.id)) });
    if (result.ok) {
      sent++;
      await db.query(`UPDATE digest_subscribers SET confirm_sent_at=NOW() WHERE id=$1 AND status='pending'`, [row.id]);
    } else failed++;
  }
  return { sent, failed, remaining: Math.max(0, waiting.length - limit) };
}

export async function confirmSubscription(db: SqlConnection, id: string, token: string | null): Promise<boolean> {
  if (!verifyDigestToken(id, "confirm", token)) return false;
  const r = await db.query(
    `UPDATE digest_subscribers SET status='active', confirmed_at=COALESCE(confirmed_at, NOW()) WHERE id=$1 AND (status='active' OR COALESCE(confirm_sent_at, created_at) > NOW() - INTERVAL '${PENDING_TTL_DAYS} days')`, [id]);
  return (r.rowCount ?? 0) > 0;
}

/** Unsubscribing IS deleting: the address and its consent record are removed, not flagged. */
export async function unsubscribeAndDelete(db: SqlConnection, id: string, token: string | null): Promise<boolean> {
  if (!verifyDigestToken(id, "unsubscribe", token)) return false;
  await db.query(`DELETE FROM digest_subscribers WHERE id=$1`, [id]);
  return true;
}

/**
 * Deletes requests whose confirmation link went unanswered for 3 days. The clock starts when the
 * link was mailed, so an address saved before the update email started is not purged for waiting.
 */
export async function purgeStalePending(db: SqlConnection): Promise<number> {
  const r = await db.query(`DELETE FROM digest_subscribers WHERE status='pending' AND confirm_sent_at IS NOT NULL AND confirm_sent_at < NOW() - INTERVAL '${PENDING_TTL_DAYS} days'`);
  return r.rowCount ?? 0;
}

export function defaultMailer(): { config: EmailConfig; send: Mailer } | null {
  const config = emailConfig();
  return config ? { config, send: message => sendEmail(message, config) } : null;
}
