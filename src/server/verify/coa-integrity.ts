// COA integrity detector — the "salvage title" engine.
//
// A vendor posting certificates isn't the same as a vendor being tested. This inspects the
// COAs a vendor publishes and derives the ways a certificate program can be fake or hollow:
// one lot number reused across many products, a certificate self-issued by the vendor's own
// "lab", a COA that pictures a different compound than the product, or certificates too old to
// describe current stock. These are the things a buyer can't see but VialGrade can — surfaced as
// loud red flags, never silently swallowed. Purely derived from the evidence; nothing hardcoded.

export interface PostedCoa {
  vendorSlug: string;
  vendorName: string;
  compound: string;
  lot?: string | null;
  lab?: string | null;
  testedAt?: string | null;   // as printed; may be a bare year
  coaProduct?: string | null; // the product the COA actually pictures, when it differs
}

export type CoaFlagKind = "reused-lot" | "self-issued" | "mismatched" | "undated" | "stale";

export interface CoaFlag {
  kind: CoaFlagKind;
  severity: "high" | "medium";
  label: string;
  detail: string;
}

import type { SqlConnection } from "@/server/db/client";
import { newId } from "@/server/db/ids";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

// Rough "printed date is at least `years` old" test. Accepts bare years and common formats.
function yearOf(s: string): number | null {
  const m = s.match(/(20\d{2})/);
  return m ? Number(m[1]) : null;
}

const MONTHS = "jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec";

/**
 * Whether a `batch_code` value is actually a lot number.
 *
 * Source pages offer whatever they offer, and what lands in this field is often the analysis
 * DATE — "2025-10-06", "3rd June 2026", or a bare "2026". Grouping on those makes unrelated
 * products look like one production run, and the reused-lot flag then says in the vendor's own
 * name that their certificates are a template rather than real per-batch testing. Over the real
 * corpus that was three of four reused-lot flags: false accusations about real businesses.
 *
 * The test is whether the value is ENTIRELY a date. A genuine lot that happens to embed one
 * ("RT30/2026-04-06A") is still a lot, and must keep counting — blinding the detector is the
 * failure in the other direction.
 */
export function looksLikeLotNumber(lot: string | null | undefined): lot is string {
  const s = (lot ?? "").trim();
  if (!s || /^n\/?a$/i.test(s)) return false;
  if (/^\d{4}$/.test(s)) return false;                                             // bare year
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(s)) return false;                     // 2025-10-06
  if (/^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(s)) return false;                   // 06/10/2025
  if (new RegExp(`^\\d{1,2}(st|nd|rd|th)?\\s+(${MONTHS})[a-z]*\\.?\\s+\\d{2,4}$`, "i").test(s)) return false;  // 3rd June 2026
  if (new RegExp(`^(${MONTHS})[a-z]*\\.?\\s+\\d{1,2}(st|nd|rd|th)?,?\\s*\\d{2,4}$`, "i").test(s)) return false; // June 3 2026
  if (new RegExp(`^(${MONTHS})[a-z]*\\.?\\s+\\d{4}$`, "i").test(s)) return false;                                  // June 2026
  return true;
}

/**
 * Derive integrity flags for one vendor from the certificates it publishes.
 * `nowYear` is passed in (no ambient clock) so callers control staleness cut-off.
 */
export function detectVendorCoaFlags(vendorName: string, coas: PostedCoa[], nowYear: number): CoaFlag[] {
  if (coas.length === 0) return [];
  const flags: CoaFlag[] = [];
  const vTok = norm(vendorName);

  // 1. Reused lot — one batch/lot number spanning several distinct compounds is a template,
  //    not per-batch testing. A real lot is one manufacturing run of one product.
  const byLot = new Map<string, Set<string>>();
  for (const c of coas) {
    if (!looksLikeLotNumber(c.lot)) continue;
    const set = byLot.get(c.lot) ?? new Set<string>();
    set.add(c.compound);
    byLot.set(c.lot, set);
  }
  const worstLot = [...byLot.entries()].sort((a, b) => b[1].size - a[1].size)[0];
  if (worstLot && worstLot[1].size >= 3) {
    flags.push({ kind: "reused-lot", severity: "high", label: "Reused lot number", detail: `The same lot number (${worstLot[0]}) appears on ${worstLot[1].size} different products. One lot is a single production run of one product — reusing it across a catalog means the certificate is a template, not real per-batch testing.` });
  }

  // 2. Self-issued — the "lab" on the certificate is the vendor itself. Not independent.
  const selfIssued = coas.filter((c) => c.lab && norm(c.lab).includes(vTok)).length;
  if (selfIssued > 0 && selfIssued >= coas.length / 2) {
    flags.push({ kind: "self-issued", severity: "high", label: "Self-issued certificate", detail: `${vendorName}'s certificates are issued by its own in-house lab, not an independent third party. A vendor testing itself and publishing the result is not independent verification.` });
  }

  // 3. Mismatched — the certificate pictures a different compound than the product it's on.
  const mismatched = coas.filter((c) => c.coaProduct && norm(c.coaProduct) !== norm(c.compound));
  if (mismatched.length > 0) {
    const ex = mismatched[0];
    flags.push({ kind: "mismatched", severity: "high", label: "Certificate doesn't match the product", detail: `${mismatched.length} of this vendor's certificates picture a different compound than the product they're attached to (e.g. a ${ex.coaProduct} certificate shown on the ${ex.compound.replace(/-/g, " ")} listing). A COA for another product proves nothing about this one.` });
  }

  // 4. Undated — certificates with no analysis date can't be tied to any current or past batch.
  const dated = coas.filter((c) => c.testedAt && yearOf(c.testedAt) != null);
  if (dated.length === 0) {
    flags.push({ kind: "undated", severity: "medium", label: "No test dates", detail: `None of this vendor's certificates carry an analysis date, so there's no way to know when — or whether — the tested material relates to what's for sale now.` });
  } else {
    // 5. Stale — all dated certificates are years old.
    const years = dated.map((c) => yearOf(c.testedAt!)!).filter((y) => y > 0);
    const newest = years.length ? Math.max(...years) : null;
    if (newest != null && nowYear - newest >= 2) {
      flags.push({ kind: "stale", severity: "medium", label: "Certificates are years out of date", detail: `The newest certificate this vendor publishes is from ${newest}. A years-old COA describes a batch long gone — it says nothing about the stock shipping today.` });
    }
  }

  return flags;
}

// ---- persistence ----

/** Replace a vendor's integrity flags (idempotent per vendor+kind). */
export async function writeVendorFlags(db: SqlConnection, vendorSlug: string, flags: CoaFlag[]): Promise<void> {
  await db.query(`DELETE FROM vendor_flags WHERE vendor_slug=$1`, [vendorSlug]);
  for (const f of flags) {
    await db.query(
      `INSERT INTO vendor_flags (id, vendor_slug, kind, severity, label, detail, origin)
       VALUES ($1,$2,$3,$4,$5,$6,'live')
       ON CONFLICT (vendor_slug, kind) DO UPDATE SET severity=EXCLUDED.severity, label=EXCLUDED.label, detail=EXCLUDED.detail, updated_at=NOW()`,
      [newId("vflag"), vendorSlug, f.kind, f.severity, f.label, f.detail],
    );
  }
}

/** All integrity flags for one vendor, most severe first. */
export async function getVendorFlags(db: SqlConnection, vendorSlug: string): Promise<CoaFlag[]> {
  const rows = (await db.query<{ kind: CoaFlagKind; severity: "high" | "medium"; label: string; detail: string }>(
    `SELECT kind, severity, label, detail FROM vendor_flags WHERE vendor_slug=$1 ORDER BY CASE severity WHEN 'high' THEN 0 ELSE 1 END`,
    [vendorSlug],
  )).rows;
  return rows.map((r) => ({ kind: r.kind, severity: r.severity, label: r.label, detail: r.detail }));
}

/** Set of vendor slugs that carry at least one flag — for cheap listing-level lookups. */
export async function getFlaggedVendorSlugs(db: SqlConnection): Promise<Set<string>> {
  const rows = (await db.query<{ vendor_slug: string }>(`SELECT DISTINCT vendor_slug FROM vendor_flags`)).rows;
  return new Set(rows.map((r) => r.vendor_slug));
}
