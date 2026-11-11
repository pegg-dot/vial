import { notFound, permanentRedirect } from "next/navigation";
import { researchSubjectBySlug } from "@/lib/research-explorer";

// One page per compound: the research dossier lives at /compounds/<slug>. This address only forwards.
export default async function ResearchDossierRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!researchSubjectBySlug(slug)) notFound();
  permanentRedirect("/compounds/" + slug);
}
