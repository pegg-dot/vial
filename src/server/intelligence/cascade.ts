import type { QueryResultRow } from "pg";
import type { SqlConnection } from "@/server/db/client";
import { createAlert, createChildEvent, createDomainEvent, recordMetric, upsertOpportunity } from "./events";

export interface ListingProjection {
  price: number;
  previousPrice: number | null;
  availability: string;
  shipping: string;
  batchCode: string;
  reportDate: string;
  reportIssuer: string;
  reportConfirmed: boolean;
  priceHistory: number[];
}

interface ListingContext extends QueryResultRow {
  listing_id: string;
  listing_slug: string;
  compound_id: string;
  compound_slug: string;
  compound_name: string;
  vendor_id: string;
  vendor_slug: string;
  vendor_name: string;
  vendor_profile_status: string;
  product_name: string;
  price: string | number;
  availability: string;
  report_date: string;
  report_confirmed: boolean;
  batch_code: string;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return (value ?? fallback) as T;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function median(values: number[]) {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[midpoint] : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

function alertForPredicate(predicate: string, context: ListingContext, before: ListingProjection, after: ListingProjection) {
  switch (predicate) {
    case "price": return { category: "price-change", title: `${context.product_name} price changed`, message: `${context.vendor_name} moved from $${before.price.toFixed(0)} to $${after.price.toFixed(0)}.`, severity: "notice" as const };
    case "availability": return { category: "availability-change", title: `${context.product_name} availability changed`, message: `${context.vendor_name} now reports ${after.availability.toLowerCase()}.`, severity: after.availability === "Unavailable" ? "warning" as const : "notice" as const };
    case "batchCode": return { category: "batch-change", title: `New batch observed for ${context.product_name}`, message: `${context.vendor_name} changed its declared batch from ${before.batchCode} to ${after.batchCode}.`, severity: "notice" as const };
    case "shipping": return { category: "shipping-change", title: `${context.product_name} shipping changed`, message: `${context.vendor_name} changed its public shipping claim from ${before.shipping} to ${after.shipping}.`, severity: "info" as const };
    default: return { category: "evidence-change", title: `${context.product_name} evidence changed`, message: `${context.vendor_name} published a change to ${predicate}.`, severity: "notice" as const };
  }
}

async function findUpstream(tx: SqlConnection, claimId: string) {
  const claim = await tx.query<QueryResultRow & { metadata: unknown; agent_run_id: string }>(
    `SELECT ss.metadata, ec.agent_run_id
     FROM evidence_claims ec
     JOIN source_snapshots ss ON ss.id = ec.source_snapshot_id
     WHERE ec.id = $1`,
    [claimId],
  );
  const row = claim.rows[0];
  const metadata = parseJson<Record<string, unknown>>(row?.metadata, {});
  const rootEventId = typeof metadata.rootEventId === "string" ? metadata.rootEventId : null;
  if (!rootEventId) return null;
  const event = await tx.query<QueryResultRow & { id: string; root_event_id: string }>(
    `SELECT id, root_event_id
     FROM domain_events
     WHERE root_event_id = $1 AND event_type = 'source.refresh.succeeded'
     ORDER BY occurred_at DESC
     LIMIT 1`,
    [rootEventId],
  );
  return event.rows[0] ? { id: event.rows[0].id, rootEventId: event.rows[0].root_event_id } : { id: rootEventId, rootEventId };
}

async function listingContext(tx: SqlConnection, listingId: string) {
  const result = await tx.query<ListingContext>(
    `SELECT
       l.id AS listing_id, l.slug AS listing_slug, l.price, l.availability, l.report_date, l.report_confirmed, l.batch_code,
       p.name AS product_name, p.compound_id, p.vendor_id,
       c.slug AS compound_slug, c.canonical_name AS compound_name,
       o.slug AS vendor_slug, o.display_name AS vendor_name, o.profile_status AS vendor_profile_status
     FROM listings l
     JOIN products p ON p.id = l.product_id
     JOIN compounds c ON c.id = p.compound_id
     JOIN organizations o ON o.id = p.vendor_id
     WHERE l.id = $1`,
    [listingId],
  );
  if (!result.rows[0]) throw new Error("Listing context was not found");
  return result.rows[0];
}

async function recomputeCompound(tx: SqlConnection, context: ListingContext, parent: { id: string; rootEventId: string }) {
  const rows = await tx.query<QueryResultRow & { price: string | number; availability: string; report_date: string; report_confirmed: boolean }>(
    `SELECT l.price, l.availability, l.report_date, l.report_confirmed
     FROM listings l JOIN products p ON p.id = l.product_id
     WHERE p.compound_id = $1 AND p.status = 'active'`,
    [context.compound_id],
  );
  const prices = rows.rows.map((row) => Number(row.price)).filter(Number.isFinite);
  const midpoint = median(prices);
  const documented = rows.rows.filter((row) => row.report_date && row.report_date !== "Not located").length;
  const confirmed = rows.rows.filter((row) => row.report_confirmed).length;
  const available = rows.rows.filter((row) => row.availability !== "Unavailable").length;
  const coverage = rows.rows.length ? Math.round((documented / rows.rows.length) * 100) : 0;
  const spread = prices.length > 1 && midpoint > 0 ? ((Math.max(...prices) - Math.min(...prices)) / midpoint) * 100 : 0;
  // price_change is NOT touched here. It is earned from dated observations by
  // recomputeCompoundPriceChanges in the collect tick (spec D6); recomputing it from the old
  // undated arrays on every approval zeroed a real Δ until the next tick.
  await tx.query(
    `UPDATE compounds SET listing_count=$2, median_price=$3, documentation_coverage=$4, updated_at=NOW() WHERE id=$1`,
    [context.compound_id, rows.rows.length, midpoint, coverage],
  );
  const event = await createChildEvent(tx, parent, {
    eventType: "compound.metrics.recalculated",
    entityType: "compound",
    entityId: context.compound_id,
    actor: "system:metrics",
    payload: { listings: rows.rows.length, medianPrice: midpoint, documentationCoverage: coverage, confirmedReports: confirmed, availableListings: available, priceSpreadPct: spread },
    relation: "recalculated-compound",
  });
  for (const [key, value] of Object.entries({ listingCount: rows.rows.length, medianPrice: midpoint, documentationCoverage: coverage, confirmedReports: confirmed, availableListings: available, priceSpreadPct: spread })) {
    await recordMetric(tx, { rootEventId: parent.rootEventId, eventId: event.id, entityType: "compound", entityId: context.compound_id, metricKey: key, value });
  }
  return { event, listingCount: rows.rows.length, medianPrice: midpoint, documentationCoverage: coverage, confirmedReports: confirmed, availableListings: available, priceSpreadPct: spread };
}

async function recomputeVendor(tx: SqlConnection, context: ListingContext, parent: { id: string; rootEventId: string }, predicate: string) {
  const rows = await tx.query<QueryResultRow & { report_date: string; report_confirmed: boolean }>(
    `SELECT l.report_date, l.report_confirmed
     FROM listings l JOIN products p ON p.id = l.product_id
     WHERE p.vendor_id = $1 AND p.status = 'active'`,
    [context.vendor_id],
  );
  const currentDocs = rows.rows.filter((row) => row.report_date && row.report_date !== "Not located").length;
  const confirmed = rows.rows.filter((row) => row.report_confirmed).length;
  const historyResult = await tx.query<QueryResultRow & { history: unknown }>(`SELECT history FROM organizations WHERE id = $1`, [context.vendor_id]);
  const history = parseJson<Array<{ date: string; event: string; type: string }>>(historyResult.rows[0]?.history, []);
  history.unshift({
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }),
    event: `${context.product_name} ${predicate} updated through a reviewed source`,
    type: predicate.startsWith("report") || predicate === "batchCode" ? "document" : "catalog",
  });
  await tx.query(
    `UPDATE organizations
     SET product_count=$2, documentation_current=$3, last_observed='just now', history=$4::jsonb, updated_at=NOW()
     WHERE id=$1`,
    [context.vendor_id, rows.rows.length, currentDocs, JSON.stringify(history.slice(0, 16))],
  );
  const event = await createChildEvent(tx, parent, {
    eventType: "vendor.metrics.recalculated",
    entityType: "vendor",
    entityId: context.vendor_id,
    actor: "system:metrics",
    payload: { products: rows.rows.length, documentationCurrent: currentDocs, confirmedReports: confirmed },
    relation: "recalculated-vendor",
  });
  for (const [key, value] of Object.entries({ productCount: rows.rows.length, documentationCurrent: currentDocs, confirmedReports: confirmed })) {
    await recordMetric(tx, { rootEventId: parent.rootEventId, eventId: event.id, entityType: "vendor", entityId: context.vendor_id, metricKey: key, value });
  }
  return { event, productCount: rows.rows.length, documentationCurrent: currentDocs, confirmedReports: confirmed };
}

export async function runPublicationCascade(tx: SqlConnection, input: {
  publicationId: string;
  claimId: string;
  listingId: string;
  predicate: string;
  before: ListingProjection;
  after: ListingProjection;
  actor: string;
}) {
  const context = await listingContext(tx, input.listingId);
  const upstream = await findUpstream(tx, input.claimId);
  const publicationEvent = await createDomainEvent(tx, {
    eventType: `listing.${input.predicate}.published`,
    entityType: "listing",
    entityId: input.listingId,
    actor: input.actor,
    payload: { publicationId: input.publicationId, claimId: input.claimId, before: input.before, after: input.after },
    parentEventId: upstream?.id ?? null,
    rootEventId: upstream?.rootEventId ?? null,
    relation: "published-reviewed-claim",
  });
  const rootEventId = publicationEvent.rootEventId;

  const compound = await recomputeCompound(tx, context, publicationEvent);
  const vendor = await recomputeVendor(tx, context, publicationEvent, input.predicate);
  const alert = alertForPredicate(input.predicate, context, input.before, input.after);
  await createAlert(tx, {
    rootEventId,
    parentEventId: publicationEvent.id,
    category: alert.category,
    severity: alert.severity,
    entityType: "listing",
    entityId: input.listingId,
    title: alert.title,
    message: alert.message,
    data: { listingSlug: context.listing_slug, compoundSlug: context.compound_slug, vendorSlug: context.vendor_slug, predicate: input.predicate },
  });

  if (compound.priceSpreadPct >= 20) {
    await upsertOpportunity(tx, {
      signalKey: `price-dispersion:${context.compound_id}`,
      rootEventId,
      parentEventId: compound.event.id,
      signalType: "price-dispersion",
      entityType: "compound",
      entityId: context.compound_id,
      title: `${context.compound_name} prices are all over the map`,
      summary: `The cheapest and the priciest listings are about ${compound.priceSpreadPct.toFixed(0)}% apart — worth comparing before you buy.`,
      score: Math.min(100, 45 + compound.priceSpreadPct),
      confidence: 0.96,
      evidence: compound,
    });
  }
  if (compound.availableListings <= 1) {
    await upsertOpportunity(tx, {
      signalKey: `thin-availability:${context.compound_id}`,
      rootEventId,
      parentEventId: compound.event.id,
      signalType: "thin-availability",
      entityType: "compound",
      entityId: context.compound_id,
      title: `Hardly anyone is selling ${context.compound_name}`,
      summary: compound.availableListings === 0 ? "Nothing we track is showing as in stock right now." : "Only one listing is showing as in stock right now.",
      score: 76,
      confidence: 0.92,
      evidence: compound,
    });
  }
  if (compound.documentationCoverage < 70) {
    await upsertOpportunity(tx, {
      signalKey: `compound-evidence-gap:${context.compound_id}`,
      rootEventId,
      parentEventId: compound.event.id,
      signalType: "compound-evidence-gap",
      entityType: "compound",
      entityId: context.compound_id,
      title: `Lab reports are patchy for ${context.compound_name}`,
      summary: `Only ${compound.documentationCoverage}% of the listings we track show a dated lab report. For the rest you are taking the seller's word for it.`,
      score: 100 - compound.documentationCoverage,
      confidence: 0.94,
      evidence: compound,
    });
  }
  if (vendor.documentationCurrent < vendor.productCount) {
    await upsertOpportunity(tx, {
      signalKey: `vendor-evidence-gap:${context.vendor_id}`,
      rootEventId,
      parentEventId: vendor.event.id,
      signalType: "vendor-evidence-gap",
      entityType: "vendor",
      entityId: context.vendor_id,
      title: `${context.vendor_name} shows a lab report for only some of its listings`,
      summary: `${vendor.documentationCurrent} of the ${vendor.productCount} listings we track from them have a dated report.`,
      score: vendor.productCount ? Math.round((1 - vendor.documentationCurrent / vendor.productCount) * 100) : 0,
      confidence: 0.93,
      evidence: vendor,
    });
  }
  if (context.vendor_profile_status === "unclaimed") {
    await upsertOpportunity(tx, {
      signalKey: `vendor-onboarding:${context.vendor_id}`,
      rootEventId,
      parentEventId: vendor.event.id,
      signalType: "vendor-onboarding",
      entityType: "vendor",
      entityId: context.vendor_id,
      title: `${context.vendor_name} has not claimed their page`,
      summary: "We built this page from public sources. Nobody from the company has claimed it to correct anything or send us their own data.",
      score: 68,
      confidence: 0.98,
      evidence: { profileStatus: context.vendor_profile_status, productCount: vendor.productCount },
    });
  }
  if (!input.after.reportDate || input.after.reportDate === "Not located") {
    await upsertOpportunity(tx, {
      signalKey: `listing-evidence-refresh:${input.listingId}`,
      rootEventId,
      parentEventId: publicationEvent.id,
      signalType: "listing-evidence-refresh",
      entityType: "listing",
      entityId: input.listingId,
      title: `${context.vendor_name} ${context.product_name} has no current lab report`,
      summary: "The listing changed, and there is no dated lab report tied to what it says now.",
      score: 81,
      confidence: 0.97,
      evidence: { listingSlug: context.listing_slug, reportDate: input.after.reportDate },
    });
  }
  if (input.predicate === "batchCode" && !input.after.reportConfirmed) {
    await upsertOpportunity(tx, {
      signalKey: `new-batch-evidence:${input.listingId}:${input.after.batchCode}`,
      rootEventId,
      parentEventId: publicationEvent.id,
      signalType: "new-batch-evidence",
      entityType: "listing",
      entityId: input.listingId,
      title: `New ${context.product_name} batch with nothing to back it yet`,
      summary: `Batch ${input.after.batchCode} is now on the page, but no lab has confirmed a report for it.`,
      score: 88,
      confidence: 0.98,
      evidence: { previousBatch: input.before.batchCode, currentBatch: input.after.batchCode, reportConfirmed: input.after.reportConfirmed },
    });
  }
  if (compound.medianPrice > 0) {
    const deviation = Math.abs(input.after.price - compound.medianPrice) / compound.medianPrice;
    if (deviation >= 0.2) {
      await upsertOpportunity(tx, {
        signalKey: `listing-price-outlier:${input.listingId}`,
        rootEventId,
        parentEventId: publicationEvent.id,
        signalType: "listing-price-outlier",
        entityType: "listing",
        entityId: input.listingId,
        title: `${context.vendor_name} is priced far from everyone else`,
        summary: `This listing sits ${(deviation * 100).toFixed(0)}% away from the typical ${context.compound_name} price right now.`,
        score: Math.min(100, 55 + deviation * 100),
        confidence: 0.97,
        evidence: { price: input.after.price, medianPrice: compound.medianPrice, deviationPct: deviation * 100 },
      });
    }
  }

  return { rootEventId, publicationEventId: publicationEvent.id };
}
