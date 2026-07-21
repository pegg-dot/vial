import type { QueryResultRow } from "pg";
import { getDatabase, type SqlConnection } from "@/server/db/client";
import { ensureEvidenceNetworkSeed } from "@/server/evidence-network/repository";

// A reputation record is a decomposable, provenance-linked, versioned set of dimensions —
// explicitly NOT a composite score. Each dimension stands on its own, keeps "unknown"
// visible where evidence is absent, and cites where it came from. This is the category
// standard: methodology + provenance, never a scalar (the doctrine in AGENTS.md).
export const REPUTATION_METHODOLOGY_VERSION = "reputation-v1";

export type DimensionStatus = "established" | "unknown" | "disputed";

export interface ReputationDimension {
  key: string;
  label: string;
  status: DimensionStatus;
  value: string;
  numericValue?: number;
  basis: string;
  provenance: { sourceType: string; sourceId?: string; rootEventId?: string; url?: string };
  series?: { observedAt: string; value: number }[];
}

export interface ReputationRecord {
  vialId: string | null;
  subjectType: "vendor" | "lab";
  displayName: string;
  slug: string;
  asOf: string;
  methodologyVersion: string;
  dimensions: ReputationDimension[];
}

function asOfNow(): string {
  // Deterministic-friendly: the current instant, resolved at read time.
  return new Date().toISOString();
}

async function documentationSeries(db: SqlConnection, vendorOrgId: string): Promise<{ observedAt: string; value: number }[]> {
  const rows = (await db.query<QueryResultRow & { value_json: unknown; observed_at: string }>(
    `SELECT value_json,observed_at FROM entity_metric_snapshots WHERE entity_type='vendor' AND entity_id=$1 AND metric_key='documentationCurrent' ORDER BY observed_at`,
    [vendorOrgId],
  )).rows;
  return rows.map(r => ({ observedAt: String(r.observed_at), value: Number(r.value_json) })).filter(p => Number.isFinite(p.value));
}

// Builds the per-vendor reputation record from real, scattered signals — composed, never collapsed.
export async function buildVendorReputation(db: SqlConnection, org: { id: string; slug: string; display_name: string; profile_status: string; participation_status: string; documentation_current: number; product_count: number }, vialId: string | null): Promise<ReputationRecord> {
  const dimensions: ReputationDimension[] = [];

  dimensions.push({
    key: "identity_claim",
    label: "Identity & claim",
    status: "established",
    value: `${org.profile_status}${org.participation_status ? ` · ${org.participation_status}` : ""}`,
    basis: "Observed profile claim and participation state.",
    provenance: { sourceType: "organization", sourceId: org.id, url: `/vendors/${org.slug}` },
  });

  // A freshly-aggregated vendor has no documentation data yet — that is "unknown",
  // NOT a genuine 0%. Rendering "0% · established" reads as "we assessed them and they
  // scored zero," which unfairly brands a real vendor. Only claim established when > 0.
  const docCurrent = Number(org.documentation_current);
  dimensions.push({
    key: "documentation_currency",
    label: "Documentation currency",
    status: docCurrent > 0 ? "established" : "unknown",
    value: docCurrent > 0 ? `${docCurrent}%` : "No documentation observed yet",
    numericValue: docCurrent,
    basis: "Share of observed listings exposing current documentation, recomputed on every reviewed publication.",
    provenance: { sourceType: "organization", sourceId: org.id, url: `/vendors/${org.slug}` },
    series: await documentationSeries(db, org.id),
  });

  // Independent evidence corroboration — published batch passports linked to this vendor.
  const passports = (await db.query<QueryResultRow & { passports: string | number; conflicts: string | number }>(
    `SELECT COUNT(DISTINCT bp.id) passports,COUNT(DISTINCT ec.id) FILTER(WHERE ec.status='open') conflicts
     FROM batch_passports bp LEFT JOIN evidence_conflicts ec ON ec.passport_id=bp.id
     WHERE bp.vendor_id=$1 AND bp.status='published'`, [org.id],
  )).rows[0];
  const passportCount = Number(passports?.passports ?? 0);
  const openConflicts = Number(passports?.conflicts ?? 0);
  dimensions.push(passportCount > 0
    ? { key: "evidence_corroboration", label: "Independent evidence corroboration", status: openConflicts > 0 ? "disputed" : "established", value: `${passportCount} passport${passportCount === 1 ? "" : "s"}${openConflicts > 0 ? ` · ${openConflicts} open conflict${openConflicts === 1 ? "" : "s"}` : ""}`, numericValue: passportCount, basis: "Published batch passports with independent laboratory evidence linked to this vendor.", provenance: { sourceType: "batch_passport" } }
    : { key: "evidence_corroboration", label: "Independent evidence corroboration", status: "unknown", value: "No published passports", basis: "No published batch passport links independent evidence to this vendor yet.", provenance: { sourceType: "batch_passport" } });

  // Operational reliability — only real when the vendor operates a participating storefront
  // with observed analytics. This REPLACES the fabricated support/shipping scores: absent
  // real data, the honest answer is "unknown", not an invented number.
  const seller = (await db.query<QueryResultRow & { id: string }>(`SELECT id FROM commerce_sellers WHERE organization_id=$1`, [org.id])).rows[0];
  const analytics = seller ? (await db.query<QueryResultRow & { refund_rate: string | number; fulfillment_on_time_rate: string | number; days: string | number }>(
    `SELECT AVG(refund_rate) refund_rate,AVG(fulfillment_on_time_rate) fulfillment_on_time_rate,COUNT(*) days FROM seller_analytics_daily WHERE seller_id=$1`, [seller.id],
  )).rows[0] : null;
  dimensions.push(seller && analytics && Number(analytics.days) > 0
    ? { key: "operational_reliability", label: "Operational reliability", status: "established", value: `${Math.round(Number(analytics.fulfillment_on_time_rate) * 100)}% on-time · ${(Number(analytics.refund_rate) * 100).toFixed(1)}% refunds`, numericValue: Number(analytics.fulfillment_on_time_rate), basis: "Fulfillment and refund rates observed from the vendor's participating storefront analytics.", provenance: { sourceType: "seller_analytics_daily", sourceId: seller.id } }
    : { key: "operational_reliability", label: "Operational reliability", status: "unknown", value: "Not a participating storefront", basis: "This vendor does not operate a participating storefront with observed fulfillment analytics, so operational reliability is not established.", provenance: { sourceType: "seller_analytics_daily" } });

  // Community signal — moderated, verified-purchase reviews on this vendor's listings.
  const reviews = (await db.query<QueryResultRow & { n: string | number; product: string | number; shipping: string | number; documentation: string | number }>(
    `SELECT COUNT(*) n,AVG(product_rating) product,AVG(shipping_rating) shipping,AVG(documentation_rating) documentation
     FROM marketplace_reviews mr JOIN listings l ON l.id=mr.listing_id JOIN products p ON p.id=l.product_id
     WHERE p.vendor_id=$1 AND mr.moderation_status='approved' AND mr.verified_purchase=TRUE`, [org.id],
  )).rows[0];
  const reviewCount = Number(reviews?.n ?? 0);
  dimensions.push(reviewCount > 0
    ? { key: "community_signal", label: "Community signal", status: "established", value: `${reviewCount} verified · product ${Number(reviews!.product).toFixed(1)} · shipping ${Number(reviews!.shipping).toFixed(1)} · docs ${Number(reviews!.documentation).toFixed(1)}`, numericValue: reviewCount, basis: "Moderated, verified-purchase reviews kept as separate product, shipping, and documentation ratings.", provenance: { sourceType: "marketplace_reviews" } }
    : { key: "community_signal", label: "Community signal", status: "unknown", value: "No verified reviews", basis: "No moderated, verified-purchase reviews are recorded for this vendor's listings.", provenance: { sourceType: "marketplace_reviews" } });

  // Open risk flags — ONLY genuine adverse findings (fraud/abuse cases). Curator
  // opportunity signals (e.g. "vendor evidence gap") are informational market-structure
  // observations, not red flags — counting them here (as the old code did) branded a
  // real vendor with "2 open flags · risk signals and fraud cases" for merely not having
  // uploaded a COA yet. AGENTS.md: keep opportunity signals informational, not risk.
  const flags = (await db.query<QueryResultRow & { fraud: string | number }>(
    `SELECT (SELECT COUNT(*) FROM fraud_cases WHERE subject_type='seller' AND subject_id=$1 AND status='open') fraud`, [org.id],
  )).rows[0];
  const openFlags = Number(flags?.fraud ?? 0);
  dimensions.push({
    key: "open_risk_flags",
    label: "Open risk flags",
    status: openFlags === 0 ? "established" : "disputed",
    value: openFlags === 0 ? "None on record" : `${openFlags} open case${openFlags === 1 ? "" : "s"}`,
    numericValue: openFlags,
    basis: "Open, traceable fraud or abuse cases affecting this vendor. Informational, not a recommendation.",
    provenance: { sourceType: "fraud_cases" },
  });

  return { vialId, subjectType: "vendor", displayName: org.display_name, slug: org.slug, asOf: asOfNow(), methodologyVersion: REPUTATION_METHODOLOGY_VERSION, dimensions };
}

// Builds the per-laboratory integrity record from real report/method/custody counts.
export async function buildLabReputation(db: SqlConnection, lab: { id: string; slug: string; display_name: string; accreditation_status: string; accreditation_body: string | null; accreditation_expires_at: string | null }, vialId: string | null): Promise<ReputationRecord> {
  const totals = (await db.query<QueryResultRow & Record<string, string | number>>(
    `SELECT
      (SELECT COUNT(*) FROM laboratory_reports WHERE laboratory_id=$1) total_reports,
      (SELECT COUNT(*) FROM laboratory_reports WHERE laboratory_id=$1 AND status='issued') issued_reports,
      (SELECT COUNT(*) FROM laboratory_reports WHERE laboratory_id=$1 AND status='revoked') revoked_reports,
      (SELECT COUNT(*) FROM laboratory_methods WHERE laboratory_id=$1) total_methods,
      (SELECT COUNT(*) FROM laboratory_methods WHERE laboratory_id=$1 AND validation_status='validated') validated_methods,
      (SELECT COUNT(*) FROM sample_custody_events c JOIN laboratory_samples s ON s.id=c.sample_id JOIN laboratory_test_orders o ON o.id=s.test_order_id WHERE o.laboratory_id=$1) custody_events`,
    [lab.id],
  )).rows[0];
  const totalReports = Number(totals.total_reports);
  const revoked = Number(totals.revoked_reports);
  const totalMethods = Number(totals.total_methods);
  const validated = Number(totals.validated_methods);

  const dimensions: ReputationDimension[] = [
    {
      key: "accreditation",
      label: "Accreditation",
      status: lab.accreditation_status ? "established" : "unknown",
      value: lab.accreditation_status ? `${lab.accreditation_status}${lab.accreditation_body ? ` · ${lab.accreditation_body}` : ""}` : "Not declared",
      basis: "Declared accreditation status and body for this fictional laboratory.",
      provenance: { sourceType: "laboratory_profile", sourceId: lab.id, url: `/labs/${lab.slug}` },
    },
    {
      key: "report_integrity",
      label: "Report integrity",
      status: totalReports > 0 ? "established" : "unknown",
      value: totalReports > 0 ? `${Number(totals.issued_reports)} issued · ${revoked} revoked (${Math.round((1 - revoked / totalReports) * 100)}% standing)` : "No reports issued",
      numericValue: totalReports > 0 ? Math.round((1 - revoked / totalReports) * 100) : undefined,
      basis: "Issued-versus-revoked report history — the lab's own track record, decomposed rather than scored.",
      provenance: { sourceType: "laboratory_reports", sourceId: lab.id, url: `/labs/${lab.slug}` },
    },
    {
      key: "method_coverage",
      label: "Method coverage",
      status: totalMethods > 0 ? "established" : "unknown",
      value: totalMethods > 0 ? `${validated}/${totalMethods} validated` : "No methods registered",
      numericValue: totalMethods > 0 ? Math.round((validated / totalMethods) * 100) : undefined,
      basis: "Validated analytical methods in the laboratory's registry.",
      provenance: { sourceType: "laboratory_methods", sourceId: lab.id, url: `/labs/${lab.slug}` },
    },
    {
      key: "custody_activity",
      label: "Chain-of-custody activity",
      status: Number(totals.custody_events) > 0 ? "established" : "unknown",
      value: `${Number(totals.custody_events)} hash-chained events`,
      numericValue: Number(totals.custody_events),
      basis: "Hash-chained custody handoffs across the laboratory's accessioned samples.",
      provenance: { sourceType: "sample_custody_events", sourceId: lab.id, url: `/labs/${lab.slug}` },
    },
  ];

  return { vialId, subjectType: "lab", displayName: lab.display_name, slug: lab.slug, asOf: asOfNow(), methodologyVersion: REPUTATION_METHODOLOGY_VERSION, dimensions };
}

async function loadVendorOrg(db: SqlConnection, whereColumn: "slug" | "id", value: string) {
  return (await db.query<QueryResultRow & { id: string; slug: string; display_name: string; profile_status: string; participation_status: string; documentation_current: number; product_count: number }>(
    `SELECT id,slug,display_name,profile_status,participation_status,documentation_current,product_count FROM organizations WHERE ${whereColumn}=$1 AND organization_type='vendor'`,
    [value],
  )).rows[0];
}

async function vendorVialId(db: SqlConnection, orgId: string): Promise<string | null> {
  return (await db.query<{ vial_id: string }>(`SELECT vial_id FROM registry_identifiers WHERE source_entity_type='organization' AND source_entity_id=$1 AND entity_type='vendor'`, [orgId])).rows[0]?.vial_id ?? null;
}

// Page-facing accessor: the vendor reputation record by slug.
export async function getVendorReputationBySlug(slug: string, connection?: SqlConnection): Promise<ReputationRecord | null> {
  const db = connection ?? (await getDatabase());
  const org = await loadVendorOrg(db, "slug", slug);
  if (!org) return null;
  return buildVendorReputation(db, org, await vendorVialId(db, org.id));
}

// API-facing accessor: dispatch on the registry entity type behind a canonical VIAL ID.
export async function getReputationRecord(vialId: string, connection?: SqlConnection): Promise<ReputationRecord | null> {
  await ensureEvidenceNetworkSeed();
  const db = connection ?? (await getDatabase());
  const reg = (await db.query<QueryResultRow & { entity_type: string; source_entity_id: string }>(`SELECT entity_type,source_entity_id FROM registry_identifiers WHERE vial_id=$1`, [vialId])).rows[0];
  if (!reg) return null;
  if (reg.entity_type === "vendor") {
    const org = await loadVendorOrg(db, "id", reg.source_entity_id);
    return org ? buildVendorReputation(db, org, vialId) : null;
  }
  if (reg.entity_type === "lab") {
    const lab = (await db.query<QueryResultRow & { id: string; slug: string; display_name: string; accreditation_status: string; accreditation_body: string | null; accreditation_expires_at: string | null }>(
      `SELECT id,slug,display_name,accreditation_status,accreditation_body,accreditation_expires_at FROM laboratory_profiles WHERE id=$1`, [reg.source_entity_id],
    )).rows[0];
    return lab ? buildLabReputation(db, lab, vialId) : null;
  }
  return null;
}
