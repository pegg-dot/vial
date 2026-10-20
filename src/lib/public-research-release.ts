/**
 * Temporary read-only release configuration while prior seller/COA sources,
 * privacy rights, and editorial claims are reviewed.
 *
 * Enabled only by explicit deployment environment setting. This is a PUBLIC
 * ROUTE quarantine, not a claim of legal compliance or approval.
 * Existing authenticated account remedies, staff administration and signed
 * provider callbacks retain their own access/signature checks.
 */
export function evidenceOnlyPublicRelease(enabled = process.env.VIALGRADE_PUBLIC_EVIDENCE_ONLY): boolean {
  return enabled === "true";
}

export type PublicReleaseAction = "redirect" | "gone" | null;

function matches(path: string, root: string): boolean {
  return path === root || path.startsWith(root + "/");
}

export function publicReleaseAction(
  pathname: string,
  method = "GET",
  enabled = evidenceOnlyPublicRelease(),
): PublicReleaseAction {
  if (!enabled) return null;
  const path = pathname.replace(/\/+$/, "") || "/";

  // Only the source-linked public research preview, legal notices, and
  // necessary machine-readable site resources remain public.
  if (
    matches(path, "/intelligence") ||
    matches(path, "/legal") ||
    ["/login", "/register", "/robots.txt", "/sitemap.xml", "/manifest.webmanifest", "/sw.js", "/favicon.ico"].includes(path)
  ) return null;

  // Existing legal/financial obligations must not disappear when marketing
  // and legacy source distribution are paused. Original permission/signature
  // controls still run at the perimeter and inside the handlers.
  if (
    matches(path, "/admin") ||
    matches(path, "/account") ||
    matches(path, "/orders") ||
    matches(path, "/seller") ||
    matches(path, "/lab") ||
    ["/watchlist", "/saved-searches", "/for-you"].includes(path)
  ) return null;

  // Auth, historical data-access/delete/withdrawal pathways, signed payment
  // handling, and authorized daily retention cron remain available.
  if (
    matches(path, "/api/internal/cron") ||
    matches(path, "/api/v1/auth") ||
    matches(path, "/api/v1/commerce") ||
    matches(path, "/api/v1/account") ||
    matches(path, "/api/v1/watchlist") ||
    matches(path, "/api/v1/comparisons") ||
    matches(path, "/api/v1/consumer") ||
    matches(path, "/api/v1/push/unsubscribe") ||
    matches(path, "/api/health") ||
    path === "/api/v1/health"
  ) return null;

  // A single local-only, read-only, explicit model request. The endpoint
  // independently requires preview flags, a gateway credential, consent,
  // same-origin localhost and bounded calls. Never open all /api/research/*.
  if (path === "/api/research/analyst" && method.toUpperCase() === "POST"
      && process.env.VIALGRADE_LOCAL_PREVIEW === "true") return null;

  // Never redirect API calls to HTML; decline old catalog/search/public
  // exports and anything that would capture or expose vendor data.
  if (matches(path, "/api")) return "gone";
  return ["GET", "HEAD"].includes(method.toUpperCase()) ? "redirect" : "gone";
}

/**
 * Where a retired shop URL has a real equivalent in the research product.
 *
 * Only `/compounds` and `/compounds/<slug>` where the slug has a research dossier. Everything else
 * keeps the generic "retired" notice, which says so honestly instead of guessing a destination.
 * This is a redirect to read-only research pages; it does not reopen listings, prices or referrals.
 */
export function legacyResearchDestination(
  pathname: string,
  hasDossier: (slug: string) => boolean,
): string | null {
  const path = pathname.replace(/\/+$/, "");
  if (path === "/compounds") return "/intelligence/market";
  const match = /^\/compounds\/([a-z0-9-]+)$/.exec(path);
  return match && hasDossier(match[1]) ? "/intelligence/explore/" + match[1] : null;
}
