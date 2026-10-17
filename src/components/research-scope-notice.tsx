import Link from "next/link";
import { BookOpenCheck, CircleAlert } from "lucide-react";

/**
 * Inline, accessible educational disclosure. It is NOT a legal eligibility
 * check, age gate, researcher accreditation, consent, or an RUO exemption.
 * It never records a user's identity, research interest, or acknowledgement.
 */
export function ResearchScopeNotice() {
  return (
    <aside aria-label="Research record limitations" className="mx-auto max-w-[1320px] px-5 pt-6 sm:px-8">
      <div className="ink-1 rounded-[16px] bg-white px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          <BookOpenCheck className="mt-0.5 size-5 shrink-0 text-[#2b31d8]" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-extrabold">Research documentation, not a purchasing or treatment service</p>
            <p className="mt-1 text-[13px] leading-6 text-[var(--muted)]">
              A lab report describes a submitted sample. It cannot verify a future vial,
              sterility, suitability for human use, FDA approval, or whether a seller&rsquo;s
              transaction would be lawful.
            </p>
            <details className="group mt-2">
              <summary className="w-fit cursor-pointer text-xs font-bold text-[#2b31d8] underline underline-offset-2">
                What does “research use only” actually mean?
              </summary>
              <div className="mt-3 space-y-2 border-l-2 border-[#2b31d8]/20 pl-4 text-[13px] leading-6 text-[var(--muted)]">
                <p>
                  It may be a vendor&rsquo;s description of intended use. It is not a general
                  FDA exemption for an unapproved drug. Regulators assess the product and
                  all evidence of intended use, including surrounding marketing claims.
                </p>
                <p>
                  Reading a research record does not establish professional qualifications,
                  a right to buy or administer a substance, or a medical recommendation.
                  VialGrade does not offer peptide checkout or seller referral links.
                </p>
                <p>
                  <Link href="/legal/us-regulations" className="font-bold text-[#2b31d8] underline underline-offset-2">
                    Read the U.S. regulatory overview
                  </Link>.
                  For the basis of the rule, see the{" "}
                  <a href="https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/gram-peptides-721806-03312026" target="_blank" rel="noopener noreferrer" className="font-bold text-[#2b31d8] underline underline-offset-2">
                    FDA&rsquo;s 2026 explanation of intended use
                  </a>.
                </p>
              </div>
            </details>
          </div>
          <CircleAlert className="mt-0.5 hidden size-4 shrink-0 text-[#b26a00] sm:block" aria-hidden="true" />
        </div>
      </div>
    </aside>
  );
}
