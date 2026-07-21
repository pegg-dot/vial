import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
export const metadata:Metadata={title:"Terms of use"};
export default function Page(){return <LegalPage eyebrow="Legal" title="Terms of use" updated="Prototype terms · July 2026" sections={[
["Information-only service","VIAL is a market-intelligence prototype. Nothing displayed is an offer to sell, medical advice, laboratory certification, or a representation that a physical product is safe, lawful, authentic, or fit for any purpose."],
["Fictional content","Records are seeded demo data unless marked Live. Live records are aggregated from real public third-party sources (vendor pages, lab feeds) and are provided for information only — a listing is never an endorsement, a safety claim, or a recommendation to buy or use any product."],
["Permitted use","Use the prototype to evaluate product design, data architecture, provenance workflows, and user experience. Do not use it to facilitate unlawful transactions or to make health decisions."],
["No warranties","The prototype is provided as-is for demonstration. Production deployment requires independent security, legal, privacy, accessibility, infrastructure, and data-quality review."],
]}/>}
