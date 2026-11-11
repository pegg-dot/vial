import type { Metadata } from "next";
import { ClipboardCheck, FileSearch, ShieldAlert, Store } from "lucide-react";
import { MaterialReviewWorkbench } from "@/components/intelligence/material-review-workbench";
import { RESEARCH_PROVIDER_RECORDS } from "@/lib/research-materials";
import { RESEARCH_SUBJECTS, researchSubjectBySlug } from "@/lib/research-explorer";
import {
  Chip, Facts, IconTile, Notice, NumberedSection, PageFootnote, PageHero, Pill, Quiet, Section, UI,
} from "@/components/intelligence/research-ui";

export const metadata: Metadata = {
  title: "Research materials and lot evidence | VialGrade",
  description: "Explore peptide identities, material verification requirements and company-published quality documentation. No shopping or verified batch claims.",
  robots: { index: false, follow: false },
};

export default async function ResearchMaterialsPage({ searchParams }: {
  searchParams: Promise<{ subject?: string | string[] }>;
}) {
  const params = await searchParams;
  const request = typeof params.subject === "string" ? params.subject : "pexiganan";
  const initialSlug = researchSubjectBySlug(request) ? request : "pexiganan";
  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <PageHero size="compact" art={["coa", "flask"]}
        breadcrumb={[{ href: "/intelligence", label: "Home" }, { label: "Research materials" }]}
        eyebrow={<><ClipboardCheck className="size-4" aria-hidden="true" /> Sample and report checks · Local checklist</>}
        title="Research material checks"
        lead="Have a sample label and a report? Start by comparing their lot IDs. A matching number is not proof of authenticity or quality."
        note="This is a local note-taking checklist, not a laboratory test. Nothing is uploaded or saved, and no indexed identity has an independently authenticated physical lot on file."
        actions={<>
          <Pill href="/intelligence/providers" arrow="right">Supplier quality documents</Pill>
          <Pill href={"/compounds/" + initialSlug} variant="ghost" arrow="right">Compound dossier</Pill>
        </>}
      />
      <Section tight>
        <div className="grid gap-4">
          {/* Each figure stays in one element so "0 independently authenticated physical lots" reads as one fact. */}
          <Facts tone="mint" cols={3} items={[
            { term: "Reference identities", detail: RESEARCH_SUBJECTS.length + " curated identity files" },
            { term: "Physical lots", detail: "0 independently authenticated physical lots" },
            { term: "Documentation profiles", detail: RESEARCH_PROVIDER_RECORDS.length + " company-published, not endorsements" },
          ]} />

          <MaterialReviewWorkbench initialSlug={initialSlug} />

          <NumberedSection id="material-providers" number={2} eyebrow="Public laboratory documents" title="Who publishes the quality information?"
            intro={RESEARCH_PROVIDER_RECORDS.length + " organization profiles show first-party documentation about general peptide QC practices. None is independently verified by VialGrade or linked to the availability of any molecule in this catalog."}
            actions={<Pill href="/intelligence/providers" size="sm" variant="ghost" arrow="right">Full source directory</Pill>}>
            <div className="grid gap-3 md:grid-cols-2">
              {RESEARCH_PROVIDER_RECORDS.map(provider => (
                <Quiet as="article" key={provider.slug} className="flex min-w-0 flex-col">
                  <div className="flex items-center justify-between gap-3">
                    <IconTile icon={Store} tone="mint" size="sm" />
                    <Chip tone="warn">Issuer claims only</Chip>
                  </div>
                  <p className={UI.eyebrowMuted + " mt-4"}>{provider.category}</p>
                  <h3 className={UI.h3 + " mt-1"}>{provider.name}</h3>
                  <p className={UI.body + " mt-2 flex-1"}>{provider.summary}</p>
                  <Pill href={"/intelligence/providers/" + provider.slug} variant="ink" size="sm" arrow="right" className="mt-4 w-fit">
                    Inspect quality sources
                  </Pill>
                </Quiet>
              ))}
            </div>
          </NumberedSection>

          <NumberedSection id="material-limits" number={3} eyebrow="Limits" title="Scientific promise and sample verification are different questions">
            <Notice tone="warn" icon={ShieldAlert}>
              <p>The research-file A/B/C grades describe linked primary-source layers. They do not certify an experiment&apos;s conclusions, a supplier, or a lot.</p>
            </Notice>
            <Pill href="/how-we-check#grade-checks" variant="ghost" size="sm" icon={FileSearch} arrow="right">See research grading</Pill>
          </NumberedSection>
        </div>
      </Section>
      <PageFootnote href="/compounds" linkLabel="Back to compounds">
        Editorial research starting points, not grades of material quality. Company-published supplier QC information is separate and unverified;
        no purchasing and no recommendations for human consumption.
      </PageFootnote>
    </div>
  );
}
