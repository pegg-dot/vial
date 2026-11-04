import { createHmac, timingSafeEqual } from "node:crypto";

export type DigestTokenPurpose = "confirm" | "unsubscribe";

function secret(): string {
  const v = process.env.VIALGRADE_PRIVACY_HASH_SECRET?.trim() || process.env.VIALGRADE_SESSION_SECRET?.trim();
  if (v && v.length >= 32) return v;
  if (process.env.NODE_ENV === "production") throw new Error("VIALGRADE_PRIVACY_HASH_SECRET must be at least 32 characters in production");
  return "vial-local-digest-secret-not-for-production-use";
}

/**
 * A link token is an HMAC of the subscriber id and what the link may do, so no raw token is stored
 * and a confirm link can never be used to unsubscribe (or the reverse). It does not expire by
 * itself: the row it points at is deleted when a signup goes unconfirmed or someone unsubscribes.
 */
export function signDigestToken(id: string, purpose: DigestTokenPurpose, key = secret()): string {
  return createHmac("sha256", key).update("digest:" + purpose + ":" + id).digest("base64url");
}

export function verifyDigestToken(id: string, purpose: DigestTokenPurpose, presented: string | null | undefined, key = secret()): boolean {
  if (!id || !presented) return false;
  const a = Buffer.from(presented);
  const b = Buffer.from(signDigestToken(id, purpose, key));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Lower-cased address, or null when it is not a plausible single mailbox. */
export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length < 6 || email.length > 254) return null;
  if (!/^[^\s@<>(),;:"[\]\\]+@[^\s@<>(),;:"[\]\\]+\.[a-z]{2,}$/.test(email)) return null;
  const [local, domain] = email.split("@") as [string, string];
  if (local.length > 64 || domain.includes("..") || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return null;
  return email;
}
