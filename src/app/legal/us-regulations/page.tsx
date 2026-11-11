import type { Metadata } from "next";
import { FlaskConical, Landmark, Pill as PillIcon, Scale, TriangleAlert } from "lucide-react";
import { LegalFrame, LegalLinks, LegalSection } from "@/components/legal-page";
import { Frame, Notice, PageHero, Section, SectionHeading, UI } from "@/components/intelligence/research-ui";
import { US_REGULATION_FACTS } from "@/lib/us-legal";

export const metadata: Metadata = {
  alternates: { canonical: "/legal/us-regulations" },
  title: "US peptide research: regulatory context",
  description: "An educational overview of FDA intended-use rules, approval, compounding and laboratory report limitations. Not a legal clearance determination.",
};

// The tile tone says what kind of context it is: paper for the commercial label, danger for an
// approved drug's ingredient, warn for an investigational compound. Kit tints only.
const CATEGORIES = [
  { icon: FlaskConical, tone: "bg-[var(--background)] text-[#111214]", label: "Research listings", body: "Research-only is a commercial label, not an FDA approval category. Its presence does not establish that distribution, importation or human use is legal." },
  { icon: PillIcon, tone: "bg-[#ffecea] text-[#ce403b]", label: "Approved prescription products", body: "Some molecules appear in particular FDA-approved drugs. Approval cannot be transferred to an unrelated vial or formulation." },
  { icon: TriangleAlert, tone: "bg-[#fff3d8] text-[#9b6b22]", label: "Investigational compounds", body: "Clinical investigation does not permit general commercial marketing as an approved drug for human use." },
];

const source = "font-bold text-[#2b31d8] underline underline-offset-4";

export default function Page() {
  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <PageHero size="compact" art={["shield"]} eyebrow="United States · research context" title="The law around research peptides"
        lead="This is a general overview of some important federal regulatory rules. It does not determine whether a particular product, laboratory, vendor, purchase or transaction is lawful.">
        <Notice tone="warn" icon={Scale} className="mt-6">
          <p><span className="font-extrabold">General information, not legal or medical advice.</span> VialGrade does not sell or refer visitors to sellers of the listed compounds. No label, score or laboratory report on this site is FDA approval or a safety certification. For a transaction-specific answer, consult qualified counsel.</p>
        </Notice>
      </PageHero>

      <Section narrow tight>
        <SectionHeading title="Three regulatory research contexts" lead="These are explanatory groupings, not approvals, legal classifications of individual vendors, or guarantees." />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {CATEGORIES.map(({ icon: Icon, tone, label, body }) => (
            <Frame key={label}>
              <span className={"ink-1 inline-flex size-9 items-center justify-center rounded-[10px] " + tone} aria-hidden="true"><Icon className="size-4" /></span>
              <p className={UI.h4 + " mt-4"}>{label}</p>
              <p className={UI.body + " mt-2"}>{body}</p>
            </Frame>
          ))}
        </div>

        <SectionHeading className="mt-14" title={<span className="inline-flex items-center gap-2.5"><Landmark className="size-6 shrink-0 text-[#2b31d8]" aria-hidden="true" />The details</span>} />
        <LegalFrame className="mt-6">
          {US_REGULATION_FACTS.map(({ title, body }) => <LegalSection key={title} as="h3" heading={title}><p>{body}</p></LegalSection>)}
        </LegalFrame>

        <p className={UI.body + " mt-10 max-w-3xl leading-7"}>VialGrade documents publicly observable statements, laboratory records and market data. Its listings do not constitute purchasing guidance, medicine advice, verification of a delivered product, or a representation of legal compliance.</p>
        <p className={UI.small + " mt-5 max-w-3xl leading-6"}>
          Primary sources: <a className={source} target="_blank" rel="noopener noreferrer" href="https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/gram-peptides-721806-03312026">FDA: intended use despite research labels</a>;{" "}
          <a className={source} target="_blank" rel="noopener noreferrer" href="https://www.fda.gov/drugs/human-drug-compounding/bulk-drug-substances-used-compounding-under-section-503a-fdc-act">FDA: section 503A bulk substances</a>;{" "}
          <a className={source} target="_blank" rel="noopener noreferrer" href="https://www.fda.gov/drugs/human-drug-compounding/fdc-act-provisions-apply-human-drug-compounding">FDA: sections 503A and 503B</a>;{" "}
          <a className={source} target="_blank" rel="noopener noreferrer" href="https://www.fda.gov/drugs/drug-alerts-and-statements/fdas-concerns-unapproved-glp-1-drugs-used-weight-loss">FDA: unapproved GLP-1 products and specific compounding restrictions</a>.
        </p>
        <LegalLinks items={[
          { href: "/legal/disclaimer", label: "Research & medical disclaimer" },
          { href: "/legal/terms", label: "Terms" },
          { href: "/intelligence#method", label: "Research methodology and limits" },
        ]} />
      </Section>
    </div>
  );
}
