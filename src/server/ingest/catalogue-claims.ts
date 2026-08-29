// Phase 3 of docs/superpowers/specs/2026-08-29-vial-price-truth-design.md.
//
// The collector reads the vendor's own structured catalogue feed — the price authority — but it
// used to write listings.price directly: the only price writer with no claim, no receipt and no
// cascade, so a real price move never reached a watcher as a truthful alert while a scraped promo
// banner did. Now a CHANGED feed price becomes an evidence claim against a compact capture of the
// feed, approved in-band and published through the same receipt + cascade as every other value
// (AGENTS.md). Creation is not a change: a listing's first price is still set directly.
//
// Two guards hold a claim for a person instead of publishing it: a move beyond five-fold either
// way, and a read in which most of a vendor's catalogue lands on ONE new price — the signature of
// a broken feed, not a sale. Held claims stay pending and visible on /admin/review.
import { createHash } from "node:crypto";
import type { SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { reportError } from "@/server/observability/alerts";

export const FEED_SUSPECT_MIN_ITEMS = 10;
export const FEED_SUSPECT_SHARE = 0.5;
export const FEED_EXTREME_RATIO = 5;
export const FEED_MATERIAL_MOVE = 0.3;
export const CATALOGUE_FEED_EXTRACTOR = "catalogue-feed";
export const CATALOGUE_FEED_ACTOR = "system:catalogue-feed";

export interface FeedItem { slug: string; price: number; available: boolean }

export interface FeedCapture {
  vendorSlug: string;
  vendorName: string;
  feedUrl: string;
  items: FeedItem[];
  /** Most of the catalogue landed on one price in this read — publish nothing, hold everything. */
  suspect: boolean;
  suspectReason?: string;
  sourceId?: string;
  snapshotId?: string;
  runId?: string;
}

/** Pure: is this read's price distribution the shape of a broken feed? */
export function assessFeed(items: FeedItem[]): { suspect: boolean; reason?: string } {
  if (items.length < FEED_SUSPECT_MIN_ITEMS) return { suspect: false };
  const counts = new Map<number, number>();
  for (const item of items) counts.set(item.price, (counts.get(item.price) ?? 0) + 1);
  const [price, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  if (count / items.length > FEED_SUSPECT_SHARE) {
    return { suspect: true, reason: `${count} of ${items.length} products in this read carry the same price ($${price}) — a broken feed, not a sale` };
  }
  return { suspect: false };
}

export function feedCapture(input: { vendorSlug: string; vendorName: string; feedUrl: string; items: FeedItem[] }): FeedCapture {
  const assessment = assessFeed(input.items);
  return { ...input, suspect: assessment.suspect, ...(assessment.reason ? { suspectReason: assessment.reason } : {}) };
}

/**
 * The lineage a claim needs — a `sources` row for the feed, a compact snapshot of what it declared
 * (slug, price, available — never the multi-megabyte raw JSON), and an `agent_runs` row — created
 * once per import, lazily, the first time a change is found.
 */
export async function ensureFeedCapture(db: SqlConnection, capture: FeedCapture): Promise<{ sourceId: string; snapshotId: string; runId: string }> {
  if (capture.sourceId && capture.snapshotId && capture.runId) return { sourceId: capture.sourceId, snapshotId: capture.snapshotId, runId: capture.runId };
  await db.query(
    `INSERT INTO sources (id, source_type, canonical_location, owner_organization_id, label, status, origin)
     VALUES ($1, 'vendor-feed', $2, $3, $4, 'active', 'live')
     ON CONFLICT (canonical_location) DO UPDATE SET label = EXCLUDED.label, updated_at = NOW()`,
    [`src:feed:${capture.vendorSlug}`, capture.feedUrl, `org:${capture.vendorSlug}`, `${capture.vendorName} — catalogue feed`],
  );
  const sourceId = (await db.query<{ id: string }>(`SELECT id FROM sources WHERE canonical_location = $1`, [capture.feedUrl])).rows[0]!.id;
  const content = JSON.stringify(capture.items.map((i) => ({ slug: i.slug, price: i.price, available: i.available })));
  const contentHash = createHash("sha256").update(content).digest("hex");
  const existing = (await db.query<{ id: string }>(`SELECT id FROM source_snapshots WHERE source_id = $1 AND content_hash = $2`, [sourceId, contentHash])).rows[0];
  const snapshotId = existing?.id ?? newId("snap");
  if (!existing) {
    await db.query(
      `INSERT INTO source_snapshots (id, source_id, content_hash, raw_content, content_type, fetch_status, metadata, created_by)
       VALUES ($1, $2, $3, $4, 'application/json', 'captured', $5::jsonb, $6)`,
      [snapshotId, sourceId, contentHash, content, JSON.stringify({ kind: CATALOGUE_FEED_EXTRACTOR, feedUrl: capture.feedUrl, products: capture.items.length, suspect: capture.suspect }), CATALOGUE_FEED_ACTOR],
    );
  }
  const runId = newId("run");
  await db.query(
    `INSERT INTO agent_runs (id, workflow, target_type, target_id, status, started_at, tool_budget, proposed_changes, published_changes, input_json, output_json, actor, idempotency_key)
     VALUES ($1, $2, 'vendor', $3, 'running', NOW(), 0, 0, 0, $4::jsonb, '{}'::jsonb, $5, $6)`,
    [runId, CATALOGUE_FEED_EXTRACTOR, `org:${capture.vendorSlug}`, JSON.stringify({ feedUrl: capture.feedUrl, products: capture.items.length, snapshotId }), CATALOGUE_FEED_ACTOR, `${CATALOGUE_FEED_EXTRACTOR}:${capture.vendorSlug}:${snapshotId}:${runId}`],
  );
  capture.sourceId = sourceId; capture.snapshotId = snapshotId; capture.runId = runId;
  return { sourceId, snapshotId, runId };
}

const cents = (value: number) => Math.round(value * 100) / 100;

/**
 * A changed feed price as a claim: published in-band with a receipt and the cascade, or held for
 * a person when the move is extreme or the whole read is suspect.
 */
export async function proposeCataloguePrice(
  db: SqlConnection,
  input: { capture: FeedCapture; listingId: string; listingSlug: string; previous: number; next: number },
): Promise<{ claimId: string; status: "published" | "held"; reason?: string }> {
  const previous = cents(input.previous);
  const next = cents(input.next);
  const ratio = previous > 0 ? next / previous : Number.POSITIVE_INFINITY;
  const move = previous > 0 ? Math.abs(next - previous) / previous : 1;
  const extreme = ratio >= FEED_EXTREME_RATIO || ratio <= 1 / FEED_EXTREME_RATIO;
  const hold = input.capture.suspect || extreme;
  const holdReason = input.capture.suspect
    ? input.capture.suspectReason ?? "the whole read is suspect"
    : extreme ? `a ${ratio >= 1 ? `${ratio.toFixed(1)}×` : `÷${(1 / ratio).toFixed(1)}`} move in one read` : undefined;
  const riskLevel = move > FEED_MATERIAL_MOVE ? "material" : "standard";
  const { snapshotId, runId } = await ensureFeedCapture(db, input.capture);
  const claimId = newId("claim");
  await db.query(
    `INSERT INTO evidence_claims
     (id, subject_type, subject_id, predicate, value_json, previous_value_json, source_snapshot_id, agent_run_id, extractor_version, model_confidence, verification_status, review_status, risk_level, rationale)
     VALUES ($1, 'listing', $2, 'price', $3::jsonb, $4::jsonb, $5, $6, $7, 0.99, 'source-observed', 'pending', $8, $9)`,
    [claimId, input.listingId, JSON.stringify(next), JSON.stringify(previous), snapshotId, runId, CATALOGUE_FEED_EXTRACTOR, riskLevel,
      hold ? `The vendor's catalogue feed declared $${next} (was $${previous}); held for a person because ${holdReason}.` : `The vendor's catalogue feed declared $${next} (was $${previous}).`],
  );
  if (hold) {
    reportError({ kind: "catalogue-feed-held", message: `${input.capture.vendorName}: ${input.listingSlug} held at $${previous} — feed said $${next}; ${holdReason}`, severity: "error", context: { vendor: input.capture.vendorSlug, listing: input.listingSlug, previous, next } });
    return { claimId, status: "held", reason: holdReason };
  }
  // Imported lazily: review/repository reaches the cascade, which reaches most of the server.
  const { reviewClaim } = await import("@/server/review/repository");
  await reviewClaim({ claimId, decision: "approve", actor: CATALOGUE_FEED_ACTOR, role: "admin", notes: "Published from the vendor's structured catalogue feed — the price authority for this listing." });
  return { claimId, status: "published" };
}
