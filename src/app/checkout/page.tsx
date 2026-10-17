import { permanentRedirect } from "next/navigation";

// Quarantined: VialGrade publishes records only and does not process purchases.
export default function CheckoutPage() {
  permanentRedirect("/market");
}
