import { permanentRedirect } from "next/navigation";

// Quarantined: affiliate-out means VialGrade never runs checkout. The commerce/checkout code
// stays in the repo as a dormant simulation; this route redirects to the market.
export default function CheckoutPage() {
  permanentRedirect("/market");
}
