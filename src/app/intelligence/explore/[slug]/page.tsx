import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, CheckCircle2, CircleHelp, FileSearch, FlaskConical, GitCompareArrows, Microscope } from "lucide-react";
import {
  compareExplorerHref, registryDiscoveryUrl, researchSubjectBySlug,
  researchThemeById, RESEARCH_SUBJECTS, verifiedPubmedSearchUrl,
} from "@/lib/research-explorer";
import { DossierPerspective } from "@/components/intelligence/dossier-perspective";

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
  const related = RESEARCH_SUBJECTS.filter(other => other.theme === subject.theme && other.slug !== slug).slice(0, 3);

  return (
    <main className="bg-[#faf9f7] pb-20">
      <div className="mx-auto max-w-[1100px] px-5 pt-8 sm:px-8">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#807e92]">
          <Link href="/intelligence" className="hover:text-[#5445a4] hover:underline">Research Explorer</Link>
          <span aria-hidden="true">/</span>
          <Link href="/intelligence#explore" className="hover:text-[#5445a4] hover:underline">{theme.name}</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page" className="text-[#4d4969]">{subject.name}</span>
        </nav>

        <section className="relative mt-6 overflow-hidden rounded-[24px] border border-[#dad8e7] bg-white">
          <div className="pointer-events-none absolute -right-8 -top-24 size-72 rounded-full border border-white/70 opacity-70" style={{ background: "radial-gradient(circle, " + theme.tint + " 0%, transparent 70%)" }} aria-hidden="true" />
          <div className="relative px-6 pb-7 pt-8 sm:px-9 sm:py-11">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full px-3 py-1.5 text-xs font-semibold" style={{ backgroundColor: theme.tint, color: theme.color }}>{theme.name}</span>
              <span className="text-xs text-[#8a8e99]">Curated identity source · 18 Oct 2026</span>
            </div>
            <h1 className="mt-5 text-[clamp(2.45rem,5vw,4.25rem)] font-semibold leading-[1.1] tracking-[-.06em] text-[#242639]">{subject.name}</h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-[#5d6270]">{subject.identity}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a href={subject.referenceUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#282541] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#443a7e]">
                Inspect molecular identity <ArrowUpRight className="size-4" />
              </a>
              <Link href={compareExplorerHref([subject.slug, related[0]?.slug].filter(Boolean), "researcher")}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#dedde7] bg-white px-5 py-2.5 text-sm font-semibold text-[#51468d] hover:bg-[#f5f2ff]">
                <GitCompareArrows className="size-4" /> Compare with {related[0]?.name}
              </Link>
            </div>
          </div>
          <div className="relative grid border-t border-[#eae9ee] bg-[#fcfbff] sm:grid-cols-3">
            <div className="border-b border-[#eae9ee] px-6 py-4 sm:border-b-0 sm:border-r"><p className="text-[11px] font-bold uppercase tracking-[.1em] text-[#8e90a0]">Research theme</p><p className="mt-1 text-sm font-semibold text-[#383849]">{theme.short}</p></div>
            <div className="border-b border-[#eae9ee] px-6 py-4 sm:border-b-0 sm:border-r"><p className="text-[11px] font-bold uppercase tracking-[.1em] text-[#8e90a0]">Mechanism</p><p className="mt-1 text-sm font-semibold text-[#383849]">{subject.mechanism}</p></div>
            <div className="px-6 py-4"><p className="text-[11px] font-bold uppercase tracking-[.1em] text-[#8e90a0]">Identity reference</p><p className="mt-1 text-sm font-semibold text-[#383849]">{subject.referenceLabel}</p></div>
          </div>
        </section>

        <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_335px]">
          <div className="min-w-0 space-y-5">
            <section className="rounded-2xl border border-[#dedee8] bg-white p-6 sm:p-7">
              <div className="flex items-center gap-2 text-[#685b9a]"><Microscope className="size-4" /><p className="text-xs font-bold uppercase tracking-[.12em]">Research direction</p></div>
              <h2 className="mt-3 text-xl font-semibold tracking-[-.035em] text-[#27273a]">{subject.studyQuestion}</h2>
              <p className="mt-3 text-sm leading-7 text-[#686c7a]">Start by checking studies of {subject.mechanism.toLowerCase()}, rather than inferring clinical outcomes or experiment suitability from the molecule name.</p>
            </section>
            <DossierPerspective research={subject.scientistAngle} analyst={subject.analystAngle} />
            <section aria-labelledby="research-sources-title" className="overflow-hidden rounded-2xl border border-[#dedee8] bg-white">
              <div className="border-b border-[#ececf1] px-6 py-5">
                <h2 id="research-sources-title" className="text-xl font-semibold tracking-[-.035em] text-[#28293b]">Follow the source trail</h2>
                <p className="mt-2 text-sm leading-6 text-[#727684]">One reference identity record, then two independent searches. Search results have not been individually evaluated as evidence.</p>
              </div>
              <a href={subject.referenceUrl} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 border-b border-[#ececf1] px-6 py-5 hover:bg-[#fbfaff]">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#5f53a8]" />
                <div><h3 className="text-sm font-semibold text-[#303145]">Molecular identity</h3><p className="mt-1 text-xs leading-5 text-[#777b88]">{subject.referenceLabel} · Checked 18 Oct 2026</p><p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#5545a4]">Open PubChem <ArrowUpRight className="size-3" /></p></div>
              </a>
              <a href={verifiedPubmedSearchUrl(subject)} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 border-b border-[#ececf1] px-6 py-5 hover:bg-[#fbfaff]">
                <BookOpen className="mt-0.5 size-5 shrink-0 text-[#7b83a0]" />
                <div><h3 className="text-sm font-semibold text-[#303145]">Find original publications</h3><p className="mt-1 text-xs leading-5 text-[#777b88]">PubMed search. Mentions and reviews are not necessarily direct trial results.</p><p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#5545a4]">Search PubMed <ArrowUpRight className="size-3" /></p></div>
              </a>
              <a href={registryDiscoveryUrl(subject)} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 px-6 py-5 hover:bg-[#fbfaff]">
                <FileSearch className="mt-0.5 size-5 shrink-0 text-[#7b83a0]" />
                <div><h3 className="text-sm font-semibold text-[#303145]">Find registered studies</h3><p className="mt-1 text-xs leading-5 text-[#777b88]">Registry keyword search. Returned trials may study another compound or a combination.</p><p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#5545a4]">Search ClinicalTrials.gov <ArrowUpRight className="size-3" /></p></div>
              </a>
            </section>
            <section className="rounded-2xl border border-[#dedee8] bg-white p-6">
              <div className="flex items-center gap-2 text-[#796b55]"><CircleHelp className="size-4" /><h2 className="text-base font-semibold text-[#292b3c]">What still needs checking</h2></div>
              <p className="mt-3 text-sm leading-7 text-[#656a78]">{subject.identityCaveat}</p>
              <p className="mt-3 text-sm leading-7 text-[#656a78]">{subject.nextReview}</p>
            </section>
          </div>

          <aside className="space-y-5 lg:sticky lg:top-28">
            {subject.sampleTrial && (
              <section className="rounded-2xl border border-[#c8c2e4] bg-[#f1eeff] p-6">
                <div className="flex items-center gap-2"><FlaskConical className="size-4 text-[#6451aa]" /><p className="text-xs font-bold uppercase tracking-[.1em] text-[#6451aa]">Verified study example</p></div>
                <h2 className="mt-3 text-lg font-semibold text-[#30304c]">{subject.sampleTrial}</h2>
                <p className="mt-2 text-sm leading-6 text-[#65627b]">The official intervention field names {subject.name}. That is not proof of an outcome.</p>
                <Link href={"/intelligence/studies/" + subject.sampleTrial}
                  className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#332a59] px-4 py-3 text-xs font-bold text-white hover:bg-[#483b7b]">
                  Audit this trial <ArrowRight className="size-4" />
                </Link>
              </section>
            )}
            {subject.legacyTopic && (
              <section className="rounded-2xl border border-[#dedee8] bg-white p-6">
                <h2 className="text-sm font-semibold text-[#2e3041]">Additional source samples</h2>
                <p className="mt-2 text-sm leading-6 text-[#777a88]">The earlier Intelligence dossier contains a small trial/publication sample, not a complete review.</p>
                <Link href={"/intelligence/" + subject.legacyTopic} className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-[#5845a0] hover:underline">View source sample <ArrowUpRight className="size-3.5" /></Link>
              </section>
            )}
            <section className="rounded-2xl border border-[#dedee8] bg-white p-6">
              <h2 className="text-sm font-semibold text-[#2c2d3e]">Related research directions</h2>
              <div className="mt-3 divide-y divide-[#ececf1]">
                {related.map(other => <Link href={"/intelligence/explore/" + other.slug} key={other.slug} className="flex items-center justify-between gap-3 py-3 text-sm font-medium text-[#5c5791] hover:underline">{other.name} <ArrowUpRight className="size-4 shrink-0" /></Link>)}
              </div>
              <Link href="/intelligence#explore" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-[#6b62a3] hover:underline"><ArrowLeft className="size-3" /> Back to discovery</Link>
            </section>
          </aside>
        </div>
        <p className="mt-9 max-w-4xl text-xs leading-6 text-[#818492]">
          Editorial starting points, not rankings of clinical effectiveness, experimental suitability or investment prospects. No prices, vendors, purchases or recommendations for human consumption.
        </p>
      </div>
    </main>
  );
}
