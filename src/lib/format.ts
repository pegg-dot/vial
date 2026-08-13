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
// A single declared strength, in mg (mcg is converted). The primitive used by parseTotalMg.
export function parseMg(quantity: string): number | undefined {
  if (!quantity) return undefined;
  const mg = quantity.match(/(\d+(?:\.\d+)?)\s*mg\b/i);
  if (mg) return Number(mg[1]);
  const mcg = quantity.match(/(\d+(?:\.\d+)?)\s*mcg\b/i);
  if (mcg) return Number(mcg[1]) / 1000;
  return undefined;
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
  const toMg = (n: string, u: string) => Number(n) / (/mcg|µg/i.test(u) ? 1000 : 1);
  const strengths = [...text.matchAll(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg)\b/gi)];
  const distinct = [...new Set(strengths.map((m) => toMg(m[1], m[2])))];

  // 1) An explicitly stated total ("… 120MG TOTAL BOTTLE", "TOTAL: 30 mg") wins outright.
  const total = text.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg)\s*total\b/i)
             || text.match(/\btotal[^0-9]{0,12}(\d+(?:\.\d+)?)\s*(mg|mcg|µg)\b/i);
  if (total) return toMg(total[1], total[2]);

  // 2) Liquids: total = concentration × volume. "25mg/ml @ 30ml" or "25mg × 30ml" = 750mg, NOT 25mg.
  const vol = text.match(/(\d+(?:\.\d+)?)\s*m[lL]\b/);
  if (vol) {
    const v = Number(vol[1]);
    const conc = text.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg)\s*\/\s*m[lL]\b/i)                        // "25 mg/ml"
              || text.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg)\s*(?:x|×)\s*\d+(?:\.\d+)?\s*m[lL]\b/i);   // "25mg × 30ml"
    if (conc && v > 0) return toMg(conc[1], conc[2]) * v;
    const dissolved = text.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg)\s+in\s+\d/i);                        // "5mg in 5ml" = 5mg total
    if (dissolved) return toMg(dissolved[1], dissolved[2]);
    if (strengths.length) return undefined;                                                          // strength + volume but unclear → no guess
  }
  if (/\/\s*m[lL]\b/i.test(text)) return undefined;                                                   // a concentration with no volume = unknown total

  // 3) Per-unit strength × a unit count (capsule/tablet bottles, multi-vial packs).
  const count = text.match(/(\d+)\s*(?:capsules?|caps?|tablets?|tabs?|softgels?|servings?|vials?|bottles?)\b/i)
             || text.match(/(?:x|×)\s*(\d+)\b/i)
             || text.match(/\b(\d+)\s*(?:x|×)\b/i);
  if (count) {
    const n = Number(count[1]);
    const per = text.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg)\s*(?:\/|per)\s*(?:capsule|cap|tablet|tab|softgel|serving|vial)/i);
    if (per && n >= 1) return toMg(per[1], per[2]) * n;
    if (distinct.length === 1 && n > 1) return distinct[0] * n;
    if (distinct.length > 1) return undefined;   // multi-strength pack (e.g. a two-compound combo) — ambiguous
  }

  // 4) Trust a clean single-strength DECLARED QUANTITY as this listing's size — it's the size the
  //    price is actually for. Skip when the name shows a capsule/tablet/liquid container (whose real
  //    total is handled above), so a size-range in a product title ("… 2mg/5mg vial") no longer
  //    blanks a listing whose own quantity says exactly which size it is.
  const qMg = parseMg(quantity ?? "");
  const qSingle = qMg != null && [...(quantity ?? "").matchAll(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg)\b/gi)].length === 1;
  const container = /\b(?:capsules?|tablets?|tabs?|softgels?)\b/i.test(text) || /\d\s*m[lL]\b/.test(text);
  if (qSingle && !container) return qMg;

  // 5) An ambiguous multi-size bundle with no single declared size ("2mg/5mg vial") — no per-mg.
  if (distinct.length > 1 && /\d\s*(?:mg|mcg|µg)?\s*\/\s*\d/i.test(text)) return undefined;

  // 6) A capsule/tablet container with no stated count — total is unknown, so no per-mg.
  if (/\b(?:capsules?|tablets?|tabs?|softgels?)\b/i.test(text) && strengths.length && !count) return undefined;

  // 7) The common case: a single stated strength (one vial).
  return parseMg(quantity ?? "") ?? (distinct.length === 1 ? distinct[0] : undefined);
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
