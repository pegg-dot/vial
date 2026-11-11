import { permanentRedirect } from "next/navigation";

// The supplier-grades lens was a second vendor surface. Vendor grades, with their evidence, live in
// the vendor directory; this address only forwards there.
export default function SuppliersPage() {
  permanentRedirect("/vendors");
}
