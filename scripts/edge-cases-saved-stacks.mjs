// Auth-state edge cases for saving stacks, run against a live dev server (fixture store + demo
// accounts):
//   VIALGRADE_PGLITE_MEMORY=true VIALGRADE_ALLOW_EMBEDDED_DB_FOR_TESTS=true VIALGRADE_SEED_FIXTURES=true \
//   VIALGRADE_SEED_DEMO_ACCOUNTS=true npx next dev --port 3000   # then:
//   node scripts/edge-cases-saved-stacks.mjs http://localhost:3000
// Prints PASS/FAIL per case. It signs in as the demo customer ~6 times; the login lockout is real,
// so restart the (in-memory) server if a run reports "Account temporarily locked".
// The durable guards live in tests/e2e/market-redesign.spec.ts; this is the wider sweep.
import { chromium } from "playwright";
const base = process.argv[2];
const NORA = { email: "nora@example.test", password: "VialGradeDemoCustomer!2026" };
const results = [];
const check = (name, expected, actual) => {
  const ok = JSON.stringify(expected) === JSON.stringify(actual);
  results.push({ name, ok });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `\n        expected ${JSON.stringify(expected)}\n        actual   ${JSON.stringify(actual)}`}`);
};
const browser = await chromium.launch();
async function section(title, fn) {
  try { await fn(); } catch (e) { check(`SECTION CRASHED: ${title}`, "ran", String(e).split("\n")[0].slice(0, 200)); }
}
async function fresh(init) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  return { ctx, page, errors };
}
const settle = async (page) => { await page.getByRole("heading", { name: /Stacks & blends/i }).waitFor(); await page.waitForTimeout(500); };
const badge = async (page, want) => {
  const l = page.getByRole("link", { name: /^Saved/ }).first();
  for (let i = 0; i < 20; i += 1) { const t = (await l.textContent())?.replace(/\s+/g, "") ?? null; if (want === undefined || t === want) return t; await page.waitForTimeout(250); }
  return (await l.textContent())?.replace(/\s+/g, "") ?? null;
};
const stored = async (page) => page.evaluate(() => ({ stacks: localStorage.getItem("vial-saved-stacks-v1"), list: localStorage.getItem("vial-watchlist-v1") }));
const emptyOrNull = (v) => (v == null ? null : JSON.parse(v).length === 0 ? null : v);
async function login(page, next = "/account") {
  await page.goto(`${base}/login?next=${encodeURIComponent(next)}`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.fill('input[name="email"]', NORA.email); await page.fill('input[name="password"]', NORA.password);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 }), page.getByRole("button", { name: /^Sign in$/ }).click()]);
  await page.waitForTimeout(1500);
}
const api = async (page) => (await page.request.get(`${base}/api/v1/watchlist`)).json();
// The fixture DB lives as long as the server; every run starts from an empty account.
async function resetAccount() {
  const { page, ctx } = await fresh(); await login(page);
  const cur = await api(page);
  for (const s of cur.stacks) await page.request.put(`${base}/api/v1/watchlist`, { data: { slug: `stack:${s}`, watched: false } });
  for (const s of cur.slugs) await page.request.put(`${base}/api/v1/watchlist`, { data: { slug: s, watched: false } });
  await ctx.close();
}
const helperOf = async (page, name) => (await page.getByRole("button", { name }).locator("xpath=..").textContent()) ?? "";

await section("guest persistence + keyboard + badge", async () => {
  const { page, ctx } = await fresh();
  await page.goto(`${base}/market`, { waitUntil: "domcontentloaded", timeout: 90_000 }); await settle(page);
  await page.getByRole("button", { name: /^Save Wolverine$/ }).click();
  await page.getByRole("button", { name: /Remove Wolverine from saved/ }).waitFor();
  await page.reload({ waitUntil: "domcontentloaded", timeout: 90_000 }); await settle(page);
  const pressed = await page.getByRole("button", { name: /Remove Wolverine from saved/ }).getAttribute("aria-pressed");
  check("E1 guest save survives a reload", { badge: "Saved1", pressed: "true" }, { badge: await badge(page, "Saved1"), pressed });
  await page.goto(`${base}/stacks/wolverine`, { waitUntil: "domcontentloaded", timeout: 90_000 }); await page.waitForTimeout(700);
  check("E8 stack page reflects a guest save on direct load", "true", await page.getByRole("button", { name: /^Saved$/ }).getAttribute("aria-pressed"));
  await page.goto(`${base}/market`, { waitUntil: "domcontentloaded", timeout: 90_000 }); await settle(page);
  await page.getByRole("button", { name: /Remove Wolverine from saved/ }).focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(300);
  check("E9 keyboard toggle on the card stays on the page", { url: `${base}/market`, label: "Save Wolverine" }, { url: page.url(), label: await page.getByRole("button", { name: /^Save Wolverine$/ }).getAttribute("aria-label") });
  await page.getByRole("button", { name: /^Save Wolverine$/ }).click();
  await page.getByRole("button", { name: /Add to watchlist/ }).first().click();
  check("E16 badge counts listings + stacks", "Saved2", await badge(page, "Saved2"));
  await ctx.close();
});

await section("storage hygiene", async () => {
  const a = await fresh(() => { localStorage.setItem("vial-saved-stacks-v1", JSON.stringify(["ghost-stack", "wolverine"])); });
  await a.page.goto(`${base}/market`, { waitUntil: "domcontentloaded", timeout: 90_000 }); await settle(a.page);
  check("E6 unknown stack slug in storage is not counted", { badge: "Saved1", errors: [] }, { badge: await badge(a.page, "Saved1"), errors: a.errors });
  await a.ctx.close();
  const g = await fresh(() => { localStorage.setItem("vial-saved-stacks-v1", "{not json"); localStorage.setItem("vial-watchlist-v1", "[1,2,{}]"); });
  await g.page.goto(`${base}/market`, { waitUntil: "domcontentloaded", timeout: 90_000 }); await settle(g.page);
  check("E7 corrupt storage: no crash, nothing counted", { badge: "Saved", errors: [] }, { badge: await badge(g.page), errors: g.errors });
  await g.ctx.close();
});

await section("account lifecycle", async () => {
  await resetAccount();
  const { page, ctx, errors } = await fresh();
  await page.goto(`${base}/market`, { waitUntil: "domcontentloaded", timeout: 90_000 }); await settle(page);
  await page.getByRole("button", { name: /^Save Wolverine$/ }).click(); await page.getByRole("button", { name: /Remove Wolverine from saved/ }).waitFor();
  await login(page);
  check("E2 guest save merges into the account at sign-in", { stacks: ["wolverine"], local: null }, { stacks: (await api(page)).stacks, local: (await stored(page)).stacks });
  await page.goto(`${base}/market`, { waitUntil: "domcontentloaded", timeout: 90_000 }); await settle(page);
  await page.getByRole("button", { name: /^Save GLOW$/ }).click(); await page.waitForTimeout(800);
  check("E13 signed-in save reaches the account", ["glow", "wolverine"], (await api(page)).stacks.sort());
  await page.goto(`${base}/account`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/account"), { timeout: 30_000 }), page.getByRole("button", { name: /^Sign out$/ }).click()]);
  await page.waitForTimeout(1200);
  const afterOut = await stored(page);
  check("E4 sign-out leaves nothing of the account in guest storage (badge, storage)", { stacks: null, list: null, badge: "Saved" }, { stacks: emptyOrNull(afterOut.stacks), list: emptyOrNull(afterOut.list), badge: await badge(page) });
  await page.evaluate(() => localStorage.setItem("vial-saved-stacks-v1", JSON.stringify(["wolverine"])));
  await login(page);
  check("E3 merging a stack the account already has does not duplicate", ["glow", "wolverine"], (await api(page)).stacks.sort());
  check("E5 account keeps its saves across sign-out/sign-in", ["glow", "wolverine"], (await api(page)).stacks.sort());
  const bad = await page.request.put(`${base}/api/v1/watchlist`, { data: { slug: "stack:not-a-stack", watched: true } });
  const str = await page.request.put(`${base}/api/v1/watchlist`, { data: { slug: "stack:klow", watched: "false" } });
  const missing = await page.request.put(`${base}/api/v1/watchlist`, { data: { slug: "stack:klow" } });
  const after = (await api(page)).stacks;
  check("E10a unknown stack key is refused", 400, bad.status());
  check("E10b a non-boolean 'watched' is refused, not coerced to true", { status: 400, klowSaved: false }, { status: str.status(), klowSaved: after.includes("klow") });
  check("E10c a missing 'watched' is refused", 400, missing.status());
  check("E-errors (account lifecycle) no page errors", [], errors);
  await ctx.close();
});

await section("guest copy + in-place sign-in + second tab", async () => {
  await resetAccount();
  const { page, ctx, errors } = await fresh();
  await page.goto(`${base}/stacks/klow`, { waitUntil: "domcontentloaded", timeout: 90_000 }); await page.waitForTimeout(700);
  const guestHelper = await helperOf(page, /^Save stack$/);
  await page.getByRole("button", { name: /^Save stack$/ }).click(); await page.waitForTimeout(300);
  const guestSavedHelper = await helperOf(page, /^Saved$/);
  check("E21a guest copy: on this device + offers sign-in (before and after saving)", { before: true, after: true }, { before: /sign in/i.test(guestHelper) && /this device/i.test(guestHelper), after: /sign in/i.test(guestSavedHelper) && /this device/i.test(guestSavedHelper) });
  // E18: sign in through the in-place prompt (Follow changes on a compound page) — a soft auth flip.
  await page.goto(`${base}/compounds/bpc-157`, { waitUntil: "domcontentloaded", timeout: 90_000 }); await page.waitForTimeout(800);
  await page.getByRole("button", { name: /Follow changes/ }).first().click();
  const dialog = page.getByRole("dialog"); await dialog.waitFor();
  await dialog.getByRole("button", { name: /I already have an account/ }).click();
  await dialog.locator('input[name="email"]').fill(NORA.email); await dialog.locator('input[name="password"]').fill(NORA.password);
  await dialog.getByRole("button", { name: /^Sign in$/ }).click();
  // A soft auth flip: router.refresh() re-renders the layout, the provider's effect merges and PUTs.
  // Dev-mode RSC refresh takes a few seconds; poll rather than guess.
  let merged = { klow: false, local: null };
  for (let i = 0; i < 30; i += 1) { await page.waitForTimeout(500); const a = await api(page); merged = { klow: Array.isArray(a.stacks) && a.stacks.includes("klow"), local: (await stored(page)).stacks }; if (merged.klow && merged.local === null) break; }
  check("E18 signing in through the in-place prompt merges the guest's stack (no reload)", { klow: true, local: null }, merged);
  await page.goto(`${base}/stacks/klow`, { waitUntil: "domcontentloaded", timeout: 90_000 }); await page.waitForTimeout(700);
  check("E21b signed-in copy points at Saved with your listings", true, /with your listings/.test(await helperOf(page, /^Saved$/)));
  const tab = await ctx.newPage(); await tab.goto(`${base}/stacks/klow`, { waitUntil: "domcontentloaded", timeout: 90_000 }); await tab.waitForTimeout(700);
  check("E19 another tab (fresh load) sees the account's save", "true", await tab.getByRole("button", { name: /^Saved$/ }).getAttribute("aria-pressed"));
  check("E-errors (prompt sign-in) no page errors", [], errors);
  await ctx.close();
});

await section("guest API access", async () => {
  const { page, ctx } = await fresh();
  await page.goto(`${base}/market`, { waitUntil: "domcontentloaded", timeout: 90_000 });
  check("E11 guest cannot read or write the account store", { get: 401, put: 401 }, { get: (await page.request.get(`${base}/api/v1/watchlist`)).status(), put: (await page.request.put(`${base}/api/v1/watchlist`, { data: { slug: "stack:klow", watched: true } })).status() });
  await ctx.close();
});

await browser.close();
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} handled`);
