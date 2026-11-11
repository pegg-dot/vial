import Link from "next/link";
import { ArrowRight, Fingerprint, ScanLine, TriangleAlert } from "lucide-react";
import { IconTile, Pill, Quiet, SectionHeading, UI } from "@/components/intelligence/research-ui";

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
// It renders inside the compound page's lab-tests frame, under that frame's h2, so its own
// heading is an h3 and the carousel bleeds to the frame's padding edge rather than the page's.
export function PassportCarousel({ passports, compoundName }: { passports: PassportRow[]; compoundName: string }) {
  if (!passports.length) return null;
  return (
    <div className="border-t border-[#111214]/10 pt-4">
      <SectionHeading level={3} eyebrow="Tested batches" title={`Batch test records for ${compoundName}`}
        lead="The full test history for one batch — who picked the sample, who tested it, and what came back. It describes the vials that were tested, never every vial they sold."
        action={<Pill href="/passports" variant="ghost" size="sm" icon={ScanLine}>All batch records</Pill>} />
      <div className="scroll-fade-x -mx-5 mt-4 overflow-x-auto px-5 pb-3 no-scrollbar">
        <div className="flex w-max snap-x snap-mandatory gap-4">
          {passports.map((p) => {
            const conflicts = Number(p.open_conflicts);
            const links = Number(p.evidence_links);
            return (
              <Link key={p.slug} href={`/passports/${p.slug}`} className="ink-1 hard-sm press group flex w-[300px] shrink-0 snap-start flex-col rounded-[18px] bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={UI.eyebrowMuted}>{p.origin === "live" ? "Independent lab reports" : SAMPLING_WORDS[String(p.sampling_level ?? "")] ?? "Tested batch"}</p>
                    <p className="mt-1 truncate text-lg font-extrabold tracking-[-.02em] text-[#111214]">Batch {p.declared_batch_code}</p>
                    {p.vendor_name ? <p className="truncate text-xs font-bold text-[var(--muted)]">{p.vendor_name}</p> : null}
                  </div>
                  <IconTile icon={Fingerprint} size="sm" />
                </div>
                {/* One sentence instead of three numbers. "Confidence 61%" is a score a buyer can
                    neither check nor act on, so it is no longer the headline of this card. */}
                <Quiet className="mt-4 text-center text-[13px] font-extrabold text-[#111214]">
                  {links} lab test{links === 1 ? "" : "s"}{conflicts > 0 ? <span className="text-[#9b6b22]">, {conflicts} disagree{conflicts === 1 ? "s" : ""}</span> : ", no disagreements"}
                </Quiet>
                {conflicts > 0 && <p className="mt-3 inline-flex items-center gap-1 text-[11px] font-extrabold text-[#9b6b22]"><TriangleAlert className="size-3" aria-hidden="true" /> Results disagree — both shown</p>}
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-extrabold text-[#2b31d8]">Open the record <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" /></span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
