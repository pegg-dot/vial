// Deciding which proposed claims a human actually needs to look at.
//
// Enrolling every catalogue listing in the provenance pipeline means every price move becomes a
// proposed claim. Without triage that is hundreds of review items a day, which is not a review
// queue — it is a queue nobody reads, and an unread queue is worse than none because it looks like
// oversight while providing none.
//
// So every claim still gets the full spine — snapshot, diff, claim, decision, publication receipt.
// What differs is WHO decides. Routine, in-range commerce values are decided automatically and
// recorded as such; storefront scraping noise is rejected automatically; anything surprising is the
// only thing that reaches a person.
//
// This logic was written for the one-off bpc157 ingest script and was correct there. It is the
// general policy, so it lives here now and that script delegates to it.

import type { SqlConnection } from "@/server/db/client";
import { getDatabase } from "@/server/db/client";
import { reviewClaim } from "@/server/review/repository";

/**
 * A vendor storefront is not a certificate.
 *
 * The deterministic parser scrapes page navigation and boilerplate into these predicates — real
 * observed values include batchCode "SYNTHESIS" and reportIssuer "...Search Login Cart". Auto-
 * rejecting them keeps page chrome from ever being published as evidence, which matters more than
 * queue volume: a human skimming a long queue could approve one by accident.
 *
 * Confirmed against live storefronts: bluum, eternal, swiss-chems and loti-labs all emit exactly
 * these four alongside a perfectly good price.
 */
export const STOREFRONT_NOISE = new Set(["batchCode", "reportDate", "reportIssuer", "reportConfirmed"]);

/** Bounds a real research-peptide vial price falls within. Outside this, a human looks. */
export const PRICE_MIN = 10;
export const PRICE_MAX = 500;

/**
 * How recently the vendor's structured catalogue feed must have been read for it to be the price
 * authority. The catalogue collectors run on a 6 h cadence from an hourly tick; 48 h is eight missed
 * reads — by then the feed is broken and the scraped page is the fallback that keeps prices moving.
 */
export const FEED_FRESH_HOURS = 48;

export type TriageAction = "approve" | "reject" | "hold";

export interface TriageContext {
  /** `evidence_claims.risk_level` — "material" when the pipeline saw a >30 % move. */
  riskLevel?: string | null;
  confidence?: number | null;
  /** When the vendor's catalogue collector last read the feed successfully; null when it has no feed or it is failing. */
  feedReadAt?: Date | string | null;
  now?: Date;
}

export interface TriageDecision {
  action: TriageAction;
  reason: string;
}

/**
 * Pure policy: what should happen to this claim?
 *
 * Separated from the database work so the decision can be tested directly — the version in the
 * ingest script interleaved the two, so the only way to exercise the policy was to run a full
 * ingest, and it had no direct coverage at all.
 */
export function triageClaim(predicate: string, value: unknown, context: TriageContext = {}): TriageDecision {
  if (STOREFRONT_NOISE.has(predicate)) {
    return { action: "reject", reason: "Evidence claim scraped from a vendor storefront page — not a valid COA source." };
  }
  if (predicate === "price") {
    if (typeof value !== "number" || Number.isNaN(value)) return { action: "hold", reason: "price is not a number" };
    // A scraped page is a lossy view of the vendor's own structured catalogue feed, which the
    // collector reads directly and more often. While that feed is fresh the page can only add
    // noise — in production it added promo banners ("ORDERS $100 OR MORE") as prices. The
    // rejection is recorded as a review decision, so the receipt says exactly what superseded it.
    const feedReadAt = context.feedReadAt ? new Date(context.feedReadAt) : null;
    const now = context.now ?? new Date();
    if (feedReadAt && !Number.isNaN(feedReadAt.getTime()) && now.getTime() - feedReadAt.getTime() <= FEED_FRESH_HOURS * 3_600_000) {
      return { action: "reject", reason: `Superseded: the vendor's structured catalogue feed is the price authority for this listing and was read successfully at ${feedReadAt.toISOString()} (within ${FEED_FRESH_HOURS} h). A scraped page does not overrule it.` };
    }
    if (value < PRICE_MIN || value > PRICE_MAX) return { action: "hold", reason: `price ${value} outside ${PRICE_MIN}-${PRICE_MAX} auto-approve band` };
    if (context.riskLevel === "material") return { action: "hold", reason: `price ${value} is a material move (>30 %) from a scraped page — a person decides while the catalogue feed is stale` };
    return { action: "approve", reason: "price within the auto-approve band, from a scraped page while the catalogue feed is stale or absent" };
  }
  if (predicate === "availability" || predicate === "shipping") {
    return { action: "approve", reason: `${predicate} is a routine commerce value` };
  }
  // Anything the policy does not recognise is a human's decision. New predicates must not be able
  // to auto-publish just because nobody thought about them.
  return { action: "hold", reason: `${predicate} has no auto-approve policy` };
}

export interface TriageOutcome {
  approved: { claimId: string; predicate: string; value: unknown }[];
  rejected: { claimId: string; predicate: string; value: unknown; reason: string }[];
  held: { claimId: string; predicate: string; value: unknown; reason: string }[];
}

/** Apply the policy to every pending claim on a live listing. */
export async function triagePendingClaims(
  db?: SqlConnection,
  options: { actor?: string } = {},
): Promise<TriageOutcome> {
  const database = db ?? (await getDatabase());
  const actor = options.actor ?? "system:refresh-triage";
  // `feed_read_at` is when the vendor's catalogue collector last read its structured feed
  // successfully — the price authority for this listing (spec D1). A subquery, not a join, so a
  // vendor that somehow carries two catalogue targets cannot duplicate a claim row and make the
  // second review attempt throw. Disabled or failing targets yield NULL: the feed is not being
  // read, so the scraped page becomes the fallback.
  const pending = await database.query<{ id: string; predicate: string; value_json: string; subject_id: string; risk_level: string | null; model_confidence: string | null; feed_read_at: Date | string | null }>(
    `SELECT ec.id, ec.predicate, ec.value_json, ec.subject_id, ec.risk_level, ec.model_confidence,
            (SELECT MAX(ct.last_run_at) FROM collection_targets ct
              WHERE ct.target = o.slug
                AND ct.collector IN ('catalog-shopify', 'catalog-woo', 'catalog-rsc')
                AND ct.enabled AND ct.last_ok) AS feed_read_at
     FROM evidence_claims ec
     JOIN listings l ON l.id = ec.subject_id
     JOIN products p ON p.id = l.product_id
     JOIN organizations o ON o.id = p.vendor_id
     WHERE ec.review_status = 'pending' AND l.origin = 'live'
       -- A claim the catalogue feed itself raised and held is a person's decision; this policy
       -- judges scraped pages against the feed and would "supersede" the feed with the feed.
       AND ec.extractor_version <> 'catalogue-feed'
     ORDER BY ec.created_at ASC`,
  );

  const outcome: TriageOutcome = { approved: [], rejected: [], held: [] };

  for (const claim of pending.rows) {
    let value: unknown;
    try { value = JSON.parse(claim.value_json); } catch { value = claim.value_json; }
    const decision = triageClaim(claim.predicate, value, {
      riskLevel: claim.risk_level,
      confidence: claim.model_confidence === null ? null : Number(claim.model_confidence),
      feedReadAt: claim.feed_read_at,
    });
    const entry = { claimId: claim.id, predicate: claim.predicate, value };

    if (decision.action === "hold") { outcome.held.push({ ...entry, reason: decision.reason }); continue; }
    try {
      await reviewClaim({ claimId: claim.id, decision: decision.action, actor, role: "admin", ...(decision.action === "reject" ? { notes: decision.reason } : {}) });
      if (decision.action === "approve") outcome.approved.push(entry);
      else outcome.rejected.push({ ...entry, reason: decision.reason });
    } catch (error) {
      // A claim that could not be decided stays pending and visible, never silently dropped.
      outcome.held.push({ ...entry, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  return outcome;
}
