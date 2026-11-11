import { permanentRedirect } from "next/navigation";

// The sponsors named on pexiganan's selected registrations are on the pexiganan page's source
// trail (Organizations on record); this pilot page said the same thing on its own address.
export default function ResearchOrganizationsRedirect() {
  permanentRedirect("/compounds/pexiganan#organizations");
}
