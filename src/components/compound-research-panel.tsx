import { ArrowUpRight, FlaskConical, Scale, ShieldAlert } from "lucide-react";
import type { CompoundResearch } from "@/server/external/repository";
import { Chip, Notice, NumberedSection, Quiet, SectionHeading, UI, type Tone } from "@/components/intelligence/research-ui";
import { ShowMoreBlocks } from "./show-more-blocks";

// Sourced scientific-literature findings for a compound. Educational and non-promotional: every claim
// cites a real paper, human trials are visually separated from animal/in-vitro work, and safety notes
// and evidence gaps are shown as prominently as any efficacy signal. No dosing, no recommendation.
//
// Findings render as ROWS of one flat card, not a stack of shadowed cards — a reference list, not
// a wall. Safety notes are quiet inline warn-toned text rather than boxed banners, the list is
// bounded at three rows, and the expander is a flush footer matching the tables elsewhere on the page.
const PREVIEW_FINDINGS = 3;

// Study design as a chip tone: mint for randomised human evidence, blue for other human work,
// violet for reviews, paper for animal and in-vitro findings.
const STUDY: Record<string, { label: string; tone: Tone; rank: number }> = {
  "human-rct": { label: "Human RCT", tone: "mint", rank: 0 },
  "meta-analysis": { label: "Meta-analysis", tone: "mint", rank: 1 },
  "human-trial": { label: "Human study", tone: "blue", rank: 2 },
  review: { label: "Review", tone: "violet", rank: 3 },
  animal: { label: "Animal", tone: "paper", rank: 4 },
  "in-vitro": { label: "In-vitro", tone: "paper", rank: 5 },
};

/**
 * How the regulatory notice is toned.
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
  approvedDrugExists: { tone: "blue", label: "An approved drug exists — this is not it" },
  noApprovedDrug: { tone: "warn", label: "No FDA-approved drug" },
  unknown: { tone: "warn", label: "Approval status not established" },
} as const;

const intro = (compoundName: string) =>
  `What the published literature actually shows about ${compoundName} — separate from any vendor’s marketing. Each finding links to its paper. This is education, not medical or dosing advice.`;

// With `id` and `number` it renders as the page's numbered section frame (the compound page);
// otherwise as a standalone section.
export function CompoundResearchPanel({ findings, regulatoryStatus, evidenceSummary, compoundName, fdaApprovedDrugExists, id, number }: { findings: CompoundResearch[]; regulatoryStatus: string | null; evidenceSummary: string | null; compoundName: string; fdaApprovedDrugExists?: boolean | null; id?: string; number?: number }) {
  if (findings.length === 0 && !regulatoryStatus && !evidenceSummary) return null;
  const card = REGULATORY_CARD[
    fdaApprovedDrugExists === true ? "approvedDrugExists"
      : fdaApprovedDrugExists === false ? "noApprovedDrug"
      : "unknown"
  ];
  const framed = Boolean(id && number != null);
  const renderFinding = (f: CompoundResearch) => {
    const s = STUDY[f.study_type ?? ""] ?? { label: f.study_type ?? "Study", tone: "paper" as Tone, rank: 9 };
    return (
      <div key={`${f.source_url}-${f.claim.slice(0, 24)}`} className="px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={s.tone} icon={FlaskConical}>{s.label}</Chip>
          {f.source_title && <span className="min-w-0 text-[11px] font-bold leading-4 text-[var(--muted)]">{f.source_title}</span>}
        </div>
        <p className="mt-2 max-w-4xl text-[13px] font-medium leading-6 text-[#3a3d46]">{f.claim}</p>
        {f.safety_note && (
          <p className="mt-1.5 flex max-w-4xl items-start gap-1.5 text-[12px] font-medium leading-5 text-[#9b6b22]"><ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> {f.safety_note}</p>
        )}
        <a href={f.source_url} target="_blank" rel="noopener noreferrer" className={UI.linkSmall + " mt-2"}>read the source <ArrowUpRight className="size-3.5" aria-hidden="true" /></a>
      </div>
    );
  };
  const body = (
    <>
      {regulatoryStatus && (
        <Notice tone={card.tone} icon={Scale}>
          <p className={UI.eyebrowMuted}>Regulatory status</p>
          <p className="mt-1 font-extrabold">{card.label}</p>
          <p className="mt-1">{regulatoryStatus}</p>
        </Notice>
      )}

      {evidenceSummary && (
        <Quiet>
          <p className={UI.eyebrow}>Honest overall read</p>
          <p className="mt-1.5 text-base font-medium leading-7 text-[#111214]">{evidenceSummary}</p>
        </Quiet>
      )}

      {findings.length > 0 && (
        <div className={(framed ? "ink-1 rounded-[14px]" : "ink hard-sm rounded-[16px]") + " overflow-hidden bg-white"}>
          <ShowMoreBlocks
            className="divide-y divide-[#111214]/10"
            restCount={findings.length - PREVIEW_FINDINGS}
            label={`Show all ${findings.length} findings`}
            buttonClassName="flex min-h-11 w-full items-center gap-1.5 border-t-2 border-[#111214] bg-[var(--background)] px-5 py-3 text-left text-sm font-extrabold text-[#2b31d8] hover:underline"
            preview={findings.slice(0, PREVIEW_FINDINGS).map(renderFinding)}
            rest={findings.slice(PREVIEW_FINDINGS).map(renderFinding)}
          />
        </div>
      )}
    </>
  );

  if (framed) {
    return (
      <NumberedSection id={id!} number={number!} eyebrow="What the research says" title="Scientific evidence & regulatory status" intro={intro(compoundName)}>
        {body}
      </NumberedSection>
    );
  }
  return (
    <section id={id} className={UI.container + " scroll-mt-[140px] pb-4"}>
      <SectionHeading eyebrow="What the research says" title="Scientific evidence & regulatory status" lead={intro(compoundName)} />
      <div className="mt-7 space-y-4">{body}</div>
    </section>
  );
}
