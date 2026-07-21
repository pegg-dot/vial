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
export function parseMg(quantity: string): number | undefined {
  if (!quantity) return undefined;
  const mg = quantity.match(/(\d+(?:\.\d+)?)\s*mg\b/i);
  if (mg) return Number(mg[1]);
  const mcg = quantity.match(/(\d+(?:\.\d+)?)\s*mcg\b/i);
  if (mcg) return Number(mcg[1]) / 1000;
  return undefined;
}

export function pricePerMg(price: number, quantity: string): number | undefined {
  const mg = parseMg(quantity);
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
