import type { SessionEnvelope } from "./session-envelope";

export interface AccessDecision {
  protected: boolean;
  allowed: boolean;
  loginPath?: string;
}

// Deny-by-default perimeter: anything not explicitly public and not matched by an
// account-family rule requires an authenticated session. A route nobody remembered
// to classify fails closed (protected) instead of leaking — the opposite of the 0.7
// bug class, where an unclassified route defaulted to public.

// Public page routes (browseable with no session). Exact matches or path prefixes.
const PUBLIC_PAGE_EXACT = new Set([
  "/", "/market", "/compare", "/search", "/verify", "/methodology", "/how-we-check", "/grades", "/about", "/help",
  "/go", // outbound vendor handoff (records the click, 302s to the vendor's own page)
  "/cart", "/checkout", // quarantined commerce → these routes just redirect to /market
  "/status", "/operations", "/signals", "/research", "/updates", "/testing", "/offline", "/developers", "/enforcement", "/news", "/reference-standard",
  "/login", "/register", "/admin/login", "/sell",
  // Well-known / PWA paths: crawlers and the service worker are unauthenticated by nature.
  "/robots.txt", "/sitemap.xml", "/manifest.webmanifest", "/sw.js",
]);
const PUBLIC_PAGE_PREFIX = ["/compounds", "/vendors", "/products", "/legal", "/passports", "/labs"];

// Surfaces retired from the product (moved to src/retired/). They no longer exist as routes, so
// letting them through the perimeter means Next returns its own clean 404 — rather than a login
// redirect, which tells a visitor something is still there and invites them to try to reach it.
// Nothing is exposed by allowing these: there is no handler behind them.
const RETIRED_PREFIX = ["/seller", "/lab", "/terminal", "/operations", "/updates", "/developers", "/sell"];

// Public / externally-authenticated API routes. These carry their own guard
// (public read, bearer token, or webhook signature) and must never be session-gated
// by the perimeter, or legitimate no-session callers (cron, Stripe) would be blocked.
const PUBLIC_API_EXACT = new Set([
  "/api/search", "/api/openapi.json", "/api/v1/verify", "/api/v1/compare",
  "/api/v1/health", "/api/v1/catalog", "/api/v1/alerts",
  "/api/v1/commerce/provider/webhook", "/api/internal/cron/refresh",
  // Cron routes authenticate themselves with CRON_SECRET inside the handler. They must be listed
  // here or the deny-by-default perimeter 401s them BEFORE the handler runs — which is exactly
  // what silently disabled continuous collection: Vercel Cron sends no session cookie.
  "/api/internal/cron/collect",
  // Partner postbacks authenticate with a per-vendor HMAC inside the handler.
  "/api/partner/conversion",
  // Anonymous page-view beacon. No auth by design; it stores no identity.
  "/api/track/view",
]);
const PUBLIC_API_PREFIX = ["/api/health/", "/api/v1/auth/", "/api/v1/reports/", "/api/public/"];

function isPublic(path: string): boolean {
  if (PUBLIC_PAGE_EXACT.has(path) || PUBLIC_API_EXACT.has(path)) return true;
  if (PUBLIC_PAGE_PREFIX.some((p) => path === p || path.startsWith(`${p}/`))) return true;
  // `/labs` is real and public; `/lab` is retired. Exact-or-subpath match keeps them distinct.
  if (RETIRED_PREFIX.some((p) => path === p || path.startsWith(`${p}/`))) return true;
  if (PUBLIC_API_PREFIX.some((p) => path.startsWith(p))) return true;
  return false;
}

export function accessDecision(path: string, session: SessionEnvelope | null): AccessDecision {
  if (isPublic(path)) {
    return { protected: false, allowed: true };
  }
  if (path.startsWith("/admin")) {
    return { protected: true, allowed: session?.accountType === "staff", loginPath: "/admin/login" };
  }
  if (path.startsWith("/seller")) {
    return { protected: true, allowed: session?.accountType === "seller" || session?.accountType === "staff", loginPath: "/login" };
  }
  if (path === "/lab" || path.startsWith("/lab/")) {
    return { protected: true, allowed: session?.accountType === "laboratory" || session?.accountType === "staff", loginPath: "/login" };
  }
  if (
    path.startsWith("/account") ||
    path === "/watchlist" ||
    path === "/for-you" ||
    path === "/saved-searches" ||
    path.startsWith("/orders/")
  ) {
    return { protected: true, allowed: session?.accountType === "customer", loginPath: "/login" };
  }
  // Deny-by-default backstop: an unclassified route is protected. Any authenticated
  // session passes the perimeter; the page/API's own guard enforces the specifics.
  return { protected: true, allowed: session !== null, loginPath: "/login" };
}
