import type { Metadata } from "next";
import { Suspense } from "react";
import { Building2, CircleAlert, FileCheck2, ShieldAlert } from "lucide-react";
import { PexNoLabVerification } from "@/components/intelligence/pexiganan-evidence";
import { PEXIGANAN_RECORDED_ORGANIZATIONS, PEXIGANAN_REVIEW_DATE } from "@/lib/pexiganan-evidence-network";
import { getPexigananTrialEvidence } from "@/server/intelligence/pexiganan-network";
import {
  Chip, Frame, Notice, NumberedSection, PageFootnote, PageHero, Pill, Quiet, Section, UI,
} from "@/components/intelligence/research-ui";

export const metadata: Metadata = {
  title: "Organizations and evidence provenance | VialGrade",
  description: "Learn which organizations official MSI-78 and pexiganan clinical trial records name as sponsors, and what has not been independently verified.",
  robots: { index: false, follow: false },
};

const STUDY_COUNT = PEXIGANAN_RECORDED_ORGANIZATIONS.reduce((total, org) => total + org.nctIds.length, 0);

/** One numbered section per recorded sponsor, so the organization name is the section's own h2. */
async function OrganizationAttributionList() {
  const rows = await getPexigananTrialEvidence();
  return (
    <>
      {PEXIGANAN_RECORDED_ORGANIZATIONS.map((org, index) => {
        const matching = org.nctIds.map(id => rows.find(r => r.selected.nctId === id)!);
        const verified = matching.filter(row => row.state === "matched" && row.sponsor === org.name);
        const complete = verified.length === org.nctIds.length;
        return (
          <NumberedSection key={org.name} id={"sponsor-" + (index + 1)} number={index + 1} eyebrow="Public clinical registry · Lead sponsor field"
            title={org.name} intro={org.recordRole + "."}
            chips={<Chip tone={complete ? "mint" : "warn"} icon={complete ? FileCheck2 : CircleAlert}>
              {complete ? "Sponsor field reconfirmed in both selected NCTs" : "Source check incomplete or sponsor field changed"}
            </Chip>}>
            <div>
              <p className={UI.eyebrowMuted}>Registered study links</p>
              <ul className="mt-2 grid gap-2.5">
                {matching.map(row => (
                  <Quiet as="li" key={row.selected.nctId} className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-[#111214]">{row.selected.nctId}</p>
                      <p className={UI.small + " mt-0.5"}>
                        {row.state !== "matched" ? "Exact intervention not reconfirmed" : row.sponsor === org.name ? "Original intervention and sponsor fields confirmed" : "Reported sponsor does not match the earlier editorial snapshot"}
                      </p>
                    </div>
                    <Pill href={row.sourceUrl} external size="sm" variant="ghost" arrow="up" className="shrink-0" ariaLabel={"Open source " + row.selected.nctId}>
                      Registry
                    </Pill>
                  </Quiet>
                ))}
              </ul>
            </div>
            <p className={UI.small}>
              A lead-sponsor field establishes what this trial registry records, not current corporate ownership,
              licensing, manufacturing capability, financial condition, or scientific endorsement.
            </p>
          </NumberedSection>
        );
      })}
    </>
  );
}

export default function ResearchOrganizationsPage() {
  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <PageHero size="compact" art={["molecule", "shield"]}
        breadcrumb={[{ href: "/intelligence", label: "Home" }, { href: "/compounds/pexiganan", label: "Pexiganan" }, { label: "Source organizations" }]}
        eyebrow={<><Building2 className="size-4" aria-hidden="true" /> Historical study sponsors · Pexiganan pilot</>}
        title="Who sponsored the selected studies?"
        lead={"These are the organization names recorded in the lead-sponsor fields of " + STUDY_COUNT + " selected trial registrations."}
        note={"A sponsor name is a historical source fact, not current corporate ownership, scientific performance or supplier quality. "
          + PEXIGANAN_RECORDED_ORGANIZATIONS.length + " lead-sponsor names · " + STUDY_COUNT + " curated registry records · Editorial check " + PEXIGANAN_REVIEW_DATE + "."}
        actions={<>
          <Pill href="/compounds/pexiganan#studies" arrow="right">Evidence passport</Pill>
          <Pill href="/compounds/pexiganan" variant="ghost" arrow="right">Pexiganan dossier</Pill>
        </>}
      />
      <Section tight>
        <div className="grid items-start gap-4 md:grid-cols-2">
          <Suspense fallback={
            <Frame as="section" ariaLabel="Checking sponsor fields" shadow="sm" radius="rounded-[16px]" className="md:col-span-2">
              <p className={UI.body}>Checking the original sponsor and intervention fields on {STUDY_COUNT} NIH records…</p>
            </Frame>
          }>
            <OrganizationAttributionList />
          </Suspense>

          <NumberedSection id="lab-verification" number={PEXIGANAN_RECORDED_ORGANIZATIONS.length + 1} eyebrow="Testing laboratories" title="Laboratory verification"
            intro="A trial sponsor or research publication is not a testing laboratory.">
            <PexNoLabVerification />
            <p className={UI.small}>
              Before listing an organization as an accredited laboratory, evidence of the specific accreditor, scope, independent status and current
              standing would need to be independently checked. No such lab is endorsed in this pilot.
            </p>
          </NumberedSection>

          <NumberedSection id="not-verified" number={PEXIGANAN_RECORDED_ORGANIZATIONS.length + 2} eyebrow="Limits" title="What has not been verified?">
            <Notice tone="warn" icon={ShieldAlert}>
              <p>
                This directory does not identify research-material suppliers, verify their businesses or products, validate COAs, or infer ownership
                from similar corporate names. The original commercial vendor directory is still archived. Document authentication and accredited lab
                partnerships would require separate source rights, current accreditation checks, a correction process and professional legal review.
              </p>
            </Notice>
            <Pill href="/compounds/pexiganan#studies" variant="ghost" size="sm" arrow="right">Return to the evidence passport</Pill>
          </NumberedSection>
        </div>
      </Section>
      <PageFootnote href="/compounds/pexiganan" linkLabel="Back to compound dossier">
        Sponsor names come from each registry record&apos;s lead-sponsor field on the snapshot date, re-read from NIH on request (responses may be cached for up to six hours).
        They are not a supplier list, a manufacturer list or a statement about who made any material.
      </PageFootnote>
    </div>
  );
}
