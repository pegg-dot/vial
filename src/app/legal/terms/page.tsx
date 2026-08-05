import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
export const metadata:Metadata={title:"Terms of use"};
export default function Page(){return <LegalPage eyebrow="Legal" title="Terms of use" updated="Updated July 2026" sections={[
["Information-only service","VIAL is a market-intelligence service. Nothing displayed is an offer to sell, medical advice, laboratory certification, or a representation that a physical product is safe, lawful, authentic, or fit for any purpose."],
["Record provenance","Live records are aggregated from real public third-party sources (vendor pages, lab feeds) and are provided for information only; any seeded demo records are clearly labeled. A listing is never an endorsement, a safety claim, or a recommendation to buy or use any product."],
["Permitted use","Use VIAL to research vendors, prices, and independent lab tests. Do not use it to facilitate unlawful transactions or to make health decisions."],
["No warranties","VIAL is provided as-is, for information only. Aggregated data may be incomplete or out of date; verify anything that matters against the original source before you act on it."],
]}/>}
