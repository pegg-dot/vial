import { beforeEach, describe, expect, it } from "vitest";
import type { QueryResultRow } from "pg";
import { getDatabase, resetDatabaseForTests } from "@/server/db/client";
import { createSession, recordLoginAttempt } from "@/server/auth/repository";
import { getPeopleOverview } from "@/server/admin/people";

beforeEach(async () => {
  process.env.VIALGRADE_PGLITE_MEMORY = "true";
  await resetDatabaseForTests();
  const db = await getDatabase();
  await db.query(
    `INSERT INTO auth_users(id,email,display_name,account_type,roles,status,last_login_at)
     VALUES('user:owner','owner@vialgrade.test','Owner','staff','["administrator"]'::jsonb,'active',NOW())
     ON CONFLICT(id) DO NOTHING`,
  );
  await db.query(
    `INSERT INTO auth_users(id,email,display_name,account_type,roles,status)
     VALUES('user:reader','reader@example.test','A Reader','customer','["customer"]'::jsonb,'active')
     ON CONFLICT(id) DO NOTHING`,
  );
});

async function openSessionFor(userId: string) {
  const db = await getDatabase();
  const user = (await db.query<QueryResultRow & { id: string }>(`SELECT * FROM auth_users WHERE id=$1`, [userId])).rows[0]!;
  return createSession(
    { ...user, roles: ["administrator"] } as Parameters<typeof createSession>[0],
    { requestId: "req-1", ipHash: "iphash", userAgentHash: "uahash" },
    db,
  );
}

describe("who has an account and who signed in", () => {
  it("lists every account with its type and status", async () => {
    const overview = await getPeopleOverview();
    const emails = overview.accounts.map(a => a.email);
    expect(emails).toContain("owner@vialgrade.test");
    expect(emails).toContain("reader@example.test");
    expect(overview.accounts.find(a => a.email === "reader@example.test")?.accountType).toBe("customer");
  });

  it("counts a live session and stops counting it once revoked", async () => {
    const session = await openSessionFor("user:owner");
    const before = await getPeopleOverview();
    expect(before.accounts.find(a => a.email === "owner@vialgrade.test")?.activeSessions).toBe(1);

    const db = await getDatabase();
    await db.query(`UPDATE auth_sessions SET revoked_at=NOW() WHERE id=$1`, [session.id]);

    const after = await getPeopleOverview();
    expect(after.accounts.find(a => a.email === "owner@vialgrade.test")?.activeSessions).toBe(0);
  });

  it("shows recent sign-in attempts, successful and failed", async () => {
    const db = await getDatabase();
    await recordLoginAttempt("owner@vialgrade.test", "success", { requestId: "r1", ipHash: "h" }, db);
    await recordLoginAttempt("owner@vialgrade.test", "failure", { requestId: "r2", ipHash: "h" }, db);

    const overview = await getPeopleOverview();
    const outcomes = overview.signIns.map(s => s.outcome);
    expect(outcomes).toContain("success");
    expect(outcomes).toContain("failure");
    expect(overview.totals.failedRecently).toBe(1);
  });

  // The privacy notice promises analytics carry no account identifier, and that the stored IP and
  // user-agent hashes exist for session management and rate-limiting — not for profiling. This is
  // an account-administration view, so it must never surface either.
  it("never exposes an IP or user-agent hash", async () => {
    await openSessionFor("user:owner");
    await recordLoginAttempt("owner@vialgrade.test", "success", { requestId: "r1", ipHash: "secret-hash" }, await getDatabase());

    const overview = await getPeopleOverview();
    const serialised = JSON.stringify(overview);
    expect(serialised).not.toContain("secret-hash");
    expect(serialised.toLowerCase()).not.toContain("ip_hash");
    expect(serialised.toLowerCase()).not.toContain("iphash");
    expect(serialised.toLowerCase()).not.toContain("useragent");
  });
});
