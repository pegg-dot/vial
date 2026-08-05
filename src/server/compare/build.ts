import { getCatalogSnapshot } from "@/server/catalog/repository";
import { getDatabase } from "@/server/db/client";
import { formatCurrency, formatPricePerMg } from "@/lib/format";
import { vendorPriceIndex, valueVsMarketPerMg } from "@/lib/curation";
import { markWinners, type CompareEntry, type CompareCell } from "@/lib/compare-model";
import { composeVerdictForVendorSlug } from "@/server/verify/trust-graph";
import { getVendorAggregatorRatings } from "@/server/external/repository";
import { getVendorRegulatoryActions } from "@/server/regulatory/repository";
import { getLabTestsForVendor } from "@/server/ingest/lab-tests";
import { crossCheckCoa } from "@/server/verify/coa-cross-check";
import type { Product, Vendor } from "@/lib/types";

const VERDICT_RANK: Record<string, number> = { trusted: 4, unproven: 2, info: 2, caution: 1, "high-risk": 0, avoid: -1 };
const VERDICT_LABEL: Record<string, string> = { trusted: "Trusted", caution: "Caution", unproven: "Unproven", info: "For info", "high-risk": "High risk", avoid: "Avoid" };
const VERDICT_TONE: Record<string, CompareCell["tone"]> = { trusted: "good", caution: "warn", unproven: "warn", info: "neutral", "high-risk": "bad", avoid: "bad" };

// Assemble a deep, decision-oriented comparison for up to 4 listings: every graded/hidden
// dimension filled from real data, each numeric value judged against the compound's market
// baseline (base rate), then best/worst marked across the compared set.
export async function buildComparison(slugs: string[]): Promise<{ entries: CompareEntry[] }> {
  const wanted = slugs.slice(0, 4);
  const [{ products, vendors, compounds }, db] = await Promise.all([getCatalogSnapshot(), getDatabase()]);
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const vendorBySlug = new Map(vendors.map((v) => [v.slug, v]));
  const compoundBySlug = new Map(compounds.map((c) => [c.slug, c]));
  const selected = wanted.map((s) => bySlug.get(s)).filter((p): p is Product => Boolean(p));

  // Per-vendor signals, fetched once per distinct vendor.
  const vendorSignals = new Map<string, { verdict: string; trustpilot: number | null; enforcement: { severity: string } | null; blind: number; priceIndex: number | null }>();
  for (const vslug of new Set(selected.map((p) => p.vendorSlug))) {
    const [verdict, aggregators, enforcement, labTests] = await Promise.all([
      composeVerdictForVendorSlug(vslug).catch(() => null),
      getVendorAggregatorRatings(vslug, db).catch(() => []),
      getVendorRegulatoryActions(vslug, db).catch(() => []),
      getLabTestsForVendor(db, vslug, 24).catch(() => []),
    ]);
    const tp = aggregators.find((a) => a.source === "Trustpilot");
    const vendorListings = products.filter((p) => p.vendorSlug === vslug);
    vendorSignals.set(vslug, {
      verdict: verdict?.composed.verdict ?? "info",
      trustpilot: tp?.score != null ? Number(tp.score) : null,
      enforcement: enforcement.find((e) => e.severity === "severe") ?? enforcement[0] ?? null,
      blind: labTests.filter((t) => t.is_blind).length,
      priceIndex: vendorPriceIndex(vendorListings, products).medianPctVsMarket,
    });
  }

  const entries: CompareEntry[] = [];
  for (const p of selected) {
    const vendor = vendorBySlug.get(p.vendorSlug) as Vendor | undefined;
    const compound = compoundBySlug.get(p.compoundSlug);
    const sig = vendorSignals.get(p.vendorSlug)!;
    // The SAME floored median $/mg the card and product page use (null below MIN_PERMG_PEERS), so all
    // three surfaces show — or withhold — the value verdict in lockstep. Never an ad-hoc thin-market median.
    const medPerMg = compound?.medianPricePerMg ?? null;
    const coa = await crossCheckCoa(db, {
      vendorSlug: p.vendorSlug, vendorName: vendor?.name ?? p.vendorSlug,
      compoundSlug: p.compoundSlug, compoundName: compound?.name ?? p.compoundSlug,
      reportIssuer: p.reportIssuer, reportConfirmed: p.reportConfirmed, batchCode: p.batchCode,
    }).catch(() => null);

    const pct = (v: number | null | undefined, baseline: number | null | undefined) =>
      v != null && baseline && baseline > 0 ? Math.round(((v - baseline) / baseline) * 100) : null;
    // "Value vs market" compares cost-per-mg to the compound's median $/mg — never sticker price,
    // which is size-blind (a 30mg vial looks "expensive" beside 2mg vials). Unknown size → no verdict.
    const vsMed = valueVsMarketPerMg(p.pricePerMg, medPerMg);
    const foundedYear = vendor?.founded && /^\d{4}$/.test(vendor.founded) ? Number(vendor.founded) : null;

    const cells: Record<string, CompareCell> = {
      price: { text: formatCurrency(p.price), num: p.price },
      perMg: p.pricePerMg ? { text: formatPricePerMg(p.pricePerMg), num: p.pricePerMg, baselinePct: pct(p.pricePerMg, medPerMg) } : { text: "—" },
      vsMedian: vsMed != null ? { text: `${vsMed > 0 ? "+" : ""}${vsMed}%`, num: vsMed, tone: vsMed <= 0 ? "good" : "bad" } : { text: "—" },

      tests: { text: String(vendor?.coaCount ?? 0), num: vendor?.coaCount ?? 0 },
      purity: vendor?.medianPurity != null ? { text: `${vendor.medianPurity.toFixed(1)}%`, num: vendor.medianPurity } : { text: "—" },
      evidence: { text: p.evidenceLabel || "—" },

      verdict: { text: VERDICT_LABEL[sig.verdict] ?? sig.verdict, num: VERDICT_RANK[sig.verdict] ?? 2, tone: VERDICT_TONE[sig.verdict] ?? "neutral" },
      trustpilot: sig.trustpilot != null ? { text: `${sig.trustpilot}/5`, num: sig.trustpilot, tone: sig.trustpilot >= 4 ? "good" : sig.trustpilot < 3 ? "bad" : "warn" } : { text: "No profile" },
      reviews: { text: vendor?.reviewCount ? String(vendor.reviewCount) : "—", num: vendor?.reviewCount ?? 0 },
      track: foundedYear ? { text: `Since ${foundedYear}`, num: foundedYear } : { text: vendor?.location || "—" },

      realPerMg: p.trust?.adjustedPricePerMg ? { text: `${formatPricePerMg(p.trust.adjustedPricePerMg)}`, num: p.trust.adjustedPricePerMg, tone: "good" } : { text: "—" },
      tooCheap: p.trust?.priceFlag === "too-cheap" ? { text: "Below market — caution", tone: "bad", num: 0 } : { text: "In range", tone: "good", num: 1 },
      blind: { text: sig.blind ? `${sig.blind} blind` : "None", num: sig.blind, tone: sig.blind > 0 ? "good" : "neutral" },
      enforcement: sig.enforcement ? { text: sig.enforcement.severity === "severe" ? "Severe action" : "On record", num: sig.enforcement.severity === "severe" ? 0 : 1, tone: "bad" } : { text: "None on record", num: 2, tone: "good" },
      batchMatch: coa ? { text: coaLabel(coa.status), num: coaRank(coa.status), tone: coaTone(coa.status) } : { text: "—" },
      vendorPrice: sig.priceIndex != null ? { text: `${sig.priceIndex > 0 ? "+" : ""}${sig.priceIndex}% vs market`, num: sig.priceIndex, tone: sig.priceIndex <= 0 ? "good" : "warn" } : { text: "—" },
    };

    entries.push({
      slug: p.slug, name: p.name, quantity: p.quantity, vendorName: vendor?.name ?? p.vendorSlug, vendorSlug: p.vendorSlug,
      imageUrl: p.origin === "live" ? p.imageUrl : undefined, price: p.price, cells,
    });
  }

  markWinners(entries);
  return { entries };
}

function coaLabel(status: string): string {
  return status === "batch-verified" ? "Batch-verified" : status === "verified" ? "Verified" : status === "mismatch" ? "Mismatch — borrowed COA" : status === "low-purity" ? "Low purity" : status === "unbacked" ? "Unbacked claim" : "No claim";
}
function coaRank(status: string): number {
  return status === "batch-verified" ? 3 : status === "verified" ? 2 : status === "no-claim" ? 1 : 0;
}
function coaTone(status: string): CompareCell["tone"] {
  // low-purity is amber everywhere else (tile chip + product panel); only a borrowed/mismatched
  // certificate is red. Keep compare's severity in step with the rest of the app.
  return status === "batch-verified" || status === "verified" ? "good" : status === "mismatch" ? "bad" : status === "low-purity" ? "warn" : "neutral";
}
