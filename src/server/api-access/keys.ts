import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getDatabase, type SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";

export type ApiScope = "market:read" | "signals:read" | "export:read" | "feeds:read";
export const API_SCOPES: ApiScope[] = ["market:read", "signals:read", "export:read", "feeds:read"];

export interface ApiKeyRow {
  id: string;
  name: string;
  key_prefix: string;
  scopes: ApiScope[];
  status: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
}

export interface ResolvedApiKey {
  id: string;
  ownerId: string;
  scopes: ApiScope[];
}

function keyHash(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// Issues a new key. The plaintext is returned exactly once — only its hash is stored.
export async function createApiKey(input: { ownerId: string; name: string; scopes: ApiScope[]; expiresAt?: Date | null }, connection?: SqlConnection): Promise<{ id: string; plaintext: string; prefix: string }> {
  const db = connection ?? (await getDatabase());
  const plaintext = `vial_pk_${randomBytes(24).toString("base64url")}`;
  const prefix = plaintext.slice(0, 16);
  const id = newId("apikey");
  const scopes = input.scopes.filter((scope): scope is ApiScope => (API_SCOPES as string[]).includes(scope));
  await db.query(
    `INSERT INTO api_keys (id, owner_user_id, name, key_prefix, key_hash, scopes, expires_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
    [id, input.ownerId, input.name, prefix, keyHash(plaintext), JSON.stringify(scopes), input.expiresAt ?? null],
  );
  return { id, plaintext, prefix };
}

export async function listApiKeys(ownerId: string, connection?: SqlConnection): Promise<ApiKeyRow[]> {
  const db = connection ?? (await getDatabase());
  return (await db.query<ApiKeyRow>(`SELECT id, name, key_prefix, scopes, status, created_at, last_used_at, expires_at FROM api_keys WHERE owner_user_id = $1 ORDER BY created_at DESC`, [ownerId])).rows;
}

// Owner-scoped: a user can only revoke their own key.
export async function revokeApiKey(ownerId: string, keyId: string, connection?: SqlConnection): Promise<boolean> {
  const db = connection ?? (await getDatabase());
  const result = await db.query(`UPDATE api_keys SET status = 'revoked' WHERE id = $1 AND owner_user_id = $2 AND status = 'active'`, [keyId, ownerId]);
  return Number(result.rowCount ?? 0) > 0;
}

// Resolves a presented key: hash match, still active, not expired. Bumps last_used_at.
export async function resolveApiKey(rawToken: string, connection?: SqlConnection): Promise<ResolvedApiKey | null> {
  if (!rawToken.startsWith("vial_pk_")) return null;
  const db = connection ?? (await getDatabase());
  const row = (await db.query<{ id: string; owner_user_id: string; key_hash: string; scopes: unknown; status: string; expires_at: string | null }>(
    `SELECT id, owner_user_id, key_hash, scopes, status, expires_at FROM api_keys WHERE key_hash = $1`,
    [keyHash(rawToken)],
  )).rows[0];
  if (!row || row.status !== "active") return null;
  // Timing-safe confirmation of the hash we matched on.
  const presented = Buffer.from(keyHash(rawToken));
  const stored = Buffer.from(row.key_hash);
  if (presented.length !== stored.length || !timingSafeEqual(presented, stored)) return null;
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) return null;
  await db.query(`UPDATE api_keys SET last_used_at = NOW() WHERE id = $1`, [row.id]);
  const scopes = Array.isArray(row.scopes) ? (row.scopes as ApiScope[]) : [];
  return { id: row.id, ownerId: row.owner_user_id, scopes };
}
