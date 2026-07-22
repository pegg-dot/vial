// Vendor linkage engine — resolve which "independent" storefronts are actually one operator or
// one source, from machine-checkable shared fingerprints. Edges come from three signals:
//   web-id       — the same Google Analytics / GTM / Facebook-pixel / Shopify handle (near-certain
//                  same operator; you don't accidentally share an analytics account)
//   shared-lot   — the same specific COA lot number appears on two vendors (same physical batch)
//   shared-source— two vendors' certificates name the same upstream manufacturer (same factory)
// A buyer eyeballing one site can't see any of this; the platform builds the graph.

import type { SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";

export interface VendorLink { linkedSlug: string; basis: "web-id" | "shared-lot" | "shared-source" | "shared-photo"; strength: "strong" | "info"; detail: string }

const WEB_LABEL: Record<string, string> = { ga: "Google Analytics", gtm: "Google Tag Manager", fb: "Facebook pixel", shopify: "Shopify store handle", cert: "TLS certificate", ip: "server IP" };

// Hamming distance between two 16-hex-char (64-bit) perceptual hashes — nibble by nibble, so
// no BigInt (and robust to the build target).
function hamming(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    let x = (parseInt(a[i], 16) ^ parseInt(b[i], 16)) & 0xf;
    while (x) { n += x & 1; x >>= 1; }
  }
  return n;
}

/** Store one observed web fingerprint for a vendor (idempotent). */
export async function recordFingerprint(db: SqlConnection, vendorSlug: string, kind: string, value: string): Promise<void> {
  if (!value) return;
  await db.query(
    `INSERT INTO vendor_fingerprints (id, vendor_slug, kind, value) VALUES ($1,$2,$3,$4) ON CONFLICT (vendor_slug, kind, value) DO NOTHING`,
    [newId("vfp"), vendorSlug, kind, value],
  );
}

async function writeLink(db: SqlConnection, a: string, b: string, basis: string, strength: string, detail: string): Promise<void> {
  await db.query(
    `INSERT INTO vendor_links (id, vendor_slug, linked_slug, basis, strength, detail) VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (vendor_slug, linked_slug, basis) DO UPDATE SET strength=EXCLUDED.strength, detail=EXCLUDED.detail`,
    [newId("vlink"), a, b, basis, strength, detail],
  );
}

/**
 * Recompute all vendor links from fingerprints + COA records. Idempotent (clears and rebuilds).
 * Writes both directions of every edge so a vendor page can read all its links in one query.
 */
export async function computeAndStoreLinkages(db: SqlConnection): Promise<{ edges: number }> {
  await db.query(`DELETE FROM vendor_links`);
  let edges = 0;
  const emit = async (a: string, b: string, basis: string, strength: string, detailA: string, detailB: string) => {
    if (a === b) return;
    await writeLink(db, a, b, basis, strength, detailA);
    await writeLink(db, b, a, basis, strength, detailB);
    edges += 1;
  };

  // 1. Web fingerprints shared across vendors — the same analytics/pixel/handle.
  const fps = (await db.query<{ kind: string; value: string; vendors: string[] }>(
    `SELECT kind, value, array_agg(DISTINCT vendor_slug) vendors FROM vendor_fingerprints GROUP BY kind, value HAVING COUNT(DISTINCT vendor_slug) > 1`,
  )).rows;
  for (const f of fps) {
    const label = WEB_LABEL[f.kind] ?? f.kind;
    for (let i = 0; i < f.vendors.length; i++) for (let j = i + 1; j < f.vendors.length; j++) {
      await emit(f.vendors[i], f.vendors[j], "web-id", "strong",
        `Shares a ${label} ID (${f.value}) with ${f.vendors[j].replace(/-/g, " ")} — you don't share an analytics account by accident. Near-certain the same operator runs both.`,
        `Shares a ${label} ID (${f.value}) with ${f.vendors[i].replace(/-/g, " ")} — near-certain the same operator runs both.`);
    }
  }

  // 2. Specific COA lot numbers shared across vendors — same physical batch. Only real lots
  //    (length >= 6, so bare years like "2026" and stub numbers like "4" are excluded).
  const lots = (await db.query<{ lot: string; vendors: string[] }>(
    `SELECT REGEXP_REPLACE(LOWER(batch_code),'[^a-z0-9]','','g') lot, array_agg(DISTINCT vendor_slug) vendors
       FROM lab_test_records WHERE batch_code IS NOT NULL AND vendor_slug IS NOT NULL
        AND LENGTH(REGEXP_REPLACE(LOWER(batch_code),'[^a-z0-9]','','g')) >= 6
      GROUP BY 1 HAVING COUNT(DISTINCT vendor_slug) > 1`,
  )).rows;
  for (const l of lots) {
    if (l.vendors.length > 6) continue; // suspiciously generic — skip rather than mass-link
    for (let i = 0; i < l.vendors.length; i++) for (let j = i + 1; j < l.vendors.length; j++) {
      await emit(l.vendors[i], l.vendors[j], "shared-lot", "strong",
        `Shares COA lot ${l.lot} with ${l.vendors[j].replace(/-/g, " ")} — the same physically-tested batch, so they're selling the same material from the same source.`,
        `Shares COA lot ${l.lot} with ${l.vendors[i].replace(/-/g, " ")} — the same physically-tested batch from the same source.`);
    }
  }

  // 3. Shared upstream manufacturer — same factory behind different storefronts.
  const makers = (await db.query<{ manufacturer: string; vendors: string[] }>(
    `SELECT manufacturer, array_agg(DISTINCT vendor_slug) vendors FROM lab_test_records
      WHERE vendor_slug IS NOT NULL AND manufacturer IS NOT NULL AND LOWER(manufacturer) NOT IN ('unknown','n/a')
      GROUP BY manufacturer HAVING COUNT(DISTINCT vendor_slug) > 1`,
  )).rows;
  for (const m of makers) {
    if (m.vendors.length > 8) continue;
    for (let i = 0; i < m.vendors.length; i++) for (let j = i + 1; j < m.vendors.length; j++) {
      await emit(m.vendors[i], m.vendors[j], "shared-source", "info",
        `Both ${m.vendors[i].replace(/-/g, " ")} and ${m.vendors[j].replace(/-/g, " ")} source from ${m.manufacturer} — the same upstream maker, so the underlying product is likely identical. Compare on price.`,
        `Both source from ${m.manufacturer} — the same upstream maker. Compare on price.`);
    }
  }

  // 4. Reused product photos — the same image (perceptual near-match, Hamming ≤ 6 of 64) on two
  //    vendors is a hallmark of one drop-shipper. Pairwise across vendors; one edge per pair.
  const photos = (await db.query<{ vendor_slug: string; value: string }>(`SELECT vendor_slug, value FROM vendor_fingerprints WHERE kind='photo'`)).rows;
  const donePairs = new Set<string>();
  for (let i = 0; i < photos.length; i++) for (let j = i + 1; j < photos.length; j++) {
    const a = photos[i], b = photos[j];
    if (a.vendor_slug === b.vendor_slug) continue;
    const pair = [a.vendor_slug, b.vendor_slug].sort().join("|");
    if (donePairs.has(pair)) continue;
    // Near-EXACT only (≤ 3 of 64). Looser thresholds match different-but-similar white-vial-on-
    // white photos; the collector already dropped low-entropy blanks, so a ≤3 match here is a
    // genuinely-distinctive image reused verbatim.
    if (hamming(a.value, b.value) <= 3) {
      donePairs.add(pair);
      await emit(a.vendor_slug, b.vendor_slug, "shared-photo", "strong",
        `Uses the same product photo as ${b.vendor_slug.replace(/-/g, " ")} — reused imagery is a hallmark of one drop-shipper running multiple storefronts.`,
        `Uses the same product photo as ${a.vendor_slug.replace(/-/g, " ")} — likely one drop-shipper behind both.`);
    }
  }

  return { edges };
}

/** All links for a vendor, strongest first. */
export async function getVendorLinks(db: SqlConnection, vendorSlug: string): Promise<VendorLink[]> {
  const rows = (await db.query<{ linked_slug: string; basis: VendorLink["basis"]; strength: VendorLink["strength"]; detail: string }>(
    `SELECT linked_slug, basis, strength, detail FROM vendor_links WHERE vendor_slug=$1
      ORDER BY CASE strength WHEN 'strong' THEN 0 ELSE 1 END, basis`,
    [vendorSlug],
  )).rows;
  return rows.map((r) => ({ linkedSlug: r.linked_slug, basis: r.basis, strength: r.strength, detail: r.detail }));
}
