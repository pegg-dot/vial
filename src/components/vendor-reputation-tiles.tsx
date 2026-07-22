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

const STATUS_MEANING: Record<string, string> = {
  established: "We hold direct evidence for this, shown on the card with its source. It's a fact we can point to — not a rating we assigned.",
  unknown: "We have no evidence for this yet. “Unknown” is not a mark against the vendor — it means the data is simply absent, and we refuse to invent a number to fill the gap.",
  disputed: "The evidence here conflicts with itself. That's a genuine reason for caution, and we show it rather than smoothing it over.",
};

const PROVENANCE_LABELS: Record<string, string> = {
  lab_test_records: "Independent third-party lab certificates",
  batch_passport: "Published batch passports",
  organization: "The vendor's observed public profile",
  seller_analytics_daily: "Storefront fulfilment analytics",
  marketplace_reviews: "Verified-purchase buyer reviews",
  community_mentions: "Gathered buyer reviews & community reports",
  fraud_cases: "Fraud & abuse case records",
};

function toneOf(status: string) {
  return status === "established"
    ? { chip: "bg-emerald-50 text-emerald-800", Icon: CheckCircle2, iconClass: "text-emerald-700", card: "border-black/[.07] bg-white" }
    : status === "disputed"
    ? { chip: "bg-amber-50 text-amber-800", Icon: AlertTriangle, iconClass: "text-amber-700", card: "border-amber-200 bg-amber-50" }
    : { chip: "bg-black/[.05] text-black/55", Icon: CircleDashed, iconClass: "text-black/35", card: "border-dashed border-black/15 bg-black/[.015]" };
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
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {dimensions.map((d) => {
          const t = toneOf(d.status);
          return (
            <div key={d.key} className={`rounded-[26px] border p-5 ${t.card}`}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-semibold">{PLAIN_DIMENSION_LABELS[d.key] ?? d.label}</h3>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${t.chip}`}><t.Icon className={`size-3 ${t.iconClass}`} />{d.status}</span>
              </div>
              <p className="mt-3 text-lg font-semibold tracking-[-.02em]">{d.value}</p>
              <p className="mt-2 text-xs leading-5 text-[var(--muted)]">{d.basis}</p>
              <button type="button" onClick={() => setOpen(d)} className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-black/45 transition hover:text-black/70">
                What does &ldquo;{d.status}&rdquo; mean? →
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
                    <span className={`mt-2 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${t.chip}`}><t.Icon className={`size-3 ${t.iconClass}`} />{open.status}</span>
                  </div>
                  <button type="button" onClick={() => setOpen(null)} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-full border border-black/[.1] bg-white text-black/50 transition hover:text-black"><X className="size-4" /></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                  <p className="text-2xl font-semibold tracking-[-.03em]">{open.value}</p>
                  <p className="mt-4 text-sm leading-7 text-black/70">{open.basis}</p>
                  <div className="mt-6 rounded-2xl border border-black/[.08] bg-white p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-black/50">What &ldquo;{open.status}&rdquo; means here</p>
                    <p className="mt-2 text-sm leading-6 text-black/70">{STATUS_MEANING[open.status] ?? ""}</p>
                  </div>
                  <p className="mt-4 text-xs leading-5 text-[var(--muted)]">Source: {PROVENANCE_LABELS[open.provenance.sourceType] ?? open.provenance.sourceType}. Every answer stands on its own and cites where it came from — we never blend them into one score.</p>
                </div>
              </>
            );
          })() : null}
        </aside>
      </div>
    </>
  );
}
