import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
export const metadata:Metadata={title:"Terms of use"};
export default function Page(){return <LegalPage eyebrow="Legal" title="Terms of use" updated="Prototype terms · July 2026" sections={[
["Information-only service","VIAL is a fictional market-intelligence prototype. Nothing displayed is an offer to sell, medical advice, laboratory certification, or a representation that a physical product is safe, lawful, authentic, or fit for any purpose."],
["Fictional content","Vendor names, laboratories, reports, listings, prices, ratings, reviews, batches, and source fixtures in this build are fictional and must not be treated as real market facts."],
["Permitted use","Use the prototype to evaluate product design, data architecture, provenance workflows, and user experience. Do not use it to facilitate unlawful transactions or to make health decisions."],
["No warranties","The prototype is provided as-is for demonstration. Production deployment requires independent security, legal, privacy, accessibility, infrastructure, and data-quality review."],
]}/>}
