import { ExternalLink, FlaskConical, Scale, ShieldAlert } from "lucide-react";
import type { CompoundResearch } from "@/server/external/repository";
import { ShowMoreBlocks } from "./show-more-blocks";

// Sourced scientific-literature findings for a compound. Educational and non-promotional: every claim
// cites a real paper, human trials are visually separated from animal/in-vitro work, and safety notes
// and evidence gaps are shown as prominently as any efficacy signal. No dosing, no recommendation.
// The list is bounded — the first findings show, the rest sit behind one expander — so the research
// section reads as a summary, not a second page.
const PREVIEW_FINDINGS = 3;

const STUDY: Record<string, { label: string; cls: string; rank: number }> = {
  "human-rct": { label: "Human RCT", cls: "bg-[#e6fbf6] text-[#0e8f80]", rank: 0 },
  "meta-analysis": { label: "Meta-analysis", cls: "bg-[#e6fbf6] text-[#0e8f80]", rank: 1 },
  "human-trial": { label: "Human study", cls: "bg-[#eaf3ff] text-[#2b31d8]", rank: 2 },
  review: { label: "Review", cls: "bg-[#f0edff] text-[#5a4be0]", rank: 3 },
  animal: { label: "Animal", cls: "bg-black/[.06] text-black/55", rank: 4 },
  "in-vitro": { label: "In-vitro", cls: "bg-black/[.06] text-black/55", rank: 5 },
};

/**
 * How the regulatory card is painted.
 *
 * This used to be decided by regexing the prose — /FDA-approved/i AND NOT /Not FDA/i — which meant
 * the sentence "Not AN FDA-approved drug" slipped past the negation and painted GHK-Cu, an
 * unapproved substance, with the green approved badge on its live page. The badge is now read from
 * a stored boolean that each record declares explicitly, so wording can never decide it.
 *
 * There is deliberately NO green "approved" state. Where an approved drug does exist, the material
 * sold through this site is never that drug: afamelanotide is approved as SCENESSE, an implant a
 * clinician places under the skin for a rare porphyria — not an online injectable vial; elamipretide
 * is approved as Forzinity for Barth syndrome. Painting those pages green would tell a buyer that
 * what they are about to purchase is FDA-approved, which is false and is exactly the claim this
 * site exists to check. So the third state says an approved drug EXISTS and that this is not it.
 */
const REGULATORY_CARD = {
  approvedDrugExists: {
    bg: "bg-[#eaf3ff]", fg: "text-[#2b31d8]",
    label: "An approved drug exists — this is not it",
  },
  noApprovedDrug: {
    bg: "bg-[#fff6e6]", fg: "text-[#b26a00]",
    label: "No FDA-approved drug",
  },
  unknown: {
    bg: "bg-[#fff6e6]", fg: "text-[#b26a00]",
    label: "Approval status not established",
  },
} as const;

export function CompoundResearchPanel({ findings, regulatoryStatus, evidenceSummary, compoundName, fdaApprovedDrugExists, id }: { findings: CompoundResearch[]; regulatoryStatus: string | null; evidenceSummary: string | null; compoundName: string; fdaApprovedDrugExists?: boolean | null; id?: string }) {
  if (findings.length === 0 && !regulatoryStatus && !evidenceSummary) return null;
  const card = REGULATORY_CARD[
    fdaApprovedDrugExists === true ? "approvedDrugExists"
      : fdaApprovedDrugExists === false ? "noApprovedDrug"
      : "unknown"
  ];
  const renderFinding = (f: CompoundResearch) => {
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
  };
  return (
    <section id={id} className="mx-auto max-w-[1320px] scroll-mt-[140px] px-5 pb-4 sm:px-8">
      <div className="mb-7">
        <p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#5a4be0]">What the research says</p>
        <h2 className="mt-3 text-[clamp(1.8rem,3.6vw,2.6rem)] font-extrabold leading-[.98] tracking-[-.04em]">Scientific evidence &amp; regulatory status</h2>
        <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-[var(--muted)]">What the published literature actually shows about {compoundName} — separate from any vendor&rsquo;s marketing. Each finding links to its paper. This is education, not medical or dosing advice.</p>
      </div>

      {regulatoryStatus && (
        <div className={`ink hard mb-4 flex items-start gap-3 rounded-[18px] p-5 ${card.bg}`}>
          <Scale className={`mt-0.5 size-5 shrink-0 ${card.fg}`} />
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--muted)]">Regulatory status</p>
            <p className={`mt-1 text-[13px] font-bold ${card.fg}`}>{card.label}</p>
            <p className="mt-1.5 text-sm font-semibold leading-6 text-black/80">{regulatoryStatus}</p>
          </div>
        </div>
      )}

      {evidenceSummary && (
        <div className="ink hard mb-5 rounded-[18px] bg-white p-5">
          <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#2b31d8]">Honest overall read</p>
          <p className="mt-1.5 text-base font-medium leading-7 text-black/80">{evidenceSummary}</p>
        </div>
      )}

      <ShowMoreBlocks
        className="space-y-3"
        restCount={findings.length - PREVIEW_FINDINGS}
        label={`Show all ${findings.length} findings`}
        preview={findings.slice(0, PREVIEW_FINDINGS).map(renderFinding)}
        rest={findings.slice(PREVIEW_FINDINGS).map(renderFinding)}
      />
    </section>
  );
}
