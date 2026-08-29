// Live-data create-path.
//
// The refresh pipeline can update claims on an existing listing but cannot create
// catalog entities, and only the demo seed ever inserted a source/refresh policy.
// This module is the missing create-path: it inserts real (origin='live') vendors,
// listings, and HTTP refresh policies so real public data can flow through the same
// snapshot -> review -> publish spine the demo data uses.
//
// Safety: creating a LIVE http policy is gassed behind an explicit approval, mirroring
// the commerce double-gate. Live fetching is intentional, never a silent default.

import type { SqlConnection } from "@/server/db/client";
import { mintRegistryId } from "@/server/registry/repository";

export class LiveIngestNotApprovedError extends Error {
  constructor() {
    super(
      "Live ingest is not approved. Set VIALGRADE_LIVE_INGEST_APPROVED=true (or pass { approved: true }) to register real HTTP sources.",
    );
    this.name = "LiveIngestNotApprovedError";
  }
}

export function isLiveIngestApproved(options?: { approved?: boolean }): boolean {
  if (options?.approved === true) return true;
  return process.env.VIALGRADE_LIVE_INGEST_APPROVED === "true";
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export interface LiveVendorInput {
  slug: string;
  name: string;
  /** The vendor's real domain(s), e.g. ["eternalpeptides.com"]. */
  domains: string[];
  location?: string;
  description: string;
  accent?: [string, string];
}

/** Insert (idempotently) a real vendor organization marked origin='live'. Returns its id. */
export async function upsertLiveVendor(db: SqlConnection, input: LiveVendorInput): Promise<string> {
  const id = `org:${input.slug}`;
  await db.query(
    `INSERT INTO organizations
       (id, slug, organization_type, display_name, description, location, founded, initials,
        profile_status, participation_status, domains, accent, last_observed, origin)
     VALUES ($1,$2,'vendor',$3,$4,$5,'',$6,'unclaimed','independent',$7::jsonb,$8::jsonb,$9,'live')
     ON CONFLICT (slug) DO UPDATE
       SET display_name = EXCLUDED.display_name,
           description = EXCLUDED.description,
           location = EXCLUDED.location,
           domains = EXCLUDED.domains,
           origin = 'live',
           updated_at = NOW()`,
    [
      id,
      input.slug,
      input.name,
      input.description,
      input.location ?? "",
      initials(input.name),
      JSON.stringify(input.domains),
      JSON.stringify(input.accent ?? ["#6d5dfc", "#b777ff"]),
      new Date().toISOString().slice(0, 10),
    ],
  );
  // Mint a public, resolvable vialgrade:vendor: ID so live vendors appear in the registry /
  // public ID API alongside demo entities (the ingest previously skipped this, so the
  // "citeable identity" product excluded 100% of real data).
  await mintRegistryId(db, { entityType: "vendor", sourceEntityType: "organization", sourceEntityId: id, displayName: input.name, slug: input.slug, currentEntityId: id });
  return id;
}

export interface LiveListingInput {
  compoundSlug: string;
  vendorSlug: string;
  /** Slug shared by the product + listing, e.g. "eternal-peptides-bpc-157-5mg". */
  slug: string;
  name: string;
  quantity: string;
  form?: string;
  /** The vendor's real product-page URL (also the outbound affiliate target). */
  externalUrl: string;
  accent?: [string, string, string];
  /** A resolved storefront-published Janoshik COA claim for this listing (present = the vendor advertises
   *  a confirmed Janoshik test VialGrade holds for this compound). Stamps the listing's testing claim so the
   *  hardened crossCheckCoa can decide the verdict; never itself a verdict. */
  coa?: { batchCode: string | null; issuer?: string };
  // The vendor's own ADVERTISED testing claim, with no certificate behind it. Deliberately
  // separate from `coa`: it must never set report_confirmed (an activation gate reads that) nor
  // report_issuer (the entity graph mints a laboratory from it).
  advertisedTesting?: { issuer: string } | null;
}

/**
 * Insert (idempotently) a real product + listing marked origin='live'. The listing
 * starts empty (price 0, Awaiting first check) and is populated by the first refresh
 * so every real value on it arrives through the reviewed ingestion path, never seeded.
 */
export async function upsertLiveListing(db: SqlConnection, input: LiveListingInput): Promise<{ productId: string; listingId: string }> {
  const productId = `prd:${input.slug}`;
  const listingId = `lst:${input.slug}`;
  await db.query(
    `INSERT INTO products (id, slug, vendor_id, compound_id, name, declared_quantity, declared_form, status, origin)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'active','live')
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, origin = 'live', updated_at = NOW()`,
    [productId, input.slug, `org:${input.vendorSlug}`, `cmp:${input.compoundSlug}`, input.name, input.quantity, input.form ?? "Lyophilized powder"],
  );
  await db.query(
    `INSERT INTO listings
       (id, slug, product_id, price, previous_price, currency, availability, shipping_claim,
        evidence_level, evidence_label, report_date, report_issuer, report_confirmed,
        batch_code, batch_linked, sample_origin, last_checked, rating, review_count, featured,
        checkout_mode, price_history, accent, evidence, external_url, origin)
     VALUES ($1,$2,$3,0,NULL,'USD','Unavailable','',
             'public-only','Awaiting first check','','',FALSE,
             '',FALSE,'Public vendor listing','Never',0,0,FALSE,
             'outbound','[]'::jsonb,$4::jsonb,'[]'::jsonb,$5,'live')
     ON CONFLICT (slug) DO UPDATE
       SET external_url = EXCLUDED.external_url, origin = 'live', checkout_mode = 'outbound', updated_at = NOW()`,
    [listingId, input.slug, productId, JSON.stringify(input.accent ?? ["#6d5dfc", "#8a7bff", "#b777ff"]), input.externalUrl],
  );
  await mintRegistryId(db, { entityType: "product", sourceEntityType: "product", sourceEntityId: productId, displayName: input.name, slug: input.slug, currentEntityId: productId });
  return { productId, listingId };
}

export type LiveSourceType = "vendor-page" | "lab-report";
export type LiveParserProfile = "generic" | "jsonld" | "document" | "catalog";

export interface LiveSourceInput {
  key: string;
  sourceType: LiveSourceType;
  /** The real URL to fetch. */
  canonicalLocation: string;
  label: string;
  ownerVendorSlug?: string;
  targetListingSlug: string;
  parserProfile: LiveParserProfile;
  /** Hostnames the SSRF-safe fetcher is permitted to reach for this policy. */
  allowedHostnames: string[];
  intervalMinutes?: number;
}

/**
 * Register a real HTTP source + refresh policy (transport='http'). Gated: refuses
 * unless live ingest is explicitly approved. The listing's source_id is linked so
 * provenance and freshness resolve back to this real source.
 */
export async function registerLiveHttpSource(db: SqlConnection, input: LiveSourceInput, options?: { approved?: boolean }): Promise<{ sourceId: string; policyId: string }> {
  if (!isLiveIngestApproved(options)) throw new LiveIngestNotApprovedError();
  const sourceId = `src:live:${input.key}`;
  const policyId = `policy:live:${input.key}`;
  const listingId = `lst:${input.targetListingSlug}`;
  const ownerId = input.ownerVendorSlug ? `org:${input.ownerVendorSlug}` : null;

  // A source row may already exist for this URL from a prior ingest. ON CONFLICT keeps the
  // EXISTING row's id, so we must link the listing to the ACTUAL id (via RETURNING), not the
  // id we tried to insert — otherwise listing.source_id dangles and the freshness recompute
  // (which copies it into an FK-constrained table) crashes every page.
  const src = await db.query<{ id: string }>(
    `INSERT INTO sources (id, source_type, canonical_location, owner_organization_id, label, status, origin)
     VALUES ($1,$2,$3,$4,$5,'active','live')
     ON CONFLICT (canonical_location) DO UPDATE
       SET owner_organization_id = EXCLUDED.owner_organization_id, label = EXCLUDED.label, origin = 'live', updated_at = NOW()
     RETURNING id`,
    [sourceId, input.sourceType, input.canonicalLocation, ownerId, input.label],
  );
  const realSourceId = src.rows[0]?.id ?? sourceId;
  await db.query(`UPDATE listings SET source_id = $2 WHERE id = $1`, [listingId, realSourceId]);
  await db.query(
    `INSERT INTO source_refresh_policies
       (id, source_id, target_listing_id, transport, parser_profile, enabled, interval_minutes, next_run_at, allowed_hostnames, allowed_content_types, timeout_ms, max_response_bytes)
     VALUES ($1,$2,$3,'http',$4,TRUE,$5,NOW(),$6::jsonb,$7::jsonb,15000,3000000)
     ON CONFLICT (source_id) DO UPDATE
       SET target_listing_id = EXCLUDED.target_listing_id, transport = 'http', parser_profile = EXCLUDED.parser_profile,
           allowed_hostnames = EXCLUDED.allowed_hostnames, next_run_at = NOW(), updated_at = NOW()`,
    [
      policyId,
      realSourceId,
      listingId,
      input.parserProfile,
      input.intervalMinutes ?? 720,
      JSON.stringify(input.allowedHostnames),
      JSON.stringify(["text/html", "application/json", "application/ld+json", "text/plain"]),
    ],
  );
  return { sourceId: realSourceId, policyId };
}

/** Mark an existing compound record as backed by live data (badges the compound page). */
export async function markCompoundLive(db: SqlConnection, compoundSlug: string): Promise<void> {
  await db.query(`UPDATE compounds SET origin = 'live', updated_at = NOW() WHERE slug = $1`, [compoundSlug]);
}

/**
 * Recompute every compound's listing_count / median_price / documentation_coverage from
 * its active listings. Catalog imports (recordCatalogListing) don't go through the publish
 * cascade, so their compound-level stats need a post-import recompute to stay coherent.
 */
export async function recomputeCompoundStats(db: SqlConnection): Promise<void> {
  await db.query(`
    WITH stats AS (
      SELECT p.compound_id,
             COUNT(*) AS n,
             percentile_cont(0.5) WITHIN GROUP (ORDER BY l.price) AS med,
             ROUND(100.0 * COUNT(*) FILTER (WHERE l.report_date <> '' AND l.report_date <> 'Not located') / COUNT(*)) AS docs
      FROM listings l JOIN products p ON p.id = l.product_id WHERE p.status = 'active'
      GROUP BY p.compound_id
    )
    UPDATE compounds c
    SET listing_count = COALESCE(s.n, 0),
        median_price = COALESCE(s.med, c.median_price),
        documentation_coverage = COALESCE(s.docs, 0),
        updated_at = NOW()
    FROM stats s WHERE s.compound_id = c.id
  `);
  // Compounds with zero active listings → reflect that honestly.
  await db.query(`
    UPDATE compounds c SET listing_count = 0, updated_at = NOW()
    WHERE NOT EXISTS (SELECT 1 FROM products p JOIN listings l ON l.product_id = p.id WHERE p.compound_id = c.id AND p.status = 'active')
      AND c.listing_count <> 0
  `);
}

export interface LiveCompoundInput {
  slug: string;
  name: string;
  shorthand: string;
  category: string;
  description: string;
  aliases: string[];
  accent?: [string, string, string];
  researchNote?: string;
}

const DEFAULT_RESEARCH_NOTE =
  "Research summaries describe published literature and market data only. They do not establish the identity, quality, safety, or legal status of any listed physical product.";

/** Create (idempotently) a real compound record marked origin='live'. Returns its id. */
export async function upsertLiveCompound(db: SqlConnection, input: LiveCompoundInput): Promise<string> {
  const id = `cmp:${input.slug}`;
  await db.query(
    `INSERT INTO compounds (id, slug, canonical_name, shorthand, category, description, aliases, accent, research_note, origin)
     VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,'live')
     ON CONFLICT (slug) DO UPDATE
       SET canonical_name = EXCLUDED.canonical_name, shorthand = EXCLUDED.shorthand, category = EXCLUDED.category,
           description = EXCLUDED.description, aliases = EXCLUDED.aliases, origin = 'live', updated_at = NOW()`,
    [
      id, input.slug, input.name, input.shorthand, input.category, input.description,
      JSON.stringify(input.aliases), JSON.stringify(input.accent ?? ["#6d5dfc", "#8a7bff", "#b777ff"]),
      input.researchNote ?? DEFAULT_RESEARCH_NOTE,
    ],
  );
  await mintRegistryId(db, { entityType: "compound", sourceEntityType: "compound", sourceEntityId: id, displayName: input.name, slug: input.slug, currentEntityId: id });
  return id;
}

/**
 * Directly record an observed listing price from a vendor's own structured catalog feed
 * (e.g. Shopify /products.json) with honest provenance. This is first-party structured
 * data — the vendor's declared price — so it is recorded as an observation (evidence_level
 * 'public-only', label "Vendor catalog") linked to a source, NOT passed off as lab evidence.
 * A live HTTP source can still be registered separately to keep it fresh via the pipeline.
 */
/**
 * Enrol a catalogue listing in the provenance pipeline.
 *
 * Until now the collectors created a `sources` row for every listing and stopped there, so nothing
 * was ever snapshotted, diffed, reviewed or published — the entire spine behind /admin/ingest,
 * /admin/review, /admin/publications and /admin/traces sat empty in production while prices were
 * written straight to the catalogue. AGENTS.md is explicit that every changed observed value must
 * enter the review queue; this is the missing enrolment.
 *
 * The hostname allowlist is exactly the listing's OWN vendor domain, which is already in
 * known-vendors.json and is already being fetched by the collector that produced this row. That is
 * the same trust boundary, not a broadened one — the policy still cannot be pointed anywhere else.
 *
 * Interval is DAILY on purpose. The collectors re-read prices hourly, so freshness is already
 * handled; what this pipeline adds is a provenance record, and one snapshot per listing per day is
 * a complete record without a thousand fetches a day against other people's servers.
 */
export const PROVENANCE_INTERVAL_MINUTES = 1440;

export async function enrolListingForRefresh(
  db: SqlConnection,
  input: { listingId: string; sourceId: string; canonicalLocation: string },
): Promise<{ policyId: string; enrolled: boolean }> {
  let hostname: string;
  try {
    hostname = new URL(input.canonicalLocation).hostname.toLowerCase();
  } catch {
    // A listing without a resolvable source URL cannot be refreshed. Skip it rather than writing a
    // policy that could only ever fail, and let the caller carry on.
    return { policyId: "", enrolled: false };
  }

  const policyId = `policy:catalog:${input.listingId}`;
  await db.query(
    `INSERT INTO source_refresh_policies
       (id, source_id, target_listing_id, transport, parser_profile, enabled, interval_minutes, next_run_at,
        allowed_hostnames, allowed_content_types, timeout_ms, max_response_bytes)
     VALUES ($1,$2,$3,'http','jsonld',TRUE,$4,NOW(),$5::jsonb,$6::jsonb,15000,3000000)
     ON CONFLICT (source_id) DO UPDATE
       SET target_listing_id = EXCLUDED.target_listing_id,
           allowed_hostnames = EXCLUDED.allowed_hostnames,
           parser_profile = 'jsonld',
           updated_at = NOW()`,
    [
      policyId,
      input.sourceId,
      input.listingId,
      PROVENANCE_INTERVAL_MINUTES,
      JSON.stringify([hostname]),
      JSON.stringify(["text/html", "application/json"]),
    ],
  );
  return { policyId, enrolled: true };
}

export async function recordCatalogListing(
  db: SqlConnection,
  input: LiveListingInput & { price: number; availability: "In stock" | "Low stock" | "Unavailable"; sourceUrl: string; sourceLabel: string; imageUrl?: string },
): Promise<{ productId: string; listingId: string }> {
  const { productId, listingId } = await upsertLiveListing(db, input);
  // The source has two unique keys — its deterministic id (src:catalog:<listingSlug>) and its
  // canonical_location (the product URL). On re-ingest a vendor's product URL can change
  // (e.g. a platform move), so those two keys can point at different existing rows. Reuse
  // whichever already exists (by id OR url) and update it; only insert when neither is present.
  const sourceId = `src:catalog:${input.slug}`;
  const existing = await db.query<{ id: string }>(
    `SELECT id FROM sources WHERE id = $1 OR canonical_location = $2 ORDER BY (id = $1) DESC LIMIT 1`,
    [sourceId, input.sourceUrl],
  );
  let realSourceId: string;
  if (existing.rows[0]) {
    realSourceId = existing.rows[0].id;
    await db.query(`UPDATE sources SET label = $2, origin = 'live', updated_at = NOW() WHERE id = $1`, [realSourceId, input.sourceLabel]);
  } else {
    await db.query(
      `INSERT INTO sources (id, source_type, canonical_location, owner_organization_id, label, status, origin)
       VALUES ($1,'vendor-page',$2,$3,$4,'active','live')`,
      [sourceId, input.sourceUrl, `org:${input.vendorSlug}`, input.sourceLabel],
    );
    realSourceId = sourceId;
  }
  await db.query(`UPDATE listings SET source_id = $2 WHERE id = $1`, [listingId, realSourceId]);
  // Enrol in the provenance pipeline. Creating the source without a refresh policy is what left
  // the review queue permanently empty while the catalogue updated underneath it.
  await enrolListingForRefresh(db, { listingId, sourceId: realSourceId, canonicalLocation: input.sourceUrl });
  // When the storefront published a Janoshik COA VialGrade holds for this compound, stamp the testing claim
  // (issuer + the cited batch) so the hardened crossCheckCoa can resolve the verdict. Presence of the
  // claim — not the batch — sets the issuer, since a Janoshik link without a printed batch still means
  // "the vendor advertises a confirmed independent test." Sticky on re-ingest that doesn't re-find it.
  const hasCoa = Boolean(input.coa);
  const advertised = input.advertisedTesting ?? null;
  await db.query(
    `UPDATE listings
     SET price = $2, price_source = 'catalogue', availability = $3, evidence_level = 'public-only', evidence_label = 'Vendor catalog',
         last_checked = 'just now', price_history = CASE WHEN price_history = '[]'::jsonb THEN $4::jsonb ELSE price_history END,
         image_url = COALESCE($5, image_url),
         report_issuer = CASE WHEN $6 THEN $8 ELSE report_issuer END,
         report_confirmed = CASE WHEN $6 THEN TRUE ELSE report_confirmed END,
         batch_code = COALESCE($7, batch_code),
         advertises_testing = $9,
         advertised_issuer = CASE WHEN $9 THEN $10 ELSE NULL END,
         observed_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [listingId, input.price, input.availability, JSON.stringify([input.price]), input.imageUrl ?? null, hasCoa, input.coa?.batchCode ?? null, input.coa?.issuer ?? 'Janoshik', Boolean(advertised), advertised?.issuer ?? null],
  );
  return { productId, listingId };
}
