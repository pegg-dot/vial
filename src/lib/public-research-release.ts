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

/**
 * Read-only browsing of the original VialGrade pages (compounds, grades, compare, labs, vendors,
 * batch passports, verify, search). Needs VIALGRADE_PUBLIC_BROWSE=true on top of the evidence-only
 * release. It only ever opens GET/HEAD pages: carts, checkout, /go click-throughs, product pages,
 * per-compound market tables and every API stay closed, and the pages themselves drop prices,
 * listings and outbound seller links while the evidence-only release is on (see hidesCommerce).
 */
export function publicBrowseRelease(enabled = process.env.VIALGRADE_PUBLIC_BROWSE): boolean {
  return enabled === "true";
}

/** Pages that still carry price or listing blocks must drop them whenever the quarantine is on. */
export function hidesCommerce(enabled = evidenceOnlyPublicRelease()): boolean {
  return enabled;
}

// Exact page shapes only, never a whole root. Every page listed here drops prices, listings and
// outbound seller links while the evidence-only release is on (compounds and vendors via
// hidesCommerce, the rest carry none), and a new page does not become public by living under a root.
const BROWSE_PAGES: readonly RegExp[] = [
  /^\/compounds$/, /^\/compounds\/[a-z0-9-]+$/,
  /^\/vendors$/, /^\/vendors\/[a-z0-9-]+$/,
  /^\/labs$/, /^\/labs\/[a-z0-9-]+$/,
  /^\/passports$/, /^\/passports\/[a-z0-9-]+$/,
  /^\/grades$/, /^\/methodology$/, /^\/how-we-check$/,
];

export function isBrowsePage(pathname: string, method = "GET"): boolean {
  if (!["GET", "HEAD"].includes(method.toUpperCase())) return false;
  // Match the literal path the router will see: no encodings, separators or dot segments.
  if (/[%;\\]|\/\/|\.\./.test(pathname)) return false;
  const path = pathname.replace(/\/+$/, "") || "/";
  return BROWSE_PAGES.some(pattern => pattern.test(path));
}

export type PublicReleaseAction = "redirect" | "gone" | null;

function matches(path: string, root: string): boolean {
  return path === root || path.startsWith(root + "/");
}

export function publicReleaseAction(
  pathname: string,
  method = "GET",
  enabled = evidenceOnlyPublicRelease(),
  browse = publicBrowseRelease(),
  hasDossier: (slug: string) => boolean = () => false,
): PublicReleaseAction {
  if (!enabled) return null;
  if (browse && isBrowsePage(pathname, method)) return null;
  // The compound directory and the method page are research surfaces (the research library, the
  // research-file letters) and stay public whatever the browse release says; a compound page that
  // carries a research file IS the research dossier now. Each page hides its catalog parts when
  // browse is off.
  const reading = ["GET", "HEAD"].includes(method.toUpperCase());
  const path0 = pathname.replace(/\/+$/, "") || "/";
  if (reading && (path0 === "/compounds" || path0 === "/how-we-check")) return null;
  const compound = /^\/compounds\/([a-z0-9-]+)\/?$/.exec(pathname);
  if (compound && reading && hasDossier(compound[1])) return null;
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
 * Nothing, since the compound directory became the research library: `/compounds` and every
 * compound page with a research file are let through by publicReleaseAction. Everything else
 * keeps the generic "retired" notice, which says so honestly instead of guessing a destination.
 * Kept as a seam so the proxy's shape does not change when a destination appears again.
 */
export function legacyResearchDestination(pathname: string): string | null {
  // The compound directory and every compound page are research surfaces now and never redirect;
  // nothing retired has a better destination than the honest notice.
  void pathname;
  return null;
}
