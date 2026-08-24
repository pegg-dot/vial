import { load } from "cheerio";
import { login, startProductionServer, stopProductionServer } from "./lib/production-server.mjs";
import { discoverRoutes, needsCustomer, needsAdmin, isPublic, assertDiscoverySane } from "./lib/app-routes.mjs";

// Structural accessibility across every page the app actually serves.
//
// The route list used to be typed out here by hand, and it rotted. Commit 298e7ce ("buyer-only
// surface, one admin") deleted the entire /seller and /lab surfaces and all but three /admin pages;
// this file went on requesting 47 routes that no longer existed, so the audit failed on 404s and
// said nothing whatsoever about accessibility. CI stayed red for a week and the real signal — that
// every served page has a title, one h1, labelled controls and named buttons — was lost inside it.
//
// So the list is DISCOVERED now. Every page.tsx under src/app is a route, which means a page added
// tomorrow is audited tomorrow, and a page deleted stops being demanded. The assertions below are
// unchanged: this fixes WHICH pages are checked, never HOW strictly.
const { base, child } = await startProductionServer({ port: 3418 });
const failures = [];

function audit(route, html) {
  const $ = load(html);
  if (!$("html").attr("lang")) failures.push(`${route}: missing html lang`);
  if (!$("title").text().trim()) failures.push(`${route}: missing title`);
  if ($("h1").length !== 1) failures.push(`${route}: expected exactly one h1, found ${$("h1").length}`);
  $("img").each((_, element) => { if ($(element).attr("alt") == null) failures.push(`${route}: image missing alt`); });
  const ids = new Set();
  $("[id]").each((_, element) => {
    const id = $(element).attr("id");
    if (id && ids.has(id)) failures.push(`${route}: duplicate id ${id}`);
    if (id) ids.add(id);
  });
  $("button").each((index, element) => {
    const node = $(element);
    if (!(node.text().trim() || node.attr("aria-label") || node.attr("title"))) failures.push(`${route}: button ${index + 1} has no accessible name`);
  });
  $("input:not([type=hidden]), select, textarea").each((index, element) => {
    const node = $(element);
    const id = node.attr("id");
    const named = node.attr("aria-label") || node.attr("aria-labelledby") || (id && $(`label[for='${id}']`).length) || node.closest("label").length;
    if (!named) failures.push(`${route}: form control ${index + 1} has no associated label`);
  });
}

async function page(route, cookie) {
  const r = await fetch(`${base}${route}`, { headers: cookie ? { cookie } : {} });
  // A login page redirecting an already-authenticated session is correct behaviour, not a fault.
  if (r.status !== 200) {
    if (isLoginPage(route) && cookie && (r.status === 302 || r.status === 307)) return;
    failures.push(`${route}: returned ${r.status}`);
    return;
  }
  audit(route, await r.text());
}

try {
  const routes = await discoverRoutes();
  assertDiscoverySane(routes);
  const publicRoutes = routes.filter(isPublic);
  const customerRoutes = routes.filter(needsCustomer);
  const adminRoutes = routes.filter(needsAdmin);
  console.log(`Auditing ${routes.length} discovered routes: ${publicRoutes.length} public, ${customerRoutes.length} customer, ${adminRoutes.length} staff.`);

  for (const route of publicRoutes) await page(route);

  if (customerRoutes.length) {
    const customer = await login(base, "nora@example.test", "VialGradeDemoCustomer!2026");
    for (const route of customerRoutes) await page(route, customer);
  }
  if (adminRoutes.length) {
    const admin = await login(base, "jon@vialgrade.test", "VialGradeDemoAdmin!2026", "staff");
    for (const route of adminRoutes) await page(route, admin);
  }

  if (failures.length) throw new Error(failures.join("\n"));
  console.log("Structural accessibility audit passed across every served page.");
} finally {
  await stopProductionServer(child);
}
