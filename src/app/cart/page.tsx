import { permanentRedirect } from "next/navigation";

// Quarantined: VialGrade is affiliate-out (buying happens on the vendor's own site), so the
// sandbox cart is no longer part of the buyer path. The commerce code is kept in the
// repo as a dormant simulation; this route just sends buyers back to the market.
export default function CartPage() {
  permanentRedirect("/market");
}
