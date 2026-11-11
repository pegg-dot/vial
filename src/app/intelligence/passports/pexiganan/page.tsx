import { permanentRedirect } from "next/navigation";

// One page per compound. The evidence passport is the Studies section of the pexiganan page now
// (the plain-language answer, the six checks with their #evidence-claim-* anchors, the live registry rows).
export default function PexigananEvidencePassportRedirect() {
  permanentRedirect("/compounds/pexiganan#studies");
}
