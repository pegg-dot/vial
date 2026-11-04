import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, CheckCircle2, FileSearch, GitCompareArrows, ClipboardCheck } from "lucide-react";
import {
  compareExplorerHref, registryDiscoveryUrl, researchSubjectBySlug,
  researchThemeById, RESEARCH_SUBJECTS, verifiedPubmedSearchUrl,
} from "@/lib/research-explorer";
import { DossierPerspective } from "@/components/intelligence/dossier-perspective";
import { ResearchSubjectArt } from "@/components/intelligence/research-subject-art";
import { ResearchFileGradeCard, ResearchFileGradeMark } from "@/components/intelligence/research-file-grade";
import { gradeResearchFile } from "@/lib/research-file-grade";
import { DossierTrialEvidence, TrialEvidenceLoading } from "@/components/intelligence/dossier-trial-evidence";
import { DossierOrganizations, OrganizationsLoading } from "@/components/intelligence/dossier-organizations";
import { DossierSection, DossierToc } from "@/components/intelligence/dossier-layout";
import { PexEvidenceClaimGrid, PexEvidenceWayfinder, PexSourceRegister } from "@/components/intelligence/pexiganan-evidence";
import { PexigananResearchWorkspace } from "@/components/intelligence/pexiganan-research-workspace";
import { PexTrialNetworkLive, PexTrialNetworkLoading } from "@/components/intelligence/pexiganan-trial-network";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const subject = researchSubjectBySlug(slug);
  return {
    title: subject ? subject.name + " research dossier | VialGrade" : "Research subject unavailable | VialGrade",
    description: subject ? "Explore " + subject.name + " identity, scientific questions and source starting points." : undefined,
    robots: { index: false, follow: false },
  };
}

export default async function ResearchDossierPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const subject = researchSubjectBySlug(slug);
  if (!subject) notFound();
  const theme = researchThemeById(subject.theme);
  const file = gradeResearchFile(subject);
  const related = RESEARCH_SUBJECTS.filter(other => other.theme === subject.theme && other.slug !== slug).slice(0, 3);
  const isPex = subject.slug === "pexiganan";

  // The same six sections, in the same order, on every dossier.
  const toc = [
    { id: "overview", label: "Overview" },
    { id: "file-grade", label: "Source file" },
    { id: "studies", label: "Studies" },
    { id: "sources", label: "Sources" },
    { id: "material-evidence", label: "Materials" },
    { id: "related", label: "Limits and related" },
  ] as const;
  const quiet = "rounded-[14px] border border-[#111214]/15 bg-[#fbfbf8] p-5";

  return (
    <div className="pb-24">
      <div className="mx-auto max-w-[1320px] px-5 pt-8 sm:px-8">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#4a4d56]">
          <Link href="/intelligence/market" className="hover:text-[#2b31d8] hover:underline">Research Market</Link>
          <span aria-hidden="true">/</span>
          <Link href={"/intelligence/market?theme=" + subject.theme + "#browse"} className="hover:text-[#2b31d8] hover:underline">{theme.name}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-[#111214]">{subject.name}</span>
        </nav>

        <section aria-label={subject.name + " summary"} className="ink hard mt-5 overflow-hidden rounded-[22px] bg-white">
          <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
            <div className="border-b-2 border-[#111214] lg:border-b-0 lg:border-r-2 [&>div]:border-b-0 lg:[&>div]:h-full" style={{ backgroundColor: theme.tint }}>
              <ResearchSubjectArt subject={subject} hero />
            </div>
            <div className="px-6 pb-7 pt-7 sm:px-9 sm:pb-8 sm:pt-8">
              <div className="flex flex-wrap items-center gap-3">
                <span className="ink-1 rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-[.1em]" style={{ backgroundColor: theme.tint, color: theme.color }}>{theme.name}</span>
                <span className="text-xs font-semibold text-[#4a4d56]">Curated identity source · 18 Oct 2026</span>
              </div>
              <h1 className="mt-4 text-balance text-[clamp(2.6rem,6vw,4.75rem)] font-extrabold leading-[.92] tracking-[-.055em] text-[#111214]">{subject.name}</h1>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {isPex && <span className="ink-1 rounded-full bg-[#e6fbf6] px-3 py-1.5 text-xs font-extrabold text-[#0b6b60]">{file.linkedCount} of 3 research source types on file</span>}
                <ResearchFileGradeMark subject={subject} withCount />
              </div>
              <p className="mt-2 max-w-2xl text-xs font-medium leading-5 text-[#4a4d56]">This letter describes linked source types in our file, not how promising or safe the compound is.</p>
              <p className="mt-4 max-w-3xl text-base font-medium leading-7 text-[#3a3d46]">{subject.identity}</p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <a href={isPex ? "#research-workspace" : "#overview"}
                  className="ink hard-sm press inline-flex min-h-11 items-center gap-2 rounded-full bg-[#2b31d8] px-5 text-sm font-extrabold text-white">
                  {isPex ? "Investigate the evidence" : "Start with the research question"} <ArrowRight className="size-4" />
                </a>
                <a href={subject.referenceUrl} target="_blank" rel="noopener noreferrer"
                  className="ink hard-sm press inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-5 text-sm font-extrabold">
                  Inspect molecular identity <ArrowUpRight className="size-4" />
                </a>
                <Link href={compareExplorerHref([subject.slug, related[0]?.slug].filter(Boolean), "researcher")}
                  className="ink hard-sm press inline-flex min-h-11 items-center gap-1.5 rounded-full bg-white px-5 text-sm font-extrabold">
                  <GitCompareArrows className="size-4" /> Compare with {related[0]?.name}
                </Link>
              </div>
            </div>
          </div>
          <dl className="grid border-t-2 border-[#111214] bg-[#e6fbf6] sm:grid-cols-3">
            {[
              ["What is this?", "A curated identity file, not a material listing."],
              ["What is linked?", file.linkedCount + " of 3 research source types in this file."],
              ["What is not verified?", "Clinical benefit or any physical sample."],
            ].map(([term, text], index) => (
              <div key={term} className={"px-6 py-4 " + (index < 2 ? "border-b border-[#111214]/15 sm:border-b-0 sm:border-r" : "")}>
                <dt className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#0b6b60]">{term}</dt>
                <dd className="mt-1 text-sm font-bold text-[#111214]">{text}</dd>
              </div>
            ))}
          </dl>
        </section>

        {isPex && <div className="mt-7"><PexigananResearchWorkspace /></div>}

        <div className="mt-6 grid grid-cols-1 items-start gap-x-8 gap-y-5 lg:grid-cols-[210px_minmax(0,1fr)]">
          <DossierToc items={toc} />
          <div className="min-w-0 space-y-7">
            <DossierSection id="overview" number={1} eyebrow="Overview" title={subject.studyQuestion}
              intro={"Start by checking studies of " + subject.mechanism.toLowerCase() + ", rather than inferring clinical outcomes or experiment suitability from the molecule name."}>
              <DossierPerspective research={subject.scientistAngle} analyst={subject.analystAngle} />
              <dl className="grid gap-4 sm:grid-cols-3">
                <div><dt className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#4a4d56]">Research area</dt><dd className="mt-1 text-sm font-bold">{theme.short}</dd></div>
                <div><dt className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#4a4d56]">Mechanism</dt><dd className="mt-1 text-sm font-bold">{subject.mechanism}</dd></div>
                <div><dt className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#4a4d56]">Identity reference</dt><dd className="mt-1 text-sm font-bold">{subject.referenceLabel}</dd></div>
              </dl>
            </DossierSection>

            <DossierSection id="file-grade" number={2} eyebrow="Source file" title="Which source types are linked"
              intro="A letter for how many kinds of original source sit in our file. It is about coverage, not about the compound.">
              <ResearchFileGradeCard subject={subject} />
            </DossierSection>

            <DossierSection id="studies" number={3} eyebrow="Studies" title="What the registered studies record"
              intro="Original registry facts and exact citation links. A registered study is not a result.">
              {isPex && <PexEvidenceClaimGrid compact />}
              {isPex ? (
                <Suspense fallback={<PexTrialNetworkLoading />}><PexTrialNetworkLive /></Suspense>
              ) : subject.sampleTrial ? (
                <Suspense fallback={<TrialEvidenceLoading nctId={subject.sampleTrial} />}><DossierTrialEvidence subject={subject} /></Suspense>
              ) : (
                <p className={quiet + " text-sm font-medium leading-7 text-[#3a3d46]"}>No registered study is pinned to {subject.name} in this file yet. Use the registry search under Sources to look for one.</p>
              )}
              {subject.sampleTrial && (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-extrabold text-[#2b31d8]">
                  <Link href={"/intelligence/studies/" + subject.sampleTrial} className="inline-flex min-h-6 items-center gap-1 hover:underline">Audit this trial <ArrowUpRight className="size-4" /></Link>
                  {subject.legacyTopic && <Link href={"/intelligence/" + subject.legacyTopic} className="inline-flex min-h-6 items-center gap-1 hover:underline">Additional source samples <ArrowUpRight className="size-4" /></Link>}
                </div>
              )}
              {(isPex || subject.slug === "magainin-2") && (
                <div className={quiet}>
                  <h3 className="text-base font-extrabold tracking-[-.02em]">Guided source review · Magainin 2 vs pexiganan</h3>
                  <p className="mt-2 text-sm font-medium leading-6 text-[#3a3d46]">Follow an original lipid-bilayer experiment to a separately registered clinical trial. See which observations come from which source, and why the compounds cannot be treated as interchangeable.</p>
                  <Link href="/intelligence/cases/magainin-pexiganan" className="mt-3 inline-flex min-h-6 items-center gap-2 text-sm font-extrabold text-[#2b31d8] hover:underline">
                    Open guided evidence workpaper <ArrowRight className="size-4" />
                  </Link>
                </div>
              )}
            </DossierSection>

            <DossierSection id="sources" number={4} eyebrow="Sources" title="Follow the source trail"
              intro="Every row links to the original record. Search results have not been individually evaluated as evidence.">
              {isPex ? <PexSourceRegister /> : (
                <ul className="divide-y divide-[#111214]/10 rounded-[14px] border border-[#111214]/15">
                  {[
                    { href: subject.referenceUrl, icon: CheckCircle2, title: "Molecular identity", note: subject.referenceLabel + " · Checked 18 Oct 2026", action: "Open PubChem" },
                    { href: verifiedPubmedSearchUrl(subject), icon: BookOpen, title: "Find original publications", note: "PubMed search. Mentions and reviews are not necessarily direct trial results.", action: "Search PubMed" },
                    { href: registryDiscoveryUrl(subject), icon: FileSearch, title: "Find registered studies", note: "Registry keyword search. Returned trials may study another compound or a combination.", action: "Search ClinicalTrials.gov" },
                  ].map(({ href, icon: Icon, title, note, action }) => (
                    <li key={title}>
                      <a href={href} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 px-5 py-4 hover:bg-[#eef0ff]">
                        <Icon className="mt-0.5 size-5 shrink-0 text-[#2b31d8]" aria-hidden="true" />
                        <span className="min-w-0"><span className="block text-sm font-extrabold">{title}</span><span className="mt-0.5 block text-xs font-medium leading-5 text-[#4a4d56]">{note}</span><span className="mt-1.5 inline-flex items-center gap-1 text-xs font-extrabold text-[#2b31d8]">{action} <ArrowUpRight className="size-3.5" aria-hidden="true" /></span></span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
              <Suspense fallback={<OrganizationsLoading />}><DossierOrganizations subject={subject} /></Suspense>
            </DossierSection>

            <DossierSection id="material-evidence" number={5} eyebrow="Materials" title="Sample verification: not yet authenticated"
              intro="The molecular record and the file letter do not establish the identity, authenticity or analytical quality of a physical lot.">
              <div className="flex flex-wrap items-center gap-3">
                <Link href={"/intelligence/materials?subject=" + encodeURIComponent(subject.slug)}
                  className="ink hard-sm press inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-extrabold">
                  <ClipboardCheck className="size-4" aria-hidden="true" /> Open material checks <ArrowRight className="size-4" />
                </Link>
                <Link href="/intelligence/providers" className="inline-flex min-h-11 items-center gap-1 text-sm font-extrabold text-[#2b31d8] hover:underline">Company-published QC documentation <ArrowUpRight className="size-4" /></Link>
                {isPex && <Link href="/intelligence/desk" className="inline-flex min-h-11 items-center gap-1 text-sm font-extrabold text-[#2b31d8] hover:underline">Build a briefing in the Research Desk <ArrowUpRight className="size-4" /></Link>}
              </div>
            </DossierSection>

            <DossierSection id="related" number={6} eyebrow="Limits and related" title="What still needs checking">
              <p className="text-sm font-medium leading-7 text-[#3a3d46]">{subject.identityCaveat}</p>
              <p className="text-sm font-medium leading-7 text-[#3a3d46]">{subject.nextReview}</p>
              <div>
                <h3 className="text-[11px] font-extrabold uppercase tracking-[.12em] text-[#4a4d56]">Related research directions</h3>
                <ul className="mt-2 divide-y divide-[#111214]/10 rounded-[14px] border border-[#111214]/15">
                  {related.map(other => (
                    <li key={other.slug}><Link href={"/intelligence/explore/" + other.slug} className="flex min-h-11 items-center justify-between gap-3 px-5 py-3 text-sm font-extrabold hover:bg-[#eef0ff]">{other.name} <ArrowRight className="size-4 text-[#2b31d8]" aria-hidden="true" /></Link></li>
                  ))}
                </ul>
                <Link href="/intelligence/market#browse" className="mt-3 inline-flex min-h-6 items-center gap-1 text-xs font-extrabold text-[#2b31d8] hover:underline"><ArrowLeft className="size-3" aria-hidden="true" /> Back to discovery</Link>
              </div>
            </DossierSection>

            {isPex && <div id="pexiganan-network" className="scroll-mt-36"><PexEvidenceWayfinder /></div>}
            <p className="max-w-4xl text-xs font-medium leading-6 text-[#4a4d56]">
              Editorial research starting points, not grades of clinical effectiveness or material quality. Company-published supplier QC information is separate and unverified; no prices, purchases or recommendations for human consumption.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
