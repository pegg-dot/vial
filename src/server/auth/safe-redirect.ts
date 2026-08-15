/**
 * Post-login redirect target validation.
 *
 * The previous check — "starts with `/` but not `//`" — is not the same question as "stays on this
 * site". Browsers normalize a backslash to a forward slash inside a URL, so `/\evil.com` passes that
 * test and then resolves to `//evil.com`: a protocol-relative URL pointing at an attacker's domain.
 *
 * The consequence is phishing-grade. The victim really did authenticate against the real VialGrade —
 * correct domain, correct certificate, real session cookie now set — and is then handed straight to
 * a look-alike while believing they are inside the site they just logged into. Anything the
 * look-alike asks for next (a "confirm your password", a payout detail) arrives with the credibility
 * of a completed login behind it.
 *
 * So this does not pattern-match the string. It resolves the value the way a browser resolves it,
 * against a fixed base origin, and requires the result to still be on that origin. Absolute URLs,
 * protocol-relative URLs, backslash-smuggled authorities, `javascript:` and other schemes all
 * resolve to a different origin (or to `null`) and are rejected.
 *
 * What is returned is the URL parser's own re-serialization — never the caller's raw string — so
 * backslashes, tabs and newlines cannot survive into the `Location` header even when the origin
 * check passes.
 */

// Fixed, unroutable base. Using a constant here rather than the real site origin keeps the check
// identical in every environment (dev, preview, production) and independent of request headers,
// which are themselves attacker-influenced.
const SAFE_REDIRECT_BASE = "https://redirect.invalid";

export function safeRedirectPath(value: string, fallback: string): string {
  // Cheap pre-filter: preserves the original "must be a site-relative path" intent and rejects the
  // empty/whitespace case, which would otherwise resolve to "/" instead of the caller's fallback.
  const raw = value.trim();
  if (!raw.startsWith("/")) return fallback;
  try {
    const url = new URL(raw, SAFE_REDIRECT_BASE);
    if (url.origin !== SAFE_REDIRECT_BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
