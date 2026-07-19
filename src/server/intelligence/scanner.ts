import type { QueryResultRow } from "pg";
import { withTransaction } from "@/server/db/client";
import { createChildEvent, createDomainEvent, recordMetric, upsertOpportunity } from "./events";

interface ListingRow extends QueryResultRow {
  listing_id: string;
  listing_slug: string;
  price: string | number;
  availability: string;
  batch_code: string;
  report_date: string;
  report_issuer: string;
  report_confirmed: boolean;
  source_id: string | null;
  observed_at: Date | string;
  compound_id: string;
  compound_name: string;
  vendor_id: string;
  vendor_name: string;
  vendor_profile_status: string;
  product_name: string;
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export async function runIntelligenceSweep(actor = "system:curator") {
  return withTransaction(async (tx) => {
    const root = await createDomainEvent(tx, {
      eventType: "intelligence.sweep.started",
      entityType: "market",
      entityId: "vial-market",
      actor,
      payload: { version: "opportunity-engine-v1" },
    });
    const result = await tx.query<ListingRow>(
      `SELECT
         l.id AS listing_id, l.slug AS listing_slug, l.price, l.availability, l.batch_code, l.report_date, l.report_issuer,
         l.report_confirmed, l.source_id, l.observed_at, p.compound_id, p.vendor_id, p.name AS product_name,
         c.canonical_name AS compound_name, o.display_name AS vendor_name, o.profile_status AS vendor_profile_status
       FROM listings l
       JOIN products p ON p.id=l.product_id
       JOIN compounds c ON c.id=p.compound_id
       JOIN organizations o ON o.id=p.vendor_id
       WHERE p.status='active'`,
    );
    const listings = result.rows;
    let evaluated = 0;
    let emitted = 0;

    const emit = async (input: Parameters<typeof upsertOpportunity>[1]) => {
      evaluated += 1;
      await upsertOpportunity(tx, input);
      emitted += 1;
    };

    for (const listing of listings) {
      if (!listing.source_id) {
        await emit({
          signalKey: `source-coverage-gap:${listing.listing_id}`,
          rootEventId: root.rootEventId,
          parentEventId: root.id,
          signalType: "source-coverage-gap",
          entityType: "listing",
          entityId: listing.listing_id,
          title: `${listing.vendor_name} ${listing.product_name} is not continuously monitored`,
          summary: "The listing has no controlled source policy, so changes depend on manual observation.",
          score: 82,
          confidence: 0.99,
          evidence: { listingSlug: listing.listing_slug },
        });
      } else evaluated += 1;
      if (listing.batch_code !== "Not disclosed" && (!listing.report_date || listing.report_date === "Not located")) {
        await emit({
          signalKey: `batch-document-gap:${listing.listing_id}:${listing.batch_code}`,
          rootEventId: root.rootEventId,
          parentEventId: root.id,
          signalType: "batch-document-gap",
          entityType: "listing",
          entityId: listing.listing_id,
          title: `${listing.product_name} batch lacks a dated report`,
          summary: `Batch ${listing.batch_code} is visible, but the public record does not connect it to a dated analytical document.`,
          score: 86,
          confidence: 0.98,
          evidence: { batchCode: listing.batch_code, reportDate: listing.report_date },
        });
      } else evaluated += 1;
      if (listing.vendor_profile_status === "unclaimed") {
        await emit({
          signalKey: `vendor-onboarding:${listing.vendor_id}`,
          rootEventId: root.rootEventId,
          parentEventId: root.id,
          signalType: "vendor-onboarding",
          entityType: "vendor",
          entityId: listing.vendor_id,
          title: `${listing.vendor_name} can claim its market record`,
          summary: "A public catalog record exists, but no verified operator controls corrections, direct feeds, or profile context.",
          score: 68,
          confidence: 0.99,
          evidence: { profileStatus: listing.vendor_profile_status },
        });
      } else evaluated += 1;
      const observedAgeHours = (Date.now() - new Date(listing.observed_at).getTime()) / 3_600_000;
      if (observedAgeHours > 24) {
        await emit({
          signalKey: `listing-evidence-refresh:${listing.listing_id}`,
          rootEventId: root.rootEventId,
          parentEventId: root.id,
          signalType: "listing-evidence-refresh",
          entityType: "listing",
          entityId: listing.listing_id,
          title: `${listing.vendor_name} ${listing.product_name} needs a fresh observation`,
          summary: `The current public projection is ${Math.floor(observedAgeHours)} hours old.`,
          score: Math.min(100, 55 + observedAgeHours / 4),
          confidence: 0.99,
          evidence: { observedAgeHours },
        });
      } else evaluated += 1;
    }

    const byCompound = new Map<string, ListingRow[]>();
    const byVendor = new Map<string, ListingRow[]>();
    for (const listing of listings) {
      byCompound.set(listing.compound_id, [...(byCompound.get(listing.compound_id) ?? []), listing]);
      byVendor.set(listing.vendor_id, [...(byVendor.get(listing.vendor_id) ?? []), listing]);
    }

    for (const [compoundId, rows] of byCompound) {
      const prices = rows.map((row) => Number(row.price)).filter(Number.isFinite);
      const midpoint = median(prices);
      const spread = prices.length > 1 && midpoint > 0 ? ((Math.max(...prices) - Math.min(...prices)) / midpoint) * 100 : 0;
      const available = rows.filter((row) => row.availability !== "Unavailable").length;
      const documented = rows.filter((row) => row.report_date && row.report_date !== "Not located").length;
      const confirmed = rows.filter((row) => row.report_confirmed).length;
      const coverage = rows.length ? Math.round((documented / rows.length) * 100) : 0;
      const issuerCounts = new Map<string, number>();
      for (const row of rows.filter((item) => item.report_issuer && item.report_issuer !== "Unknown")) issuerCounts.set(row.report_issuer, (issuerCounts.get(row.report_issuer) ?? 0) + 1);
      const topIssuerShare = rows.length ? Math.max(0, ...issuerCounts.values()) / rows.length : 0;
      const metricEvent = await createChildEvent(tx, root, {
        eventType: "compound.market-profile.computed",
        entityType: "compound",
        entityId: compoundId,
        actor,
        payload: { listings: rows.length, medianPrice: midpoint, spread, available, coverage, confirmed, topIssuerShare },
        relation: "computed-compound-profile",
      });
      for (const [key, value] of Object.entries({ listingCount: rows.length, medianPrice: midpoint, priceSpreadPct: spread, availableListings: available, documentationCoverage: coverage, confirmedReports: confirmed, topIssuerShare })) {
        await recordMetric(tx, { rootEventId: root.rootEventId, eventId: metricEvent.id, entityType: "compound", entityId: compoundId, metricKey: key, value });
      }
      if (spread >= 20) await emit({
        signalKey: `price-dispersion:${compoundId}`, rootEventId: root.rootEventId, parentEventId: metricEvent.id,
        signalType: "price-dispersion", entityType: "compound", entityId: compoundId,
        title: `${rows[0].compound_name} prices are fragmented`, summary: `The observed listing range spans ${spread.toFixed(1)}% around the median.`,
        score: Math.min(100, 45 + spread), confidence: 0.98, evidence: { medianPrice: midpoint, priceSpreadPct: spread, listingCount: rows.length },
      }); else evaluated += 1;
      if (available <= 1) await emit({
        signalKey: `thin-availability:${compoundId}`, rootEventId: root.rootEventId, parentEventId: metricEvent.id,
        signalType: "thin-availability", entityType: "compound", entityId: compoundId,
        title: `${rows[0].compound_name} has thin visible availability`, summary: `Only ${available} listing is currently visible as available.`,
        score: 76, confidence: 0.95, evidence: { available, listingCount: rows.length },
      }); else evaluated += 1;
      if (coverage < 70) await emit({
        signalKey: `compound-evidence-gap:${compoundId}`, rootEventId: root.rootEventId, parentEventId: metricEvent.id,
        signalType: "compound-evidence-gap", entityType: "compound", entityId: compoundId,
        title: `${rows[0].compound_name} has incomplete evidence coverage`, summary: `${coverage}% of observed listings expose a dated public report.`,
        score: 100 - coverage, confidence: 0.97, evidence: { coverage, documented, listings: rows.length },
      }); else evaluated += 1;
      if (topIssuerShare >= 0.75 && rows.length >= 2) await emit({
        signalKey: `issuer-concentration:${compoundId}`, rootEventId: root.rootEventId, parentEventId: metricEvent.id,
        signalType: "issuer-concentration", entityType: "compound", entityId: compoundId,
        title: `${rows[0].compound_name} evidence depends on one issuer`, summary: `${Math.round(topIssuerShare * 100)}% of observed listings name the same report issuer, increasing correlated evidence risk.`,
        score: Math.round(topIssuerShare * 100), confidence: 0.9, evidence: { topIssuerShare, issuers: Object.fromEntries(issuerCounts) },
      }); else evaluated += 1;
      const vendorShares = new Map<string, number>();
      for (const row of rows) vendorShares.set(row.vendor_id, (vendorShares.get(row.vendor_id) ?? 0) + 1);
      const hhi = [...vendorShares.values()].reduce((sum, count) => sum + (count / rows.length) ** 2, 0);
      if (hhi >= 0.5 && rows.length >= 2) await emit({
        signalKey: `supply-concentration:${compoundId}`, rootEventId: root.rootEventId, parentEventId: metricEvent.id,
        signalType: "supply-concentration", entityType: "compound", entityId: compoundId,
        title: `${rows[0].compound_name} listings are concentrated`, summary: `Observed listing concentration is ${(hhi * 100).toFixed(0)} on a 0–100 HHI scale, making source diversity strategically valuable.`,
        score: Math.round(hhi * 100), confidence: 0.94, evidence: { hhi, vendorShares: Object.fromEntries(vendorShares) },
      }); else evaluated += 1;
    }

    for (const [vendorId, rows] of byVendor) {
      const documented = rows.filter((row) => row.report_date && row.report_date !== "Not located").length;
      const coverage = rows.length ? Math.round((documented / rows.length) * 100) : 0;
      if (coverage < 75) await emit({
        signalKey: `vendor-evidence-gap:${vendorId}`, rootEventId: root.rootEventId, parentEventId: root.id,
        signalType: "vendor-evidence-gap", entityType: "vendor", entityId: vendorId,
        title: `${rows[0].vendor_name} has catalog evidence gaps`, summary: `${documented} of ${rows.length} observed listings expose a dated report.`,
        score: 100 - coverage, confidence: 0.96, evidence: { coverage, documented, listings: rows.length },
      }); else evaluated += 1;
    }

    const sourceRows = await tx.query<QueryResultRow & { source_id: string; label: string; consecutive_failures: number; last_succeeded_at: Date | string | null }>(
      `SELECT rp.source_id, s.label, rp.consecutive_failures, rp.last_succeeded_at
       FROM source_refresh_policies rp JOIN sources s ON s.id=rp.source_id WHERE rp.enabled=TRUE`,
    );
    for (const source of sourceRows.rows) {
      const stale = !source.last_succeeded_at || Date.now() - new Date(source.last_succeeded_at).getTime() > 24 * 3_600_000;
      if (source.consecutive_failures > 0 || stale) await emit({
        signalKey: `source-health:${source.source_id}`, rootEventId: root.rootEventId, parentEventId: root.id,
        signalType: "source-health", entityType: "source", entityId: source.source_id,
        title: `${source.label} needs refresh attention`, summary: source.consecutive_failures > 0 ? `${source.consecutive_failures} consecutive refresh failures are recorded.` : "No successful controlled refresh is recorded in the last 24 hours.",
        score: Math.min(100, 58 + source.consecutive_failures * 12), confidence: 0.99, evidence: { failures: source.consecutive_failures, stale },
      }); else evaluated += 1;
    }

    const completed = await createChildEvent(tx, root, {
      eventType: "intelligence.sweep.completed",
      entityType: "market",
      entityId: "vial-market",
      actor,
      payload: { evaluated, emitted },
      relation: "completed-sweep",
    });
    await recordMetric(tx, { rootEventId: root.rootEventId, eventId: completed.id, entityType: "market", entityId: "vial-market", metricKey: "signalsEvaluated", value: evaluated });
    await recordMetric(tx, { rootEventId: root.rootEventId, eventId: completed.id, entityType: "market", entityId: "vial-market", metricKey: "signalsEmitted", value: emitted });
    return { rootEventId: root.rootEventId, evaluated, emitted };
  });
}
