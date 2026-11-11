import type { Metadata } from "next";
import { Building2, FileBadge2, NotebookPen, ScanSearch } from "lucide-react";
import { PexSourceVerifier } from "@/components/intelligence/pexiganan-source-verifier";
import { NumberedSection, PageFootnote, PageHero, Pill, RecordList, Section } from "@/components/intelligence/research-ui";

export const metadata: Metadata = {
  title: "Verify a scientific source | VialGrade",
  description: "Check selected Pexiganan scientific identifiers against an original-source register, with explicit citation roles and limitations.",
  robots: { index: false, follow: false },
};

export default async function ResearchSourceVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string | string[] }>;
}) {
  const params = await searchParams;
  const initialRef = typeof params.ref === "string" ? params.ref.slice(0, 80) : "";
  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      {/* Compact so the verifier, and the limitation it returns, sit above the fold at 1440×900. */}
      <PageHero size="compact" art={["magnifier", "molecule"]}
        breadcrumb={[{ href: "/intelligence/market", label: "Research Market" }, { href: "/compounds/pexiganan", label: "Pexiganan" }, { label: "Verify source" }]}
        eyebrow={<><ScanSearch className="size-4" aria-hidden="true" /> Exact source ID lookup · Pexiganan pilot</>}
        title="Verify what a source says."
        lead="Look up an exact PubMed PMID, ClinicalTrials.gov NCT number or PubChem CID."
        note="This is a limited pilot, not a general claim checker. This is not a COA, supplier or clinical-benefit verifier."
        actions={<>
          <Pill href="/intelligence/passports/pexiganan" arrow="right">Evidence passport</Pill>
          <Pill href="/intelligence/organizations" variant="ghost" arrow="right">Study sponsors</Pill>
        </>}
      />
      <Section tight>
        <div className="grid gap-4">
          <PexSourceVerifier initialRef={initialRef} />
          <NumberedSection id="verify-next" number={2} eyebrow="Go deeper" title="Where a checked record leads"
            intro="A matched identifier is one node in a small, fixed evidence network. These pages show the rest of it.">
            <RecordList items={[
              { href: "/intelligence/passports/pexiganan", icon: FileBadge2, title: "Evidence passport", note: "Six specific research observations and their source limitations, ready for export.", action: "Open the passport" },
              { href: "/intelligence/organizations", icon: Building2, title: "Study sponsors named in the registry", note: "Which names appear in official trial sponsor fields, and which laboratories are not verified here.", action: "Inspect attribution" },
              { href: "/intelligence/desk", icon: NotebookPen, title: "Research Desk", note: "Build a source-linked brief from the same records, with what each one does not establish.", action: "Open the desk" },
            ]} />
          </NumberedSection>
        </div>
      </Section>
      <PageFootnote href="/compounds/pexiganan" linkLabel="Return to Pexiganan">
        A match means a record is present in this reviewed source index, not that its scientific conclusions, a vendor, a certificate or a sample have been authenticated.
        External source records can change and must be inspected directly. No user-input data is saved in a research profile.
      </PageFootnote>
    </div>
  );
}
