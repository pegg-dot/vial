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
import { triagePendingClaims } from "@/server/refresh/auto-triage";
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

/**
 * Approve every pending claim on a live listing whose value passes the sanity policy;
 * hold the rest for a human. Split out from the sweep so it can be tested offline.
 */
export async function approveSaneLiveClaims(db?: SqlConnection): Promise<Pick<IngestReport, "approved" | "heldForReview">> {
  const database = db ?? (await getDatabase());
  // The policy itself now lives in @/server/refresh/auto-triage, because enrolling every catalogue
  // listing means it runs on every sweep, not only in this one-off script. Behaviour is unchanged;
  // this keeps the script's own actor string on the audit trail.
  const outcome = await triagePendingClaims(database, { actor: "script:ingest-real-bpc157" });
  const approved: IngestReport["approved"] = outcome.approved.map((c) => ({ claimId: c.claimId, predicate: c.predicate, value: c.value, listing: "" }));
  const heldForReview: IngestReport["heldForReview"] = [
    ...outcome.rejected.map((c) => ({ claimId: c.claimId, predicate: c.predicate, value: c.value, reason: "auto-rejected: storefront noise, not a COA source" })),
    ...outcome.held.map((c) => ({ claimId: c.claimId, predicate: c.predicate, value: c.value, reason: c.reason })),
  ];
  return { approved, heldForReview };
}

/** Run the live refresh sweep, then auto-approve only sane claims. */
export async function runLiveIngestAndApprove(db?: SqlConnection): Promise<IngestReport> {
  const sweep = await runRefreshSweep(50);
  const { approved, heldForReview } = await approveSaneLiveClaims(db);
  return { sweep: { enqueued: sweep.enqueued, processed: sweep.processed }, approved, heldForReview };
}
