import { permanentRedirect } from "next/navigation";

// Quarantined: no cart, no peptide checkout, no outbound affiliate or seller referral.
export default function CartPage() {
  permanentRedirect("/market");
}
