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
          <h2 className="mt-2 text-3xl font-extrabold tracking-[-.045em]">Batch passports for {compoundName}</h2>
          <p className="mt-2 text-sm font-medium leading-6 text-[var(--muted)]">The fuller test record for a specific batch — who sampled it, who tested it, and what they found. A passport describes the tested samples, never every vial.</p>
        </div>
        <Link href="/passports" className="ink hard-sm press inline-flex items-center gap-1.5 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#111214]">
          All passports <ScanLine className="size-4" />
        </Link>
      </div>
      <div className="scroll-fade-x -mx-5 mt-6 overflow-x-auto px-5 pb-3 no-scrollbar sm:-mx-8 sm:px-8">
        <div className="flex w-max snap-x snap-mandatory gap-4">
          {passports.map((p) => {
            const conflicts = Number(p.open_conflicts);
            return (
              <Link key={p.slug} href={`/passports/${p.slug}`} className="ink-1 hard press group flex w-[300px] shrink-0 snap-start flex-col rounded-[20px] bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#6d5dfc]">{p.origin === "live" ? "Independent certificates" : `${p.sampling_level ?? "S"} evidence`}</p>
                    <p className="mt-1 truncate text-lg font-extrabold tracking-[-.02em]">Batch {p.declared_batch_code}</p>
                    {p.vendor_name ? <p className="truncate text-xs font-semibold text-[var(--muted)]">{p.vendor_name}</p> : null}
                  </div>
                  <span className="ink-1 grid size-10 shrink-0 place-items-center rounded-2xl bg-[#f0edff]"><Fingerprint className="size-4 text-[#6d5dfc]" /></span>
                </div>
                <div className="ink-1 mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-[var(--background)] p-3 text-center">
                  <div><p className="text-lg font-extrabold tabular-nums">{Math.round(Number(p.evidence_confidence) * 100)}%</p><p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[.06em] text-[var(--muted)]">Confidence</p></div>
                  <div><p className="text-lg font-extrabold tabular-nums">{String(p.evidence_links)}</p><p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[.06em] text-[var(--muted)]">Lab links</p></div>
                  <div><p className={`text-lg font-extrabold tabular-nums ${conflicts > 0 ? "text-[#b26a00]" : ""}`}>{conflicts}</p><p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[.06em] text-[var(--muted)]">Conflicts</p></div>
                </div>
                {conflicts > 0 && <p className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-[#b26a00]"><TriangleAlert className="size-3" /> Results disagree — both shown</p>}
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#5a4be0]">Open passport <ScanLine className="size-4 transition group-hover:translate-x-0.5" /></span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
