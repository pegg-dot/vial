// Who has an account here, and who has been signing in.
//
// This is account ADMINISTRATION, not analytics, and the distinction is what keeps it lawful.
//
// The privacy notice makes two promises that constrain this file:
//   1. "Analytics records carry no account identifier, so they cannot be attached to a person even
//      by us." So nothing here may join to page_views or outbound_clicks. Reading someone's
//      browsing because you know who they are is exactly what that sentence rules out.
//   2. The stored IP and user-agent hashes exist "to show you your own active sessions" and to
//      rate-limit password guessing, and are "never used for analytics". So they are counted here,
//      never surfaced — a keyed hash is still a pseudonymous identifier, and displaying it invites
//      exactly the linkage the notice forbids.
//
// What is left is what an operator legitimately needs: who exists, what kind of account they hold,
// whether it is locked, whether they are signed in right now, and whether someone is failing to log
// in repeatedly. A test asserts no hash can leak through this shape.
import type { QueryResultRow } from "pg";
import { getDatabase, type SqlConnection } from "@/server/db/client";

export interface AccountRow {
  userId: string;
  email: string;
  displayName: string;
  accountType: string;
  status: string;
  emailVerified: boolean;
  mfaEnabled: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
  activeSessions: number;
  lockedUntil: string | null;
  failedLoginCount: number;
}

export interface SignInEvent {
  at: string;
  email: string;
  outcome: string;
}

export interface PeopleOverview {
  accounts: AccountRow[];
  signIns: SignInEvent[];
  totals: {
    accounts: number;
    byType: { accountType: string; count: number }[];
    signedInNow: number;
    failedRecently: number;
    lockedNow: number;
  };
}

export async function getPeopleOverview(
  options: { recentDays?: number; connection?: SqlConnection } = {},
): Promise<PeopleOverview> {
  const db = options.connection ?? (await getDatabase());
  const window = `${options.recentDays ?? 7} days`;

  const accounts = (
    await db.query<QueryResultRow & Record<string, string | number | boolean | null>>(
      `SELECT u.id, u.email, u.display_name, u.account_type, u.status,
              u.email_verified_at, u.mfa_enabled, u.created_at, u.last_login_at,
              u.locked_until, u.failed_login_count,
              (SELECT COUNT(*) FROM auth_sessions s
                WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > NOW()) AS active_sessions
       FROM auth_users u
       ORDER BY u.last_login_at DESC NULLS LAST, u.created_at DESC`,
    )
  ).rows.map(r => ({
    userId: String(r.id),
    email: String(r.email),
    displayName: String(r.display_name),
    accountType: String(r.account_type),
    status: String(r.status),
    emailVerified: r.email_verified_at !== null,
    mfaEnabled: Boolean(r.mfa_enabled),
    createdAt: r.created_at ? String(r.created_at) : null,
    lastLoginAt: r.last_login_at ? String(r.last_login_at) : null,
    activeSessions: Number(r.active_sessions ?? 0),
    lockedUntil: r.locked_until ? String(r.locked_until) : null,
    failedLoginCount: Number(r.failed_login_count ?? 0),
  }));

  // Attempts are keyed on the email that was typed, which is deliberate: a failed attempt against
  // an address that has no account is exactly the thing worth seeing.
  const signIns = (
    await db.query<QueryResultRow & { normalized_email: string; outcome: string; created_at: string }>(
      `SELECT normalized_email, outcome, created_at FROM auth_login_attempts
       WHERE created_at > NOW() - $1::interval
       ORDER BY created_at DESC LIMIT 100`,
      [window],
    )
  ).rows.map(r => ({ at: String(r.created_at), email: r.normalized_email, outcome: r.outcome }));

  const byType = (
    await db.query<QueryResultRow & { account_type: string; n: string | number }>(
      `SELECT account_type, COUNT(*) AS n FROM auth_users GROUP BY 1 ORDER BY 2 DESC`,
    )
  ).rows.map(r => ({ accountType: r.account_type, count: Number(r.n) }));

  return {
    accounts,
    signIns,
    totals: {
      accounts: accounts.length,
      byType,
      signedInNow: accounts.reduce((n, a) => n + (a.activeSessions > 0 ? 1 : 0), 0),
      failedRecently: signIns.filter(s => s.outcome !== "success").length,
      lockedNow: accounts.filter(a => a.lockedUntil !== null && new Date(a.lockedUntil) > new Date()).length,
    },
  };
}
