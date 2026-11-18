// The email list as the owner needs to see it: how many addresses, how many are confirmed, how
// signups are trending, and who they are.
//
// This is list administration, not analytics. The list holds an address, the consent given and
// three timestamps, and nothing here joins it to page views, accounts or anything a person read:
// the privacy notice promises the list is not combined with analytics, and this file is where that
// promise would be broken. A test asserts the shape carries no other field.
//
// Unsubscribing deletes the row, so every figure is "on the list now". A day's count is the
// signups from that day that are still here, not everyone who ever signed up that day.
import { getDatabase, type SqlConnection } from "@/server/db/client";
import { emailConfig } from "@/server/email/resend";

export const SIGNUP_TIMEZONE = "America/New_York";

/** confirmed: clicked the link. confirmation-sent: link mailed, not clicked yet. waiting: saved before the update email started, no link mailed. */
export type SignupState = "confirmed" | "confirmation-sent" | "waiting";

export interface SignupRow {
  id: string;
  email: string;
  state: SignupState;
  signedUpAt: string;
  confirmedAt: string | null;
  lastEmailedAt: string | null;
}

export interface SignupOverview {
  total: number;
  confirmed: number;
  confirmationSent: number;
  waiting: number;
  last7Days: number;
  last30Days: number;
  /** The 30 days before those, for the trend. */
  previous30Days: number;
  /** One entry per calendar day (Eastern), oldest first, zero-filled. */
  daily: { day: string; count: number }[];
  /** Newest first, capped at the limit asked for. Never derive a total from its length. */
  rows: SignupRow[];
  /** Whether the site can send email at all (RESEND_API_KEY, DIGEST_FROM_EMAIL and an https site URL). */
  mailConnected: boolean;
  /** The date the last monthly update ran through, or null if none has. */
  lastUpdateThrough: string | null;
}

const iso = (v: Date | string | null): string | null => (v == null ? null : v instanceof Date ? v.toISOString() : new Date(v).toISOString());

/** The calendar day an instant falls on in the list's timezone, YYYY-MM-DD. */
export function signupDay(at: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: SIGNUP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** `days` consecutive calendar days ending on the day of `now`, each with its count or zero. Pure. */
export function fillSignupDays(counts: ReadonlyMap<string, number>, now: Date, days: number): { day: string; count: number }[] {
  const out: { day: string; count: number }[] = [];
  const [y, m, d] = signupDay(now).split("-").map(Number) as [number, number, number];
  for (let back = days - 1; back >= 0; back--) {
    // Noon UTC of a plain calendar date never crosses a day boundary when stepped by whole days.
    const day = new Date(Date.UTC(y, m - 1, d - back, 12)).toISOString().slice(0, 10);
    out.push({ day, count: counts.get(day) ?? 0 });
  }
  return out;
}

export function signupState(row: { status: string; confirm_sent_at: Date | string | null }): SignupState {
  return row.status === "active" ? "confirmed" : row.confirm_sent_at ? "confirmation-sent" : "waiting";
}

export async function getSignupOverview(
  options: { limit?: number; now?: Date; connection?: SqlConnection; mailConnected?: boolean } = {},
): Promise<SignupOverview> {
  const db = options.connection ?? (await getDatabase());
  const now = options.now ?? new Date();
  const limit = Math.max(1, Math.min(options.limit ?? 10, 2000));

  const [totals, daily, rows, marker] = await Promise.all([
    db.query<Record<string, string | number>>(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status='active') AS confirmed,
              COUNT(*) FILTER (WHERE status='pending' AND confirm_sent_at IS NOT NULL) AS confirmation_sent,
              COUNT(*) FILTER (WHERE status='pending' AND confirm_sent_at IS NULL) AS waiting,
              COUNT(*) FILTER (WHERE created_at > $1::timestamptz - INTERVAL '7 days') AS last7,
              COUNT(*) FILTER (WHERE created_at > $1::timestamptz - INTERVAL '30 days') AS last30,
              COUNT(*) FILTER (WHERE created_at <= $1::timestamptz - INTERVAL '30 days' AND created_at > $1::timestamptz - INTERVAL '60 days') AS previous30
       FROM digest_subscribers`, [now]),
    db.query<{ day: string; n: string | number }>(
      `SELECT to_char(created_at AT TIME ZONE '${SIGNUP_TIMEZONE}', 'YYYY-MM-DD') AS day, COUNT(*) AS n
       FROM digest_subscribers WHERE created_at > $1::timestamptz - INTERVAL '32 days' GROUP BY 1`, [now]),
    db.query<{ id: string; email: string; status: string; confirm_sent_at: Date | string | null; created_at: Date | string; confirmed_at: Date | string | null; last_digest_at: Date | string | null }>(
      `SELECT id, email, status, confirm_sent_at, created_at, confirmed_at, last_digest_at
       FROM digest_subscribers ORDER BY created_at DESC, id LIMIT $1`, [limit]),
    db.query<{ value: string }>(`SELECT value FROM digest_state WHERE key='last_digest_date'`),
  ]);

  const t = totals.rows[0] ?? {};
  const n = (key: string) => Number(t[key] ?? 0);
  return {
    total: n("total"),
    confirmed: n("confirmed"),
    confirmationSent: n("confirmation_sent"),
    waiting: n("waiting"),
    last7Days: n("last7"),
    last30Days: n("last30"),
    previous30Days: n("previous30"),
    daily: fillSignupDays(new Map(daily.rows.map((r) => [r.day, Number(r.n)])), now, 30),
    rows: rows.rows.map((r) => ({
      id: r.id,
      email: r.email,
      state: signupState(r),
      signedUpAt: iso(r.created_at)!,
      confirmedAt: iso(r.confirmed_at),
      lastEmailedAt: iso(r.last_digest_at),
    })),
    mailConnected: options.mailConnected ?? emailConfig() !== null,
    lastUpdateThrough: marker.rows[0]?.value ?? null,
  };
}
