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

export class LiveIngestNotApprovedError extends Error {
  constructor() {
    super(
      "Live ingest is not approved. Set VIAL_LIVE_INGEST_APPROVED=true (or pass { approved: true }) to register real HTTP sources.",
    );
    this.name = "LiveIngestNotApprovedError";
  }
}

export function isLiveIngestApproved(options?: { approved?: boolean }): boolean {
  if (options?.approved === true) return true;
  return process.env.VIAL_LIVE_INGEST_APPROVED === "true";
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

  await db.query(
    `INSERT INTO sources (id, source_type, canonical_location, owner_organization_id, label, status, origin)
     VALUES ($1,$2,$3,$4,$5,'active','live')
     ON CONFLICT (canonical_location) DO UPDATE
       SET owner_organization_id = EXCLUDED.owner_organization_id, label = EXCLUDED.label, origin = 'live', updated_at = NOW()`,
    [sourceId, input.sourceType, input.canonicalLocation, ownerId, input.label],
  );
  await db.query(`UPDATE listings SET source_id = $2 WHERE id = $1`, [listingId, sourceId]);
  await db.query(
    `INSERT INTO source_refresh_policies
       (id, source_id, target_listing_id, transport, parser_profile, enabled, interval_minutes, next_run_at, allowed_hostnames, allowed_content_types, timeout_ms, max_response_bytes)
     VALUES ($1,$2,$3,'http',$4,TRUE,$5,NOW(),$6::jsonb,$7::jsonb,15000,3000000)
     ON CONFLICT (source_id) DO UPDATE
       SET target_listing_id = EXCLUDED.target_listing_id, transport = 'http', parser_profile = EXCLUDED.parser_profile,
           allowed_hostnames = EXCLUDED.allowed_hostnames, next_run_at = NOW(), updated_at = NOW()`,
    [
      policyId,
      sourceId,
      listingId,
      input.parserProfile,
      input.intervalMinutes ?? 720,
      JSON.stringify(input.allowedHostnames),
      JSON.stringify(["text/html", "application/json", "application/ld+json", "text/plain"]),
    ],
  );
  return { sourceId, policyId };
}

/** Mark an existing compound record as backed by live data (badges the compound page). */
export async function markCompoundLive(db: SqlConnection, compoundSlug: string): Promise<void> {
  await db.query(`UPDATE compounds SET origin = 'live', updated_at = NOW() WHERE slug = $1`, [compoundSlug]);
}
