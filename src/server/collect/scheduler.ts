// Continuous collection: a self-pacing queue the deployment drains on a cron tick.
//
// Design constraints that shaped this:
//   - A serverless function has a hard time limit, and a full market pass takes minutes. So a tick
//     works to a TIME BUDGET and stops cleanly; the queue remembers where it got to.
//   - Third-party storefronts are not ours. Each target carries its own cadence (tiered by how fast
//     that source actually changes), and a failing target backs off exponentially instead of being
//     retried every tick.
//   - It runs INSIDE the deployment, so it inherits DATABASE_URL. Collection never again depends on
//     a human holding production credentials.
import type { SqlConnection } from "@/server/db/client";
import { getDatabase } from "@/server/db/client";
import { recordCollectorRun } from "@/server/health/data-health";
import { runPooled } from "./pool";
import { DUE_GRACE_MINUTES } from "./schedule-capacity";
import knownVendors from "@/server/verify/known-vendors.json";
import { importShopifyCatalog } from "@/server/ingest/shopify-import";
import { importWooCommerceCatalog } from "@/server/ingest/woocommerce-import";
import { probeVendorStatus, recordVendorStatus } from "@/server/verify/vendor-status";
import { recomputeCompoundStats } from "@/server/ingest/live-sources";
import { recordTickPriceObservations, recomputeCompoundPriceChanges } from "@/server/ingest/price-history";
import { recordLabTest } from "@/server/ingest/lab-tests";
import { recomputeVendorStats } from "@/server/db/vendor-stats-repair";
import { rebuildSearchIndex } from "@/server/search/engine";
import { recomputeAllVendorGrades } from "@/server/verify/grade-store";
import type { CompoundRef } from "@/server/ingest/shopify-import";
import { collectEnforcement } from "./enforcement";
import { collectNews } from "./news";
import { fetchDomainRegistrationDate, domainAgeNote } from "./domain-age";
import { fetchShopRating, ratingForDomain, normalizeDomain } from "./tracker-ratings";
import { recordDomainAge, recordAggregatorRating } from "@/server/external/repository";
import { importRscCatalog, productUrlsFromSitemap } from "@/server/ingest/rsc-storefront-import";
import { collectJanoshikLive, collectJanoshikCapture } from "./lab-janoshik";
import { reconcileVendorKinds } from "@/server/catalog/vendor-kind";
import type { CollectorOutcome } from "./types";

export type CollectorKind = "catalog-shopify" | "catalog-woo" | "catalog-rsc" | "vendor-status" | "domain-age" | "tracker-ratings" | "enforcement-openfda" | "news-feeds" | "lab-janoshik" | "lab-janoshik-capture";

// Market-wide collectors run once per tick, not once per vendor. They share this target name.
const MARKET_TARGET = "market";
const MARKET_COLLECTORS: CollectorKind[] = ["enforcement-openfda", "news-feeds", "lab-janoshik", "lab-janoshik-capture"];

interface KnownVendor {
  slug: string; name: string; domain: string;
  redFlag?: boolean; productsJsonWorks?: boolean; wooWorks?: boolean;
  // Headless storefronts (Medusa behind Next.js): no /products.json, no /wp-json. The catalogue is
  // in the server-component payload. Without this flag here the whole vendor class is never
  // collected in production, however well the importer works on a laptop.
  rscWorks?: boolean; rscProductPath?: string;
  reputationSummary?: string;
}

// Cadence tiers — chosen from how fast each source actually changes, not from how often we could
// ask. Prices move; a vendor's storefront being alive moves slower.
//
// No cadence here may be shorter than the interval of the cron that drains the queue, and since
// 2026-09-07 that cron is daily (owner's call: nothing runs more than once a day). A six-hour
// cadence under a daily cron is not four reads a day, it is one read a day wearing a label that
// says four — the target simply sits due until the next run. The arithmetic in schedule-capacity.ts
// counts demand straight off these numbers, so a cadence that lies here makes every capacity
// assertion downstream lie with it. `tests/unit/schedule-capacity.test.ts` holds the floor.
export const CADENCE_MINUTES: Record<CollectorKind, number> = {
  "catalog-shopify": 24 * 60,
  "catalog-woo": 24 * 60,
  "vendor-status": 24 * 60,
  // Government publishing rhythms, not ours. FDA posts recalls to openFDA in daily batches, so
  // asking more than once a day only spends rate limit — this one was already at the daily floor
  // and did not move. News dropped from twice a day to once for the reason above.
  "enforcement-openfda": 24 * 60,
  "news-feeds": 24 * 60,
  // A headless catalogue changes as fast as a Shopify one — same prices, same stock.
  "catalog-rsc": 24 * 60,
  // A registration date does not move. This is here to notice NEW vendors and to re-check the ones
  // whose lookup failed, not to re-ask a question whose answer is fixed.
  "domain-age": 30 * 24 * 60,
  // Someone else's review corpus. Weekly is enough to track a trend without hammering their site.
  "tracker-ratings": 7 * 24 * 60,
  // The lab's public feed is a bounded window of recent tests that turns over across days, not
  // hours; a daily read captures everything before it rolls off and re-confirms what we hold.
  // The committed browser capture only changes when a person commits a new one — daily is the
  // longest it can wait to be applied, and it costs one read of a file in the bundle.
  "lab-janoshik": 24 * 60,
  "lab-janoshik-capture": 24 * 60,
};

const MAX_BACKOFF_MINUTES = 7 * 24 * 60;
const DISABLE_AFTER_FAILURES = 12;
// A storefront that refuses us outright will keep refusing us. Retrying it a dozen times over a
// week is pointless load on someone else's server; stop sooner and make it visible in the admin.
const DISABLE_AFTER_REFUSALS = 3;

function vendors(): KnownVendor[] {
  const raw = knownVendors as unknown;
  const list = Array.isArray(raw) ? raw : ((raw as { vendors?: unknown[] }).vendors ?? []);
  return (list as KnownVendor[]).filter(v => v?.slug && v?.domain);
}

/**
 * The vendors a buyer can actually shop at, for kind classification.
 *
 * The offline script unioned the curated list with the vendors that publish their own COAs. Every
 * one of those 15 slugs is already in the curated list, so the union is redundant and the curated
 * list alone is the retail set — which is what makes this computable at runtime from the bundle.
 *
 * Red-flagged vendors stay in: a shop that committed fraud is still a shop, and demoting it to
 * "upstream manufacturer" would quietly retire the warning the directory exists to show.
 */
function retailVendorSlugs(): Set<string> {
  const raw = knownVendors as unknown;
  const list = Array.isArray(raw) ? raw : ((raw as { vendors?: unknown[] }).vendors ?? []);
  return new Set((list as Array<{ slug?: string }>).map((v) => v?.slug).filter((s): s is string => Boolean(s)));
}

/** Reconciles the queue against the curated vendor list. Idempotent; safe on every tick. */
export async function syncCollectionTargets(connection?: SqlConnection): Promise<{ targets: number }> {
  const db = connection ?? await getDatabase();
  const legit = vendors().filter(v => !v.redFlag);
  const rows: { collector: CollectorKind; target: string }[] = [];
  for (const v of legit) {
    if (v.productsJsonWorks) rows.push({ collector: "catalog-shopify", target: v.slug });
    else if (v.wooWorks) rows.push({ collector: "catalog-woo", target: v.slug });
    else if (v.rscWorks) rows.push({ collector: "catalog-rsc", target: v.slug });
    rows.push({ collector: "vendor-status", target: v.slug });
    // Per-vendor rather than one market-wide sweep, deliberately. A polite pass over 58 domains
    // takes longer than a serverless tick is allowed to live; per-vendor targets let the queue
    // spread the work across ticks and resume exactly where it stopped.
    rows.push({ collector: "domain-age", target: v.slug });
    rows.push({ collector: "tracker-ratings", target: v.slug });
  }
  // Market-wide intelligence: one target each, independent of the vendor list. These must be
  // enqueued even when every vendor is red-flagged, because enforcement and news are the seams
  // that tell a reader WHY.
  for (const collector of MARKET_COLLECTORS) rows.push({ collector, target: MARKET_TARGET });
  for (const row of rows) {
    await db.query(
      // Conflict on the PRIMARY KEY, not on (collector,target). `id` is derived from both, so the
      // two are equivalent on the happy path — but if they ever diverge, an ON CONFLICT that names
      // only the secondary constraint throws a duplicate-key error that kills the entire tick.
      `INSERT INTO collection_targets(id,collector,target,cadence_minutes)
       VALUES($1,$2,$3,$4)
       ON CONFLICT(id) DO UPDATE SET collector=EXCLUDED.collector,target=EXCLUDED.target,
                                     cadence_minutes=EXCLUDED.cadence_minutes,updated_at=NOW()`,
      [`ct:${row.collector}:${row.target}`, row.collector, row.target, CADENCE_MINUTES[row.collector]],
    );
  }
  // A target disabled after twelve failures was never looked at again: behemoth-labz answered
  // its Store API for 24 days while its row sat disabled. Retry weekly — keyed on last_run_at,
  // because the upsert above touches updated_at every tick.
  await db.query(
    `UPDATE collection_targets
     SET enabled = TRUE, consecutive_failures = 0, next_due_at = NOW(), updated_at = NOW()
     WHERE NOT enabled AND last_run_at < NOW() - INTERVAL '7 days'`,
  );
  // A platform flag flip (Shopify → RSC) leaves the old kind's row behind, still enabled, still
  // failing. Remove rows for KNOWN vendors that this tick did not declare; a synthetic or unknown
  // target is not ours to judge.
  await db.query(
    `DELETE FROM collection_targets WHERE target = ANY($1::text[]) AND NOT (id = ANY($2::text[]))`,
    [vendors().map(v => v.slug), rows.map(row => `ct:${row.collector}:${row.target}`)],
  );
  return { targets: rows.length };
}

/**
 * After a COMPLETE, successful read of a vendor's feed, every live listing of that vendor the
 * read did not touch is no longer for sale there. Imports upsert and never delete, which is how
 * purerawz kept 154 listings "In stock" for a catalogue of 80. One statement, bounded by the
 * vendor, guarded by `observed_at < run start` so nothing the run itself just wrote is touched.
 *
 * `exemptUrls` are product pages the read did NOT evaluate (their sizes were cut by the deadline
 * or the fetch budget). A read that never looked at a product cannot say its sizes are gone —
 * that is how umbrella-labs' in-stock retatrutide, DSIP and tesamorelin vials read "Unavailable"
 * on 2026-08-30 while carrying the junk price the feed was supposed to correct.
 */
export async function retireUnseenListings(db: SqlConnection, vendorSlug: string, since: string | Date, exemptUrls: string[] = []): Promise<number> {
  const result = await db.query<{ id: string }>(
    `UPDATE listings l
     SET availability = 'Unavailable', observed_at = NOW(), updated_at = NOW()
     FROM products p
     WHERE p.id = l.product_id AND p.vendor_id = $1 AND l.origin = 'live'
       AND l.availability <> 'Unavailable' AND l.observed_at < $2::timestamptz
       AND NOT (l.external_url = ANY($3::text[]))
     RETURNING l.id`,
    [`org:${vendorSlug}`, since, exemptUrls],
  );
  return result.rows.length;
}

export interface DueTarget {
  id: string; collector: CollectorKind; target: string; cadence_minutes: number; consecutive_failures: number;
}

/**
 * Most-overdue first, so nothing starves while a busy collector hogs the ticks.
 *
 * Claims slightly EARLY on purpose — see DUE_GRACE_MINUTES. Without the grace, a cadence equal to
 * the cron interval makes every target alternate days, because the seconds a run takes to reach a
 * target push its next due time past the moment the next run starts.
 */
export async function claimDueTargets(db: SqlConnection, limit: number): Promise<DueTarget[]> {
  return (await db.query<DueTarget>(
    `SELECT id,collector,target,cadence_minutes,consecutive_failures
     FROM collection_targets
     WHERE enabled AND next_due_at <= NOW() + ($2::text || ' minutes')::interval
     ORDER BY next_due_at ASC
     LIMIT $1`,
    [limit, String(DUE_GRACE_MINUTES)],
  )).rows;
}

// A failing target backs off instead of burning every tick on the same dead host.
function nextDelayMinutes(cadence: number, failures: number): number {
  if (failures <= 0) return cadence;
  return Math.min(cadence * Math.pow(2, failures), MAX_BACKOFF_MINUTES);
}

async function settle(db: SqlConnection, t: DueTarget, ok: boolean, items: number, error?: string, disableAfter = DISABLE_AFTER_FAILURES) {
  const failures = ok ? 0 : t.consecutive_failures + 1;
  const delay = nextDelayMinutes(t.cadence_minutes, failures);
  await db.query(
    `UPDATE collection_targets
     SET last_run_at=NOW(), last_ok=$2, last_items=$3::int, last_error=$4,
         consecutive_failures=$5::int,
         enabled = CASE WHEN $5::int >= $6::int THEN FALSE ELSE enabled END,
         next_due_at = NOW() + ($7::text || ' minutes')::interval, updated_at=NOW()
     WHERE id=$1`,
    [t.id, ok, items, error?.slice(0, 400) ?? null, failures, disableAfter, String(delay)],
  );
  await recordCollectorRun(db, { collector: t.collector, target: t.target, items, ok });
}

/**
 * Written BEFORE a target runs: the pessimistic outcome. If the function is killed at its ceiling
 * mid-import, this is what remains — the target reads as failing with a reason, is backed off, and
 * is not picked first again next tick to die the same way (umbrella-labs, hourly, for a day, taking
 * every target queued behind it). settle() replaces it with the real outcome.
 */
export async function leaseTarget(db: SqlConnection, t: DueTarget): Promise<void> {
  const failures = t.consecutive_failures + 1;
  await db.query(
    `UPDATE collection_targets
     SET last_run_at=NOW(), last_ok=FALSE, last_error=$2, consecutive_failures=$3::int,
         next_due_at = NOW() + ($4::text || ' minutes')::interval, updated_at=NOW()
     WHERE id=$1`,
    [t.id, "started but did not settle — the function was likely killed at its ceiling mid-run", failures, String(nextDelayMinutes(t.cadence_minutes, failures))],
  );
}

/** The most one target may take of a tick; the function ceiling is 120 s and the tick 45 s. */
export const TARGET_DEADLINE_MS = 40_000;

async function compoundRefs(db: SqlConnection): Promise<CompoundRef[]> {
  return (await db.query<{ slug: string; canonical_name: string; aliases: unknown }>(
    `SELECT slug, canonical_name, aliases FROM compounds`,
  )).rows.map(r => ({
    slug: r.slug,
    name: r.canonical_name,
    aliases: Array.isArray(r.aliases) ? (r.aliases as string[]) : [],
  }));
}

/**
 * Collect a headless storefront's catalogue AND the certificates it publishes.
 *
 * Exported and injectable on purpose. The first version of this lived inline in runOne, which is
 * module-private, so the regression test that was supposed to guard it re-implemented the same loop
 * by hand — meaning a one-line revert of the real code left the test green. A guard that cannot
 * fail is worse than none, so the test calls THIS, the same function production calls.
 */
export async function collectRscCatalog(
  db: SqlConnection,
  input: {
    vendor: { slug: string; name: string; domain: string; rscProductPath?: string };
    compounds: CompoundRef[];
    description: string;
    /** Injected by tests so the path can be exercised without the network. */
    fetchImpl?: typeof fetch;
    fetchProducts?: Parameters<typeof importRscCatalog>[1]["fetchProducts"];
  },
): Promise<CollectorOutcome> {
  const { vendor, compounds, description } = input;
  const doFetch = input.fetchImpl ?? fetch;

  // A headless storefront publishes no catalogue endpoint, so its own sitemap is how we learn what
  // exists. Off-host entries are dropped inside productUrlsFromSitemap.
  const res = await doFetch(`https://${vendor.domain}/sitemap.xml`, { headers: { "user-agent": "VialGrade-Catalog-Import/1.0" }, redirect: "follow" });
  if (!res.ok) throw new Error(`sitemap HTTP ${res.status}`);
  const productUrls = productUrlsFromSitemap(await res.text(), vendor.rscProductPath ?? "/product/", vendor.domain);
  if (!productUrls.length) throw new Error("no product urls in sitemap");

  const rsc = await importRscCatalog(db, {
    vendorSlug: vendor.slug, vendorName: vendor.name, domain: vendor.domain,
    description, compounds, productUrls,
    ...(input.fetchProducts ? { fetchProducts: input.fetchProducts } : {}),
  });

  // Record the certificates the storefront publishes. Forgetting this is why production showed
  // Ascend Bio Labs as "not enough evidence to grade — nothing on file" while the same importer run
  // by hand produced ten independent lab tests: importRscCatalog RETURNS the COA metadata and this
  // path was dropping it. rscCoaFromMetadata has already refused anything without a NAMED
  // third-party lab, so everything arriving here is independent by construction.
  let coas = 0;
  for (const c of rsc.coas) {
    const recorded = await recordLabTest(db, {
      testId: `${vendor.slug}-${c.compoundSlug}-${(c.batchId || c.url).slice(-8)}`,
      verifyUrl: c.url,
      sampleName: compounds.find((x) => x.slug === c.compoundSlug)?.name ?? c.compoundSlug,
      manufacturer: vendor.name,
      batchCode: c.batchId ?? undefined,
      purityPct: c.purityPct,
      measuredContent: null,
      testedAt: c.testedAt,
      lab: c.lab,
      vendorSlug: vendor.slug,
      isIndependent: true,
    }, { compounds, vendors: vendors().map((v) => ({ slug: v.slug, name: v.name, domain: v.domain })) });
    if (recorded.vendorSlug) coas += 1;
  }

  // Both numbers matter to whoever reads collector_runs: listings are the catalogue, certificates
  // are the evidence, and a run that imported one but not the other is not a healthy run.
  return { items: rsc.imported.length + coas, ok: true };
}


async function runOne(db: SqlConnection, t: DueTarget, deadlineAt?: number): Promise<CollectorOutcome> {
  // Market-wide collectors have no vendor, and they report ok/not-ok themselves rather than
  // signalling a dead source by throwing.
  if (t.collector === "enforcement-openfda") return collectEnforcement(db);
  if (t.collector === "news-feeds") return collectNews(db);
  if (t.collector === "lab-janoshik") return collectJanoshikLive(db);
  if (t.collector === "lab-janoshik-capture") return collectJanoshikCapture(db);

  const vendor = vendors().find(v => v.slug === t.target);
  if (!vendor) throw new Error(`unknown vendor ${t.target}`);

  if (t.collector === "vendor-status") {
    const status = await probeVendorStatus(vendor.domain);
    await recordVendorStatus(db, vendor.slug, status);
    return { items: 1, ok: true };
  }

  if (t.collector === "domain-age") {
    const note = domainAgeNote(await fetchDomainRegistrationDate(vendor.domain));
    // A lookup that failed is NOT an answer. recordDomainAge ignores null rather than erasing a
    // note we already hold, and reporting ok:false lets the queue back this target off instead of
    // asking a registry that just refused us again on the next tick. The reason is recorded —
    // purerawz sat on /admin as "failing (2)" with a BLANK error column, which told the owner
    // nothing except to worry.
    if (!note) return { items: 0, ok: false, error: `rdap lookup returned no registration date for ${vendor.domain} — rdap.org refused or timed out, or the registry omits the date` };
    await recordDomainAge(db, vendor.slug, note);
    return { items: 1, ok: true };
  }

  if (t.collector === "tracker-ratings") {
    const domain = normalizeDomain(vendor.domain);
    for (const url of [`https://peptigrity.com/shops/${domain.replace(/\./g, "-")}`, `https://peptigrity.com/shops/${domain}`]) {
      // The page must name THIS vendor's domain. A redirect or a recycled slug otherwise attaches
      // one shop's reputation to another, which is the worst thing this product can get wrong.
      const rating = ratingForDomain(await fetchShopRating(url), domain);
      if (!rating) continue;
      await recordAggregatorRating(db, {
        vendorSlug: vendor.slug, source: "peptigrity-community",
        score: rating.ratingValue, maxScore: rating.bestRating,
        testCount: null, avgPurity: null, wouldBuyAgainPct: null,
        summary: `Peptigrity community rates ${rating.domain} ${rating.ratingValue}/${rating.bestRating} from ${rating.ratingCount} community review${rating.ratingCount === 1 ? "" : "s"}.`,
        sourceUrl: url,
      });
      return { items: 1, ok: true };
    }
    // Not tracked there is a real answer, not a failure — most vendors are not.
    return { items: 0, ok: true };
  }

  const compounds = await compoundRefs(db);
  const input = {
    vendorSlug: vendor.slug, vendorName: vendor.name, domain: vendor.domain,
    description: `${vendor.reputationSummary ?? "Research-peptide vendor."} Aggregated from public sources; VialGrade does not endorse any vendor.`,
    compounds,
  };
  if (t.collector === "catalog-rsc") {
    return collectRscCatalog(db, { vendor, compounds, description: input.description });
  }

  // The database's clock, not this process's: `observed_at` is written with NOW() by the import.
  const startedAt = (await db.query<{ now: string }>(`SELECT NOW() AS now`)).rows[0]!.now;
  const result = t.collector === "catalog-shopify"
    ? await importShopifyCatalog(db, input)
    : await importWooCommerceCatalog(db, { ...input, ...(deadlineAt !== undefined ? { deadlineAt } : {}) });
  // A feed that answered with nothing is a broken feed, not a green run. Reporting it green kept
  // bluum-peptides "healthy" for eight days of zero-item imports. Matching no compound is fine —
  // the feed was read; that is what "fresh" means to the price authority in auto-triage.
  if (result.productsSeen === 0) return { items: 0, ok: false, error: "storefront returned no products — the feed answered but was empty" };
  const retired = result.complete ? await retireUnseenListings(db, vendor.slug, startedAt, result.unevaluatedUrls ?? []) : 0;
  return { items: result.imported.length, ok: true, retired };
}

export interface TickResult {
  ran: { collector: string; target: string; items: number; ok: boolean; error?: string; retired?: number }[];
  /** Live listings that received today's price observation in this tick. */
  observed: number;
  budgetExhausted: boolean;
  reindexed: boolean;
  regraded: number;
  durationMs: number;
}

/**
 * Drains as much of the queue as fits in `budgetMs`, then stops cleanly.
 *
 * Never throws for a single bad target — a vendor that blocks us, changes its platform, or times
 * out is recorded and backed off, and the tick moves on.
 */
export async function runCollectionTick(
  options: { budgetMs?: number; maxTargets?: number; concurrency?: number; connection?: SqlConnection } = {},
): Promise<TickResult> {
  const started = Date.now();
  const budgetMs = options.budgetMs ?? 180_000;
  const db = options.connection ?? await getDatabase();
  await syncCollectionTargets(db);
  // The database's clock: observed_at is written with NOW() by the importers, and the tick's
  // observation statement selects on it.
  const tickStartedAt = (await db.query<{ now: string }>(`SELECT NOW() AS now`)).rows[0]!.now;

  const ran: TickResult["ran"] = [];
  let budgetExhausted = false;
  let catalogChanged = false;

  // Fair share across collector KINDS, not just most-overdue.
  //
  // Pure most-overdue ordering starves small collectors: 40 per-vendor catalog targets will always
  // out-age the single enforcement or news target, so those would wait hours behind a queue they
  // can never get to the front of. Reserve a slot for each kind that has due work, then fill the
  // rest by age.
  const maxTargets = options.maxTargets ?? 8;
  const concurrency = options.concurrency ?? 1;
  // Claim deeper than we can run: the fair-share pass below picks from the whole due set, and on a
  // daily cron the due set IS the day's work rather than a slice of it.
  const allDue = await claimDueTargets(db, Math.max(200, maxTargets * 2));
  const firstOfEachKind: DueTarget[] = [];
  const seenKinds = new Set<string>();
  for (const t of allDue) {
    if (seenKinds.has(t.collector)) continue;
    seenKinds.add(t.collector);
    firstOfEachKind.push(t);
  }
  // Cheapest kind first, measured by how many targets it has due.
  //
  // Reserving a slot per kind is not enough on its own: the reserved slots still ran in age order,
  // so a catalog target — which now fetches per-variation data and can spend the entire tick budget
  // by itself — went first and the single-target enforcement and news collectors were never
  // reached. A collector with one target is by definition cheap; run it before the fleet.
  const dueCountByKind = new Map<string, number>();
  for (const t of allDue) dueCountByKind.set(t.collector, (dueCountByKind.get(t.collector) ?? 0) + 1);
  firstOfEachKind.sort((a, b) => (dueCountByKind.get(a.collector) ?? 0) - (dueCountByKind.get(b.collector) ?? 0));
  const chosen = new Set(firstOfEachKind.map(t => t.id));
  const due = [
    ...firstOfEachKind.slice(0, maxTargets),
    ...allDue.filter(t => !chosen.has(t.id)).slice(0, Math.max(0, maxTargets - firstOfEachKind.length)),
  ];
  // Keyed on `target`, which is the vendor slug — so the pool goes wide across storefronts and
  // never opens two connections to the same one. At concurrency 1 this is exactly the sequential
  // loop it replaced, which is what the tests that predate the daily schedule still assert.
  //
  // The budget still stops work BEFORE it starts, not partway through: a half-run target settles as
  // a failure and backs off for no reason, so under-running is always the cheaper mistake.
  const pooled = await runPooled(due, async (t) => {
    // A collector reports a dead SOURCE in its return value, not by throwing — a throw here means
    // a defect in our own code, and the two must stay distinguishable in `collector_runs`.
    try {
      await leaseTarget(db, t);
      const deadlineAt = Date.now() + Math.min(TARGET_DEADLINE_MS, Math.max(1_000, budgetMs - (Date.now() - started)));
      const { items, ok, error, retired } = await runOne(db, t, deadlineAt);
      await settle(db, t, ok, items, error);
      ran.push({ collector: t.collector, target: t.target, items, ok, ...(error ? { error } : {}), ...(retired !== undefined ? { retired } : {}) });
      if (ok && (t.collector === "catalog-shopify" || t.collector === "catalog-woo")) catalogChanged = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const refused = error instanceof Error && error.name === "StorefrontUnreachableError";
      await settle(db, t, false, 0, message, refused ? DISABLE_AFTER_REFUSALS : DISABLE_AFTER_FAILURES);
      ran.push({ collector: t.collector, target: t.target, items: 0, ok: false, error: message });
    }
  }, { concurrency, keyOf: (t) => t.target, budgetMs: Math.max(0, budgetMs - (Date.now() - started)) });
  if (pooled.budgetExhausted) budgetExhausted = true;

  // Storefront or upstream factory, decided every tick rather than by hand.
  //
  // `organizations.vendor_kind` defaults to 'storefront' at the schema level, and the only caller
  // of the classifier was an offline script. So every vendor the lab feed discovers — the "Made By"
  // party on a Janoshik certificate — kept that default forever: 41 Chinese contract factories
  // (HH Peptide Factory, Guangzhou BoWei Peptide, Dankangpeptidesourcefactory…) were counted under
  // "Shops you can buy from" and rendered as storefronts whose catalogue we had merely failed to
  // capture. Nothing failed; a default was simply mistaken for an answer.
  //
  // It belongs here because both of its inputs move here: a catalogue import gives a vendor
  // listings (making it a storefront), and the lab collector creates new vendors. Idempotent, one
  // read plus an update only where the answer actually changed, so a vendor that later gains a
  // catalogue flips back on its own.
  await reconcileVendorKinds(db, retailVendorSlugs());

  // Every live listing this tick touched becomes today's observation — one statement, the only
  // writer of observation rows — and each compound's Δ is re-earned from those rows (spec D4/D6).
  const observed = await recordTickPriceObservations(db, tickStartedAt);
  await recomputeCompoundPriceChanges(db);

  // Newly imported listings are invisible to site search until the derived index is rebuilt, and
  // compound stats drive the market pages. Only pay for it when the catalog actually moved.
  let reindexed = false;
  if (catalogChanged && Date.now() - started < budgetMs + 15_000) {
    await recomputeCompoundStats(db);
    // Vendor stats are derived the same way and drift for the same reason: an import writes
    // listings without going through the publication cascade, which is the only other writer of
    // organizations.product_count / documentation_current. This MUST precede the index rebuild —
    // rebuildSearchIndex reads those two columns straight into popularity_score / quality_score.
    await recomputeVendorStats(db);
    await rebuildSearchIndex(db);
    reindexed = true;
  }

  // Keep the materialized grade in step with the evidence that just changed. Stale-first ordering
  // means the longest-unrated vendor is always next.
  //
  // The size is a per-DAY budget, not a per-run one, and it has to be re-derived whenever the cron
  // frequency moves. The history is a warning: 25 per run was tuned for a 15-minute collector (96
  // runs/day), and when the cron went daily the same number silently became a four-day lag — a
  // grade correction sitting unpublished while directory cards served the old verdict, in the very
  // case where the stale grade was hiding a vendor's DOJ enforcement record behind a neutral chip.
  // It was raised to 200 against an hourly cron, then 100 against a 30-minute one.
  //
  // The cron is daily again as of 2026-09-07 — this time deliberately, and this time with the
  // number moved to match. One run is now the whole day, so the limit has to clear the entire
  // vendor table in a single pass or it rebuilds that same lag on purpose. 400 covers the ~124
  // vendors on record with room for the table to grow.
  //
  // The budget bounds it. maxDuration on this route is 300s and collection has already spent up to
  // 180s of it by this point, so what is left is claimed here up to 90s — and stale-first ordering
  // means an exhausted budget resumes where it stopped rather than losing its place.
  const regrade = await recomputeAllVendorGrades({ connection: db, budgetMs: Math.min(90_000, Math.max(5_000, 280_000 - (Date.now() - started))), limit: 400 });

  return { ran, budgetExhausted, reindexed, observed, regraded: regrade.graded, durationMs: Date.now() - started };
}
