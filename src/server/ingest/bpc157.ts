// Real BPC-157 provisioning + ingest orchestration.
//
// This is the "make one compound real" proof from the roadmap: it provisions real
// vendors/listings for BPC-157, points HTTP refresh policies at their real product
// pages plus the Janoshik public COA feed, runs the real fetch through the normal
// snapshot -> extract -> review pipeline, and approves only sane, in-range claims
// (an out-of-range price is left pending for a human, exactly like the demo path).

import type { SqlConnection } from "@/server/db/client";
import { getDatabase } from "@/server/db/client";
import { runRefreshSweep } from "@/server/refresh/scheduler";
import { reviewClaim } from "@/server/review/repository";
import {
  markCompoundLive,
  registerLiveHttpSource,
  upsertLiveListing,
  upsertLiveVendor,
  type LiveParserProfile,
} from "./live-sources";

export interface RealVendorSpec {
  slug: string;
  name: string;
  domain: string;
  location: string;
  description: string;
  listingSlug: string;
  productName: string;
  quantity: string;
  productUrl: string;
  parserProfile: LiveParserProfile;
  accent: [string, string, string];
}

// Verified live 2026-07-21: all three product pages return 200 with a parseable
// price in schema.org / JSON-LD. Prices here are only for reference/guardrails —
// the real value is fetched and reviewed, never seeded from these numbers.
export const REAL_BPC157_VENDORS: RealVendorSpec[] = [
  {
    slug: "eternal-peptides",
    name: "Eternal Peptides",
    domain: "eternalpeptides.com",
    location: "United States",
    description: "Research-peptide vendor publishing third-party Janoshik COAs. Aggregated from the vendor's public product page.",
    listingSlug: "eternal-peptides-bpc-157-5mg",
    productName: "BPC-157",
    quantity: "5mg",
    productUrl: "https://eternalpeptides.com/product/bpc-157-5mg/",
    parserProfile: "jsonld",
    accent: ["#5b8def", "#7aa5f5", "#a7c4fb"],
  },
  {
    slug: "bluum-peptides",
    name: "Bluum Peptides",
    domain: "bluumpeptides.com",
    location: "United States",
    description: "Research-peptide vendor advertising independent Janoshik testing. Aggregated from the vendor's public product page.",
    listingSlug: "bluum-peptides-bpc-157-5mg",
    productName: "BPC-157",
    quantity: "5mg",
    productUrl: "https://bluumpeptides.com/products/bpc-157",
    parserProfile: "jsonld",
    accent: ["#3aa6b9", "#5fc2d1", "#9adbe6"],
  },
  {
    slug: "biotech-peptides",
    name: "Biotech Peptides",
    domain: "biotechpeptides.com",
    location: "United States",
    description: "Research-peptide vendor with published COAs. Aggregated from the vendor's public product page.",
    listingSlug: "biotech-peptides-bpc-157-5mg",
    productName: "BPC-157",
    quantity: "5mg",
    productUrl: "https://biotechpeptides.com/product/bpc-157/",
    parserProfile: "jsonld",
    accent: ["#6d5dfc", "#8a7bff", "#b777ff"],
  },
];

// Janoshik Analytical publishes a server-rendered public feed of recent tests with
// vendor-immutable, QR-verifiable certificate URLs. It is the real "audited financials"
// evidence source. (The certificate purity % lives inside a JPG on each verify page and
// would need OCR/vision; the feed itself proves a batch was tested + links the record.)
export const JANOSHIK_SOURCE = {
  key: "janoshik-public-bpc157",
  url: "https://public.janoshik.com/",
  hostname: "public.janoshik.com",
  label: "Janoshik Analytical — public test feed (BPC-157 evidence)",
};

const COMPOUND_SLUG = "bpc-157";

/** Provision real vendors + listings + HTTP sources for BPC-157. Idempotent. */
export async function provisionRealBpc157(db: SqlConnection, options?: { approved?: boolean }) {
  await markCompoundLive(db, COMPOUND_SLUG);
  const provisioned: { vendor: string; listingSlug: string; sourceId: string }[] = [];

  for (const spec of REAL_BPC157_VENDORS) {
    await upsertLiveVendor(db, {
      slug: spec.slug,
      name: spec.name,
      domains: [spec.domain],
      location: spec.location,
      description: spec.description,
      accent: [spec.accent[0], spec.accent[2]],
    });
    await upsertLiveListing(db, {
      compoundSlug: COMPOUND_SLUG,
      vendorSlug: spec.slug,
      slug: spec.listingSlug,
      name: spec.productName,
      quantity: spec.quantity,
      externalUrl: spec.productUrl,
      accent: spec.accent,
    });
    const { sourceId } = await registerLiveHttpSource(
      db,
      {
        key: spec.slug,
        sourceType: "vendor-page",
        canonicalLocation: spec.productUrl,
        label: `${spec.name} — BPC-157 ${spec.quantity} (public product page)`,
        ownerVendorSlug: spec.slug,
        targetListingSlug: spec.listingSlug,
        parserProfile: spec.parserProfile,
        allowedHostnames: [spec.domain, `www.${spec.domain}`],
      },
      options,
    );
    provisioned.push({ vendor: spec.name, listingSlug: spec.listingSlug, sourceId });
  }

  // Register the Janoshik feed as a real lab-report source bound to the first listing,
  // so the reviewed evidence trail shows a real independent-lab provenance link.
  await registerLiveHttpSource(
    db,
    {
      key: JANOSHIK_SOURCE.key,
      sourceType: "lab-report",
      canonicalLocation: JANOSHIK_SOURCE.url,
      label: JANOSHIK_SOURCE.label,
      targetListingSlug: REAL_BPC157_VENDORS[0].listingSlug,
      parserProfile: "document",
      allowedHostnames: [JANOSHIK_SOURCE.hostname],
    },
    options,
  );

  return provisioned;
}

export interface IngestReport {
  sweep: { enqueued: number; processed: number };
  approved: { claimId: string; predicate: string; value: unknown; listing: string }[];
  heldForReview: { claimId: string; predicate: string; value: unknown; reason: string }[];
}

// Guardrails: a plausible per-vial BPC-157 price. Anything outside is not auto-approved
// (left pending for a human), so a mis-parsed shipping fee or aggregate never publishes.
const PRICE_MIN = 10;
const PRICE_MAX = 500;

/**
 * Approve every pending claim on a live listing whose value passes the sanity policy;
 * hold the rest for a human. Split out from the sweep so it can be tested offline.
 */
export async function approveSaneLiveClaims(db?: SqlConnection): Promise<Pick<IngestReport, "approved" | "heldForReview">> {
  const database = db ?? (await getDatabase());
  const pending = await database.query<{ id: string; predicate: string; value_json: string; subject_id: string }>(
    `SELECT ec.id, ec.predicate, ec.value_json, ec.subject_id
     FROM evidence_claims ec
     JOIN listings l ON l.id = ec.subject_id
     WHERE ec.review_status = 'pending' AND l.origin = 'live'
     ORDER BY ec.created_at ASC`,
  );

  const approved: IngestReport["approved"] = [];
  const heldForReview: IngestReport["heldForReview"] = [];

  // Evidence predicates (batch code, report metadata) must come from a real lab/COA
  // source, NOT a vendor storefront page — the deterministic parser scrapes page nav and
  // boilerplate into these (e.g. batchCode "SYNTHESIS", reportIssuer "...Search Login Cart").
  // Auto-REJECT that noise on live listings so the review queue never fills with garbage
  // and a human can't accidentally publish page-chrome as a real batch code.
  const STOREFRONT_NOISE = new Set(["batchCode", "reportDate", "reportIssuer", "reportConfirmed"]);

  for (const claim of pending.rows) {
    let value: unknown;
    try { value = JSON.parse(claim.value_json); } catch { value = claim.value_json; }

    if (STOREFRONT_NOISE.has(claim.predicate)) {
      try {
        await reviewClaim({ claimId: claim.id, decision: "reject", actor: "script:ingest-real-bpc157", role: "admin", notes: "Evidence claim scraped from a vendor storefront page — not a valid COA source." });
      } catch { /* best-effort cleanup */ }
      heldForReview.push({ claimId: claim.id, predicate: claim.predicate, value, reason: "auto-rejected: storefront noise, not a COA source" });
      continue;
    }

    const inRange =
      claim.predicate === "price"
        ? typeof value === "number" && value >= PRICE_MIN && value <= PRICE_MAX
        : claim.predicate === "availability" || claim.predicate === "shipping";

    if (!inRange) {
      heldForReview.push({ claimId: claim.id, predicate: claim.predicate, value, reason: `${claim.predicate} outside auto-approve policy` });
      continue;
    }
    try {
      await reviewClaim({ claimId: claim.id, decision: "approve", actor: "script:ingest-real-bpc157", role: "admin" });
      approved.push({ claimId: claim.id, predicate: claim.predicate, value, listing: claim.subject_id });
    } catch (error) {
      heldForReview.push({ claimId: claim.id, predicate: claim.predicate, value, reason: error instanceof Error ? error.message : String(error) });
    }
  }

  return { approved, heldForReview };
}

/** Run the live refresh sweep, then auto-approve only sane claims. */
export async function runLiveIngestAndApprove(db?: SqlConnection): Promise<IngestReport> {
  const sweep = await runRefreshSweep(50);
  const { approved, heldForReview } = await approveSaneLiveClaims(db);
  return { sweep: { enqueued: sweep.enqueued, processed: sweep.processed }, approved, heldForReview };
}
