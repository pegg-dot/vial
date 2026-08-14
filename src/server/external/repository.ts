import { getDatabase, type SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";

// ── Third-party aggregator ratings (Peptigrity / BatchGuild / Finnrick) ──────────────────────────
export interface AggregatorRating { vendor_slug: string; source: string; score: number | null; max_score: number | null; test_count: number | null; avg_purity: number | null; would_buy_again_pct: number | null; summary: string; source_url: string }

export async function recordAggregatorRating(db: SqlConnection, r: { vendorSlug: string; source: string; score?: number | null; maxScore?: number | null; testCount?: number | null; avgPurity?: number | null; wouldBuyAgainPct?: number | null; summary?: string; sourceUrl: string }): Promise<void> {
  await db.query(
    `INSERT INTO aggregator_ratings (id, vendor_slug, source, score, max_score, test_count, avg_purity, would_buy_again_pct, summary, source_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT (vendor_slug, source) DO UPDATE SET score=EXCLUDED.score, max_score=EXCLUDED.max_score, test_count=EXCLUDED.test_count, avg_purity=EXCLUDED.avg_purity, would_buy_again_pct=EXCLUDED.would_buy_again_pct, summary=EXCLUDED.summary, source_url=EXCLUDED.source_url, updated_at=NOW()`,
    [newId("agg"), r.vendorSlug, r.source, r.score ?? null, r.maxScore ?? null, r.testCount ?? null, r.avgPurity ?? null, r.wouldBuyAgainPct ?? null, r.summary ?? "", r.sourceUrl],
  );
}
export async function getVendorAggregatorRatings(vendorSlug: string, connection?: SqlConnection): Promise<AggregatorRating[]> {
  const db = connection ?? (await getDatabase());
  return (await db.query<AggregatorRating>(`SELECT vendor_slug, source, score, max_score, test_count, avg_purity, would_buy_again_pct, summary, source_url FROM aggregator_ratings WHERE vendor_slug=$1 ORDER BY source`, [vendorSlug])).rows;
}

// ── Vendor operational / legitimacy signals ──────────────────────────────────────────────────────
export interface VendorSignals { vendor_slug: string; checkout_status: string | null; payment_methods: unknown; domain_age_note: string | null; ships_from: string | null; guarantees: string | null; research_disclaimer: boolean | null; notable_copy: string | null; source_url: string | null }

export async function recordVendorSignals(db: SqlConnection, s: { vendorSlug: string; checkoutStatus?: string | null; paymentMethods?: string[]; domainAgeNote?: string | null; shipsFrom?: string | null; guarantees?: string | null; researchDisclaimer?: boolean | null; notableCopy?: string | null; sourceUrl?: string | null }): Promise<void> {
  await db.query(
    `INSERT INTO vendor_signals (vendor_slug, checkout_status, payment_methods, domain_age_note, ships_from, guarantees, research_disclaimer, notable_copy, source_url)
     VALUES ($1,$2,$3::jsonb,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (vendor_slug) DO UPDATE SET checkout_status=EXCLUDED.checkout_status, payment_methods=EXCLUDED.payment_methods, domain_age_note=EXCLUDED.domain_age_note, ships_from=EXCLUDED.ships_from, guarantees=EXCLUDED.guarantees, research_disclaimer=EXCLUDED.research_disclaimer, notable_copy=EXCLUDED.notable_copy, source_url=EXCLUDED.source_url, updated_at=NOW()`,
    [s.vendorSlug, s.checkoutStatus ?? null, JSON.stringify(s.paymentMethods ?? []), s.domainAgeNote ?? null, s.shipsFrom ?? null, s.guarantees ?? null, s.researchDisclaimer ?? null, s.notableCopy ?? null, s.sourceUrl ?? null],
  );
}
export async function getVendorSignals(vendorSlug: string, connection?: SqlConnection): Promise<VendorSignals | null> {
  const db = connection ?? (await getDatabase());
  return (await db.query<VendorSignals>(`SELECT * FROM vendor_signals WHERE vendor_slug=$1`, [vendorSlug])).rows[0] ?? null;
}

// ── Offers / discount codes ──────────────────────────────────────────────────────────────────────
export interface VendorOffer { vendor_slug: string; code: string | null; description: string; discount_pct: number | null; free_shipping_threshold: string | null; source_url: string; seen_on_vendor_site: boolean }

export async function recordVendorOffer(db: SqlConnection, o: { vendorSlug: string; code?: string | null; description: string; discountPct?: number | null; freeShippingThreshold?: string | null; sourceUrl: string; seenOnVendorSite?: boolean }): Promise<void> {
  await db.query(
    `INSERT INTO vendor_offers (id, vendor_slug, code, description, discount_pct, free_shipping_threshold, source_url, seen_on_vendor_site)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (vendor_slug, description) DO UPDATE SET code=EXCLUDED.code, discount_pct=EXCLUDED.discount_pct, free_shipping_threshold=EXCLUDED.free_shipping_threshold, source_url=EXCLUDED.source_url, seen_on_vendor_site=EXCLUDED.seen_on_vendor_site, updated_at=NOW()`,
    [newId("offer"), o.vendorSlug, o.code ?? null, o.description, o.discountPct ?? null, o.freeShippingThreshold ?? null, o.sourceUrl, o.seenOnVendorSite ?? false],
  );
}
export async function getVendorOffers(vendorSlug: string, connection?: SqlConnection): Promise<VendorOffer[]> {
  const db = connection ?? (await getDatabase());
  return (await db.query<VendorOffer>(`SELECT vendor_slug, code, description, discount_pct, free_shipping_threshold, source_url, seen_on_vendor_site FROM vendor_offers WHERE vendor_slug=$1 ORDER BY discount_pct DESC NULLS LAST`, [vendorSlug])).rows;
}

// ── News & press ─────────────────────────────────────────────────────────────────────────────────
export interface NewsItem { id: string; vendor_slug: string | null; title: string; publisher: string | null; news_date: string | null; summary: string; source_url: string; source_type: string; vendor_name?: string | null }

export async function recordNewsItem(db: SqlConnection, n: { vendorSlug?: string | null; title: string; publisher?: string | null; newsDate?: string | null; summary: string; sourceUrl: string; sourceType?: string }): Promise<void> {
  await db.query(
    `INSERT INTO news_items (id, vendor_slug, title, publisher, news_date, summary, source_url, source_type)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (source_url, title) DO UPDATE SET vendor_slug=EXCLUDED.vendor_slug, publisher=EXCLUDED.publisher, news_date=EXCLUDED.news_date, summary=EXCLUDED.summary, source_type=EXCLUDED.source_type`,
    [newId("news"), n.vendorSlug ?? null, n.title, n.publisher ?? null, n.newsDate ?? null, n.summary, n.sourceUrl, n.sourceType ?? "news"],
  );
}
export async function getVendorNews(vendorSlug: string, connection?: SqlConnection): Promise<NewsItem[]> {
  const db = connection ?? (await getDatabase());
  return (await db.query<NewsItem>(`SELECT id, vendor_slug, title, publisher, news_date, summary, source_url, source_type FROM news_items WHERE vendor_slug=$1 ORDER BY news_date DESC NULLS LAST`, [vendorSlug])).rows;
}
export async function listNews(connection?: SqlConnection, limit = 60): Promise<NewsItem[]> {
  const db = connection ?? (await getDatabase());
  return (await db.query<NewsItem>(`SELECT n.id, n.vendor_slug, n.title, n.publisher, n.news_date, n.summary, n.source_url, n.source_type, o.display_name vendor_name FROM news_items n LEFT JOIN organizations o ON o.slug=n.vendor_slug ORDER BY n.news_date DESC NULLS LAST LIMIT $1`, [limit])).rows;
}

// ── Compound scientific literature ───────────────────────────────────────────────────────────────
export interface CompoundResearch { compound_slug: string; claim: string; study_type: string | null; safety_note: string | null; source_url: string; source_title: string | null }

export async function recordCompoundResearch(db: SqlConnection, r: { compoundSlug: string; claim: string; studyType?: string | null; safetyNote?: string | null; sourceUrl: string; sourceTitle?: string | null }): Promise<void> {
  await db.query(
    `INSERT INTO compound_research (id, compound_slug, claim, study_type, safety_note, source_url, source_title)
     VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (compound_slug, source_url, claim) DO UPDATE SET study_type=EXCLUDED.study_type, safety_note=EXCLUDED.safety_note, source_title=EXCLUDED.source_title`,
    [newId("research"), r.compoundSlug, r.claim, r.studyType ?? null, r.safetyNote ?? null, r.sourceUrl, r.sourceTitle ?? null],
  );
}
export async function setCompoundRegulatory(db: SqlConnection, compoundSlug: string, regulatoryStatus: string | null, evidenceSummary: string | null, fdaApprovedDrugExists: boolean | null = null): Promise<void> {
  await db.query(`UPDATE compounds SET regulatory_status=COALESCE($2, regulatory_status), evidence_summary=COALESCE($3, evidence_summary), fda_approved_drug_exists=COALESCE($4, fda_approved_drug_exists), updated_at=NOW() WHERE slug=$1`, [compoundSlug, regulatoryStatus, evidenceSummary, fdaApprovedDrugExists]);
}
export async function getCompoundResearch(compoundSlug: string, connection?: SqlConnection): Promise<CompoundResearch[]> {
  const db = connection ?? (await getDatabase());
  return (await db.query<CompoundResearch>(`SELECT compound_slug, claim, study_type, safety_note, source_url, source_title FROM compound_research WHERE compound_slug=$1 ORDER BY CASE study_type WHEN 'human-rct' THEN 0 WHEN 'meta-analysis' THEN 1 WHEN 'human-trial' THEN 2 WHEN 'review' THEN 3 WHEN 'animal' THEN 4 ELSE 5 END`, [compoundSlug])).rows;
}
export async function getCompoundRegulatory(compoundSlug: string, connection?: SqlConnection): Promise<{ regulatory_status: string | null; evidence_summary: string | null; fda_approved_drug_exists: boolean | null } | null> {
  const db = connection ?? (await getDatabase());
  return (await db.query<{ regulatory_status: string | null; evidence_summary: string | null; fda_approved_drug_exists: boolean | null }>(`SELECT regulatory_status, evidence_summary, fda_approved_drug_exists FROM compounds WHERE slug=$1`, [compoundSlug])).rows[0] ?? null;
}

// ── Cross-vendor / market-wide reads (for the news feed) ─────────────────────────────────────────
export async function listAllOffers(connection?: SqlConnection): Promise<Array<VendorOffer & { vendor_name: string | null }>> {
  const db = connection ?? (await getDatabase());
  return (await db.query<VendorOffer & { vendor_name: string | null }>(`SELECT vo.vendor_slug, vo.code, vo.description, vo.discount_pct, vo.free_shipping_threshold, vo.source_url, vo.seen_on_vendor_site, o.display_name vendor_name FROM vendor_offers vo LEFT JOIN organizations o ON o.slug=vo.vendor_slug ORDER BY vo.discount_pct DESC NULLS LAST`)).rows;
}
