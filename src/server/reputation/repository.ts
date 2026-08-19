import type { QueryResultRow } from "pg";
import { getDatabase, type SqlConnection } from "@/server/db/client";
import { ensureEvidenceNetworkSeed } from "@/server/evidence-network/repository";
import { normalizeReviewConfidence, normalizeReviewVolume } from "@/server/verify/vendor-reviews";

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
  registryId: string | null;
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

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

async function documentationSeries(db: SqlConnection, vendorOrgId: string): Promise<{ observedAt: string; value: number }[]> {
  const rows = (await db.query<QueryResultRow & { value_json: unknown; observed_at: string }>(
    `SELECT value_json,observed_at FROM entity_metric_snapshots WHERE entity_type='vendor' AND entity_id=$1 AND metric_key='documentationCurrent' ORDER BY observed_at`,
    [vendorOrgId],
  )).rows;
  return rows.map(r => ({ observedAt: String(r.observed_at), value: Number(r.value_json) })).filter(p => Number.isFinite(p.value));
}

// Builds the per-vendor reputation record from real, scattered signals — composed, never collapsed.
export async function buildVendorReputation(db: SqlConnection, org: { id: string; slug: string; display_name: string; profile_status: string; participation_status: string; documentation_current: number; product_count: number }, registryId: string | null): Promise<ReputationRecord> {
  const dimensions: ReputationDimension[] = [];

  // Said in words a buyer uses. The stored words ("unclaimed · independent") read to a shopper like
  // a compliment, when what they mean is "the vendor has never touched this page".
  const pageClaimed = org.profile_status !== "unclaimed";
  dimensions.push({
    key: "identity_claim",
    label: "Identity & claim",
    status: "established",
    value: pageClaimed ? "Claimed by the vendor" : "Unclaimed page — nothing here is written by them",
    basis: pageClaimed
      ? "Has this vendor claimed their page? Yes — so they can correct what's on it."
      : "Has this vendor claimed their page? No. Everything here was gathered by us from public sources.",
    provenance: { sourceType: "organization", sourceId: org.id, url: `/vendors/${org.slug}` },
  });

  // A freshly-aggregated vendor has no documentation data yet — that is "unknown",
  // NOT a genuine 0%. Rendering "0% · established" reads as "we assessed them and they
  // scored zero," which unfairly brands a real vendor. Only claim established when > 0.
  // Independent third-party certificates for this vendor — computed once, used by both the
  // "lab tests current" and "independently tested" dimensions below (never the stale denormalized
  // documentation_current column, which is 0 for every COA-only vendor).
  const coa = (await db.query<QueryResultRow & { n: string | number; purities: number[] | null; latest: string | null }>(
    `SELECT COUNT(*) n, array_agg(purity_pct) FILTER(WHERE purity_pct IS NOT NULL) purities, MAX(tested_at) latest
     FROM lab_test_records WHERE vendor_slug=$1 AND is_independent=TRUE`, [org.slug],
  )).rows[0];
  const coaCount = Number(coa?.n ?? 0);
  const coaPurities = (coa?.purities ?? []).map(Number).filter((v) => Number.isFinite(v));
  const coaMedian = coaPurities.length ? median(coaPurities) : null;

  // "Lab tests current?" now reflects the vendor's real independent certificates and how recent the
  // newest one is — not a listing-only documentation share that reads 0 for a vendor with no store.
  const docCurrent = Number(org.documentation_current);
  // documentation_current is an absolute COUNT, not a percentage. The cascade that writes it counts
  // rows ("N of the M listings we track from them have a dated report") and this dimension's own
  // basis line says the same thing — but the value was rendered `${docCurrent}%`. It only ever
  // looked right because the six seeded demo vendors were hand-authored with percentage-shaped
  // numbers (94, 88, 76...). The first publication cascade that touched lattice-research would have
  // turned "94%" into "2%". Say the count, with the denominator that makes it mean something.
  const listedTotal = Number(org.product_count);
  const documentedValue = listedTotal > 0
    ? `${docCurrent} of ${listedTotal} listing${listedTotal === 1 ? "" : "s"} show a dated lab report`
    : `${docCurrent} listing${docCurrent === 1 ? "" : "s"} show a dated lab report`;
  dimensions.push(coaCount > 0
    ? { key: "documentation_currency", label: "Documentation currency", status: "established", value: `${coaCount} lab test${coaCount === 1 ? "" : "s"} on file${coa?.latest ? ` · newest tested ${coa.latest}` : ""}`, numericValue: coaCount, basis: "The independent lab tests we hold for this vendor, newest first.", provenance: { sourceType: "lab_test_records", url: `/vendors/${org.slug}` } }
    : docCurrent > 0
    ? { key: "documentation_currency", label: "Documentation currency", status: "established", value: documentedValue, numericValue: docCurrent, basis: "How many of their listings show a dated lab report.", provenance: { sourceType: "organization", sourceId: org.id, url: `/vendors/${org.slug}` }, series: await documentationSeries(db, org.id) }
    : { key: "documentation_currency", label: "Documentation currency", status: "unknown", value: "No lab tests on record yet", basis: "We haven't found an independent lab test for this vendor yet.", provenance: { sourceType: "lab_test_records", url: `/vendors/${org.slug}` } });

  // Independent evidence corroboration — independent lab tests (COAs) and published batch
  // passports linked to this vendor. COAs are the primary, most common signal: a vendor with
  // real third-party certificates on record IS independently corroborated, so this must reflect
  // them rather than reading "unknown" whenever no batch passport exists.
  const passports = (await db.query<QueryResultRow & { passports: string | number; conflicts: string | number }>(
    `SELECT COUNT(DISTINCT bp.id) passports,COUNT(DISTINCT ec.id) FILTER(WHERE ec.status='open') conflicts
     FROM batch_passports bp LEFT JOIN evidence_conflicts ec ON ec.passport_id=bp.id
     WHERE bp.vendor_id=$1 AND bp.status='published'`, [org.id],
  )).rows[0];
  const passportCount = Number(passports?.passports ?? 0);
  const openConflicts = Number(passports?.conflicts ?? 0);
  if (coaCount > 0 || passportCount > 0) {
    const parts: string[] = [];
    if (coaCount > 0) parts.push(`${coaCount} independent lab test${coaCount === 1 ? "" : "s"}${coaMedian != null ? ` · typically ${coaMedian.toFixed(1)}% pure` : ""}`);
    if (passportCount > 0) parts.push(`${passportCount} batch test record${passportCount === 1 ? "" : "s"}`);
    dimensions.push({ key: "evidence_corroboration", label: "Independent evidence corroboration", status: openConflicts > 0 ? "disputed" : "established", value: `${parts.join(" · ")}${openConflicts > 0 ? ` · ${openConflicts} result${openConflicts === 1 ? "" : "s"} that disagree` : ""}`, numericValue: coaCount + passportCount, basis: "Independent lab tests and published batch test records linked to this vendor.", provenance: { sourceType: coaCount > 0 ? "lab_test_records" : "batch_passport", url: `/vendors/${org.slug}` } });
  } else {
    dimensions.push({ key: "evidence_corroboration", label: "Independent evidence corroboration", status: "unknown", value: "No independent tests on record", basis: "Nobody independent has tested this vendor's product, as far as we can find.", provenance: { sourceType: "lab_test_records" } });
  }

  // Operational reliability — only real when the vendor operates a participating storefront
  // with observed analytics. This REPLACES the fabricated support/shipping scores: absent
  // real data, the honest answer is "unknown", not an invented number.
  const seller = (await db.query<QueryResultRow & { id: string }>(`SELECT id FROM commerce_sellers WHERE organization_id=$1`, [org.id])).rows[0];
  const analytics = seller ? (await db.query<QueryResultRow & { refund_rate: string | number; fulfillment_on_time_rate: string | number; days: string | number }>(
    `SELECT AVG(refund_rate) refund_rate,AVG(fulfillment_on_time_rate) fulfillment_on_time_rate,COUNT(*) days FROM seller_analytics_daily WHERE seller_id=$1`, [seller.id],
  )).rows[0] : null;
  dimensions.push(seller && analytics && Number(analytics.days) > 0
    ? { key: "operational_reliability", label: "Operational reliability", status: "established", value: `${Math.round(Number(analytics.fulfillment_on_time_rate) * 100)}% on-time · ${(Number(analytics.refund_rate) * 100).toFixed(1)}% refunds`, numericValue: Number(analytics.fulfillment_on_time_rate), basis: "How fast they ship and how often they refund, from their own storefront with us.", provenance: { sourceType: "seller_analytics_daily", sourceId: seller.id } }
    : { key: "operational_reliability", label: "Operational reliability", status: "unknown", value: "We can't see how they ship", basis: "They don't sell through us, so we can't see how fast they ship.", provenance: { sourceType: "seller_analytics_daily" } });

  // Community signal — what real buyers report, gathered from the open web (Reddit, forums,
  // Trustpilot complaints, scam/DOJ reports) and weighted by the community's own asymmetry:
  // specific failure reports and independent lab results count far above cheap praise.
  const gathered = (await db.query<QueryResultRow & { sentiment: string; summary: string; review_volume: string; confidence: string }>(
    `SELECT sentiment, summary, review_volume, confidence FROM vendor_reviews WHERE vendor_slug=$1`, [org.slug],
  )).rows[0];
  if (gathered && gathered.sentiment !== "unknown") {
    const sent = gathered.sentiment;
    const status: DimensionStatus = sent === "positive" ? "established" : "disputed";
    const label = sent === "positive" ? "Mostly positive" : sent === "mixed" ? "Mixed reports" : sent === "negative" ? "Mostly negative" : sent === "scam" ? "Scam / fraud reports" : "Reported";
    // Plain words for the two enums a buyer would otherwise have to decode ("sparse volume ·
    // low confidence"). Unrecognized values fall back to the stored word rather than inventing one.
    const volumeWord = ({ none: "no reports", sparse: "only a few reports", moderate: "a fair number of reports", heavy: "lots of reports" } as Record<string, string>)[normalizeReviewVolume(gathered.review_volume) ?? ""] ?? `${gathered.review_volume} volume`;
    const confidenceWord = ({ low: "we're not very sure", medium: "we're fairly sure", high: "we're confident" } as Record<string, string>)[normalizeReviewConfidence(gathered.confidence) ?? ""] ?? `${gathered.confidence} confidence`;
    dimensions.push({ key: "community_signal", label: "Community signal", status, value: `${label} · ${volumeWord} · ${confidenceWord}`, basis: gathered.summary, provenance: { sourceType: "community_mentions", url: `/vendors/${org.slug}` } });
  } else {
    dimensions.push({ key: "community_signal", label: "Community signal", status: "unknown", value: "No buyer reviews found", basis: "We searched the web for buyer reviews and complaints about this vendor and found nothing solid yet.", provenance: { sourceType: "community_mentions" } });
  }

  // Open risk flags — ONLY genuine adverse findings (fraud/abuse cases). Curator
  // opportunity signals (e.g. "vendor evidence gap") are informational market-structure
  // observations, not red flags — counting them here (as the old code did) branded a
  // real vendor with "2 open flags · risk signals and fraud cases" for merely not having
  // uploaded a COA yet. AGENTS.md: keep opportunity signals informational, not risk.
  const flags = (await db.query<QueryResultRow & { fraud: string | number }>(
    `SELECT (SELECT COUNT(*) FROM fraud_cases WHERE subject_type='seller' AND subject_id=$1 AND status='open') fraud`, [org.id],
  )).rows[0];
  const openFlags = Number(flags?.fraud ?? 0);
  // Public regulatory & enforcement records (FDA/DOJ/FTC) are the strongest, safest red flag —
  // official government actions, correctly attributed. They fold into this dimension so "scam &
  // red flags" reflects real enforcement, not just an (empty) internal fraud-case table.
  const reg = (await db.query<QueryResultRow & { n: string | number; severe: string | number; kinds: string[] | null }>(
    `SELECT COUNT(*) n, COUNT(*) FILTER(WHERE severity='severe') severe, array_agg(DISTINCT agency||' '||action_type) kinds FROM regulatory_actions WHERE vendor_slug=$1`, [org.slug],
  )).rows[0];
  const regCount = Number(reg?.n ?? 0), regSevere = Number(reg?.severe ?? 0);
  const totalFlags = openFlags + regCount;
  const regLabel = (reg?.kinds ?? []).map((k) => k.replace("_", " ")).slice(0, 3).join(" · ");
  dimensions.push({
    key: "open_risk_flags",
    label: "Open risk flags",
    status: totalFlags === 0 ? "established" : "disputed",
    value: totalFlags === 0 ? "None on record"
      : regCount > 0 ? `${regCount} enforcement record${regCount === 1 ? "" : "s"}${regSevere > 0 ? " (severe)" : ""}${regLabel ? ` · ${regLabel}` : ""}`
      : `${openFlags} open case${openFlags === 1 ? "" : "s"}`,
    numericValue: totalFlags,
    basis: "Official government actions (FDA, DOJ, FTC) and open fraud cases against this vendor. These are public records, not our opinion.",
    provenance: { sourceType: regCount > 0 ? "regulatory_actions" : "fraud_cases", url: `/vendors/${org.slug}` },
  });

  return { registryId, subjectType: "vendor", displayName: org.display_name, slug: org.slug, asOf: asOfNow(), methodologyVersion: REPUTATION_METHODOLOGY_VERSION, dimensions };
}

// Builds the per-laboratory integrity record from real report/method/custody counts.
export async function buildLabReputation(db: SqlConnection, lab: { id: string; slug: string; display_name: string; accreditation_status: string; accreditation_body: string | null; accreditation_expires_at: string | null }, registryId: string | null): Promise<ReputationRecord> {
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
      basis: "The accreditation this laboratory declares, and who granted it.",
      provenance: { sourceType: "laboratory_profile", sourceId: lab.id, url: `/labs/${lab.slug}` },
    },
    {
      key: "report_integrity",
      label: "Report integrity",
      status: totalReports > 0 ? "established" : "unknown",
      value: totalReports > 0 ? `${Number(totals.issued_reports)} issued · ${revoked} revoked (${Math.round((1 - revoked / totalReports) * 100)}% standing)` : "No reports issued",
      numericValue: totalReports > 0 ? Math.round((1 - revoked / totalReports) * 100) : undefined,
      basis: "How many reports this lab has issued, and how many it later withdrew.",
      provenance: { sourceType: "laboratory_reports", sourceId: lab.id, url: `/labs/${lab.slug}` },
    },
    {
      key: "method_coverage",
      label: "Method coverage",
      status: totalMethods > 0 ? "established" : "unknown",
      value: totalMethods > 0 ? `${validated}/${totalMethods} validated` : "No methods registered",
      numericValue: totalMethods > 0 ? Math.round((validated / totalMethods) * 100) : undefined,
      basis: "How many of the lab's test methods have been validated.",
      provenance: { sourceType: "laboratory_methods", sourceId: lab.id, url: `/labs/${lab.slug}` },
    },
    {
      key: "custody_activity",
      label: "Chain-of-custody activity",
      status: Number(totals.custody_events) > 0 ? "established" : "unknown",
      value: `${Number(totals.custody_events)} recorded handoffs`,
      numericValue: Number(totals.custody_events),
      basis: "Every time a sample changed hands, recorded so the trail can't be edited afterwards.",
      provenance: { sourceType: "sample_custody_events", sourceId: lab.id, url: `/labs/${lab.slug}` },
    },
  ];

  return { registryId, subjectType: "lab", displayName: lab.display_name, slug: lab.slug, asOf: asOfNow(), methodologyVersion: REPUTATION_METHODOLOGY_VERSION, dimensions };
}

async function loadVendorOrg(db: SqlConnection, whereColumn: "slug" | "id", value: string) {
  return (await db.query<QueryResultRow & { id: string; slug: string; display_name: string; profile_status: string; participation_status: string; documentation_current: number; product_count: number }>(
    `SELECT id,slug,display_name,profile_status,participation_status,documentation_current,product_count FROM organizations WHERE ${whereColumn}=$1 AND organization_type='vendor'`,
    [value],
  )).rows[0];
}

async function vendorRegistryId(db: SqlConnection, orgId: string): Promise<string | null> {
  return (await db.query<{ registry_id: string }>(`SELECT registry_id FROM registry_identifiers WHERE source_entity_type='organization' AND source_entity_id=$1 AND entity_type='vendor'`, [orgId])).rows[0]?.registry_id ?? null;
}

// Page-facing accessor: the vendor reputation record by slug.
export async function getVendorReputationBySlug(slug: string, connection?: SqlConnection): Promise<ReputationRecord | null> {
  const db = connection ?? (await getDatabase());
  const org = await loadVendorOrg(db, "slug", slug);
  if (!org) return null;
  return buildVendorReputation(db, org, await vendorRegistryId(db, org.id));
}

// API-facing accessor: dispatch on the registry entity type behind a canonical VialGrade ID.
export async function getReputationRecord(registryId: string, connection?: SqlConnection): Promise<ReputationRecord | null> {
  await ensureEvidenceNetworkSeed();
  const db = connection ?? (await getDatabase());
  const reg = (await db.query<QueryResultRow & { entity_type: string; source_entity_id: string }>(`SELECT entity_type,source_entity_id FROM registry_identifiers WHERE registry_id=$1`, [registryId])).rows[0];
  if (!reg) return null;
  if (reg.entity_type === "vendor") {
    const org = await loadVendorOrg(db, "id", reg.source_entity_id);
    return org ? buildVendorReputation(db, org, registryId) : null;
  }
  if (reg.entity_type === "lab") {
    const lab = (await db.query<QueryResultRow & { id: string; slug: string; display_name: string; accreditation_status: string; accreditation_body: string | null; accreditation_expires_at: string | null }>(
      `SELECT id,slug,display_name,accreditation_status,accreditation_body,accreditation_expires_at FROM laboratory_profiles WHERE id=$1`, [reg.source_entity_id],
    )).rows[0];
    return lab ? buildLabReputation(db, lab, registryId) : null;
  }
  return null;
}
