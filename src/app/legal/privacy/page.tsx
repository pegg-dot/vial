import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
export const metadata:Metadata={title:"Privacy notice"};
export default function Page(){return <LegalPage eyebrow="Legal" title="Privacy notice" updated="Prototype notice · July 2026" sections={[
["Current prototype","VIAL currently stores browser-local watchlists and preferences. The public prototype does not collect payment information, health information, product-use histories, or identity documents."],
["Operational records","Staff workflow demonstrations may store source snapshots, tool receipts, review decisions, and publication events in the configured database. The included data is fictional."],
["Future accounts","Durable accounts, email delivery, analytics, and seller participation will require a production privacy program, retention schedule, consent model, access controls, and jurisdiction-specific review before launch."],
["No sale of personal data","This prototype does not sell personal information or share user conversations with vendors or advertisers."],
]}/>}
