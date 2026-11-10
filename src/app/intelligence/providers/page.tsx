import type { Metadata } from "next";
import { Building2, FileCheck2, FlaskConical, ShieldAlert, Store } from "lucide-react";
import { RESEARCH_PROVIDER_RECORDS, MATERIAL_REVIEW_DATE } from "@/lib/research-materials";
import {
  Chip, IconTile, Notice, NumberedSection, PageFootnote, PageHero, Pill, Quiet, RecordList, Section, UI,
} from "@/components/intelligence/research-ui";

export const metadata: Metadata = {
  title: "Research supplier documentation | VialGrade",
  description: "Source-linked public QC descriptions from professional peptide organizations. No endorsements, rankings, purchasing or independently authenticated batches.",
  robots: { index: false, follow: false },
};

export default function ResearchProvidersPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <PageHero size="compact" art={["coa", "shield"]}
        breadcrumb={[{ href: "/intelligence/market", label: "Research Market" }, { label: "Supplier documentation" }]}
        eyebrow={<><FileCheck2 className="size-4" aria-hidden="true" /> Company-published QC statements · {RESEARCH_PROVIDER_RECORDS.length} profiles</>}
        title="Supplier quality documents"
        lead="Read the quality-control methods these companies describe on their own websites."
        note={"These are company statements, not independent lab audits or evidence about a particular sample. Source notes dated " + MATERIAL_REVIEW_DATE + "."}
        actions={<>
          <Pill href="/intelligence/materials" arrow="right">Check a sample report</Pill>
          <Pill href="/intelligence/organizations" variant="ghost" arrow="right">Study sponsors</Pill>
        </>}
      />
      <Section tight>
        <div className="grid gap-4">
          <NumberedSection id="provider-profiles" number={1} eyebrow="Documentation profiles" title="Who publishes QC information, in their own words"
            intro="Each profile quotes what the organization says about its own analytical methods and documentation, with a link to the original page.">
            <div className="grid gap-3 md:grid-cols-2">
              {RESEARCH_PROVIDER_RECORDS.map(provider => (
                <Quiet as="article" key={provider.slug} className="flex min-w-0 flex-col">
                  <div className="flex items-center justify-between gap-3">
                    <IconTile icon={Store} tone="mint" />
                    <Chip tone="warn">Independent checks pending</Chip>
                  </div>
                  <p className={UI.eyebrowMuted + " mt-4"}>{provider.category}</p>
                  <h3 className={UI.h3 + " mt-1"}>{provider.name}</h3>
                  <p className={UI.body + " mt-2 flex-1"}>{provider.summary}</p>
                  <div className="mt-4 rounded-[14px] border border-[#111214]/15 bg-white p-4">
                    <p className={UI.eyebrowMuted + " flex items-center gap-1.5"}><FileCheck2 className="size-3.5 text-[#2b31d8]" aria-hidden="true" /> Publicly documented</p>
                    <p className={UI.small + " mt-2"}>{provider.publishedMethod}</p>
                    <p className="mt-2 text-xs font-bold text-[#9b6b22]">Based on the organization&apos;s own site, not independent confirmation.</p>
                  </div>
                  <Pill href={"/intelligence/providers/" + provider.slug} variant="ink" size="sm" arrow="right" className="mt-4 w-fit">
                    Open source profile
                  </Pill>
                </Quiet>
              ))}
            </div>
          </NumberedSection>

          <NumberedSection id="provider-limits" number={2} eyebrow="Limits" title="What this directory can and cannot tell you">
            <Notice tone="warn" icon={ShieldAlert}>
              <p>
                We can show the specific statements a company makes about its analytical methods and documentation, with a link to the original page.
                We cannot currently validate its QC performance, independent accreditations, sample identity, current product availability, supply relationship
                to a specific peptide, or the authenticity of a particular COA. No names here constitute a preferred-supplier list.
              </p>
            </Notice>
          </NumberedSection>

          <NumberedSection id="provider-related" number={3} eyebrow="Related" title="Connected research workflows"
            intro="Company documentation is one input. These pages hold the checks that sit beside it.">
            <RecordList items={[
              { href: "/intelligence/materials", icon: FlaskConical, title: "Material evidence workbench", note: "Compare sample and report lot IDs locally; export an explicitly unverified workpaper.", action: "Open the workbench" },
              { href: "/intelligence/organizations", icon: Building2, title: "Trial sponsor attribution", note: "Sponsors shown in clinical registries are not necessarily manufacturers or material suppliers.", action: "Inspect attribution" },
            ]} />
          </NumberedSection>
        </div>
      </Section>
      <PageFootnote href="/intelligence/market" linkLabel="Back to Research Market">
        Company-published documentation only, dated {MATERIAL_REVIEW_DATE}. No endorsements, rankings, purchasing or independently authenticated batches;
        file coverage is not a quality claim.
      </PageFootnote>
    </div>
  );
}
