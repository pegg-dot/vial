import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, FlaskConical, Landmark, Pill, Scale } from "lucide-react";
import { US_REGULATION_FACTS } from "@/lib/us-legal";

export const metadata: Metadata = {
  alternates: { canonical: "/legal/us-regulations" },
  title: "US peptide research: regulatory context",
  description: "An educational overview of FDA intended-use rules, approval, compounding and laboratory report limitations. Not a legal clearance determination.",
};

const CATEGORIES = [
  { icon: FlaskConical, tone: "text-[#111214] bg-[var(--background)]", label: "Research listings", body: "Research-only is a commercial label, not an FDA approval category. Its presence does not establish that distribution, importation or human use is legal." },
  { icon: Pill, tone: "text-[#d3372c] bg-[#fff1f0]", label: "Approved prescription products", body: "Some molecules appear in particular FDA-approved drugs. Approval cannot be transferred to an unrelated vial or formulation." },
  { icon: AlertTriangle, tone: "text-[#b26a00] bg-[#fff4e0]", label: "Investigational compounds", body: "Clinical investigation does not permit general commercial marketing as an approved drug for human use." },
];

export default function Page() {
  return (
    <div className="mx-auto max-w-[960px] px-5 py-16 sm:px-8 sm:py-24">
      <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#2b31d8]">United States · research context</p>
      <h1 className="mt-4 text-5xl font-extrabold tracking-[-.065em] sm:text-7xl">The law around research peptides</h1>
      <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--muted)]">This is a general overview of some important federal regulatory rules. It does not determine whether a particular product, laboratory, vendor, purchase or transaction is lawful.</p>

      <div className="ink-1 mt-8 flex items-start gap-3 rounded-[14px] bg-[#fff4e0] p-4">
        <Scale className="mt-0.5 size-5 shrink-0 text-[#b26a00]" />
        <p className="text-sm leading-6 text-[#111214]/80"><span className="font-semibold">General information, not legal or medical advice.</span> VialGrade does not sell or refer visitors to sellers of the listed compounds. No label, score or laboratory report on this site is FDA approval or a safety certification. For a transaction-specific answer, consult qualified counsel.</p>
      </div>

      <section className="mt-12">
        <h2 className="text-2xl font-extrabold tracking-[-.04em]">Three regulatory research contexts</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">These are explanatory groupings, not approvals, legal classifications of individual vendors, or guarantees.</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <div key={c.label} className="ink hard rounded-[18px] bg-white p-5">
                <span className={`ink-1 inline-flex size-9 items-center justify-center rounded-[10px] ${c.tone}`}><Icon className="size-4" /></span>
                <p className="mt-4 font-extrabold tracking-[-.02em]">{c.label}</p>
                <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">{c.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-14">
        <div className="flex items-center gap-2.5">
          <Landmark className="size-5 text-[#2b31d8]" />
          <h2 className="text-2xl font-extrabold tracking-[-.04em]">The details</h2>
        </div>
        <div className="ink hard mt-6 divide-y divide-[#111214]/10 rounded-[20px] bg-white px-6 sm:px-9">
          {US_REGULATION_FACTS.map(({ title, body }) => (
            <section key={title} className="py-7">
              <h3 className="text-lg font-extrabold tracking-[-.03em]">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{body}</p>
            </section>
          ))}
        </div>
      </section>

      <p className="mt-10 text-sm leading-7 text-[var(--muted)]">VialGrade documents publicly observable statements, laboratory records and market data. Its listings do not constitute purchasing guidance, medicine advice, verification of a delivered product, or a representation of legal compliance.</p>
      <div className="mt-5 text-xs leading-6 text-[var(--muted)]">
        Primary sources: <a className="underline" target="_blank" rel="noopener noreferrer" href="https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/gram-peptides-721806-03312026">FDA: intended use despite research labels</a>;{" "}
        <a className="underline" target="_blank" rel="noopener noreferrer" href="https://www.fda.gov/drugs/human-drug-compounding/bulk-drug-substances-used-compounding-under-section-503a-fdc-act">FDA: section 503A bulk substances</a>;{" "}
        <a className="underline" target="_blank" rel="noopener noreferrer" href="https://www.fda.gov/drugs/human-drug-compounding/fdc-act-provisions-apply-human-drug-compounding">FDA: sections 503A and 503B</a>;{" "}
        <a className="underline" target="_blank" rel="noopener noreferrer" href="https://www.fda.gov/drugs/drug-alerts-and-statements/fdas-concerns-unapproved-glp-1-drugs-used-weight-loss">FDA: unapproved GLP-1 products and specific compounding restrictions</a>.
      </div>
      <div className="mt-8 flex flex-wrap gap-3 text-sm font-bold text-[#2b31d8]">
        <Link href="/legal/disclaimer">Research & medical disclaimer</Link>
        <Link href="/legal/terms">Terms</Link>
        <Link href="/how-we-check">How we check</Link>
      </div>
    </div>
  );
}
