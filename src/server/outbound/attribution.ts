// Making the handoff provable.
//
// A click we record is our word. A session the vendor sees in THEIR OWN analytics is theirs — and
// that asymmetry is the whole negotiating position. So every outbound URL carries standard UTM
// parameters plus a short click ref:
//
//   ?utm_source=vialgrade&utm_medium=referral&utm_campaign=<compound>&utm_content=<listing>&vg=<ref>
//
// Nothing here requires the vendor to install, sign, or agree to anything. The day they look at
// their Shopify/Woo/GA referral report, VialGrade is already itemised with sessions and orders
// against it. The `vg` ref is what later closes the loop exactly, if they choose to post back.
import { createHash } from "node:crypto";

export const UTM_SOURCE = "vialgrade";

/** Short, URL-safe, unguessable-enough click reference. Not a secret — an opaque join key. */
export function newClickRef(): string {
  return createHash("sha256")
    .update(`${Date.now()}:${Math.random()}:${process.pid}`)
    .digest("base64url")
    .slice(0, 12);
}

/**
 * Count distinct PEOPLE without being able to identify one.
 *
 * Salted with a per-day component so the same visitor hashes differently tomorrow: enough to say
 * "41 distinct people clicked through to you today", never enough to build a profile or link a
 * person across days. The privacy secret never leaves the server.
 */
export function visitorHash(ip: string | null, userAgent: string | null, day = new Date()): string {
  const secret = privacySecret();
  const stamp = day.toISOString().slice(0, 10);
  return createHash("sha256")
    .update(`${secret}:${stamp}:${ip ?? ""}:${userAgent ?? ""}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * The salt that makes a visitor hash unguessable.
 *
 * This used to be `process.env.VIALGRADE_PRIVACY_HASH_SECRET ?? ""`. With an empty secret the hash
 * collapses to sha256(date : ip : user-agent) — every input publicly known — so the entire IPv4
 * space can be enumerated in minutes and each "anonymous" hash resolved back to an address. The
 * pseudonymous analytics would silently become recoverable personal data, and the privacy notice
 * that promises otherwise would be false. That is a legal exposure created by a missing variable.
 *
 * Failing loudly in production is the only safe behaviour, and it matches how the session layer in
 * auth/request-context.ts already treats the same secret. Outside production a fixed development
 * value keeps local work and tests running.
 */
function privacySecret(): string {
  const configured = process.env.VIALGRADE_PRIVACY_HASH_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === "production") {
    throw new Error("VIALGRADE_PRIVACY_HASH_SECRET must be set to at least 32 characters in production — without it visitor hashes are reversible.");
  }
  return "vial-local-privacy-hash-secret-at-least-32-characters";
}

export function deviceOf(userAgent: string | null): string {
  const ua = (userAgent ?? "").toLowerCase();
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobi|android|iphone/.test(ua)) return "mobile";
  if (!ua) return "unknown";
  return "desktop";
}

export interface TagInput {
  compoundSlug?: string | null;
  listingSlug?: string | null;
  clickRef: string;
}

/**
 * Append attribution parameters to a destination URL.
 *
 * Never overwrites a parameter the vendor's own URL already carries — if a storefront is already
 * using utm_source for its own campaign we must not clobber it, and a negotiated affiliate rule
 * (applied separately) always takes precedence over these defaults.
 */
export function tagDestination(destination: string, input: TagInput): string {
  try {
    const url = new URL(destination);
    const params: Record<string, string> = {
      utm_source: UTM_SOURCE,
      utm_medium: "referral",
      vg: input.clickRef,
    };
    if (input.compoundSlug) params.utm_campaign = input.compoundSlug;
    if (input.listingSlug) params.utm_content = input.listingSlug;
    for (const [key, value] of Object.entries(params)) {
      if (!url.searchParams.has(key)) url.searchParams.set(key, value);
    }
    return url.toString();
  } catch {
    // A destination we cannot parse is still a destination — never break the handoff over tagging.
    return destination;
  }
}
