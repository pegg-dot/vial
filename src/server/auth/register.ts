import { hashPassword } from "./password";
import { createSession, findUserByEmail, recordAuditEvent } from "./repository";
import { getDatabase } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { consumeRateLimit } from "@/server/security/rate-limit";
import { encodeSessionEnvelope, SESSION_TTL_SECONDS } from "./session-envelope";
import type { UserRole } from "./types";

export type RegisterResult =
  | { ok: true; principal: { id: string; email: string; displayName: string; accountType: "customer"; roles: UserRole[]; status: "active" }; cookieValue: string; maxAge: number; expiresAt: Date }
  | { ok: false; status: 400 | 409 | 429; reason: string; retryAfterSeconds?: number };

// Self-serve buyer signup. Creates a customer account only — vendors are DISCOVERED by
// the aggregator (ingestion), and labs onboard through a separate reviewed process, so
// this path can never mint a seller/lab/staff account.
export async function registerCustomer(
  input: { email: string; password: string; displayName: string },
  ctx: { requestId: string; ipHash: string; userAgentHash: string },
): Promise<RegisterResult> {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName.trim();

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, status: 400, reason: "Enter a valid email address." };
  if (displayName.length < 2 || displayName.length > 80) return { ok: false, status: 400, reason: "Enter your name (2–80 characters)." };
  if (input.password.length < 12) return { ok: false, status: 400, reason: "Password must be at least 12 characters." };

  // Rate-limit signups per IP to blunt automated account creation.
  const limit = await consumeRateLimit({ bucket: "auth-register-ip", key: ctx.ipHash, limit: 8, windowSeconds: 3600 });
  if (!limit.allowed) return { ok: false, status: 429, reason: "Too many sign-up attempts. Try again later.", retryAfterSeconds: 3600 };

  if (await findUserByEmail(email)) return { ok: false, status: 409, reason: "An account with that email already exists. Sign in instead." };

  const db = await getDatabase();
  const userId = newId("user:customer");
  await db.query(
    `INSERT INTO auth_users(id,email,display_name,account_type,roles,email_verified_at,mfa_enabled)
     VALUES($1,$2,$3,'customer','["customer"]'::jsonb,NULL,FALSE)`,
    [userId, email, displayName],
  );
  await db.query(`INSERT INTO auth_credentials(user_id,password_hash) VALUES($1,$2)`, [userId, await hashPassword(input.password)]);
  await db.query(`INSERT INTO user_notification_preferences(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`, [userId]);

  const user = { id: userId, email, display_name: displayName, account_type: "customer" as const, roles: ["customer"] as UserRole[], password_hash: "" } as Parameters<typeof createSession>[0];
  const session = await createSession(user, ctx);
  await recordAuditEvent({ actorUserId: userId, action: "auth.register", targetType: "user", targetId: userId, requestId: ctx.requestId, ipHash: ctx.ipHash });

  const cookieValue = encodeSessionEnvelope({
    version: 1, sessionId: session.id, userId, accountType: "customer",
    roles: ["customer"], issuedAt: Date.now(), expiresAt: session.expiresAt.getTime(),
  });
  return {
    ok: true,
    principal: { id: userId, email, displayName, accountType: "customer", roles: ["customer"], status: "active" },
    cookieValue, maxAge: SESSION_TTL_SECONDS, expiresAt: session.expiresAt,
  };
}
