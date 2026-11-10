"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleDashed, X } from "lucide-react";
import type { ReputationDimension } from "@/server/reputation/repository";
import { Chip, Frame, UI } from "@/components/intelligence/research-ui";

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

// The chip tone says what kind of answer it is: mint for a recorded fact, warn for a disagreement,
// paper for a gap we are not going to paper over.
function toneOf(status: string): { tone: "mint" | "warn" | "paper"; Icon: typeof CheckCircle2 } {
  return status === "established" ? { tone: "mint", Icon: CheckCircle2 }
    : status === "disputed" ? { tone: "warn", Icon: AlertTriangle }
    : { tone: "paper", Icon: CircleDashed };
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
      {/* One matrix, not six floating cards — the same label | stamp | answer rows the verdict
          ledger above uses. Six cards repeated the same explainer link six times and left half of
          each box empty; here the whole read is six tight rows and one drawer per row. */}
      <div className="divide-y divide-[#111214]/10 overflow-hidden rounded-[14px] border border-[#111214]/15 bg-white">
        {dimensions.map((d) => {
          const t = toneOf(d.status);
          return (
            <div key={d.key} className={`grid gap-2 px-4 py-3 sm:grid-cols-[170px_170px_1fr_auto] sm:items-center ${d.status === "disputed" ? "bg-[#fff3d8]" : ""}`}>
              <p className="text-sm font-extrabold text-[#111214]">{PLAIN_DIMENSION_LABELS[d.key] ?? d.label}</p>
              <Chip tone={t.tone} icon={t.Icon} className="w-fit">{STATUS_WORD[d.status] ?? d.status}</Chip>
              <p className="min-w-0 text-[13px] font-medium leading-5 text-[var(--muted)]"><span className="font-extrabold text-[#111214]">{d.value}.</span> {d.basis}</p>
              <button type="button" onClick={() => setOpen(d)} aria-label={`What ${STATUS_WORD[d.status] ?? d.status} means for ${PLAIN_DIMENSION_LABELS[d.key] ?? d.label}`} className={UI.linkSmall + " justify-self-start whitespace-nowrap sm:justify-self-end"}>
                Meaning →
              </button>
            </div>
          );
        })}
      </div>

      {/* Sliding explainer drawer. Esc closes it (the listener above), as does the scrim. */}
      <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
        <div onClick={() => setOpen(null)} className={`absolute inset-0 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`} />
        {/* The drawer speaks the site's own language — ink borders, hard shadows, extrabold type,
            paper ground — the same register as the matrix it explains. */}
        <aside role="dialog" aria-modal="true" className={`absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l-2 border-[#111214] bg-[var(--background)] transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}>
          {open ? (() => {
            const t = toneOf(open.status);
            return (
              <>
                <div className="flex items-start justify-between gap-4 border-b-2 border-[#111214] bg-white p-5 sm:p-6">
                  <div>
                    <p className={UI.eyebrowMuted}>{PLAIN_DIMENSION_LABELS[open.key] ?? open.label}</p>
                    <Chip tone={t.tone} icon={t.Icon} className="mt-2">{STATUS_WORD[open.status] ?? open.status}</Chip>
                  </div>
                  <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="ink-1 press grid size-9 shrink-0 place-items-center rounded-full bg-white text-[#111214] hover:bg-[var(--background)]"><X className="size-4" aria-hidden="true" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-5 sm:p-6">
                  <p className={UI.h3 + " leading-7"}>{open.value}</p>
                  <p className={UI.body + " mt-3"}>{open.basis}</p>
                  <Frame thin shadow="sm" radius="rounded-[14px]" pad="sm" className="mt-5">
                    <p className={UI.eyebrow}>What &ldquo;{STATUS_WORD[open.status] ?? open.status}&rdquo; means here</p>
                    <p className={UI.bodyInk + " mt-2"}>{STATUS_MEANING[open.status] ?? ""}</p>
                  </Frame>
                  <p className={UI.small + " mt-4"}>Where this came from: <span className="font-bold text-[#111214]">{PROVENANCE_LABELS[open.provenance.sourceType] ?? open.provenance.sourceType}</span>. Every answer stands on its own and says where it came from &mdash; we never blend them into one score.</p>
                </div>
              </>
            );
          })() : null}
        </aside>
      </div>
    </>
  );
}
