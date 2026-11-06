import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, FileCheck2, ShieldAlert } from "lucide-react";
import { getVendorDirectory } from "@/server/vendors/directory";
import { supplierGradesReleased, supplierRows, TENTATIVE_BELOW_CERTIFICATES, type SupplierRow } from "@/lib/supplier-grades";

export const metadata: Metadata = {
  title: "Supplier grades | VialGrade",
  description: "Organizations graded on the independent lab evidence we hold, with the evidence beside every grade. Not a shop, price list or recommendation.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const CONFIDENCE_TEXT = { unrated: "Unrated", tentative: "Tentative", established: "Established" } as const;

export default async function SuppliersPage() {
  if (!supplierGradesReleased()) {
    return (
      <div className="mx-auto max-w-[900px] px-5 py-16 sm:px-8">
        <h1 className="text-3xl font-extrabold tracking-[-.04em]">Supplier grades are not switched on yet</h1>
        <p className="mt-3 text-sm font-medium leading-6 text-[#4a4d56]">Grades of laboratories, manufacturers and storefronts are built but held back until the evidence behind them has been reviewed. The research dossiers and the supplier documentation pages are unaffected.</p>
        <Link href="/intelligence/providers" className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-extrabold text-[#2b31d8] hover:underline">Company-published QC documentation <ArrowRight className="size-4" /></Link>
      </div>
    );
  }
  const entries = await getVendorDirectory().catch(() => null);
  if (!entries) return <div className="mx-auto max-w-[900px] px-5 py-16 sm:px-8"><p className="text-sm font-bold">The supplier records could not be read right now.</p></div>;
  const rows = supplierRows(entries);
  const sections: Array<[string, SupplierRow[]]> = [
    ["Laboratory-tested storefronts and brands", rows.filter(r => r.kind !== "manufacturer")],
    ["Upstream manufacturers named on certificates", rows.filter(r => r.kind === "manufacturer")],
  ];

  return (
    <div className="mx-auto max-w-[1320px] px-5 pb-20 pt-8 sm:px-8">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs font-bold text-[#4a4d56]">
        <Link href="/intelligence/market" className="hover:underline">Research Market</Link><span aria-hidden="true">/</span>
        <span aria-current="page" className="text-[#111214]">Supplier grades</span>
      </nav>
      <header className="ink hard mt-5 rounded-[22px] bg-white px-6 py-6 sm:px-8">
        <h1 className="text-balance text-[clamp(2rem,4vw,3.25rem)] font-extrabold leading-[.95] tracking-[-.05em]">Supplier grades, with the evidence beside each one</h1>
        <p className="mt-3 max-w-3xl text-[15px] font-medium leading-6 text-[#3a3d46]">
          A letter summarizes the independent laboratory certificates we hold for an organization. It is not a certification, a recommendation or a statement about any product you could receive. This page has no prices, stock or links to sellers.
        </p>
        <p className="mt-2 max-w-3xl text-xs font-medium leading-5 text-[#4a4d56]">
          Fewer than {TENTATIVE_BELOW_CERTIFICATES} certificates is shown as <strong>Tentative</strong>; none is <strong>Unrated</strong>. Corrections: tell us through <Link href="/legal/privacy" className="font-bold text-[#2b31d8] underline">the contact on the legal page</Link>.
        </p>
      </header>
      {sections.map(([title, list]) => list.length === 0 ? null : (
        <section key={title} aria-label={title} className="mt-6">
          <h2 className="text-lg font-extrabold tracking-[-.02em]">{title} <span className="text-sm font-bold text-[#4a4d56]">· {list.length}</span></h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {list.map(row => (
              <li key={row.slug} className="ink hard-sm rounded-[16px] bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-extrabold">{row.name}</h3>
                    <p className="mt-0.5 text-xs font-bold text-[#4a4d56]">{CONFIDENCE_TEXT[row.confidence]} grade</p>
                  </div>
                  <span aria-label={"Grade " + (row.letter ?? "not assigned")} className="grid size-11 shrink-0 place-items-center rounded-lg border-2 border-[#111214] bg-[#e6fbf6] text-xl font-black">{row.letter ?? "—"}</span>
                </div>
                <p className="mt-2 text-[13px] font-medium leading-5 text-[#3a3d46]">{row.headline}</p>
                <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-[#111214]/15 pt-3 text-xs">
                  <div><dt className="font-bold text-[#4a4d56]">Certificates</dt><dd className="mt-0.5 text-sm font-extrabold">{row.certificates}</dd></div>
                  <div><dt className="font-bold text-[#4a4d56]">Median purity</dt><dd className="mt-0.5 text-sm font-extrabold">{row.medianPurity != null ? row.medianPurity + "%" : "—"}</dd></div>
                  <div><dt className="font-bold text-[#4a4d56]">Last tested</dt><dd className="mt-0.5 text-sm font-extrabold">{row.latestTestedAt ? row.latestTestedAt.slice(0, 10) : "—"}</dd></div>
                </dl>
                {(row.enforcement || row.integrityFlagged) && (
                  <p className="mt-3 flex items-start gap-1.5 text-xs font-bold text-[#8a4b00]"><ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    {row.enforcement ? "A public regulatory action is on record." : ""}{row.integrityFlagged ? " A certificate integrity flag is on record." : ""}
                  </p>
                )}
                <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#4a4d56]"><FileCheck2 className="size-3.5" aria-hidden="true" /> Purity is the lab&apos;s figure for one tested sample, not a guarantee of any other lot.</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
