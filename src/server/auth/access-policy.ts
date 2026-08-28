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
const PUBLIC_PAGE_PREFIX = ["/compounds", "/vendors", "/products", "/legal", "/passports", "/labs", "/stacks"];

// Surfaces retired from the product (moved to src/retired/). They no longer exist as routes, so
// letting them through the perimeter means Next returns its own clean 404 — rather than a login
// redirect, which tells a visitor something is still there and invites them to try to reach it.
// Nothing is exposed by allowing these: there is no handler behind them.
//
// `/seller` and `/lab` are deliberately NOT in this list even though they are also retired. Both
// have role gates further down in `accessDecision`, and `isPublic` is consulted first — so listing
// them here made those gates unreachable dead code. That costs nothing while the routes are absent,
// but it is a trap armed for whoever restores one: the day a `src/app/seller/**` page reappears it
// would be served to anonymous visitors, with a role check sitting right there in this file looking
// like it was doing the work. A retired route that shares a prefix with a live gate must fail
// closed. The only thing given up is the clean 404 — an anonymous visitor to a nonexistent
// `/seller` now sees the login page instead.
const RETIRED_PREFIX = ["/terminal", "/operations", "/updates", "/developers", "/sell"];

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
  // The provenance sweep. Added 2026-08-25 and omitted from this list, so the perimeter 401'd every
  // Vercel Cron invocation before the handler ran and the sweep never executed once — the identical
  // failure the comment above describes, repeated three lines below the warning about it. There is
  // a test now that reads vercel.json and requires every cron path to appear here.
  "/api/internal/cron/provenance",
  // The nightly notification sweep. Without this entry the perimeter 401s Vercel Cron before the
  // handler runs, and every reader silently stops being told anything — the same failure as the
  // two above, on the one route whose whole purpose is to reach people who are not looking.
  "/api/internal/cron/notifications",
  // Partner postbacks authenticate with a per-vendor HMAC inside the handler.
  "/api/partner/conversion",
  // Anonymous page-view beacon. No auth by design; it stores no identity.
  "/api/track/view",
  // Browser error boundaries report here. It must be reachable without a session, because the
  // errors most worth hearing about are the ones that break the page before anyone can log in.
  // The handler treats every caller as hostile: fixed alert kind, capped body, truncated fields.
  "/api/internal/client-error",
]);
const PUBLIC_API_PREFIX = ["/api/health/", "/api/v1/auth/", "/api/v1/reports/", "/api/public/"];

function isPublic(path: string): boolean {
  if (PUBLIC_PAGE_EXACT.has(path) || PUBLIC_API_EXACT.has(path)) return true;
  if (PUBLIC_PAGE_PREFIX.some((p) => path === p || path.startsWith(`${p}/`))) return true;
  // Exact-or-subpath match, so a retired prefix never swallows a longer live one.
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
