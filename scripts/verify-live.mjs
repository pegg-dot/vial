#!/usr/bin/env node
// What is actually true on vialgrade.com right now?
//
// Written because "it's deployed" and "it works" are different claims, and today produced several
// cases where the first was true and the second wasn't: a certificate fix that shipped while the
// vendor page still read "not enough evidence", collectors reporting green while serving 8% of
// their cadence, a status card calling an empty queue healthy.
//
// Rules this file follows, learned the hard way:
//   - A check that cannot fail is not a check. Every parser here is exercised against known-bad
//     input by --selftest, which runs FIRST and aborts the whole run if a bad fixture passes.
//   - A probe that cannot measure reports UNKNOWN, never PASS. Zero is not health.
//   - Read rendered text, not raw HTML. Every SPA ships its error strings in a bundle.
//
// Usage: node scripts/verify-live.mjs [--selftest] [--base https://vialgrade.com]

const BASE = process.argv.includes("--base")
  ? process.argv[process.argv.indexOf("--base") + 1]
  : "https://vialgrade.com";

const results = [];
const record = (verdict, name, detail) => { results.push({ verdict, name, detail }); };
const pass = (n, d) => record("PASS", n, d);
const fail = (n, d) => record("FAIL", n, d);
const unknown = (n, d) => record("UNKNOWN", n, d);

async function get(path, { redirect = "manual" } = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(`${url}${url.includes("?") ? "&" : "?"}_cb=${Math.random().toString(36).slice(2)}`, {
    redirect, headers: { "user-agent": "VialGrade-LiveVerify/1.0", "cache-control": "no-cache" },
  });
  return res;
}

/** Strip scripts and tags so we judge what a person sees, never the i18n bundle. */
export function renderedText(html) {
  const withoutCode = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, " ");
  return withoutCode
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;|&rsquo;|&#39;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"').replace(/&mdash;/g, "—")
    .replace(/\s+/g, " ").trim();
}

/** Parse the Collectors card. Returns null when the card is absent — absent is not zero. */
export function parseCollectors(text) {
  const m = /Collectors\s+(\d+)\s+enabled\s+(.{0,80}?)(?:\s+Intelligence graph|$)/.exec(text);
  if (!m) return null;
  const enabled = Number(m[1]);
  const rest = m[2];
  const waiting = /(\d+)\s+waiting/.exec(rest);
  return { enabled, waiting: waiting ? Number(waiting[1]) : 0, detail: rest.trim() };
}

export function bannerOf(text) {
  const m = /(All systems operational|Major outage[^|]{0,90}|Degraded\s+—\s+[^|]{0,110}?)(?:\s+System status|$)/.exec(text);
  return m ? m[1].trim() : null;
}

// ── Self-test: prove the parsers can say no ─────────────────────────────────────────────────────
function selfTest() {
  const bad = [];
  const t = (name, cond) => { if (!cond) bad.push(name); };

  // renderedText must not surface strings that live only inside <script> — the Trustpilot trap.
  t("renderedText leaks script contents",
    !renderedText('<div>ok</div><script>var e="This profile has been removed"</script>').includes("removed"));
  t("renderedText keeps visible copy",
    renderedText("<p>All systems <b>operational</b></p>") === "All systems operational");

  // parseCollectors must return null (not a zero) when the card is missing.
  t("parseCollectors invents a card", parseCollectors("Refresh engine 4 enabled Intelligence graph") === null);
  t("parseCollectors reads a real card",
    parseCollectors("Collectors 99 enabled 71 waiting · oldest 10d past due Intelligence graph 223 traces")?.waiting === 71);
  t("parseCollectors reads a zero card", parseCollectors("Collectors 0 enabled Nothing is being gathered")?.enabled === 0);

  t("bannerOf misses a degraded banner",
    bannerOf("Degraded — collectors are behind; waited 10d System status")?.startsWith("Degraded"));
  t("bannerOf invents a banner", bannerOf("Some unrelated page about vendors") === null);

  return bad;
}

if (process.argv.includes("--selftest")) {
  const bad = selfTest();
  console.log(bad.length ? `SELFTEST FAILED:\n- ${bad.join("\n- ")}` : "Self-test passed: every parser can still say no.");
  process.exit(bad.length ? 1 : 0);
}

const blind = selfTest();
if (blind.length) {
  console.error(`Live verification is BLIND — its own parsers no longer reject known-bad input:\n- ${blind.join("\n- ")}`);
  process.exit(1);
}

// ── 1. The site serves ──────────────────────────────────────────────────────────────────────────
const PUBLIC = ["/", "/vendors", "/compounds", "/verify", "/news", "/testing", "/status", "/search", "/signals"];
for (const path of PUBLIC) {
  const res = await get(path, { redirect: "follow" });
  if (res.ok) pass(`GET ${path}`, `HTTP ${res.status}`);
  else fail(`GET ${path}`, `HTTP ${res.status}`);
}

// ── 2. Admin is protected — 307 to login, never 200 ─────────────────────────────────────────────
for (const path of ["/admin", "/admin/sources", "/admin/ingest", "/admin/review", "/admin/publications", "/admin/traces"]) {
  const res = await get(path);
  if (res.status === 200) fail(`ADMIN ${path}`, "served 200 to an anonymous caller");
  else if (res.status >= 300 && res.status < 400) pass(`ADMIN ${path}`, `HTTP ${res.status} -> ${res.headers.get("location") ?? "?"}`);
  else unknown(`ADMIN ${path}`, `HTTP ${res.status}`);
}

// ── 3. /status tells the truth about the collectors ─────────────────────────────────────────────
{
  const text = renderedText(await (await get("/status", { redirect: "follow" })).text());
  const c = parseCollectors(text);
  const banner = bannerOf(text);

  if (!c) fail("status: Collectors card", "card absent — the surface that makes starvation visible is missing");
  else if (c.enabled === 0) fail("status: collectors enabled", "0 enabled — nothing is being gathered");
  else pass("status: collectors enabled", `${c.enabled} enabled · ${c.detail}`);

  if (!banner) unknown("status: banner", "could not read a banner");
  else if (c && c.enabled > 0 && c.waiting === 0 && banner !== "All systems operational")
    fail("status: banner agrees with the numbers", `nothing waiting but banner says "${banner}"`);
  else pass("status: banner", banner);

  // The backlog was 87 immediately after the hourly cron shipped. Anything at or above that means
  // ticks are not draining it, whatever the tick logs say.
  if (c && c.waiting >= 87) fail("collector backlog draining", `${c.waiting} waiting — at or above the 87 measured when the fix shipped`);
  else if (c) pass("collector backlog draining", `${c.waiting} waiting (was 87 at fix time)`);
}

// ── 4. Readiness endpoint and the page cannot disagree ──────────────────────────────────────────
{
  const res = await get("/api/health/ready", { redirect: "follow" });
  const body = await res.text();
  let json = null; try { json = JSON.parse(body); } catch { /* not json */ }
  if (!json) unknown("health/ready", `unparseable body (HTTP ${res.status})`);
  else if (json.status === "ready") pass("health/ready", `status=${json.status} db=${json.database}`);
  else fail("health/ready", `status=${json.status} ${JSON.stringify(json).slice(0, 120)}`);
}

// ── 5. An absence of evidence must not be published as a red flag ───────────────────────────────
{
  const res = await get("/vendors/chameleon-peptides", { redirect: "follow" });
  if (!res.ok) unknown("absence-vs-finding split", `vendor page HTTP ${res.status}`);
  else {
    const text = renderedText(await res.text());
    const gapPhrase = /No independent Reddit|No community verification|forum verification found/i.test(text);
    const idxGaps = text.search(/What we could not check|could not check|Gaps in our/i);
    if (!gapPhrase) unknown("absence-vs-finding split", "no gap-phrased note on this page to judge");
    else if (idxGaps === -1) fail("absence-vs-finding split", "gap note present but no 'could not check' section — it is still rendered as a finding");
    else pass("absence-vs-finding split", "gap notes render under their own heading, not under red flags");
  }
}

// ── 6. Ascend: did the certificate fix reach the page? ──────────────────────────────────────────
{
  const res = await get("/vendors/ascend-bio-labs", { redirect: "follow" });
  if (!res.ok) unknown("ascend certificates", `HTTP ${res.status}`);
  else {
    const text = renderedText(await res.text());
    const ungraded = /Not enough evidence to grade/i.test(text);
    const noLabs = /no independent lab tests?/i.test(text);
    if (ungraded && noLabs) unknown("ascend certificates", "still ungraded — its collector target has not been claimed yet (backlog draining at 8/hour)");
    else if (ungraded) unknown("ascend certificates", "ungraded for another reason — inspect the page");
    else pass("ascend certificates", "graded — the scheduled import recorded its certificates");
  }
}

// ── 7. Whatever the deploy path is, SOMETHING must refuse a red commit ─────────────────────────
//
// This check used to assert that no production deploy came from git — true while CI was the only
// deploy path, and deliberately false since GitHub Actions became unavailable and the gate moved
// into the Vercel build. The check flagged itself, which is the point of it existing; a verifier
// that quietly kept passing on a stale premise would be worse than none.
//
// What must hold in EITHER architecture is that a red suite cannot reach the site. So: assert the
// gate exists wherever it currently lives, and name which mode is active rather than assuming.
{
  const { readFileSync } = await import("node:fs");
  const build = readFileSync(new URL("../scripts/build.mjs", import.meta.url), "utf8");
  const vercelCfg = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const autoDeployOff = vercelCfg.git?.deploymentEnabled?.main === false;
  const buildGated = /vitest\.mjs[\s\S]{0,200}tests\/unit/.test(build) && /Refusing to build/.test(build);

  if (autoDeployOff) {
    // CI-gated mode: the deploy job is the only path, so no production deploy may come from git.
    const token = process.env.VERCEL_TOKEN;
    if (!token) unknown("deploy gate (CI mode)", "set VERCEL_TOKEN to check deployment sources");
    else {
      const res = await fetch("https://api.vercel.com/v6/deployments?projectId=prj_IsRs7YJEMkuBWGR7qCRbNrceqCCC&teamId=team_MA7HI0IC6XvMpuw33G9utThB&target=production&limit=3",
        { headers: { Authorization: `Bearer ${token}` } });
      const recent = ((await res.json()).deployments ?? []).slice(0, 3);
      const git = recent.filter((d) => d.source === "git");
      if (git.length) fail("deploy gate (CI mode)", `${git.length} of ${recent.length} deploys came from git, bypassing CI`);
      else pass("deploy gate (CI mode)", `last ${recent.length} deploys all source=cli`);
    }
  } else if (buildGated) {
    pass("deploy gate (build mode)", "auto-deploy on; scripts/build.mjs refuses to build a red unit suite");
  } else {
    fail("deploy gate", "auto-deploy is ON and the build does not run the unit suite — nothing checks a commit before it ships");
  }
}

// ── 8. Production must be serving the commit that was verified ─────────────────────────────────
{
  const token = process.env.VERCEL_TOKEN;
  const { execSync } = await import("node:child_process");
  let head = null;
  try { head = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim(); } catch { /* not a repo */ }
  if (!token || !head) unknown("production serves HEAD", "needs VERCEL_TOKEN and a git checkout");
  else {
    const res = await fetch("https://api.vercel.com/v6/deployments?projectId=prj_IsRs7YJEMkuBWGR7qCRbNrceqCCC&teamId=team_MA7HI0IC6XvMpuw33G9utThB&target=production&limit=1",
      { headers: { Authorization: `Bearer ${token}` } });
    const d = ((await res.json()).deployments ?? [])[0];
    const sha = d?.meta?.githubCommitSha;
    if (!d) unknown("production serves HEAD", "no deployment returned");
    else if (d.readyState !== "READY") unknown("production serves HEAD", `latest deployment is ${d.readyState}`);
    else if (!sha) unknown("production serves HEAD", "deployment carries no commit metadata");
    else if (sha !== head) fail("production serves HEAD", `live ${sha.slice(0, 7)} but HEAD is ${head.slice(0, 7)} — main is ahead of the site`);
    else pass("production serves HEAD", sha.slice(0, 7));
  }
}

// ── Report ──────────────────────────────────────────────────────────────────────────────────────
const width = Math.max(...results.map((r) => r.name.length));
console.log(`\nLive verification of ${BASE}\n${"─".repeat(60)}`);
for (const r of results) {
  const mark = r.verdict === "PASS" ? "✓" : r.verdict === "FAIL" ? "✗" : "?";
  console.log(`${mark} ${r.name.padEnd(width)}  ${r.detail}`);
}
const failed = results.filter((r) => r.verdict === "FAIL");
const unsure = results.filter((r) => r.verdict === "UNKNOWN");
console.log(`${"─".repeat(60)}\n${results.length - failed.length - unsure.length} passed · ${failed.length} failed · ${unsure.length} unknown`);
if (unsure.length) console.log(`\nUnknown is not passing — these could not be measured:\n${unsure.map((u) => `  ? ${u.name}: ${u.detail}`).join("\n")}`);
process.exit(failed.length ? 1 : 0);
