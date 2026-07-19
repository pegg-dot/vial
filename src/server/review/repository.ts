import type { QueryResultRow } from "pg";
import type { StaffRole } from "@/server/auth/session";
import { getDatabase, withTransaction, type SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";
import { runPublicationCascade, type ListingProjection } from "@/server/intelligence/cascade";

export type ReviewDecision = "approve" | "reject";

export interface ReviewClaim {
  id: string;
  runId: string;
  listingId: string;
  listingSlug: string;
  productName: string;
  vendorName: string;
  predicate: string;
  proposedValue: unknown;
  previousValue: unknown;
  confidence: number;
  riskLevel: "standard" | "material" | "high-impact";
  rationale: string;
  reviewStatus: string;
  createdAt: string;
  sourceLabel: string;
  sourceLocation: string;
  sourceType: string;
  sourceExcerpt: string;
  snapshotId: string;
}

export interface PublicationRecord {
  id: string;
  listingSlug: string;
  productName: string;
  vendorName: string;
  version: number;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  publishedClaimIds: string[];
  publishedBy: string;
  publishedAt: string;
  rootEventId?: string;
}

export interface AdminMetrics {
  pendingClaims: number;
  activeRuns: number;
  sources: number;
  snapshots: number;
  publications: number;
  listings: number;
}

type ClaimRow = QueryResultRow & {
  id: string;
  agent_run_id: string;
  subject_id: string;
  predicate: string;
  value_json: unknown;
  previous_value_json: unknown;
  model_confidence: string | number;
  risk_level: ReviewClaim["riskLevel"];
  rationale: string;
  review_status: string;
  created_at: Date | string;
  listing_slug: string;
  product_name: string;
  vendor_name: string;
  source_label: string;
  source_location: string;
  source_type: string;
  raw_content: string;
  snapshot_id: string;
};

type ListingRow = QueryResultRow & {
  id: string;
  slug: string;
  product_id: string;
  price: string | number;
  previous_price: string | number | null;
  availability: string;
  shipping_claim: string;
  batch_code: string;
  report_date: string;
  report_issuer: string;
  report_confirmed: boolean;
  price_history: unknown;
  compound_id: string;
  vendor_id: string;
};

function parseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function parseJsonArray<T>(value: unknown): T[] {
  const parsed = parseJson(value);
  return Array.isArray(parsed) ? (parsed as T[]) : [];
}

function excerpt(raw: string, max = 460) {
  const normalized = raw.replace(/\s+/g, " ").trim();
  return normalized.length > max ? `${normalized.slice(0, max).trim()}…` : normalized;
}

function serializeListing(row: ListingRow): ListingProjection {
  return {
    price: Number(row.price),
    previousPrice: row.previous_price === null ? null : Number(row.previous_price),
    availability: row.availability,
    shipping: row.shipping_claim,
    batchCode: row.batch_code,
    reportDate: row.report_date,
    reportIssuer: row.report_issuer,
    reportConfirmed: row.report_confirmed,
    priceHistory: parseJsonArray<number>(row.price_history),
  };
}

async function applyApprovedClaim(tx: SqlConnection, listing: ListingRow, predicate: string, value: unknown) {
  switch (predicate) {
    case "price": {
      const price = Number(value);
      if (!Number.isFinite(price) || price <= 0) throw new Error("Approved price must be a positive number");
      const history = parseJsonArray<number>(listing.price_history);
      history.push(price);
      await tx.query(
        `UPDATE listings
         SET previous_price = price,
             price = $2,
             price_history = $3::jsonb,
             last_checked = 'just now',
             observed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [listing.id, price, JSON.stringify(history.slice(-24))],
      );
      break;
    }
    case "availability":
      if (!["In stock", "Low stock", "Unavailable"].includes(String(value))) {
        throw new Error("Availability is outside the supported catalog vocabulary");
      }
      await tx.query(
        `UPDATE listings SET availability = $2, last_checked = 'just now', observed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [listing.id, String(value)],
      );
      break;
    case "shipping":
      await tx.query(
        `UPDATE listings SET shipping_claim = $2, last_checked = 'just now', observed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [listing.id, String(value)],
      );
      break;
    case "batchCode":
      await tx.query(
        `UPDATE listings SET batch_code = $2, last_checked = 'just now', observed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [listing.id, String(value)],
      );
      break;
    case "reportDate":
      await tx.query(
        `UPDATE listings SET report_date = $2, last_checked = 'just now', observed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [listing.id, String(value)],
      );
      break;
    case "reportIssuer":
      await tx.query(
        `UPDATE listings SET report_issuer = $2, last_checked = 'just now', observed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [listing.id, String(value)],
      );
      break;
    case "reportConfirmed":
      await tx.query(
        `UPDATE listings
         SET report_confirmed = $2,
             evidence_level = CASE WHEN $2 THEN 'issuer-confirmed' ELSE 'vendor-published' END,
             evidence_label = CASE WHEN $2 THEN 'Issuer confirmed' ELSE 'Vendor-published report' END,
             last_checked = 'just now', observed_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [listing.id, Boolean(value)],
      );
      break;
    default:
      throw new Error(`Unsupported claim predicate: ${predicate}`);
  }
}

async function settleAgentRun(tx: SqlConnection, runId: string) {
  const counts = await tx.query<QueryResultRow & { pending: string | number; published: string | number; rejected: string | number }>(
    `SELECT
       COUNT(*) FILTER (WHERE review_status = 'pending') AS pending,
       COUNT(*) FILTER (WHERE review_status = 'published') AS published,
       COUNT(*) FILTER (WHERE review_status = 'rejected') AS rejected
     FROM evidence_claims
     WHERE agent_run_id = $1`,
    [runId],
  );
  const row = counts.rows[0];
  const pending = Number(row?.pending ?? 0);
  const published = Number(row?.published ?? 0);
  const rejected = Number(row?.rejected ?? 0);
  if (pending > 0) {
    await tx.query(`UPDATE agent_runs SET status = 'review', published_changes = $2 WHERE id = $1`, [runId, published]);
    return;
  }
  await tx.query(
    `UPDATE agent_runs
     SET status = $2,
         completed_at = COALESCE(completed_at, NOW()),
         published_changes = $3,
         blocked_reason = CASE WHEN $2 = 'blocked' THEN $4 ELSE NULL END
     WHERE id = $1`,
    [runId, published > 0 ? "published" : "blocked", published, published > 0 ? null : `${rejected} proposed change${rejected === 1 ? " was" : "s were"} rejected`],
  );
}

export async function getAdminMetrics(): Promise<AdminMetrics> {
  const db = await getDatabase();
  const result = await db.query<QueryResultRow & {
    pending_claims: string | number;
    active_runs: string | number;
    source_count: string | number;
    snapshot_count: string | number;
    publication_count: string | number;
    listing_count: string | number;
  }>(
    `SELECT
       (SELECT COUNT(*) FROM evidence_claims WHERE review_status = 'pending') AS pending_claims,
       (SELECT COUNT(*) FROM agent_runs WHERE status IN ('running', 'review')) AS active_runs,
       (SELECT COUNT(*) FROM sources) AS source_count,
       (SELECT COUNT(*) FROM source_snapshots) AS snapshot_count,
       (SELECT COUNT(*) FROM publication_events) AS publication_count,
       (SELECT COUNT(*) FROM listings) AS listing_count`,
  );
  const row = result.rows[0];
  return {
    pendingClaims: Number(row?.pending_claims ?? 0),
    activeRuns: Number(row?.active_runs ?? 0),
    sources: Number(row?.source_count ?? 0),
    snapshots: Number(row?.snapshot_count ?? 0),
    publications: Number(row?.publication_count ?? 0),
    listings: Number(row?.listing_count ?? 0),
  };
}

export async function getPendingClaims(limit = 100): Promise<ReviewClaim[]> {
  const db = await getDatabase();
  const result = await db.query<ClaimRow>(
    `SELECT
       ec.id,
       ec.agent_run_id,
       ec.subject_id,
       ec.predicate,
       ec.value_json,
       ec.previous_value_json,
       ec.model_confidence,
       ec.risk_level,
       ec.rationale,
       ec.review_status,
       ec.created_at,
       l.slug AS listing_slug,
       p.name AS product_name,
       o.display_name AS vendor_name,
       s.label AS source_label,
       s.canonical_location AS source_location,
       s.source_type,
       ss.raw_content,
       ss.id AS snapshot_id
     FROM evidence_claims ec
     JOIN listings l ON l.id = ec.subject_id AND ec.subject_type = 'listing'
     JOIN products p ON p.id = l.product_id
     JOIN organizations o ON o.id = p.vendor_id
     JOIN source_snapshots ss ON ss.id = ec.source_snapshot_id
     JOIN sources s ON s.id = ss.source_id
     WHERE ec.review_status = 'pending'
     ORDER BY
       CASE ec.risk_level WHEN 'high-impact' THEN 1 WHEN 'material' THEN 2 ELSE 3 END,
       ec.created_at ASC
     LIMIT $1`,
    [limit],
  );
  return result.rows.map((row) => ({
    id: row.id,
    runId: row.agent_run_id,
    listingId: row.subject_id,
    listingSlug: row.listing_slug,
    productName: row.product_name,
    vendorName: row.vendor_name,
    predicate: row.predicate,
    proposedValue: parseJson(row.value_json),
    previousValue: parseJson(row.previous_value_json),
    confidence: Number(row.model_confidence),
    riskLevel: row.risk_level,
    rationale: row.rationale,
    reviewStatus: row.review_status,
    createdAt: new Date(row.created_at).toISOString(),
    sourceLabel: row.source_label,
    sourceLocation: row.source_location,
    sourceType: row.source_type,
    sourceExcerpt: excerpt(row.raw_content),
    snapshotId: row.snapshot_id,
  }));
}

export async function reviewClaim(input: {
  claimId: string;
  decision: ReviewDecision;
  notes?: string;
  actor: string;
  role: StaffRole;
}) {
  return withTransaction(async (tx) => {
    const claimResult = await tx.query<ClaimRow & { listing_id: string; compound_id: string; vendor_id: string }>(
      `SELECT
         ec.*,
         l.id AS listing_id,
         p.compound_id,
         p.vendor_id
       FROM evidence_claims ec
       JOIN listings l ON l.id = ec.subject_id AND ec.subject_type = 'listing'
       JOIN products p ON p.id = l.product_id
       WHERE ec.id = $1
       FOR UPDATE`,
      [input.claimId],
    );
    const claim = claimResult.rows[0];
    if (!claim) throw new Error("Claim was not found");
    if (claim.review_status !== "pending") throw new Error("Claim has already been reviewed");
    if (claim.risk_level === "high-impact" && input.role !== "admin") {
      throw new Error("High-impact changes require an administrator");
    }

    const listingResult = await tx.query<ListingRow>(
      `SELECT l.*, p.compound_id, p.vendor_id
       FROM listings l
       JOIN products p ON p.id = l.product_id
       WHERE l.id = $1
       FOR UPDATE`,
      [claim.listing_id],
    );
    const listing = listingResult.rows[0];
    if (!listing) throw new Error("Target listing was not found");

    await tx.query(
      `INSERT INTO review_decisions (id, claim_id, reviewer_role, reviewer_label, decision, reason_code, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [newId("review"), claim.id, input.role, input.actor, input.decision, input.decision === "approve" ? "evidence-accepted" : "evidence-rejected", input.notes?.trim() ?? ""],
    );

    if (input.decision === "reject") {
      await tx.query(
        `UPDATE evidence_claims SET review_status = 'rejected', reviewed_at = NOW() WHERE id = $1`,
        [claim.id],
      );
      await settleAgentRun(tx, claim.agent_run_id);
      return { claimId: claim.id, status: "rejected" as const };
    }

    const before = serializeListing(listing);
    const proposedValue = parseJson(claim.value_json);
    await applyApprovedClaim(tx, listing, claim.predicate, proposedValue);

    const afterResult = await tx.query<ListingRow>(
      `SELECT l.*, p.compound_id, p.vendor_id
       FROM listings l
       JOIN products p ON p.id = l.product_id
       WHERE l.id = $1`,
      [listing.id],
    );
    const afterListing = afterResult.rows[0];
    if (!afterListing) throw new Error("Published listing could not be reloaded");
    const after = serializeListing(afterListing);

    const versionResult = await tx.query<QueryResultRow & { version: string | number; id: string | null }>(
      `SELECT version, id FROM publication_events WHERE entity_type = 'listing' AND entity_id = $1 ORDER BY version DESC LIMIT 1`,
      [listing.id],
    );
    const previousPublication = versionResult.rows[0];
    const version = Number(previousPublication?.version ?? 0) + 1;
    const publicationId = newId("pub");
    await tx.query(
      `INSERT INTO publication_events
       (id, entity_type, entity_id, version, published_claim_ids, before_json, after_json, supersedes_event_id, published_by)
       VALUES ($1, 'listing', $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7, $8)`,
      [publicationId, listing.id, version, JSON.stringify([claim.id]), JSON.stringify(before), JSON.stringify(after), previousPublication?.id ?? null, input.actor],
    );
    const cascade = await runPublicationCascade(tx, {
      publicationId,
      claimId: claim.id,
      listingId: listing.id,
      predicate: claim.predicate,
      before,
      after,
      actor: input.actor,
    });
    await tx.query(`UPDATE publication_events SET root_event_id = $2 WHERE id = $1`, [publicationId, cascade.rootEventId]);
    await tx.query(
      `UPDATE evidence_claims
       SET review_status = 'published', reviewed_at = NOW(), published_at = NOW(), verification_status = 'human-approved'
       WHERE id = $1`,
      [claim.id],
    );
    await settleAgentRun(tx, claim.agent_run_id);
    return { claimId: claim.id, status: "published" as const, publicationId, version, cascade };
  });
}

export async function getPublicationRecords(limit = 100): Promise<PublicationRecord[]> {
  const db = await getDatabase();
  const result = await db.query<QueryResultRow & {
    id: string;
    listing_slug: string;
    product_name: string;
    vendor_name: string;
    version: number;
    before_json: unknown;
    after_json: unknown;
    published_claim_ids: unknown;
    published_by: string;
    published_at: Date | string;
    root_event_id: string | null;
  }>(
    `SELECT
       pe.id,
       l.slug AS listing_slug,
       p.name AS product_name,
       o.display_name AS vendor_name,
       pe.version,
       pe.before_json,
       pe.after_json,
       pe.published_claim_ids,
       pe.published_by,
       pe.published_at,
       pe.root_event_id
     FROM publication_events pe
     JOIN listings l ON l.id = pe.entity_id AND pe.entity_type = 'listing'
     JOIN products p ON p.id = l.product_id
     JOIN organizations o ON o.id = p.vendor_id
     ORDER BY pe.published_at DESC
     LIMIT $1`,
    [limit],
  );
  return result.rows.map((row) => ({
    id: row.id,
    listingSlug: row.listing_slug,
    productName: row.product_name,
    vendorName: row.vendor_name,
    version: Number(row.version),
    before: (parseJson(row.before_json) ?? {}) as Record<string, unknown>,
    after: (parseJson(row.after_json) ?? {}) as Record<string, unknown>,
    publishedClaimIds: parseJsonArray<string>(row.published_claim_ids),
    publishedBy: row.published_by,
    publishedAt: new Date(row.published_at).toISOString(),
    rootEventId: row.root_event_id ?? undefined,
  }));
}
