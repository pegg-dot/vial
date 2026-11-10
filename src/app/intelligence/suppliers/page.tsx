import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { getVendorDirectory } from "@/server/vendors/directory";
import { SupplierSections } from "@/components/intelligence/supplier-sections";
import { Notice, PageFootnote, PageHero, Pill, Section } from "@/components/intelligence/research-ui";
import { supplierGradesReleased, supplierRows, TENTATIVE_BELOW_CERTIFICATES, type SupplierRow } from "@/lib/supplier-grades";

export const metadata: Metadata = {
  title: "Supplier grades | VialGrade",
  description: "Organizations graded on the independent lab evidence we hold, with the evidence beside every grade. Not a shop, price list or recommendation.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const CRUMBS = [{ href: "/intelligence/market", label: "Research Market" }, { label: "Supplier grades" }] as const;
const TITLE = "Supplier grades, with the evidence beside each one";

export default async function SuppliersPage() {
  if (!supplierGradesReleased()) {
    return (
      <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
        <PageHero size="compact" art={["shield", "coa"]} breadcrumb={CRUMBS}
          eyebrow={<><ShieldCheck className="size-4" aria-hidden="true" /> Supplier grades · Not released</>}
          title="Supplier grades are not switched on yet"
          lead="Grades of laboratories, manufacturers and storefronts are built but held back until the evidence behind them has been reviewed."
          note="The research dossiers and the supplier documentation pages are unaffected."
          actions={<>
            <Pill href="/intelligence/providers" arrow="right">Company-published QC documentation</Pill>
            <Pill href="/intelligence/market" variant="ghost">Research Market</Pill>
          </>}
        />
        <PageFootnote href="/intelligence/grading" linkLabel="How research files are graded">
          When released, a letter will summarize the independent laboratory certificates we hold for an organization. It will not be a certification,
          a recommendation or a statement about any product you could receive.
        </PageFootnote>
      </div>
    );
  }
  const entries = await getVendorDirectory().catch(() => null);
  if (!entries) {
    return (
      <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
        <PageHero size="compact" art={["shield", "coa"]} breadcrumb={CRUMBS} eyebrow="Supplier grades" title={TITLE}
          lead="A letter summarizes the independent laboratory certificates we hold for an organization." />
        <Section narrow tight>
          <Notice tone="danger" role="alert"><p>The supplier records could not be read right now.</p></Notice>
        </Section>
      </div>
    );
  }
  const rows = supplierRows(entries);
  const sections: Array<[string, SupplierRow[]]> = [
    ["Laboratory-tested storefronts and brands", rows.filter(r => r.kind !== "manufacturer")],
    ["Upstream manufacturers named on certificates", rows.filter(r => r.kind === "manufacturer")],
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] pb-20 text-[#111214]">
      <PageHero art={["shield", "coa"]} breadcrumb={CRUMBS}
        eyebrow={<><ShieldCheck className="size-4" aria-hidden="true" /> Supplier grades · Independent certificates on file</>}
        title={TITLE}
        lead="A letter summarizes the independent laboratory certificates we hold for an organization. It is not a certification, a recommendation or a statement about any product you could receive. This page has no catalog, stock or links to sellers."
        note={<>Fewer than {TENTATIVE_BELOW_CERTIFICATES} certificates is shown as <strong>Tentative</strong>; none is <strong>Unrated</strong>. Corrections: tell us through <Link href="/legal/privacy" className="font-bold text-[#2b31d8] underline underline-offset-4">the contact on the legal page</Link>.</>}
        actions={<>
          <Pill href="/intelligence/providers" arrow="right">Company-published QC documentation</Pill>
          <Pill href="/intelligence/grading" variant="ghost" arrow="right">How files are graded</Pill>
        </>}
      />
      <Section tight>
        <SupplierSections sections={sections} />
      </Section>
      <PageFootnote href="/intelligence/grading" linkLabel="How research files are graded">
        Purity figures are each laboratory&apos;s result for one tested sample. A grade is a summary of certificates on file, not a guarantee of any other lot
        and not a recommendation.
      </PageFootnote>
    </div>
  );
}
