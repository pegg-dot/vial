"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, X } from "lucide-react";
import type { ReputationDimension } from "@/server/reputation/repository";

const PLAIN_DIMENSION_LABELS: Record<string, string> = {
  identity_claim: "Who they are",
  documentation_currency: "Lab tests current?",
  evidence_corroboration: "Independently tested?",
  operational_reliability: "Track record shipping",
  community_signal: "What buyers say",
  open_risk_flags: "Scam & red flags",
};

// The stored status words are ours, not the reader's. "Established" and "disputed" are filing
// terms; what a buyer is asking is "do you actually know this or not?"
const STATUS_WORD: Record<string, string> = {
  established: "Confirmed",
  unknown: "We don't know",
  disputed: "Needs a closer look",
};

const STATUS_MEANING: Record<string, string> = {
  established: "We have the evidence for this, and the card shows where it came from. It's something we can point at — not a rating we made up.",
  unknown: "We don't have the evidence for this yet. That is not a mark against the vendor — the information simply isn't there, and we won't invent a number to fill the gap.",
  disputed: "What we found here doesn't line up — either the evidence disagrees with itself, or there is something on record against them. That's a real reason to slow down, so we show it instead of smoothing it over.",
};

const PROVENANCE_LABELS: Record<string, string> = {
  lab_test_records: "Independent lab reports",
  batch_passport: "Published batch test records",
  organization: "The vendor's own public page",
  seller_analytics_daily: "How their store actually shipped",
  marketplace_reviews: "Reviews from people who bought it",
  community_mentions: "Buyer reviews and community posts",
  fraud_cases: "Fraud and abuse case records",
};

function toneOf(status: string) {
  return status === "established"
    ? { chip: "bg-[#e6fbf6] text-[#0e8f80]", Icon: CheckCircle2, iconClass: "text-[#0e8f80]", card: "ink-1 hard bg-white" }
    : status === "disputed"
    ? { chip: "bg-[#fff6e6] text-[#b26a00]", Icon: AlertTriangle, iconClass: "text-[#b26a00]", card: "ink-1 hard bg-[#fff6e6]" }
    : { chip: "bg-[#111214]/[.06] text-black/55", Icon: CircleDashed, iconClass: "text-black/35", card: "border-2 border-dashed border-[#111214]/20 bg-white/40" };
}

export function VendorReputationTiles({ dimensions }: { dimensions: ReputationDimension[] }) {
  const [open, setOpen] = useState<ReputationDimension | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* One matrix, not six floating cards — the same label | stamp | answer rows the product
          page's verify matrix uses. Six cards repeated the same explainer link six times and left
          half of each box empty; here the whole read is six tight rows and one drawer per row. */}
      <div className="ink hard-sm overflow-hidden rounded-[16px] bg-white">
        {dimensions.map((d, i) => {
          const t = toneOf(d.status);
          return (
            <div key={d.key} className={`grid gap-2 px-4 py-3 sm:grid-cols-[170px_150px_1fr_auto] sm:items-center ${i > 0 ? "border-t border-[#111214]/10" : ""} ${d.status === "disputed" ? "bg-[#fff6e6]" : ""}`}>
              <p className="text-sm font-extrabold">{PLAIN_DIMENSION_LABELS[d.key] ?? d.label}</p>
              <span className={`ink-1 inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${t.chip}`}><t.Icon className={`size-3 ${t.iconClass}`} />{STATUS_WORD[d.status] ?? d.status}</span>
              <p className="min-w-0 text-[13px] font-medium leading-5 text-[var(--muted)]"><span className="font-extrabold text-[#111214]">{d.value}.</span> {d.basis}</p>
              <button type="button" onClick={() => setOpen(d)} aria-label={`What ${STATUS_WORD[d.status] ?? d.status} means for ${PLAIN_DIMENSION_LABELS[d.key] ?? d.label}`} className="justify-self-start whitespace-nowrap text-[11px] font-bold text-[#2b31d8] transition hover:opacity-70 sm:justify-self-end">
                Meaning →
              </button>
            </div>
          );
        })}
      </div>

      {/* Sliding explainer modal */}
      <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
        <div onClick={() => setOpen(null)} className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} />
        <aside role="dialog" aria-modal="true" className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-[#faf9f6] shadow-2xl transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}>
          {open ? (() => {
            const t = toneOf(open.status);
            return (
              <>
                <div className="flex items-start justify-between gap-4 border-b border-black/[.08] p-6">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[.16em] text-[var(--muted)]">{PLAIN_DIMENSION_LABELS[open.key] ?? open.label}</p>
                    <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${t.chip}`}><t.Icon className={`size-3 ${t.iconClass}`} />{STATUS_WORD[open.status] ?? open.status}</span>
                  </div>
                  <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full border border-black/[.1] bg-white text-black/50 transition hover:text-black"><X className="size-4" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <p className="text-2xl font-semibold tracking-[-.03em]">{open.value}</p>
                  <p className="mt-4 text-sm leading-7 text-black/70">{open.basis}</p>
                  <div className="mt-6 rounded-2xl border border-black/[.08] bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-black/50">What &ldquo;{STATUS_WORD[open.status] ?? open.status}&rdquo; means here</p>
                    <p className="mt-2 text-sm leading-6 text-black/70">{STATUS_MEANING[open.status] ?? ""}</p>
                  </div>
                  <p className="mt-4 text-xs leading-5 text-[var(--muted)]">Where this came from: {PROVENANCE_LABELS[open.provenance.sourceType] ?? open.provenance.sourceType}. Every answer stands on its own and says where it came from &mdash; we never blend them into one score.</p>
                </div>
              </>
            );
          })() : null}
        </aside>
      </div>
    </>
  );
}
