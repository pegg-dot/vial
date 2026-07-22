// Reads that fuse the static, sourced lab registry with live usage from the certificate store.
// The registry says what we know about each lab (existence, independence, accreditation — all
// sourced); the DB says how much real evidence flows through it (COAs, vendors, purity). Together
// they make /labs a real lab-intelligence surface instead of a demo network.

import type { QueryResultRow } from "pg";
import { getDatabase, type SqlConnection } from "@/server/db/client";
import { LAB_REGISTRY, getLabProfile, type LabProfile } from "./registry";

export interface LabUsage { coaCount: number; vendorCount: number; purityMedian: number | null; blindCount: number }
export interface LabOverviewRow { profile: LabProfile; usage: LabUsage }

async function usageByLab(db: SqlConnection): Promise<Map<string, LabUsage>> {
  const rows = (await db.query<QueryResultRow & { lab: string; coas: string | number; vendors: string | number; blind: string | number; purities: number[] | null }>(
    `SELECT lab, COUNT(*) coas, COUNT(DISTINCT vendor_slug) vendors,
            COUNT(*) FILTER (WHERE is_blind) blind,
            array_agg(purity_pct) FILTER (WHERE purity_pct IS NOT NULL) purities
     FROM lab_test_records GROUP BY lab`,
  )).rows;
  const map = new Map<string, LabUsage>();
  for (const r of rows) {
    const pk = getLabProfile(r.lab)?.slug;
    if (!pk) continue; // an unvetted lab name not in the registry — skip from the labs surface
    const purities = (r.purities ?? []).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    const median = purities.length ? purities[Math.floor(purities.length / 2)] : null;
    const prev = map.get(pk);
    const merged: LabUsage = {
      coaCount: (prev?.coaCount ?? 0) + Number(r.coas),
      vendorCount: (prev?.vendorCount ?? 0) + Number(r.vendors),
      blindCount: (prev?.blindCount ?? 0) + Number(r.blind),
      purityMedian: median ?? prev?.purityMedian ?? null,
    };
    map.set(pk, merged);
  }
  return map;
}

/** All registry labs with their live usage, ordered: confirmed-independent first, then by COA volume. */
export async function getLabsOverview(connection?: SqlConnection): Promise<LabOverviewRow[]> {
  const db = connection ?? (await getDatabase());
  const usage = await usageByLab(db);
  const rank = { independent: 0, "independence-unverified": 1, unverified: 2 } as const;
  return LAB_REGISTRY
    .map((profile) => ({ profile, usage: usage.get(profile.slug) ?? { coaCount: 0, vendorCount: 0, purityMedian: null, blindCount: 0 } }))
    .sort((a, b) => rank[a.profile.independence] - rank[b.profile.independence] || b.usage.coaCount - a.usage.coaCount);
}

export interface LabDetail {
  profile: LabProfile;
  usage: LabUsage;
  vendors: { vendorSlug: string; coas: number }[];
  recentTests: { verifyUrl: string; sampleName: string; vendorSlug: string | null; compoundSlug: string | null; purityPct: number | null; testedAt: string | null; isBlind: boolean }[];
}

export async function getLabDetail(slug: string, connection?: SqlConnection): Promise<LabDetail | null> {
  const profile = LAB_REGISTRY.find((l) => l.slug === slug);
  if (!profile) return null;
  const db = connection ?? (await getDatabase());
  const usage = (await usageByLab(db)).get(slug) ?? { coaCount: 0, vendorCount: 0, purityMedian: null, blindCount: 0 };
  // Match on any alias so a canonical rename doesn't orphan rows mid-migration.
  const names = [profile.displayName, ...profile.aliases];
  const vendors = (await db.query<QueryResultRow & { vendor_slug: string; coas: string | number }>(
    `SELECT vendor_slug, COUNT(*) coas FROM lab_test_records WHERE lower(lab)=ANY($1) AND vendor_slug IS NOT NULL GROUP BY vendor_slug ORDER BY coas DESC LIMIT 40`,
    [names.map((n) => n.toLowerCase())],
  )).rows.map((r) => ({ vendorSlug: r.vendor_slug, coas: Number(r.coas) }));
  const recent = (await db.query<QueryResultRow & { verify_url: string; sample_name: string; vendor_slug: string | null; compound_slug: string | null; purity_pct: string | number | null; tested_at: string | null; is_blind: boolean }>(
    `SELECT verify_url, sample_name, vendor_slug, compound_slug, purity_pct, tested_at, is_blind FROM lab_test_records WHERE lower(lab)=ANY($1) ORDER BY is_blind DESC, updated_at DESC LIMIT 20`,
    [names.map((n) => n.toLowerCase())],
  )).rows.map((r) => ({ verifyUrl: r.verify_url, sampleName: r.sample_name, vendorSlug: r.vendor_slug, compoundSlug: r.compound_slug, purityPct: r.purity_pct == null ? null : Number(r.purity_pct), testedAt: r.tested_at, isBlind: Boolean(r.is_blind) }));
  return { profile, usage, vendors, recentTests: recent };
}
