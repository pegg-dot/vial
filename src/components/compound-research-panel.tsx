import { ExternalLink, FlaskConical, Scale, ShieldAlert } from "lucide-react";
import type { CompoundResearch } from "@/server/external/repository";

// Sourced scientific-literature findings for a compound. Educational and non-promotional: every claim
// cites a real paper, human trials are visually separated from animal/in-vitro work, and safety notes
// and evidence gaps are shown as prominently as any efficacy signal. No dosing, no recommendation.
const STUDY: Record<string, { label: string; cls: string; rank: number }> = {
  "human-rct": { label: "Human RCT", cls: "bg-[#e6fbf6] text-[#0e8f80]", rank: 0 },
  "meta-analysis": { label: "Meta-analysis", cls: "bg-[#e6fbf6] text-[#0e8f80]", rank: 1 },
  "human-trial": { label: "Human study", cls: "bg-[#eaf3ff] text-[#2b31d8]", rank: 2 },
  review: { label: "Review", cls: "bg-[#f0edff] text-[#5a4be0]", rank: 3 },
  animal: { label: "Animal", cls: "bg-black/[.06] text-black/55", rank: 4 },
  "in-vitro": { label: "In-vitro", cls: "bg-black/[.06] text-black/55", rank: 5 },
};

export function CompoundResearchPanel({ findings, regulatoryStatus, evidenceSummary, compoundName }: { findings: CompoundResearch[]; regulatoryStatus: string | null; evidenceSummary: string | null; compoundName: string }) {
  if (findings.length === 0 && !regulatoryStatus && !evidenceSummary) return null;
  const approved = /FDA-approved/i.test(regulatoryStatus ?? "") && !/Not FDA/i.test(regulatoryStatus ?? "");
  return (
    <section className="mx-auto max-w-[1320px] px-5 pb-4 sm:px-8">
      <div className="mb-7">
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#5a4be0]">What the research says</p>
        <h2 className="mt-3 text-[clamp(1.8rem,3.6vw,2.6rem)] font-extrabold leading-[.98] tracking-[-.04em]">Scientific evidence &amp; regulatory status</h2>
        <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">What the published literature actually shows about {compoundName} — separate from any vendor&rsquo;s marketing. Each finding links to its paper. This is education, not medical or dosing advice.</p>
      </div>

      {regulatoryStatus && (
        <div className={`ink hard mb-4 flex items-start gap-3 rounded-[18px] p-5 ${approved ? "bg-[#e6fbf6]" : "bg-[#fff6e6]"}`}>
          <Scale className={`mt-0.5 size-5 shrink-0 ${approved ? "text-[#0e8f80]" : "text-[#b26a00]"}`} />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">Regulatory status</p>
            <p className="mt-1 text-sm font-semibold leading-6 text-black/80">{regulatoryStatus}</p>
          </div>
        </div>
      )}

      {evidenceSummary && (
        <div className="ink hard mb-5 rounded-[18px] bg-white p-5">
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#2b31d8]">Honest overall read</p>
          <p className="mt-1.5 text-base font-medium leading-7 text-black/80">{evidenceSummary}</p>
        </div>
      )}

      <div className="space-y-3">
        {findings.map((f) => {
          const s = STUDY[f.study_type ?? ""] ?? { label: f.study_type ?? "Study", cls: "bg-black/[.06] text-black/55", rank: 9 };
          return (
            <div key={`${f.source_url}-${f.claim.slice(0, 24)}`} className="ink-1 hard rounded-[18px] bg-white p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`ink-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${s.cls}`}><FlaskConical className="size-3" /> {s.label}</span>
                {f.source_title && <span className="text-[11px] font-semibold text-[var(--muted)]">{f.source_title}</span>}
              </div>
              <p className="mt-3 text-sm font-medium leading-7 text-black/80">{f.claim}</p>
              {f.safety_note && (
                <p className="ink-1 mt-3 flex items-start gap-2 rounded-xl bg-[#fff6e6] px-3 py-2 text-[13px] font-medium leading-5 text-[#111214]/80"><ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-[#b26a00]" /> {f.safety_note}</p>
              )}
              <a href={f.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-black/45 hover:text-black">read the source <ExternalLink className="size-3" /></a>
            </div>
          );
        })}
      </div>
    </section>
  );
}
