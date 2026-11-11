import Link from "next/link";
import { BookOpen, ChevronDown } from "lucide-react";
import type { CompoundEducation } from "@/lib/compound-education";
import { goalLabel, goalBlurb } from "@/lib/compound-education";
import { researchStage, type CompoundDepth } from "@/lib/compound-depth";
import { Chip, Frame, IconTile, Notice, NumberedSection, UI, type Tone } from "@/components/intelligence/research-ui";
import { GoalTags } from "./goal-tags";

// The research stage is a fact about the molecule, so it is a chip whose tone says what kind of
// fact: blue for an approved or widely studied molecule, violet for a trial in progress, warn
// when the human data is thin.
const STAGE_TONE: Record<string, Tone> = { approved: "blue", clinical: "violet", preclinical: "warn", limited: "warn", studied: "blue" };

// The "I just want to understand what this is" panel. The visible answer is the PLAIN-ENGLISH
// translation (compound-plain-english.ts) — everyday words first, always. The science lives
// inside the dropdowns, labeled as the science, and every dropdown starts CLOSED so the panel
// reads as one card, not a wall. No dosing, medical, or human-use guidance (research only).
//
// With `id` and `number` it renders as the page's numbered section frame (the compound page);
// otherwise as a standalone card (the product page).
export function CompoundKnowledge({
  name, education, depth, stacked = [], showStacks = false, id, number,
}: {
  name: string;
  education: CompoundEducation;
  depth?: CompoundDepth;
  stacked?: { slug: string; name: string }[];
  showStacks?: boolean;
  id?: string;
  number?: number;
}) {
  const goals = education.goals ?? [];
  const stage = depth ? researchStage(depth.researchStatus) : null;
  const chips = stage || depth?.knownAs ? (
    <>
      {stage && <Chip tone={STAGE_TONE[stage.stage] ?? "blue"}>{stage.label}</Chip>}
      {depth?.knownAs ? <Chip plain tone="paper">a.k.a. {depth.knownAs}</Chip> : null}
    </>
  ) : null;
  const body = (
    <>
      {depth?.plainEnglish ? (
        <p className="max-w-3xl text-[15px] font-medium leading-7 text-[#3a3d46]">{depth.plainEnglish}</p>
      ) : education.summary ? (
        <p className="max-w-3xl text-[15px] font-medium leading-7 text-[#3a3d46]">{education.summary}</p>
      ) : null}
      {goals.length > 0 ? <div><GoalTags goals={goals} size="md" /></div> : null}

      {depth?.caveat ? (
        <Notice tone="warn">
          <p className="text-[13px] leading-6"><span className="font-extrabold">Good to know:</span> {depth.caveat}</p>
        </Notice>
      ) : null}

      <div className="border-t border-[#111214]/10">
        {depth?.mechanism ? (
          <QA q={`How does ${name} work?`}>
            <p className={UI.eyebrowMuted + " mb-1.5"}>The science</p>
            <p>{depth.mechanism}</p>
            <p className="mt-2 text-xs text-[var(--muted)]">Mechanism of action from published research — how the molecule behaves, not a claim about any product or any human-use effect.</p>
          </QA>
        ) : null}

        {(depth?.researchedFor || goals.length > 0) ? (
          <QA q={`What is ${name} researched for?`}>
            {depth?.researchedFor ? <p className="mb-3">{depth.researchedFor}</p> : null}
            {goals.length > 0 && (
              <ul className="space-y-3.5">
                {goals.map((g) => (
                  <li key={g} className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                    <span className="shrink-0 font-extrabold text-[#111214] sm:w-52">{goalLabel(g)}</span>
                    <span className="text-[#4a4d56]">{goalBlurb(g)}</span>
                  </li>
                ))}
              </ul>
            )}
          </QA>
        ) : null}

        {depth?.researchStatus ? (
          <QA q="How far has the research gone?">
            <p>{depth.researchStatus}</p>
            <p className="mt-2 text-xs text-[var(--muted)]">An FDA-approved finished drug is not interchangeable with an independently marketed research listing, and regulatory status must be evaluated product by product.</p>
          </QA>
        ) : null}

        {showStacks && stacked.length > 0 ? (
          <QA q={`What is ${name} commonly stacked with?`}>
            <p className="mb-3">Compounds the research community frequently discusses alongside {name}. Not a protocol or a recommendation — a map of what to read about next.</p>
            <div className="flex flex-wrap gap-2">
              {stacked.map((s) => (
                <Link key={s.slug} href={`/compounds/${s.slug}`} className="ink-1 inline-flex min-h-7 items-center rounded-full bg-white px-3 py-1 text-[11px] font-extrabold text-[#111214] transition-colors hover:bg-[#eef0ff]">
                  {s.name}
                </Link>
              ))}
            </div>
          </QA>
        ) : null}

        <QA q="How should a laboratory report be interpreted?">
          <ul className="space-y-2.5">
            <li className="flex gap-2.5"><Dot /><span><span className="font-extrabold text-[#111214]">Scope.</span> A report describes a tested sample and specified methods; it does not verify all inventory or a future shipment.</span></li>
            <li className="flex gap-2.5"><Dot /><span><span className="font-extrabold text-[#111214]">Provenance.</span> Lab identity, sample identifier, source document and custody records can support or weaken a match.</span></li>
            <li className="flex gap-2.5"><Dot /><span><span className="font-extrabold text-[#111214]">Missing evidence.</span> Purity findings are not proof of sterility, clinical effectiveness, FDA approval, or legality.</span></li>
          </ul>
          <p className="mt-3 text-xs text-[var(--muted)]">Documentary research only. VialGrade provides no advice about purchasing, combining, dosing or using compounds.</p>
        </QA>
      </div>
    </>
  );

  if (id && number != null) {
    return (
      <NumberedSection id={id} number={number} eyebrow="Understand this compound" title={`What is ${name}?`} chips={chips}>
        {body}
      </NumberedSection>
    );
  }
  return (
    <Frame shadow="sm" radius="rounded-[16px]">
      <div className="flex items-center gap-3">
        <IconTile icon={BookOpen} size="sm" />
        <p className={UI.eyebrow}>Understand this compound</p>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <h2 className={UI.h3 + " sm:text-2xl"}>What is {name}?</h2>
        {chips}
      </div>
      <div className="mt-3 space-y-4">{body}</div>
    </Frame>
  );
}

function QA({ q, children, open }: { q: string; children: React.ReactNode; open?: boolean }) {
  return (
    <details open={open} className="group border-b border-[#111214]/10 last:border-0">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 py-3 text-[15px] font-extrabold tracking-[-.01em] text-[#111214] marker:hidden [&::-webkit-details-marker]:hidden">
        {q}
        <ChevronDown className="size-4 shrink-0 text-[#4a4d56] transition-transform duration-200 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="pb-5 pr-2 text-sm font-medium leading-6 text-[#3a3d46] sm:pr-8">{children}</div>
    </details>
  );
}

function Dot() {
  return <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#2b31d8]" />;
}
