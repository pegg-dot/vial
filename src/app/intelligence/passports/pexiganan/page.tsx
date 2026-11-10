import type { Metadata } from "next";
import { Suspense } from "react";
import { ArrowLeft, BadgeCheck, ClipboardList, ScanSearch } from "lucide-react";
import { ResearchWorkpaperActions } from "@/components/intelligence/research-workpaper-actions";
import {
  PexEvidenceClaimGrid, PexEvidenceScopeStrip, PexNoLabVerification, PexSourceRegister,
} from "@/components/intelligence/pexiganan-evidence";
import { PexTrialNetworkLive, PexTrialNetworkLoading } from "@/components/intelligence/pexiganan-trial-network";
import {
  ContentsLayout, Frame, IconTile, Notice, NumberedSection, PageFootnote, PageHero, Pill, Quiet, Section, UI,
} from "@/components/intelligence/research-ui";
import {
  PEXIGANAN_NETWORK_VERSION, PEXIGANAN_REVIEW_DATE, PEXIGANAN_SOURCES, PEXIGANAN_TRIAL_SELECTION, pexEvidencePassportMarkdown,
} from "@/lib/pexiganan-evidence-network";

export const metadata: Metadata = {
  title: "Pexiganan evidence passport | VialGrade",
  description: "Source-traceable record of what an original membrane experiment, registered trial and publication links do and do not establish about pexiganan.",
  robots: { index: false, follow: false },
};

// The same four sections, in the same order, every visit.
const CONTENTS = [
  { id: "passport-claims", label: "Six evidence checks" },
  { id: "passport-studies", label: "Selected studies" },
  { id: "passport-register", label: "Source register" },
  { id: "passport-limits", label: "Limits" },
] as const;

// Counts come from the register itself, so the copy cannot drift from the records.
const SOURCE_COUNT = PEXIGANAN_SOURCES.length;
const COMPOUND_COUNT = PEXIGANAN_SOURCES.filter(source => source.kind === "compound").length;
const REGISTRY_COUNT = PEXIGANAN_SOURCES.filter(source => source.kind === "registry").length;
const PUBMED_COUNT = SOURCE_COUNT - COMPOUND_COUNT - REGISTRY_COUNT;
const PINNED_TRIALS = PEXIGANAN_TRIAL_SELECTION.length;

export default function PexigananEvidencePassportPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <PageHero art={["coa"]}
        breadcrumb={[
          { href: "/intelligence/market", label: "Research Market" },
          { href: "/intelligence/explore/pexiganan", label: "Pexiganan" },
          { label: "Evidence passport" },
        ]}
        eyebrow={<><ClipboardList className="size-4" aria-hidden="true" /> Evidence passport · Research pilot</>}
        title="Pexiganan, with the receipts."
        lead="Six precise observations, ten source records and four individually selected registered studies. Open every original record, see which connections have been checked, and find what still needs a scientific reviewer."
        note={"Editorial source check " + PEXIGANAN_REVIEW_DATE + " · " + PEXIGANAN_NETWORK_VERSION + " · a selected-source review, not a scientific verdict."}
        actions={<>
          <Pill href="#passport-claims" variant="primary" arrow="right">Read the six checks</Pill>
          <Pill href="/intelligence/organizations" variant="ghost" arrow="right">Study sponsors</Pill>
        </>}
        aside={
          <Frame tone="mint" shadow="hard">
            <IconTile icon={ScanSearch} tone="white" />
            <h2 className={UI.h3 + " mt-4"}>Try a real source check</h2>
            <p className={UI.bodyInk + " mt-2"}>
              Search <strong>PMID 36781451</strong>. The original registry cites it as DERIVED, but PubMed classifies it as a review. Our verifier shows both facts and their limitation instead of turning that bibliography label into a result claim.
            </p>
            <Pill href="/intelligence/verify?ref=PMID%2036781451" variant="ink" size="sm" arrow="right" className="mt-4">Verify PMID 36781451</Pill>
          </Frame>
        }>
        <div className="mt-6"><PexEvidenceScopeStrip /></div>
      </PageHero>

      <Section tight>
        <Frame as="section" ariaLabel="Passport summary in plain language" pad="lg" className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
          <div>
            <p className={UI.eyebrow}>The answer before the paperwork</p>
            <h2 className={UI.h2 + " mt-3"}>What can we actually say?</h2>
            <p className={UI.bodyInk + " mt-4 max-w-3xl leading-7"}>
              Pexiganan and Magainin 2 have separate molecular identities. Selected study registrations and papers can
              be traced back to their source records. That does not establish a clinical benefit, an exact trial-to-paper
              outcome match, or the authenticity of any physical sample.
            </p>
            <p className={UI.small + " mt-3"}>Read the six individual evidence checks below to see which link is supported and where questions remain.</p>
          </div>
          <div className="grid gap-3">
            <Notice tone="blue" icon={BadgeCheck} title="The bottom line">
              <p className="text-xs leading-5">Source relationships, not a scientific verdict. A reported registry result is not a benefit finding. A DERIVED review is not a clinical primary outcome paper.</p>
            </Notice>
            <Quiet>
              <p className="text-sm font-extrabold text-[#111214]">Save the source trail</p>
              <p className={UI.small + " mt-1"}>Export all checked claims, sources and limitations without an account.</p>
              <div className="mt-3"><ResearchWorkpaperActions markdown={pexEvidencePassportMarkdown()} filename="vialgrade-pexiganan-evidence-passport.md" /></div>
            </Quiet>
          </div>
        </Frame>

        <ContentsLayout contents={CONTENTS} label="Passport sections" className="mt-6">
          <NumberedSection id="passport-claims" number={1} eyebrow="Evidence checks" title="Six observations, each tied to its original record"
            intro="Every card names the records it rests on, what they show, and what they do not prove. The status chip says whether a fact is read from one source field, connected across two sources, or still needs a reviewer.">
            <PexEvidenceClaimGrid headless />
          </NumberedSection>

          <NumberedSection id="passport-studies" number={2} eyebrow="Registered studies" title="The registry, re-read on request"
            intro={PINNED_TRIALS + " pinned NCT records are fetched live from ClinicalTrials.gov and matched on their intervention field. A row that cannot be reconfirmed stays unverified rather than inheriting the editorial snapshot."}>
            <Suspense fallback={<PexTrialNetworkLoading />}>
              <PexTrialNetworkLive headless />
            </Suspense>
          </NumberedSection>

          <NumberedSection id="passport-register" number={3} eyebrow="Source register" title="Every record behind this passport"
            intro={SOURCE_COUNT + " original records: " + COMPOUND_COUNT + " PubChem identities, " + REGISTRY_COUNT + " registry entries and " + PUBMED_COUNT + " PubMed items. Each links to the verifier, which reports the record and its limitation."}>
            <PexSourceRegister />
          </NumberedSection>

          <NumberedSection id="passport-limits" number={4} eyebrow="Limits" title="What this passport does not establish"
            intro="Metadata and claim provenance only: not laboratory accreditation, medical advice, clinical-evidence certainty, an allegation of reporting misconduct, or a seller verification.">
            <PexNoLabVerification />
            <div className="flex flex-wrap items-center gap-3">
              <Pill href="/intelligence/explore/pexiganan" variant="secondary" size="sm" icon={ArrowLeft}>Back to compound dossier</Pill>
              <Pill href="/intelligence/organizations" variant="ghost" size="sm" arrow="right">Organizations behind these records</Pill>
              <Pill href="https://clinicaltrials.gov/study/NCT01594762" external variant="ghost" size="sm" arrow="up">Official example trial</Pill>
            </div>
          </NumberedSection>
        </ContentsLayout>
      </Section>

      <PageFootnote href="/intelligence/grading" linkLabel="How we check">
        This passport is a selected-source metadata and claim-provenance review, not laboratory accreditation,
        medical advice, clinical-evidence certainty, an allegation of reporting misconduct, or a market-ready seller verification.
        Scientific methods review, source-rights and any use in professional decisions remain separate.
      </PageFootnote>
    </div>
  );
}
