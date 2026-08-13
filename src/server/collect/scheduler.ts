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
import knownVendors from "@/server/verify/known-vendors.json";
import { importShopifyCatalog } from "@/server/ingest/shopify-import";
import { importWooCommerceCatalog } from "@/server/ingest/woocommerce-import";
import { probeVendorStatus, recordVendorStatus } from "@/server/verify/vendor-status";
import { recomputeCompoundStats } from "@/server/ingest/live-sources";
import { rebuildSearchIndex } from "@/server/search/engine";
import { recomputeAllVendorGrades } from "@/server/verify/grade-store";
import type { CompoundRef } from "@/server/ingest/shopify-import";
import { collectEnforcement } from "./enforcement";
import { collectNews } from "./news";
import type { CollectorOutcome } from "./types";

export type CollectorKind = "catalog-shopify" | "catalog-woo" | "vendor-status" | "enforcement-openfda" | "news-feeds";

// Market-wide collectors run once per tick, not once per vendor. They share this target name.
const MARKET_TARGET = "market";
const MARKET_COLLECTORS: CollectorKind[] = ["enforcement-openfda", "news-feeds"];

interface KnownVendor {
  slug: string; name: string; domain: string;
  redFlag?: boolean; productsJsonWorks?: boolean; wooWorks?: boolean;
  reputationSummary?: string;
}

// Cadence tiers — chosen from how fast each source actually changes, not from how often we could
// ask. Prices move; a vendor's storefront being alive moves slower.
export const CADENCE_MINUTES: Record<CollectorKind, number> = {
  "catalog-shopify": 6 * 60,
  "catalog-woo": 6 * 60,
  "vendor-status": 24 * 60,
  // Government publishing rhythms, not ours. FDA posts recalls to openFDA in daily batches, so
  // asking more than once a day only spends rate limit. Press releases land through the working
  // day, and a twice-daily pass keeps `/news` current without hammering a public feed.
  "enforcement-openfda": 24 * 60,
  "news-feeds": 12 * 60,
};

const MAX_BACKOFF_MINUTES = 7 * 24 * 60;
const DISABLE_AFTER_FAILURES = 12;

function vendors(): KnownVendor[] {
  const raw = knownVendors as unknown;
  const list = Array.isArray(raw) ? raw : ((raw as { vendors?: unknown[] }).vendors ?? []);
  return (list as KnownVendor[]).filter(v => v?.slug && v?.domain);
}

/** Reconciles the queue against the curated vendor list. Idempotent; safe on every tick. */
export async function syncCollectionTargets(connection?: SqlConnection): Promise<{ targets: number }> {
  const db = connection ?? await getDatabase();
  const legit = vendors().filter(v => !v.redFlag);
  const rows: { collector: CollectorKind; target: string }[] = [];
  for (const v of legit) {
    if (v.productsJsonWorks) rows.push({ collector: "catalog-shopify", target: v.slug });
    else if (v.wooWorks) rows.push({ collector: "catalog-woo", target: v.slug });
    rows.push({ collector: "vendor-status", target: v.slug });
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
  return { targets: rows.length };
}

export interface DueTarget {
  id: string; collector: CollectorKind; target: string; cadence_minutes: number; consecutive_failures: number;
}

/** Most-overdue first, so nothing starves while a busy collector hogs the ticks. */
export async function claimDueTargets(db: SqlConnection, limit: number): Promise<DueTarget[]> {
  return (await db.query<DueTarget>(
    `SELECT id,collector,target,cadence_minutes,consecutive_failures
     FROM collection_targets
     WHERE enabled AND next_due_at <= NOW()
     ORDER BY next_due_at ASC
     LIMIT $1`,
    [limit],
  )).rows;
}

// A failing target backs off instead of burning every tick on the same dead host.
function nextDelayMinutes(cadence: number, failures: number): number {
  if (failures <= 0) return cadence;
  return Math.min(cadence * Math.pow(2, failures), MAX_BACKOFF_MINUTES);
}

async function settle(db: SqlConnection, t: DueTarget, ok: boolean, items: number, error?: string) {
  const failures = ok ? 0 : t.consecutive_failures + 1;
  const delay = nextDelayMinutes(t.cadence_minutes, failures);
  await db.query(
    `UPDATE collection_targets
     SET last_run_at=NOW(), last_ok=$2, last_items=$3::int, last_error=$4,
         consecutive_failures=$5::int,
         enabled = CASE WHEN $5::int >= $6::int THEN FALSE ELSE enabled END,
         next_due_at = NOW() + ($7::text || ' minutes')::interval, updated_at=NOW()
     WHERE id=$1`,
    [t.id, ok, items, error?.slice(0, 400) ?? null, failures, DISABLE_AFTER_FAILURES, String(delay)],
  );
  await recordCollectorRun(db, { collector: t.collector, target: t.target, items, ok });
}

async function compoundRefs(db: SqlConnection): Promise<CompoundRef[]> {
  return (await db.query<{ slug: string; canonical_name: string; aliases: unknown }>(
    `SELECT slug, canonical_name, aliases FROM compounds`,
  )).rows.map(r => ({
    slug: r.slug,
    name: r.canonical_name,
    aliases: Array.isArray(r.aliases) ? (r.aliases as string[]) : [],
  }));
}

async function runOne(db: SqlConnection, t: DueTarget): Promise<CollectorOutcome> {
  // Market-wide collectors have no vendor, and they report ok/not-ok themselves rather than
  // signalling a dead source by throwing.
  if (t.collector === "enforcement-openfda") return collectEnforcement(db);
  if (t.collector === "news-feeds") return collectNews(db);

  const vendor = vendors().find(v => v.slug === t.target);
  if (!vendor) throw new Error(`unknown vendor ${t.target}`);

  if (t.collector === "vendor-status") {
    const status = await probeVendorStatus(vendor.domain);
    await recordVendorStatus(db, vendor.slug, status);
    return { items: 1, ok: true };
  }

  const compounds = await compoundRefs(db);
  const input = {
    vendorSlug: vendor.slug, vendorName: vendor.name, domain: vendor.domain,
    description: `${vendor.reputationSummary ?? "Research-peptide vendor."} Aggregated from public sources; VialGrade does not endorse any vendor.`,
    compounds,
  };
  const result = t.collector === "catalog-shopify"
    ? await importShopifyCatalog(db, input)
    : await importWooCommerceCatalog(db, input);
  return { items: result.imported.length, ok: true };
}

export interface TickResult {
  ran: { collector: string; target: string; items: number; ok: boolean; error?: string }[];
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
  options: { budgetMs?: number; maxTargets?: number; connection?: SqlConnection } = {},
): Promise<TickResult> {
  const started = Date.now();
  const budgetMs = options.budgetMs ?? 45_000;
  const db = options.connection ?? await getDatabase();
  await syncCollectionTargets(db);

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
  const allDue = await claimDueTargets(db, 200);
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
  for (const t of due) {
    // Stop BEFORE starting work we cannot finish — a half-run target would settle as a failure
    // and back off for no reason.
    if (Date.now() - started > budgetMs) { budgetExhausted = true; break; }
    try {
      // A collector reports a dead SOURCE in its return value, not by throwing — a throw here means
      // a defect in our own code, and the two must stay distinguishable in `collector_runs`.
      const { items, ok, error } = await runOne(db, t);
      await settle(db, t, ok, items, error);
      ran.push({ collector: t.collector, target: t.target, items, ok, ...(error ? { error } : {}) });
      if (ok && (t.collector === "catalog-shopify" || t.collector === "catalog-woo")) catalogChanged = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await settle(db, t, false, 0, message);
      ran.push({ collector: t.collector, target: t.target, items: 0, ok: false, error: message });
    }
  }

  // Newly imported listings are invisible to site search until the derived index is rebuilt, and
  // compound stats drive the market pages. Only pay for it when the catalog actually moved.
  let reindexed = false;
  if (catalogChanged && Date.now() - started < budgetMs + 15_000) {
    await recomputeCompoundStats(db);
    await rebuildSearchIndex(db);
    reindexed = true;
  }

  // Keep the materialized grade in step with the evidence that just changed. Stale-first ordering
  // plus its own budget means this never crowds out collection — it just keeps chipping away.
  const regrade = await recomputeAllVendorGrades({ connection: db, budgetMs: 10_000, limit: 25 });

  return { ran, budgetExhausted, reindexed, regraded: regrade.graded, durationMs: Date.now() - started };
}
