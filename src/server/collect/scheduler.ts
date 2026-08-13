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

export type CollectorKind = "catalog-shopify" | "catalog-woo" | "vendor-status";

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

async function runOne(db: SqlConnection, t: DueTarget): Promise<number> {
  const vendor = vendors().find(v => v.slug === t.target);
  if (!vendor) throw new Error(`unknown vendor ${t.target}`);

  if (t.collector === "vendor-status") {
    const status = await probeVendorStatus(vendor.domain);
    await recordVendorStatus(db, vendor.slug, status);
    return 1;
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
  return result.imported.length;
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

  const due = await claimDueTargets(db, options.maxTargets ?? 8);
  for (const t of due) {
    // Stop BEFORE starting work we cannot finish — a half-run target would settle as a failure
    // and back off for no reason.
    if (Date.now() - started > budgetMs) { budgetExhausted = true; break; }
    try {
      const items = await runOne(db, t);
      await settle(db, t, true, items);
      ran.push({ collector: t.collector, target: t.target, items, ok: true });
      if (t.collector !== "vendor-status") catalogChanged = true;
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
