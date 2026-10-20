import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, Building2, CircleAlert, FileCheck2, FlaskConical, ShieldAlert } from "lucide-react";
import { PexNoLabVerification } from "@/components/intelligence/pexiganan-evidence";
import { PEXIGANAN_RECORDED_ORGANIZATIONS, PEXIGANAN_REVIEW_DATE } from "@/lib/pexiganan-evidence-network";
import { getPexigananTrialEvidence } from "@/server/intelligence/pexiganan-network";

export const metadata: Metadata = {
  title: "Organizations and evidence provenance | VialGrade",
  description: "Learn which organizations official MSI-78 and pexiganan clinical trial records name as sponsors, and what has not been independently verified.",
  robots: { index: false, follow: false },
};

async function OrganizationAttributionList() {
  const rows = await getPexigananTrialEvidence();
  return (
    <div className="mt-6 grid gap-5 md:grid-cols-2">
      {PEXIGANAN_RECORDED_ORGANIZATIONS.map(org => {
        const matching = org.nctIds.map(id => rows.find(r => r.selected.nctId === id)!);
        const verified = matching.filter(row => row.state === "matched" && row.sponsor === org.name);
        return (
          <article key={org.name} className="overflow-hidden rounded-[19px] border-2 border-[#17191b] bg-white">
            <div className="border-b border-[#dce6e0] bg-[#f0faf4] p-6">
              <div className="grid size-11 place-items-center rounded-xl border border-[#cee2d4] bg-white"><Building2 className="size-5 text-[#287362]" /></div>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[.09em] text-[#548371]">Public clinical registry · Lead sponsor field</p>
              <h2 className="mt-2 text-xl font-extrabold tracking-[-.04em] text-[#202b25]">{org.name}</h2>
              <p className="mt-2 text-sm leading-6 text-[#64756d]">{org.recordRole}.</p>
              <p className={"mt-3 inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-[11px] font-bold " + (
                verified.length === org.nctIds.length ? "bg-[#d9f3e3] text-[#226a54]" : "bg-[#fff1dc] text-[#8c662e]"
              )}>
                {verified.length === org.nctIds.length
                  ? <FileCheck2 className="size-4" /> : <CircleAlert className="size-4" />}
                {verified.length === org.nctIds.length
                  ? "Sponsor field reconfirmed in both selected NCTs"
                  : "Source check incomplete or sponsor field changed"}
              </p>
            </div>
            <div className="space-y-3 p-6">
              <h3 className="text-xs font-extrabold uppercase tracking-[.08em] text-[#728078]">Registered study links</h3>
              {matching.map(row => (
                <div key={row.selected.nctId} className="flex items-start justify-between gap-3 rounded-xl border border-[#e2e8e4] bg-[#fdfefd] p-3">
                  <div>
                    <p className="text-xs font-extrabold text-[#263e32]">{row.selected.nctId}</p>
                    <p className="mt-1 text-[11px] leading-5 text-[#778078]">
                      {row.state !== "matched" ? "Exact intervention not reconfirmed" : row.sponsor === org.name ? "Original intervention and sponsor fields confirmed" : "Reported sponsor does not match the earlier editorial snapshot"}
                    </p>
                  </div>
                  <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer"
                    className="shrink-0 text-[#2b8069] hover:text-[#164f40]" aria-label={"Open source " + row.selected.nctId}>
                    <ArrowUpRight className="size-4" />
                  </a>
                </div>
              ))}
              <p className="text-xs leading-6 text-[#7a817c]">
                A lead-sponsor field establishes what this trial registry records, not current corporate ownership,
                licensing, manufacturing capability, financial condition, or scientific endorsement.
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}

export default function ResearchOrganizationsPage() {
  return (
    <div className="bg-[#faf9f7] pb-24">
      <div className="mx-auto max-w-[1130px] px-5 pt-8 sm:px-8">
        <nav aria-label="Organization directory breadcrumbs" className="flex flex-wrap gap-2 text-xs font-bold text-[#7e8e83]">
          <Link href="/intelligence/market" className="hover:underline">Research Market</Link>
          <span>/</span>
          <Link href="/intelligence/explore/pexiganan" className="hover:underline">Pexiganan</Link>
          <span>/</span>
          <span aria-current="page" className="text-[#326e5c]">Source organizations</span>
        </nav>
        <header className="mt-7 rounded-[22px] border-2 border-[#17191b] bg-[#eafff2] px-6 py-9 sm:px-9 sm:py-11">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.13em] text-[#207867]"><Building2 className="size-4" /> Historical study sponsors · Pexiganan pilot</p>
          <h1 className="mt-3 text-[clamp(2.4rem,5vw,4rem)] font-extrabold tracking-[-.06em] text-[#17191b]">Who sponsored the selected studies?</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#506b5f] sm:text-base">
            These are the organization names recorded in the lead-sponsor fields of four selected trial registrations.
            A sponsor name is a historical source fact, not proof of current ownership, scientific performance or supplier quality.
          </p>
          <p className="mt-3 text-xs font-bold text-[#698878]">Two lead-sponsor names · Four curated registry records · Editorial check {PEXIGANAN_REVIEW_DATE}</p>
        </header>

        <Suspense fallback={<div className="mt-6 rounded-xl border border-[#d8e1db] bg-white p-6 text-sm text-[#697b70]">Checking the original sponsor and intervention fields on four NIH records…</div>}>
          <OrganizationAttributionList />
        </Suspense>

        <section className="mt-10 space-y-4">
          <div className="flex items-center gap-2 text-[#2b6253]"><FlaskConical className="size-5" /><h2 className="text-xl font-extrabold tracking-[-.03em]">Laboratory verification</h2></div>
          <PexNoLabVerification />
          <p className="max-w-3xl text-xs leading-6 text-[#718177]">
            A trial sponsor or research publication is not a testing laboratory. Before listing an organization as
            an accredited laboratory, evidence of the specific accreditor, scope, independent status and current
            standing would need to be independently checked. No such lab is endorsed in this pilot.
          </p>
        </section>

        <section className="mt-10 rounded-2xl border border-[#d9e7de] bg-white p-6 sm:p-8">
          <div className="flex items-center gap-2 text-[#2c806d]"><ShieldAlert className="size-5" /><h2 className="text-lg font-extrabold">What has not been verified?</h2></div>
          <p className="mt-3 text-sm leading-7 text-[#66756d]">
            This directory does not identify research-material suppliers, verify their businesses or products,
            validate COAs, or infer ownership from similar corporate names. The original commercial vendor directory
            is still archived. Document authentication and accredited lab partnerships would require separate source rights,
            current accreditation checks, a correction process and professional legal review.
          </p>
          <Link href="/intelligence/passports/pexiganan" className="mt-5 inline-flex items-center gap-2 text-sm font-extrabold text-[#2f765f] hover:underline">
            Return to the evidence passport <ArrowRight className="size-4" />
          </Link>
        </section>

        <Link href="/intelligence/explore/pexiganan" className="mt-7 inline-flex items-center gap-1 text-xs font-bold text-[#347461] hover:underline">
          <ArrowLeft className="size-4" /> Back to compound dossier
        </Link>
      </div>
    </div>
  );
}
