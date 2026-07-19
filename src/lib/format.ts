import type { EvidenceLevel, VendorStatus } from "./types";

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
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
