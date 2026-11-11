import Link from "next/link";
import { BookOpenCheck } from "lucide-react";
import { Frame, UI } from "@/components/intelligence/research-ui";

/**
 * Inline, accessible educational disclosure. It is NOT a legal eligibility
 * check, age gate, researcher accreditation, consent, or an RUO exemption.
 * It never records a user's identity, research interest, or acknowledgement.
 *
 * `bare` drops the page container for a caller that already sits inside one (the compound page's
 * body section); vendor and product pages keep the default, self-contained band.
 */
export function ResearchScopeNotice({ bare = false }: { bare?: boolean }) {
  const notice = (
    <Frame as="aside" ariaLabel="Research record limitations" tone="blue" thin shadow="none" radius="rounded-[14px]" pad="sm">
      <div className="flex items-start gap-3">
        <BookOpenCheck className="mt-0.5 size-5 shrink-0 text-[#2b31d8]" aria-hidden="true" />
        <div className="min-w-0 text-sm font-medium leading-6 text-[#111214]">
          <p className="font-extrabold">Research documentation, not a purchasing or treatment service</p>
          <p className="mt-1 text-[13px] leading-6 text-[#3a3d46]">
            A lab report describes a submitted sample. It cannot verify a future vial,
            sterility, suitability for human use, FDA approval, or whether a seller&rsquo;s
            transaction would be lawful.
          </p>
          <details className="group mt-2">
            <summary className="w-fit cursor-pointer text-xs font-extrabold text-[#2b31d8] underline underline-offset-2">
              What does “research use only” actually mean?
            </summary>
            <div className="mt-3 space-y-2 border-l-2 border-[#2b31d8]/20 pl-4 text-[13px] leading-6 text-[#3a3d46]">
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
                <Link href="/legal/us-regulations" className="font-extrabold text-[#2b31d8] underline underline-offset-2">
                  Read the U.S. regulatory overview
                </Link>.
                For the basis of the rule, see the{" "}
                <a href="https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/gram-peptides-721806-03312026" target="_blank" rel="noopener noreferrer" className="font-extrabold text-[#2b31d8] underline underline-offset-2">
                  FDA&rsquo;s 2026 explanation of intended use
                </a>.
              </p>
            </div>
          </details>
        </div>
      </div>
    </Frame>
  );
  return bare ? notice : <div className={UI.container + " pt-6"}>{notice}</div>;
}
