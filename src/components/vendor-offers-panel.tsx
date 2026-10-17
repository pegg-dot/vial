import type { VendorOffer } from "@/server/external/repository";

// No public coupons, promotion codes, or purchase incentives during the
// evidence-only compliance review. Historical data remains in backend records.
export function VendorOffersPanel({ offers, vendorName }: { offers: VendorOffer[]; vendorName: string }) {
  void offers;
  void vendorName;
  return null;
}
