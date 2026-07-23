import { ExternalLink, FlaskConical, Scale, ShieldAlert } from "lucide-react";
import type { CompoundResearch } from "@/server/external/repository";

// Sourced scientific-literature findings for a compound. Educational and non-promotional: every claim
// cites a real paper, human trials are visually separated from animal/in-vitro work, and safety notes
// and evidence gaps are shown as prominently as any efficacy signal. No dosing, no recommendation.
const STUDY: Record<string, { label: string; cls: string; rank: number }> = {
  "human-rct": { label: "Human RCT", cls: "bg-emerald-50 text-emerald-700", rank: 0 },
  "meta-analysis": { label: "Meta-analysis", cls: "bg-emerald-50 text-emerald-700", rank: 1 },
  "human-trial": { label: "Human study", cls: "bg-sky-50 text-sky-700", rank: 2 },
  review: { label: "Review", cls: "bg-violet-50 text-violet-700", rank: 3 },
  animal: { label: "Animal", cls: "bg-black/[.05] text-black/55", rank: 4 },
  "in-vitro": { label: "In-vitro", cls: "bg-black/[.05] text-black/55", rank: 5 },
};

export function CompoundResearchPanel({ findings, regulatoryStatus, evidenceSummary, compoundName }: { findings: CompoundResearch[]; regulatoryStatus: string | null; evidenceSummary: string | null; compoundName: string }) {
  if (findings.length === 0 && !regulatoryStatus && !evidenceSummary) return null;
  const approved = /FDA-approved/i.test(regulatoryStatus ?? "") && !/Not FDA/i.test(regulatoryStatus ?? "");
  return (
    <section className="mx-auto max-w-[1320px] px-5 pb-4 sm:px-8">
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[var(--muted)]">What the research says</p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-.045em]">Scientific evidence &amp; regulatory status</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">What the published literature actually shows about {compoundName} — separate from any vendor&rsquo;s marketing. Each finding links to its paper. This is education, not medical or dosing advice.</p>
      </div>

      {regulatoryStatus && (
        <div className={`mb-4 flex items-start gap-3 rounded-[24px] border p-5 ${approved ? "border-emerald-200 bg-emerald-50/60" : "border-amber-200 bg-amber-50/60"}`}>
          <Scale className={`mt-0.5 size-5 shrink-0 ${approved ? "text-emerald-700" : "text-amber-700"}`} />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[var(--muted)]">Regulatory status</p>
            <p className="mt-1 text-sm leading-6 text-black/80">{regulatoryStatus}</p>
          </div>
        </div>
      )}

      {evidenceSummary && (
        <div className="mb-5 rounded-[24px] border border-black/[.07] bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[var(--muted)]">Honest overall read</p>
          <p className="mt-1.5 text-base leading-7 text-black/80">{evidenceSummary}</p>
        </div>
      )}

      <div className="space-y-3">
        {findings.map((f) => {
          const s = STUDY[f.study_type ?? ""] ?? { label: f.study_type ?? "Study", cls: "bg-black/[.05] text-black/55", rank: 9 };
          return (
            <div key={`${f.source_url}-${f.claim.slice(0, 24)}`} className="rounded-[24px] border border-black/[.07] bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.cls}`}><FlaskConical className="size-3" /> {s.label}</span>
                {f.source_title && <span className="text-[11px] text-[var(--muted)]">{f.source_title}</span>}
              </div>
              <p className="mt-3 text-sm leading-7 text-black/80">{f.claim}</p>
              {f.safety_note && (
                <p className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50/70 px-3 py-2 text-[13px] leading-5 text-amber-950/80"><ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-amber-700" /> {f.safety_note}</p>
              )}
              <a href={f.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-black/45 hover:text-black">read the source <ExternalLink className="size-3" /></a>
            </div>
          );
        })}
      </div>
    </section>
  );
}
