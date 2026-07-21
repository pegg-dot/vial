import { permanentRedirect } from "next/navigation";

// The methodology content moved to the consolidated buyer-facing proof page.
export default function MethodologyPage() {
  permanentRedirect("/how-we-check");
}
