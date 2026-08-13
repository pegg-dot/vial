import type { SqlConnection } from "@/server/db/client";
import { hashPassword } from "./password";

// Provisions the single owner admin account from the environment.
//
// The password is read from `VIALGRADE_ADMIN_PASSWORD` and stored only as a scrypt hash — it is
// never written to the repo, never logged, and never returned. Rotating it is a matter of changing
// the env var and redeploying: the hash is rewritten on next boot.
//
// Runs on every boot so the account cannot drift out of existence, and is a no-op unless both
// variables are set — an unconfigured deploy gets no admin rather than a default one.
export async function ensureOwnerAdmin(db: SqlConnection): Promise<{ provisioned: boolean; email?: string }> {
  const email = process.env.VIALGRADE_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.VIALGRADE_ADMIN_PASSWORD;
  if (!email || !password) return { provisioned: false };

  // hashPassword enforces a 12-character floor and throws below it. A misconfigured secret must not
  // take the whole boot down — the site should still serve, just without an admin.
  let passwordHash: string;
  try {
    passwordHash = await hashPassword(password);
  } catch {
    console.warn("[owner-admin] VIALGRADE_ADMIN_PASSWORD rejected (minimum 12 characters) — admin not provisioned.");
    return { provisioned: false };
  }

  const id = "user:staff:owner";
  await db.query(
    `INSERT INTO auth_users(id,email,display_name,account_type,roles,email_verified_at,mfa_enabled)
     VALUES($1,$2,'Owner','staff',$3::jsonb,NOW(),FALSE)
     ON CONFLICT(id) DO UPDATE SET email=EXCLUDED.email,account_type='staff',roles=EXCLUDED.roles,status='active',updated_at=NOW()`,
    [id, email, JSON.stringify(["administrator", "reviewer", "compliance_analyst", "finance_analyst"])],
  );
  await db.query(
    `INSERT INTO auth_credentials(user_id,password_hash) VALUES($1,$2)
     ON CONFLICT(user_id) DO UPDATE SET password_hash=EXCLUDED.password_hash,updated_at=NOW()`,
    [id, passwordHash],
  );
  await db.query(`INSERT INTO user_notification_preferences(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING`, [id]);
  return { provisioned: true, email };
}
