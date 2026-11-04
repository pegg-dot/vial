import type { SqlConnection } from "@/server/db/client";
import { allTopicsAnswered, buildDigest, selectDigestChanges } from "@/lib/digest-content";
import type { TopicTrials } from "@/server/intelligence/public-trials";
import { purgeStalePending, unsubscribeUrl, type Mailer } from "./subscribers";
import type { EmailConfig } from "@/server/email/resend";

/** One run sends to at most this many readers; the rest report as `remaining` and go next run. */
export const MAX_SENDS_PER_RUN = 300;
const WATERMARK = "last_digest_date";
const day = (d: Date) => d.toISOString().slice(0, 10);

export type DigestRunResult =
  | { state: "skipped"; reason: "email-not-configured" | "registry-unavailable" }
  | { state: "ok"; purged: number; changes: number; sent: number; failed: number; remaining: number };

/**
 * Weekly run. The date marker moves forward only when every registry topic answered AND everyone
 * due was mailed (or there was nothing to say), so a registry fault or a failed send never
 * silently swallows a week of changes.
 */
export async function runDigest(
  db: SqlConnection,
  deps: { topics: () => Promise<TopicTrials[]>; mail: { config: EmailConfig; send: Mailer } | null; now?: Date },
): Promise<DigestRunResult> {
  if (!deps.mail) return { state: "skipped", reason: "email-not-configured" };
  const now = deps.now ?? new Date();
  const purged = await purgeStalePending(db);
  const stored = (await db.query<{ value: string }>(`SELECT value FROM digest_state WHERE key=$1`, [WATERMARK])).rows[0]?.value;
  const since = stored ?? day(new Date(now.getTime() - 7 * 86_400_000));

  const topics = await deps.topics();
  if (!allTopicsAnswered(topics)) return { state: "skipped", reason: "registry-unavailable" };
  const changes = selectDigestChanges(topics, since);

  let sent = 0, failed = 0, remaining = 0;
  if (changes.length > 0) {
    const due = (await db.query<{ id: string; email: string }>(
      `SELECT id, email FROM digest_subscribers WHERE status='active' AND (last_digest_at IS NULL OR last_digest_at < $1) ORDER BY created_at, id`,
      [new Date(now.getTime() - 3 * 86_400_000)])).rows;
    remaining = Math.max(0, due.length - MAX_SENDS_PER_RUN);
    for (const person of due.slice(0, MAX_SENDS_PER_RUN)) {
      const link = unsubscribeUrl(deps.mail.config.siteUrl, person.id);
      const message = buildDigest({ changes, siteUrl: deps.mail.config.siteUrl, unsubscribeUrl: link, since })!;
      const result = await deps.mail.send({ to: person.email, ...message, headers: { "List-Unsubscribe": "<" + link + ">" } });
      if (result.ok) {
        sent++;
        await db.query(`UPDATE digest_subscribers SET last_digest_at=$2 WHERE id=$1`, [person.id, now]);
      } else failed++;
    }
  }
  // One permanently bad address must not freeze the marker; an all-failed run (an outage) must.
  if (remaining === 0 && (failed === 0 || sent > 0)) {
    await db.query(
      `INSERT INTO digest_state(key,value) VALUES($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW()`,
      [WATERMARK, day(now)]);
  }
  return { state: "ok", purged, changes: changes.length, sent, failed, remaining };
}
