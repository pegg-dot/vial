import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
export const metadata:Metadata={title:"Research and medical disclaimer"};
export default function Page(){return <LegalPage eyebrow="Important boundary" title="Research and medical disclaimer" updated="Updated July 2026" sections={[
["No medical guidance","VialGrade does not diagnose, treat, prevent, or recommend anything. It does not provide dosing, administration, reconstitution, injection, or product-use instructions."],
["Evidence is dimensional","A report may support a narrow statement about one document or tested sample. It does not establish that all inventory is equivalent, sterile, uncontaminated, lawfully sold, or suitable for human use."],
["No physical verification","AI and software can inspect documents, histories, and structured data. They cannot determine the contents, quantity, contamination state, or storage history of an untested physical vial."],
["Seek qualified advice","Questions involving health, medicine, law, laboratory methods, or regulated transactions require appropriately qualified professionals."],
]}/>}
