import type { SqlConnection } from "./client";
import { compounds, products, vendors } from "@/lib/data";
import { recomputeVendorStats } from "./vendor-stats-repair";

interface FixtureVersion {
  version: number;
  contentType: string;
  rawContent: string;
  metadata?: Record<string, unknown>;
}

interface FixtureSource {
  key: string;
  label: string;
  vendorSlug: string;
  listingSlug: string;
  canonicalLocation: string;
  parserProfile: "generic" | "jsonld" | "document" | "catalog";
  versions: FixtureVersion[];
}

const fixtureSources: FixtureSource[] = [
  {
    key: "northstar-bpc",
    label: "Northstar BPC-157 product page",
    vendorSlug: "northstar-research",
    listingSlug: "northstar-bpc-157-10mg",
    canonicalLocation: "https://fixtures.vial.local/northstar-research/bpc-157-10mg",
    parserProfile: "catalog",
    versions: [
      {
        version: 1,
        contentType: "text/html",
        rawContent: `<html><body><main><h1>BPC-157 10 mg</h1><p>Price: $54</p><p>In stock</p><p>Shipping within 2-4 business days</p><p>Batch: NS-BPC-0716</p><p>Report date: July 16, 2026</p><p>Laboratory: Aperture Analytical</p><p>Report confirmed: yes</p></main></body></html>`,
      },
      {
        version: 2,
        contentType: "text/html",
        rawContent: `<html><body><main><h1>BPC-157 10 mg</h1><p>Price: $49</p><p>In stock</p><p>Shipping within 2-4 business days</p><p>Batch: NS-BPC-0719</p><p>Report date: July 19, 2026</p><p>Laboratory: Aperture Analytical</p><p>Report confirmed: yes</p></main></body></html>`,
      },
      {
        version: 3,
        contentType: "text/html",
        rawContent: `<html><body><main><h1>BPC-157 10 mg</h1><p>Price: $57</p><p>Out of stock</p><p>Shipping within 5-7 business days</p><p>Batch: NS-BPC-0719</p><p>Report date: July 19, 2026</p><p>Laboratory: Aperture Analytical</p><p>Report confirmed: yes</p></main></body></html>`,
      },
    ],
  },
  {
    key: "helix-bpc",
    label: "Helix BPC-157 product page",
    vendorSlug: "helix-science",
    listingSlug: "helix-bpc-157-10mg",
    canonicalLocation: "https://fixtures.vial.local/helix-science/bpc-157-10mg",
    parserProfile: "catalog",
    versions: [
      {
        version: 1,
        contentType: "text/html",
        rawContent: `<html><body><h1>BPC-157 10 mg</h1><p>Price: $52</p><p>In stock</p><p>Delivery in 3-5 business days</p><p>Lot: HX-BPC-0708</p><p>Analysis date: July 8, 2026</p><p>Tested by Vector Analytics</p><p>Report confirmed: no</p></body></html>`,
      },
      {
        version: 2,
        contentType: "text/html",
        rawContent: `<html><body><h1>BPC-157 10 mg</h1><p>Price: $52</p><p>In stock</p><p>Delivery in 3-5 business days</p><p>Lot: HX-BPC-0708</p><p>Analysis date: July 8, 2026</p><p>Tested by Vector Analytics</p><p>Report confirmed: yes</p></body></html>`,
      },
    ],
  },
  {
    key: "lattice-mots",
    label: "Lattice MOTS-c product page",
    vendorSlug: "lattice-research",
    listingSlug: "lattice-mots-c-10mg",
    canonicalLocation: "https://fixtures.vial.local/lattice-research/mots-c-10mg",
    parserProfile: "catalog",
    versions: [
      {
        version: 1,
        contentType: "text/html",
        rawContent: `<html><body><h1>MOTS-c 10 mg</h1><p>Price: $69</p><p>In stock</p><p>Shipping within 1-3 business days</p><p>Batch: LR-MOTS-0718</p><p>Report date: July 18, 2026</p><p>Lab: Vector Analytics</p><p>Report confirmed: yes</p></body></html>`,
      },
      {
        version: 2,
        contentType: "text/html",
        rawContent: `<html><body><h1>MOTS-c 10 mg</h1><p>Price: $66</p><p>Low stock</p><p>Shipping within 1-3 business days</p><p>Batch: LR-MOTS-0718</p><p>Report date: July 18, 2026</p><p>Lab: Vector Analytics</p><p>Report confirmed: yes</p></body></html>`,
      },
    ],
  },
  {
    key: "meridian-bpc",
    label: "Meridian BPC-157 product page",
    vendorSlug: "meridian-biosciences",
    listingSlug: "meridian-bpc-157-5mg",
    canonicalLocation: "https://fixtures.vial.local/meridian-biosciences/bpc-157-5mg",
    parserProfile: "catalog",
    versions: [
      {
        version: 1,
        contentType: "text/html",
        rawContent: `<html><body><h1>BPC-157 5 mg</h1><p>Price: $41</p><p>In stock</p><p>Delivery in 4-6 business days</p><p>No current batch report is displayed.</p></body></html>`,
      },
      {
        version: 2,
        contentType: "text/html",
        rawContent: `<html><body><h1>BPC-157 5 mg</h1><p>Price: $41</p><p>In stock</p><p>Delivery in 4-6 business days</p><p>Batch: MB-BPC-0719</p><p>Report date: July 19, 2026</p><p>Laboratory: Nova Assay Group</p><p>Report confirmed: no</p></body></html>`,
      },
    ],
  },
];

export async function seedDatabase(database: SqlConnection) {
  for (const compound of compounds) {
    await database.query(
      `INSERT INTO compounds
       (id, slug, canonical_name, shorthand, category, description, aliases, listing_count, median_price, price_change, documentation_coverage, accent, research_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12::jsonb,$13)
       ON CONFLICT (slug) DO NOTHING`,
      [
        `cmp:${compound.slug}`,
        compound.slug,
        compound.name,
        compound.shorthand,
        compound.category,
        compound.description,
        JSON.stringify(compound.aliases),
        compound.listings,
        compound.medianPrice,
        compound.priceChange,
        compound.documentationCoverage,
        JSON.stringify(compound.accent),
        compound.researchNote,
      ],
    );
  }

  for (const vendor of vendors) {
    await database.query(
      `INSERT INTO organizations
       (id, slug, organization_type, display_name, description, location, founded, initials, profile_status, participation_status, product_count, documentation_current, median_ship_days, support_score, last_observed, accent, history)
       VALUES ($1,$2,'vendor',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb)
       ON CONFLICT (slug) DO NOTHING`,
      [
        `org:${vendor.slug}`,
        vendor.slug,
        vendor.name,
        vendor.description,
        vendor.location,
        vendor.founded,
        vendor.initials,
        vendor.profileStatus,
        vendor.profileStatus === "participating" ? "participating" : "independent",
        vendor.productCount,
        vendor.documentationCurrent,
        vendor.medianShipDays,
        vendor.supportScore,
        vendor.lastObserved,
        JSON.stringify(vendor.accent),
        JSON.stringify(vendor.history),
      ],
    );
  }

  for (const product of products) {
    await database.query(
      `INSERT INTO products
       (id, slug, vendor_id, compound_id, name, declared_quantity, declared_form, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'active')
       ON CONFLICT (slug) DO NOTHING`,
      [
        `prd:${product.slug}`,
        product.slug,
        `org:${product.vendorSlug}`,
        `cmp:${product.compoundSlug}`,
        product.name,
        product.quantity,
        product.form,
      ],
    );
    await database.query(
      `INSERT INTO listings
       (id, slug, product_id, price, previous_price, currency, availability, shipping_claim, evidence_level, evidence_label, report_date, report_issuer, report_confirmed, batch_code, batch_linked, sample_origin, last_checked, rating, review_count, featured, checkout_mode, price_history, accent, evidence)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb,$23::jsonb,$24::jsonb)
       ON CONFLICT (slug) DO NOTHING`,
      [
        `lst:${product.slug}`,
        product.slug,
        `prd:${product.slug}`,
        product.price,
        product.previousPrice ?? null,
        product.currency,
        product.availability,
        product.shipping,
        product.evidenceLevel,
        product.evidenceLabel,
        product.reportDate,
        product.reportIssuer,
        product.reportConfirmed,
        product.batchCode,
        product.batchLinked,
        product.sampleOrigin,
        product.lastChecked,
        product.rating,
        product.reviewCount,
        product.featured ?? false,
        product.checkoutMode,
        JSON.stringify(product.priceHistory),
        JSON.stringify(product.accent),
        JSON.stringify(product.evidence),
      ],
    );
  }

  for (const fixture of fixtureSources) {
    const sourceId = `src:fixture:${fixture.key}`;
    const policyId = `policy:fixture:${fixture.key}`;
    const listingId = `lst:${fixture.listingSlug}`;
    const vendorId = `org:${fixture.vendorSlug}`;

    await database.query(
      `INSERT INTO sources
       (id, source_type, canonical_location, owner_organization_id, label, status)
       VALUES ($1, 'vendor-page', $2, $3, $4, 'active')
       ON CONFLICT (canonical_location) DO UPDATE
       SET owner_organization_id = EXCLUDED.owner_organization_id,
           label = EXCLUDED.label,
           updated_at = NOW()`,
      [sourceId, fixture.canonicalLocation, vendorId, fixture.label],
    );
    await database.query(`UPDATE listings SET source_id = $2 WHERE id = $1 AND source_id IS NULL`, [listingId, sourceId]);
    await database.query(
      `INSERT INTO source_refresh_policies
       (id, source_id, target_listing_id, transport, parser_profile, enabled, interval_minutes, next_run_at, allowed_hostnames)
       VALUES ($1, $2, $3, 'fixture', $4, TRUE, 360, NOW() + INTERVAL '12 hours', $5::jsonb)
       ON CONFLICT (source_id) DO UPDATE
       SET target_listing_id = EXCLUDED.target_listing_id,
           transport = EXCLUDED.transport,
           parser_profile = EXCLUDED.parser_profile,
           allowed_hostnames = EXCLUDED.allowed_hostnames,
           updated_at = NOW()`,
      [policyId, sourceId, listingId, fixture.parserProfile, JSON.stringify(["fixtures.vial.local"])],
    );
    for (const version of fixture.versions) {
      await database.query(
        `INSERT INTO source_fixtures
         (id, policy_id, version, content_type, raw_content, metadata, active)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
         ON CONFLICT (policy_id, version) DO UPDATE
         SET raw_content = EXCLUDED.raw_content,
             content_type = EXCLUDED.content_type,
             metadata = EXCLUDED.metadata`,
        [
          `fixture:${fixture.key}:v${version.version}`,
          policyId,
          version.version,
          version.contentType,
          version.rawContent,
          JSON.stringify({ fixture: true, label: fixture.label, ...version.metadata }),
          version.version === 1,
        ],
      );
    }
  }

  // The two derived vendor columns are HAND-AUTHORED in src/lib/data.ts (northstar-research is
  // written as productCount 4 / documentationCurrent 88 while its seeded catalog is 3 listings,
  // all 3 documented). Authored constants are precisely how these columns drifted in the first
  // place, so the seed finishes by deriving them from the rows it just inserted. Demo vendors then
  // obey the same invariant as live ones, and nothing renders a fictional "88%".
  await recomputeVendorStats(database);
}
