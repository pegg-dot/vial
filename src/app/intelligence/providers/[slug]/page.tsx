import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Building2, ShieldAlert } from "lucide-react";
import { MATERIAL_EVIDENCE_REQUIREMENTS, MATERIAL_REVIEW_DATE, researchProviderBySlug } from "@/lib/research-materials";
import {
  Facts, Notice, NumberedSection, PageFootnote, PageHero, Pill, Quiet, RecordList, Section, UI,
} from "@/components/intelligence/research-ui";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const provider = researchProviderBySlug(slug);
  return {
    title: provider ? provider.name + " public QC documentation | VialGrade" : "Source record not found | VialGrade",
    description: "Review original company-authored quality statements, with clear limits on material and certificate authentication.",
    robots: { index: false, follow: false },
  };
}

export default async function ResearchProviderProfile({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const provider = researchProviderBySlug(slug);
  if (!provider) notFound();
  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      {/* The h1 is the provider name; the id rides on its text because PageHero does not take a title id. */}
      <PageHero size="compact" art={["coa", "shield"]}
        breadcrumb={[{ href: "/intelligence", label: "Home" }, { href: "/intelligence/materials#material-providers", label: "Material checks" }, { label: provider.name }]}
        eyebrow={<><Building2 className="size-4" aria-hidden="true" /> Public organization dossier · {provider.category}</>}
        title={<span id="source-profile-title">{provider.name}</span>}
        lead={provider.summary}
        note={"Company-authored statements noted " + MATERIAL_REVIEW_DATE + ". Nothing here is an independent audit, a lot-linked report or a supply relationship to any indexed molecule."}
        actions={<>
          <Pill href="/intelligence/materials" arrow="right">Check a sample report</Pill>
          <Pill href="/intelligence/materials#material-providers" variant="ghost">All documentation profiles</Pill>
        </>}
        aside={<Facts tone="mint" cols={3} items={[
          { term: "Company source", detail: "Public process description" },
          { term: "Independent quality review", detail: "Not performed" },
          { term: "Lot-linked report", detail: "Not authenticated" },
        ]} />}
      />
      <Section tight>
        <div className="grid gap-4">
          <NumberedSection id="source-documentation" number={1} eyebrow="Original documentation" title="Follow the original documentation" intro={provider.publishedMethod}>
            <p className={UI.small}>
              <span className="font-extrabold text-[#9b6b22]">Source class: COMPANY-AUTHORED.</span> These observations describe published claims, not independently established facts.
            </p>
            <RecordList items={provider.sources.map(source => ({
              href: source.url, external: true, title: source.title,
              note: "Reference noted " + source.observed + " · First-party source",
              action: "Open original company page",
            }))} />
          </NumberedSection>

          <NumberedSection id="verification-status" number={2} eyebrow="Limits" title="Verification is not complete">
            <Notice tone="warn" icon={ShieldAlert}>
              <p>{provider.importantLimit}</p>
              <p className="mt-2 text-xs font-bold">As-of review: {MATERIAL_REVIEW_DATE}</p>
            </Notice>
            <Pill href="/intelligence/materials" variant="ghost" size="sm" arrow="right">Review a material lot</Pill>
          </NumberedSection>

          <NumberedSection id="evidence-requirements" number={3} eyebrow="Requirements" title="What is missing before a specific research material is verifiable?">
            <div className="grid gap-3 sm:grid-cols-2">
              {MATERIAL_EVIDENCE_REQUIREMENTS.map(check => (
                <Quiet key={check.id} className="min-w-0">
                  <p className="text-sm font-extrabold text-[#111214]">{check.title}</p>
                  <p className={UI.small + " mt-1"}>{check.question}</p>
                  <p className="mt-2 text-[11px] font-bold text-[#9b6b22]">Not established for any lot in this dossier</p>
                </Quiet>
              ))}
            </div>
          </NumberedSection>
        </div>
      </Section>
      <PageFootnote href="/intelligence/materials#material-providers" linkLabel="Back to material checks">
        This is a read-only quality-source audit, not vendor certification, material availability, accreditation verification, a scientific effectiveness score,
        or an invitation to purchase. A company profile is not evidence that it made the molecule in any VialGrade dossier.
      </PageFootnote>
    </div>
  );
}
