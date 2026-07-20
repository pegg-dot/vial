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
  "/", "/market", "/compare", "/search", "/methodology", "/about", "/help",
  "/status", "/operations", "/signals", "/research", "/updates", "/testing", "/offline",
  "/login", "/admin/login", "/sell",
  // Well-known / PWA paths: crawlers and the service worker are unauthenticated by nature.
  "/robots.txt", "/sitemap.xml", "/manifest.webmanifest", "/sw.js",
]);
const PUBLIC_PAGE_PREFIX = ["/compounds", "/vendors", "/products", "/legal", "/passports", "/labs"];

// Public / externally-authenticated API routes. These carry their own guard
// (public read, bearer token, or webhook signature) and must never be session-gated
// by the perimeter, or legitimate no-session callers (cron, Stripe) would be blocked.
const PUBLIC_API_EXACT = new Set([
  "/api/search", "/api/openapi.json",
  "/api/v1/health", "/api/v1/catalog", "/api/v1/alerts",
  "/api/v1/commerce/provider/webhook", "/api/internal/cron/refresh",
]);
const PUBLIC_API_PREFIX = ["/api/health/", "/api/v1/auth/", "/api/v1/reports/"];

function isPublic(path: string): boolean {
  if (PUBLIC_PAGE_EXACT.has(path) || PUBLIC_API_EXACT.has(path)) return true;
  if (PUBLIC_PAGE_PREFIX.some((p) => path === p || path.startsWith(`${p}/`))) return true;
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
    path === "/cart" ||
    path === "/checkout" ||
    path.startsWith("/orders/")
  ) {
    return { protected: true, allowed: session?.accountType === "customer", loginPath: "/login" };
  }
  // Deny-by-default backstop: an unclassified route is protected. Any authenticated
  // session passes the perimeter; the page/API's own guard enforces the specifics.
  return { protected: true, allowed: session !== null, loginPath: "/login" };
}
