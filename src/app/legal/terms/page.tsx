import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { CONTACT_EMAIL, GOVERNING_LAW, HAS_GOVERNING_LAW, LEGAL_EMAIL, LEGAL_ENTITY, VENUE } from "@/lib/contact";

export const metadata: Metadata = { title: "Terms of use", alternates: { canonical: "/legal/terms" } };

export default function Page() {
  return <LegalPage eyebrow="Legal" title="Terms of use" updated="Updated August 2026" sections={[

["Information-only service","VialGrade is a market-intelligence service. Nothing displayed is an offer to sell, medical advice, laboratory certification, or a representation that a physical product is safe, lawful, authentic, or fit for any purpose."],

["Record provenance","Live records are aggregated from real public third-party sources (vendor pages, lab feeds) and are provided for information only; any seeded demo records are clearly labeled. A listing is never an endorsement, a safety claim, or a recommendation to buy or use any product."],

["Permitted use","Use VialGrade to research vendors, prices, and independent lab tests. Do not use it to facilitate unlawful transactions or to make health decisions."],

["No warranties","VialGrade is provided as-is, for information only. Aggregated data may be incomplete or out of date; verify anything that matters against the original source before you act on it."],

["How VialGrade makes money","VialGrade sells nothing and never handles your payment. Links to a vendor may be affiliate links, meaning VialGrade could earn a commission if you buy after following one. No such arrangement is in place today, and if one starts you will see it disclosed next to the link before you click. A commission never affects a grade, a lab result, a price, a warning, or where a listing appears — grades come from the evidence pipeline, which has no access to commercial terms."],

["Corrections and disputes","If VialGrade has something wrong about you or your company — a grade, a flag, an enforcement entry, a price, a lab result — write to us and a person will review it. How to do that, what to include, and what happens next are on the contact and corrections page at /legal/contact. Nothing here shortens or replaces any right you have to be heard before a claim about you stays published."],

["Copyright and other legal notices",`Send copyright, trademark, and other legal notices to ${LEGAL_EMAIL}. For a copyright complaint, identify the work, identify the material on VialGrade you say infringes it and the URL where it appears, give your contact details, state that you believe in good faith that the use is unauthorised, state under penalty of perjury that your notice is accurate and that you are the owner or authorised to act for them, and sign it. Material that is the subject of a valid notice is removed or disabled while it is assessed, and the person who supplied it may respond.`],

["Limitation of liability","To the fullest extent the law allows, VialGrade is not liable for indirect, incidental, special, consequential, or punitive damages, or for lost profits, lost data, or harm arising from a decision you made using this site — including a purchase from a vendor, since that transaction is between you and that vendor. Total liability for any claim relating to VialGrade is limited to US$100, which is more than you have paid us, because the site is free. Some jurisdictions do not allow these exclusions; where that is so, they apply only as far as that jurisdiction permits, and nothing here excludes liability for fraud or for anything else that cannot lawfully be excluded."],

// Omitted entirely when no jurisdiction is set. A visible "[to be added]" in a legal document
// undermines every other line on the page, and guessing a jurisdiction is worse than saying
// nothing — with no clause, ordinary law applies, which is the normal position for a small site.
...(HAS_GOVERNING_LAW ? [["Governing law and venue",`These terms are governed by the laws of ${GOVERNING_LAW}, without regard to its conflict-of-laws rules. Disputes are heard in ${VENUE}, and you and ${LEGAL_ENTITY} each consent to that venue. Nothing here removes a consumer-protection right that the law of your home jurisdiction gives you and does not allow you to waive.`] as [string, string]] : []),

["Who operates VialGrade",`VialGrade is operated by ${LEGAL_ENTITY}. General contact: ${CONTACT_EMAIL}.`],

["Changes to these terms","These terms change when the service does, and the date at the top moves with them. Continuing to use VialGrade after a change means the current version applies."],

  ]} />;
}
