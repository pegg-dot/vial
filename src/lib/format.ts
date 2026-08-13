import type { EvidenceLevel, VendorStatus } from "./types";

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

// Normalize a listing to price-per-milligram so buyers can actually compare
// "$40 / 5mg" against "$55 / 10mg" — the single most useful comparison, and the one
// a non-expert can't do in their head. Returns undefined when the quantity has no
// parseable mg (tablets, water, kits, etc.).
// Every mass unit vendors actually print on a size. Beyond mg/mcg this covers two shapes that were
// silently unreadable and cost real coverage: bulk powders sold in GRAMS ("DIHEXA POWDER (1 GRAM)",
// "NAD+ … Powder, 10 grams") and the size attribute spelled out in words, which is how
// umbrellalabs.is writes every one of its options ("10 Milligrams", "2 Milligrams").
const MASS_UNIT = String.raw`(mg|mcg|µg|milligrams?|micrograms?|grams?|g)`;

/** Build a size regex from a pattern using `{U}` where the mass unit goes. */
function massRe(pattern: string, flags = "i"): RegExp {
  return new RegExp(pattern.replace(/\{U\}/g, MASS_UNIT), flags);
}

function unitToMg(n: string, unit: string): number {
  const v = Number(n);
  const u = unit.toLowerCase();
  if (u === "mcg" || u === "µg" || u.startsWith("microgram")) return v / 1000;
  if (u === "g" || u.startsWith("gram")) return v * 1000;
  return v;
}

// A single declared strength, in mg (mcg and grams are converted). The primitive used by
// parseTotalMg. `g` is deliberately excluded when it is a molecular-weight unit ("1419.556 g/mol"),
// which vendors print in the same spec tables that carry the real size.
export function parseMg(quantity: string): number | undefined {
  if (!quantity) return undefined;
  const m = quantity.match(massRe(String.raw`(\d+(?:\.\d+)?)\s*{U}\b(?!\s*\/\s*mol)`));
  return m ? unitToMg(m[1], m[2]) : undefined;
}

// The TOTAL milligrams a listing actually delivers — read from the quantity AND the product name,
// because peptides ship as capsule/tablet bottles, multi-vial packs, and stated "total bottle"
// amounts, not just single vials. Cost-per-mg (and every comparison built on it) rides on this, so a
// wrong number here mis-flags an entire listing (e.g. a "0.5mg/capsule × 60" bottle looks 50× too
// pricey if only the per-capsule 0.5mg is read). When the size is genuinely ambiguous — a listing
// that bundles several sizes, or a capsule bottle with no stated count — it returns undefined so the
// UI shows NO cost-per-mg rather than a confidently-wrong one.
export function parseTotalMg(quantity: string | undefined, name = ""): number | undefined {
  const text = `${name} ${quantity ?? ""}`.replace(/\s+/g, " ").trim();
  if (!text) return undefined;
  const strengths = [...text.matchAll(massRe(String.raw`(\d+(?:\.\d+)?)\s*{U}\b(?!\s*\/\s*mol)`, "gi"))];
  const distinct = [...new Set(strengths.map((m) => unitToMg(m[1], m[2])))];

  // 1) An explicitly stated total ("… 120MG TOTAL BOTTLE", "TOTAL: 30 mg") wins outright.
  const total = text.match(massRe(String.raw`(\d+(?:\.\d+)?)\s*{U}\s*total\b`))
             || text.match(massRe(String.raw`\btotal[^0-9]{0,12}(\d+(?:\.\d+)?)\s*{U}\b`));
  if (total) return unitToMg(total[1], total[2]);

  // 2) Liquids: total = concentration × volume. "25mg/ml @ 30ml" or "25mg × 30ml" = 750mg, NOT 25mg.
  //    Vendors write the concentration both ways — "25 mg/mL" and "10mL bottle @ 1mg per mL" are the
  //    same statement, and only the first was being read.
  const vol = text.match(/(\d+(?:\.\d+)?)\s*m[lL]\b/);
  if (vol) {
    const v = Number(vol[1]);
    const conc = text.match(massRe(String.raw`(\d+(?:\.\d+)?)\s*{U}\s*(?:\/|per)\s*m[lL]\b`))                 // "25 mg/ml", "1mg per mL"
              || text.match(massRe(String.raw`(\d+(?:\.\d+)?)\s*{U}\s*(?:x|×)\s*\d+(?:\.\d+)?\s*m[lL]\b`));   // "25mg × 30ml"
    if (conc && v > 0) return unitToMg(conc[1], conc[2]) * v;
    const dissolved = text.match(massRe(String.raw`(\d+(?:\.\d+)?)\s*{U}\s+in\s+\d`));                        // "5mg in 5ml" = 5mg total
    if (dissolved) return unitToMg(dissolved[1], dissolved[2]);
    if (strengths.length) return undefined;                                                                   // strength + volume but unclear → no guess
  }
  if (/(?:\/|per)\s*m[lL]\b/i.test(text)) return undefined;                                                   // a concentration with no volume = unknown total

  // 3) Per-unit strength × a unit count (capsule/tablet bottles, multi-vial packs).
  //    The count is written with a hyphen as often as a space ("10-vial kit") and capsule bottles
  //    are counted in "ct" ("50mg capsule/60ct/3000mg"); both were silently unreadable.
  const count = text.match(/(\d+)[\s-]*(?:capsules?|caps?|tablets?|tabs?|softgels?|servings?|vials?|bottles?|ct)\b/i)
             || text.match(/(?:x|×)\s*(\d+)\b/i)
             || text.match(/\b(\d+)\s*(?:x|×)\b/i);
  if (count) {
    const n = Number(count[1]);
    // "0.5mg/capsule", "300mcg per tablet" and "5 mg/vial" are the vendor stating a PER-UNIT
    // strength. Bare adjacency ("50mg capsule/60ct") counts only for capsule/tablet units: a bare
    // "100MG VIAL" is the whole listing, not one unit of a pack, and reading it as per-unit would
    // multiply a plain vial by a stray count.
    const per = text.match(massRe(String.raw`(\d+(?:\.\d+)?)\s*{U}\s*(?:\/|per)\s*(?:capsules?|caps?|tablets?|tabs?|softgels?|servings?|vials?)\b`))
             || text.match(massRe(String.raw`(\d+(?:\.\d+)?)\s*{U}\s+(?:capsules?|caps?|tablets?|tabs?|softgels?)\b`));
    if (per && n >= 1) return unitToMg(per[1], per[2]) * n;
    if (distinct.length === 1 && n > 1) return distinct[0] * n;
    if (distinct.length > 1) return undefined;   // multi-strength pack (e.g. a two-compound combo) — ambiguous
  }

  // 4) Trust a clean single-strength DECLARED QUANTITY as this listing's size — it's the size the
  //    price is actually for. Skip when the name shows a capsule/tablet/liquid container (whose real
  //    total is handled above), so a size-range in a product title ("… 2mg/5mg vial") no longer
  //    blanks a listing whose own quantity says exactly which size it is.
  const qMg = parseMg(quantity ?? "");
  const qSingle = qMg != null && [...(quantity ?? "").matchAll(massRe(String.raw`(\d+(?:\.\d+)?)\s*{U}\b`, "gi"))].length === 1;
  const container = /\b(?:capsules?|tablets?|tabs?|softgels?)\b/i.test(text) || /\d\s*m[lL]\b/.test(text);
  if (qSingle && !container) return qMg;

  // 5) Two or more different strengths and nothing above resolved them: a blend ("5mg + 5mg (10mg)"),
  //    a size range ("2mg/5mg vial"), a multi-compound kit. Which one this listing's price buys is
  //    unknowable, so it gets NO cost-per-mg — reading the first number would have priced a 10mg
  //    blend as 5mg.
  if (distinct.length > 1) return undefined;

  // 6) A capsule/tablet container with no stated count — total is unknown, so no per-mg.
  if (/\b(?:capsules?|tablets?|tabs?|softgels?)\b/i.test(text) && strengths.length && !count) return undefined;

  // 7) The common case: a single stated strength (one vial).
  return qMg ?? (distinct.length === 1 ? distinct[0] : undefined);
}

export function pricePerMg(price: number, quantity: string, name = ""): number | undefined {
  const mg = parseTotalMg(quantity, name);
  if (!mg || mg <= 0 || !Number.isFinite(price) || price <= 0) return undefined;
  return price / mg;
}

export function formatPricePerMg(value: number): string {
  return `$${value < 1 ? value.toFixed(2) : value.toFixed(value < 10 ? 2 : 1)}/mg`;
}

export function evidenceTone(level: EvidenceLevel) {
  switch (level) {
    case "independent":
      return "emerald";
    case "issuer-confirmed":
      return "violet";
    case "vendor-published":
      return "blue";
    case "stale":
      return "amber";
    default:
      return "neutral";
  }
}

export function vendorStatusLabel(status: VendorStatus) {
  switch (status) {
    case "participating":
      return "Participating seller";
    case "claimed":
      return "Claimed profile";
    default:
      return "Independent profile";
  }
}

/**
 * Human "how long ago" from a real timestamp.
 *
 * `listings.last_checked` is a stored literal that said "just now" on all 537 live listings while
 * the vendor pages beside them read "Updated 2026-08-05". The timestamp to tell the truth from
 * (`observed_at`) was already on the row — it just was not being used.
 */
export function relativeTime(value: string | Date | null | undefined, now: Date = new Date()): string | null {
  if (!value) return null;
  const then = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(then.getTime())) return null;
  const seconds = Math.round((now.getTime() - then.getTime()) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 90) return "just now";
  const units: [limit: number, secs: number, name: string][] = [
    [60 * 60, 60, "minute"],
    [60 * 60 * 24, 60 * 60, "hour"],
    [60 * 60 * 24 * 30, 60 * 60 * 24, "day"],
    [60 * 60 * 24 * 365, 60 * 60 * 24 * 30, "month"],
    [Infinity, 60 * 60 * 24 * 365, "year"],
  ];
  for (const [limit, secs, name] of units) {
    if (seconds < limit) {
      const n = Math.max(1, Math.floor(seconds / secs));
      return `${n} ${name}${n === 1 ? "" : "s"} ago`;
    }
  }
  return null;
}

/**
 * Whole days since an ISO timestamp, or null if there isn't one.
 *
 * The clock read lives here rather than in a component: a page computing `Date.now()` inline is
 * flagged as impure render, and this value legitimately depends on request time.
 */
export function daysSince(value: string | Date | null | undefined, now: Date = new Date()): number | null {
  if (!value) return null;
  const then = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((now.getTime() - then.getTime()) / 86_400_000);
}
