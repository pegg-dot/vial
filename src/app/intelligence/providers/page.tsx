import { permanentRedirect } from "next/navigation";

// The supplier documentation profiles are a section of Material checks; each profile keeps its
// own page under /intelligence/providers/[slug].
export default function ResearchProvidersRedirect() {
  permanentRedirect("/intelligence/materials#material-providers");
}
