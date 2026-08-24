import { readdir } from "node:fs/promises";
import path from "node:path";

// The routes this app actually serves, read from the filesystem.
//
// Three audit scripts each kept their own typed-out list, and commit 298e7ce ("buyer-only surface,
// one admin") deleted the entire /seller and /lab surfaces plus all but three /admin pages. Every
// list rotted at once: the accessibility audit demanded 47 pages that 404, the role audit demanded
// ~50, and both failed on the 404s while saying nothing about accessibility or about authorization.
// CI stayed red for a week and the real signal was buried inside the noise.
//
// One definition, derived, so a page added tomorrow is covered tomorrow and a page deleted stops
// being demanded. A fourth hand-written list is the thing this file exists to prevent.
const APP = path.join(process.cwd(), "src", "app");

/**
 * Every STATIC route with a page.tsx.
 *
 * Dynamic and catch-all segments are skipped: inventing an id would 404 and prove nothing. Route
 * groups do not appear in the URL, so they are descended through transparently.
 */
export async function discoverRoutes(dir = APP, prefix = "") {
  const routes = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith("[") || entry.name.startsWith("@")) continue;
      if (entry.name.startsWith("(")) { routes.push(...await discoverRoutes(path.join(dir, entry.name), prefix)); continue; }
      routes.push(...await discoverRoutes(path.join(dir, entry.name), `${prefix}/${entry.name}`));
    } else if (entry.name === "page.tsx") {
      routes.push(prefix || "/");
    }
  }
  return routes.sort();
}

/** Routes a signed-in customer reaches, and a stranger is redirected away from. */
// /compare is deliberately PUBLIC — the read-only side-by-side tool a stranger can use before
// they have an account.
const CUSTOMER_ROUTES = new Set(["/account", "/for-you", "/saved-searches", "/watchlist"]);

/**
 * Pages that exist and deliberately redirect, so "returns 200" is the WRONG assertion for them.
 *
 * /cart and /checkout are the quarantined commerce surfaces: AGENTS.md says VialGrade never runs
 * checkout or touches money, and these redirect rather than being deleted so an old link does not
 * 404. /methodology is a permanent alias to /how-we-check. Asserting that they redirect is a
 * stronger claim than asserting they merely respond — it is how we notice if commerce ever
 * quietly comes back to life.
 */
export const REDIRECTED_ROUTES = new Set(["/cart", "/checkout", "/methodology"]);
export const isRedirected = (r) => REDIRECTED_ROUTES.has(r);
export const needsCustomer = (r) => CUSTOMER_ROUTES.has(r) || r.startsWith("/account/");
/** Staff surfaces. /admin/login is the way IN, so it is public by necessity. */
export const needsAdmin = (r) => (r === "/admin" || r.startsWith("/admin/")) && r !== "/admin/login";
export const isPublic = (r) => !needsCustomer(r) && !needsAdmin(r) && !isRedirected(r);

/**
 * A discovery bug that found nothing would make every caller silently vacuous — which is the same
 * failure the hardcoded lists produced, arrived at from the other direction.
 */
export function assertDiscoverySane(routes) {
  if (routes.length < 10) {
    throw new Error(`Route discovery found only ${routes.length} routes — that is a bug in the discovery, not an app with no pages.`);
  }
}
