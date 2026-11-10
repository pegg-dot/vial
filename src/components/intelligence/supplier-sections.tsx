import { FileCheck2, ShieldAlert } from "lucide-react";
import type { SupplierRow } from "@/lib/supplier-grades";

const CONFIDENCE_TEXT = { unrated: "Unrated", tentative: "Tentative", established: "Established" } as const;

export function SupplierSections({ sections }: { sections: ReadonlyArray<readonly [string, readonly SupplierRow[]]> }) {
  return (
    <>
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
                  <p className="mt-3 flex items-start gap-1.5 text-xs font-bold text-[#9b6b22]"><ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    {row.enforcement ? "A public regulatory action is on record." : ""}{row.integrityFlagged ? " A certificate integrity flag is on record." : ""}
                  </p>
                )}
                <p className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-[#4a4d56]"><FileCheck2 className="size-3.5" aria-hidden="true" /> Purity is the lab&apos;s figure for one tested sample, not a guarantee of any other lot.</p>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
