import { login, startProductionServer, stopProductionServer } from "./lib/production-server.mjs";
import { discoverRoutes, needsCustomer, needsAdmin, isPublic, isRedirected, assertDiscoverySane } from "./lib/app-routes.mjs";

// Who can reach what, checked over real HTTP against the production build.
//
// This audit is about AUTHORIZATION BOUNDARIES, and it had stopped testing them. Its route list was
// typed out by hand and commit 298e7ce ("buyer-only surface, one admin") deleted the /seller and
// /lab surfaces and most of /admin, so it demanded ~50 pages that 404 and failed on the first one —
// `GET /sell: expected 200, got 404` — before reaching a single boundary assertion. A red build
// nobody read meant nobody knew the boundaries had gone unchecked.
//
// The page matrix is derived now. The API assertions stay written out, because they are claims
// about specific endpoints and cannot be inferred from a filename.
const server = await startProductionServer({ port: 3417 });
const { base, child } = server;
const failures = [];

async function check(path, expected, { cookie, method = "GET", body, headers = {} } = {}) {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { ...(cookie ? { cookie } : {}), ...(body ? { "content-type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  if (![].concat(expected).includes(r.status)) failures.push(`${method} ${path}: expected ${expected}, got ${r.status}`);
  return r;
}

try {
  const routes = await discoverRoutes();
  assertDiscoverySane(routes);
  const publicRoutes = routes.filter(isPublic);
  const customerRoutes = routes.filter(needsCustomer);
  const adminRoutes = routes.filter(needsAdmin);
  console.log(`Auditing ${routes.length} routes: ${publicRoutes.length} public, ${customerRoutes.length} customer, ${adminRoutes.length} staff.`);

  // ── A stranger ──────────────────────────────────────────────────────────────────────────────
  // Public pages must open. Everything else must redirect, not render and not error: a 404 would
  // leak nothing but a 200 would leak everything.
  for (const path of publicRoutes) await check(path, 200);
  // Quarantined commerce and permanent aliases must redirect. If /cart or /checkout ever answers
  // 200 this fails, which is exactly the alarm we want: it would mean commerce came back.
  for (const path of routes.filter(isRedirected)) await check(path, [307, 308]);
  for (const path of [...customerRoutes, ...adminRoutes]) await check(path, [307, 308]);

  // Unauthenticated API access is refused, and a forged bearer is refused the same way — the seller
  // and laboratory operator APIs outlived their pages and are still reachable.
  for (const path of ["/api/v1/watchlist", "/api/v1/consumer/preferences", "/api/v1/laboratory/context"]) await check(path, 401);
  await check("/api/v1/seller/operator/catalog", 401);
  await check("/api/v1/seller/operator/catalog", 401, { headers: { authorization: "Bearer vial_seller_invalid" } });
  await check("/api/v1/laboratory/operator/orders", 401, { headers: { authorization: "Bearer vial_lab_invalid" } });

  // ── A signed-in customer ────────────────────────────────────────────────────────────────────
  const customer = await login(base, "nora@example.test", "VialGradeDemoCustomer!2026");
  for (const path of customerRoutes) await check(path, 200, { cookie: customer });
  // The boundary that matters: a customer session must not open a staff surface.
  for (const path of adminRoutes) await check(path, [307, 308], { cookie: customer });
  for (const path of ["/api/v1/watchlist", "/api/v1/consumer/preferences", "/api/v1/saved-searches", "/api/v1/comparisons", "/api/v1/follows", "/api/v1/notifications", "/api/v1/market-summary"]) {
    await check(path, 200, { cookie: customer });
  }

  // ── Staff ───────────────────────────────────────────────────────────────────────────────────
  const admin = await login(base, "jon@vialgrade.test", "VialGradeDemoAdmin!2026", "staff");
  for (const path of adminRoutes) await check(path, 200, { cookie: admin });

  // Money moves only for an administrator. A reviewer is staff and still must not: 403, not 200.
  const reviewer = await login(base, "maya@vialgrade.test", "VialGradeDemoReviewer!2026", "staff");
  await check("/api/v1/commerce/control-plane", 200, { cookie: reviewer });
  await check("/api/v1/commerce/refunds", 403, { cookie: reviewer, method: "POST", body: { orderId: "missing", amount: 1 } });
  await check("/api/v1/commerce/settlements", 403, { cookie: reviewer, method: "POST", body: {} });
  // 400 not 403: the administrator IS permitted, and fails only on the missing order.
  await check("/api/v1/commerce/refunds", 400, { cookie: admin, method: "POST", body: { orderId: "missing", amount: 1 } });

  if (failures.length) throw new Error(`${failures.join("\n")}\n\nServer output:\n${server.output()}`);
  console.log("HTTP role audit passed for anonymous, customer and staff page boundaries, and for scoped seller/laboratory/commerce API boundaries.");
} finally {
  await stopProductionServer(child);
}
