import { timingSafeEqual } from "node:crypto";

/**
 * Constant-time comparison for a presented shared secret against the expected one.
 *
 * Every other secret comparison in the codebase already does this — session envelope HMACs, seller
 * API tokens, partner HMAC postbacks, the mock webhook signature, password verification. The two
 * cron routes were the exception and used `===`, which returns as soon as it finds a differing byte.
 *
 * Honest framing on severity: remotely measuring that difference across the public internet, against
 * a route that then does seconds of database and network work, is not a practical attack. The reason
 * to fix it is not the timing channel — it is that a reader auditing "how does this codebase compare
 * secrets" gets two different answers, and the weaker one is the one sitting on an unauthenticated,
 * perimeter-public route. One answer, applied everywhere, is what makes the next such route correct
 * by default.
 */
export function secretMatches(presented: string | null | undefined, expected: string): boolean {
  if (!presented || !expected) return false;
  const a = Buffer.from(presented, "utf8");
  const b = Buffer.from(expected, "utf8");
  // timingSafeEqual throws on a length mismatch, so length is checked first. Length is not itself
  // secret-revealing here in any meaningful way — the value's length is fixed by whoever set it.
  return a.length === b.length && timingSafeEqual(a, b);
}
