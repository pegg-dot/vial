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

/**
 * Everything on a browse page that is not evidence and not the market record: follow buttons,
 * buyer reviews, community posts, third-party tracker ratings, storefront signals, offers and stack
 * pages. These stay off whenever the quarantine is on, whatever the market-record flag says.
 */
export function hidesCommerce(enabled = evidenceOnlyPublicRelease()): boolean {
  return enabled;
}

/**
 * The market record: which vendor lists a compound, the size, the price as last read, the date it
 * was read and the listing it was read from. Needs VIALGRADE_MARKET_RECORDS=true on top of the
 * browse release, the owner's decision of 2026-11-11. It opens no route. Product pages, the
 * per-compound market page, compare, carts, checkout and /go click-throughs stay closed by
 * publicReleaseAction and commerce-pause, and the record's outbound links are plain links to the
 * vendor's own listing (see listingSourceUrl), never a tracked or tagged click-through.
 */
export function marketRecordsRelease(enabled = process.env.VIALGRADE_MARKET_RECORDS): boolean {
  return enabled === "true";
}

/**
 * Price and listing blocks specifically. Hidden under the quarantine unless the browse release and
 * the market-record release are both on; with the quarantine off the legacy site shows them anyway.
 */
export function hidesMarket(
  evidenceOnly = evidenceOnlyPublicRelease(),
  browse = publicBrowseRelease(),
  market = marketRecordsRelease(),
): boolean {
  return evidenceOnly && !(browse && market);
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

/**
 * The vendor comparison for one compound (/compounds/<slug>/vendors): every source on record for
 * that compound, what it lists and the price as read, beside what a lab reported for a sample
 * attributed to it. The one page the market-record release adds, the owner's decision of
 * 2026-11-17. It is a GET/HEAD page built from the same records the compound page already shows;
 * it carries no cart, no product page and no click-through.
 */
const COMPARISON_PAGE = /^\/compounds\/([a-z0-9-]+)\/vendors$/;

export function isComparisonPage(pathname: string, method = "GET"): boolean {
  if (!["GET", "HEAD"].includes(method.toUpperCase())) return false;
  if (/[%;\\]|\/\/|\.\./.test(pathname)) return false;
  return COMPARISON_PAGE.test(pathname.replace(/\/+$/, "") || "/");
}

/** Where the comparison for a compound lives. The one place the path is spelled. */
export function comparisonHref(compoundSlug: string): string {
  return "/compounds/" + compoundSlug + "/vendors";
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
  market = marketRecordsRelease(),
): PublicReleaseAction {
  if (!enabled) return null;
  if (browse && isBrowsePage(pathname, method)) return null;
  // The vendor comparison needs the browse release AND the market-record release, like the
  // price and listing blocks it is made of (hidesMarket).
  if (browse && market && isComparisonPage(pathname, method)) return null;
  // The compound directory and the method page are research surfaces (the research library, the
  // research-file letters) and stay public whatever the browse release says; a compound page that
  // carries a research file IS the research dossier now. /compounds and the compound pages hide
  // their catalog parts when browse is off; the method page links the directories only when on.
  // /verify is a page-level permanent redirect to the research source checker, so a saved link
  // forwards instead of meeting the retired notice.
  const reading = ["GET", "HEAD"].includes(method.toUpperCase());
  const path0 = pathname.replace(/\/+$/, "") || "/";
  if (reading && (path0 === "/compounds" || path0 === "/how-we-check" || path0 === "/verify")) return null;
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
 * One case: the per-compound market page. With the vendor comparison released, a saved link to
 * /compounds/<slug>/market forwards to that compound's comparison. Everything else keeps the
 * generic "retired" notice, which says so honestly instead of guessing a destination. The compound
 * directory and every compound page are research surfaces and never reach here.
 *
 * `comparisonOpen` is the three flags together; pass it explicitly in tests, since the production
 * build runs the unit suite with the deployment's own flags set.
 */
export function legacyResearchDestination(
  pathname: string,
  comparisonOpen = evidenceOnlyPublicRelease() && publicBrowseRelease() && marketRecordsRelease(),
): string | null {
  if (!comparisonOpen) return null;
  if (/[%;\\]|\/\/|\.\./.test(pathname)) return null;
  const market = /^\/compounds\/([a-z0-9-]+)\/market$/.exec(pathname.replace(/\/+$/, "") || "/");
  return market ? comparisonHref(market[1]) : null;
}
