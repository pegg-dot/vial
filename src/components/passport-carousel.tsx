import Link from "next/link";
import { Fingerprint, ScanLine, TriangleAlert } from "lucide-react";

export interface PassportRow {
  slug: string;
  declared_batch_code: string;
  vendor_name?: string | null;
  evidence_confidence: number | string;
  evidence_links: number | string;
  open_conflicts: number | string;
  origin?: string;
  sampling_level?: string;
}

// How the sample got to the lab, in words instead of a code. "S3 evidence" means nothing to a
// buyer; "bought blind, like a customer" is the whole point of the distinction.
const SAMPLING_WORDS: Record<string, string> = {
  S1: "Vendor picked the sample",
  S2: "Customer's sealed unit",
  S3: "Bought blind, like a customer",
  S4: "Bought blind, tested repeatedly",
};

// The batch passports we hold for a compound — the fuller test record for a specific batch
// (who sampled it, who tested it, what they found, incl. disagreements). Surfaced as a
// scannable carousel so the evidence we've gathered is actually visible on the compound page.
export function PassportCarousel({ passports, compoundName }: { passports: PassportRow[]; compoundName: string }) {
  if (!passports.length) return null;
  return (
    <section className="mx-auto max-w-[1320px] px-5 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#6d5dfc]">Tested batches</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-[-.045em]">Batch test records for {compoundName}</h2>
          <p className="mt-2 text-sm font-medium leading-6 text-[var(--muted)]">The full test history for one batch &mdash; who picked the sample, who tested it, and what came back. It describes the vials that were tested, never every vial they sold.</p>
        </div>
        <Link href="/passports" className="ink hard-sm press inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#111214]">
          All batch records <ScanLine className="size-4" />
        </Link>
      </div>
      <div className="scroll-fade-x -mx-5 mt-6 overflow-x-auto px-5 pb-3 no-scrollbar sm:-mx-8 sm:px-8">
        <div className="flex w-max snap-x snap-mandatory gap-4">
          {passports.map((p) => {
            const conflicts = Number(p.open_conflicts);
            const links = Number(p.evidence_links);
            return (
              <Link key={p.slug} href={`/passports/${p.slug}`} className="ink-1 hard press group flex w-[300px] shrink-0 snap-start flex-col rounded-[20px] bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#6d5dfc]">{p.origin === "live" ? "Independent lab reports" : SAMPLING_WORDS[String(p.sampling_level ?? "")] ?? "Tested batch"}</p>
                    <p className="mt-1 truncate text-lg font-extrabold tracking-[-.02em]">Batch {p.declared_batch_code}</p>
                    {p.vendor_name ? <p className="truncate text-xs font-semibold text-[var(--muted)]">{p.vendor_name}</p> : null}
                  </div>
                  <span className="ink-1 grid size-10 shrink-0 place-items-center rounded-2xl bg-[#f0edff]"><Fingerprint className="size-4 text-[#6d5dfc]" /></span>
                </div>
                {/* One sentence instead of three numbers. "Confidence 61%" is a score a buyer can
                    neither check nor act on, so it is no longer the headline of this card. */}
                <p className="ink-1 mt-4 rounded-2xl bg-[var(--background)] p-3 text-center text-[13px] font-bold">
                  {links} lab test{links === 1 ? "" : "s"}{conflicts > 0 ? <span className="text-[#b26a00]">, {conflicts} disagree{conflicts === 1 ? "s" : ""}</span> : ", no disagreements"}
                </p>
                {conflicts > 0 && <p className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-[#b26a00]"><TriangleAlert className="size-3" /> Results disagree — both shown</p>}
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#5a4be0]">Open the record <ScanLine className="size-4 transition group-hover:translate-x-0.5" /></span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
