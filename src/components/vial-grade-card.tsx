import { Check, CircleAlert, CircleDashed, CircleSlash, Factory, ShieldCheck, X } from "lucide-react";
import type { GradeBand, DimensionKey, DimensionState, VialGradeResult } from "@/server/verify/grade";
import { Chip, Frame, UI, type Tone } from "@/components/intelligence/research-ui";

// The pill also renders from the MATERIALIZED grade on a vendor row, which is a plain object
// rather than a full VialGradeResult — same fields, no dimensions.
export type GradeLike = { letter: string | null; band: string; rationale?: string };

// The headline evidence grade. It is deliberately never shown alone: the letter, the reason it landed
// there, and the per-dimension evidence ship as one block, so the reader can always audit the
// number instead of trusting it. When the evidence is too thin, there is no letter at all.
//
// Each band is one kit tone: the frame tint says which kind of answer this is, the letter box is
// the tone's ink. Blue is the informational tone for "not enough evidence" (the kit keeps violet
// for model-draft surfaces); a maker is paper — neutral, never a rank, because it is not a shop.
const BAND: Record<GradeBand, { tone: Tone; box: string; accent: string; icon: typeof ShieldCheck }> = {
  strong: { tone: "mint", box: "bg-[#0e8f80]", accent: "#0b6b60", icon: ShieldCheck },
  mixed: { tone: "warn", box: "bg-[#9b6b22]", accent: "#9b6b22", icon: CircleAlert },
  adverse: { tone: "danger", box: "bg-[#ce403b]", accent: "#ce403b", icon: X },
  insufficient: { tone: "blue", box: "bg-[#2b31d8]", accent: "#2b31d8", icon: CircleDashed },
  reference: { tone: "paper", box: "bg-[#3a3d46]", accent: "#3a3d46", icon: Factory },
};

// The row names, in the words a buyer would use. The graph files these as testing / regulatory /
// reputation / operations; the person reading is asking "do they have lab tests" and "has the
// government said anything about them", so that is what the row says.
const DIMENSION_LABEL: Record<DimensionKey, string> = {
  testing: "Lab tests",
  regulatory: "Government records",
  reputation: "Buyer reports",
  operations: "Business info",
};

const STATE: Record<DimensionState, { label: string; icon: typeof ShieldCheck; tone: string }> = {
  supported: { label: "Yes", icon: ShieldCheck, tone: "text-[#0b6b60]" },
  // "We checked and found nothing against them" — real, but weaker than evidence FOR them.
  clear: { label: "Nothing bad found", icon: Check, tone: "text-[#4a4d56]" },
  adverse: { label: "Concerns found", icon: X, tone: "text-[#ce403b]" },
  conflicting: { label: "Reports disagree", icon: CircleAlert, tone: "text-[#9b6b22]" },
  // Neutral observation, not an alarm — styled like a note, not a warning.
  noted: { label: "Worth a look", icon: CircleDashed, tone: "text-[#4a4d56]" },
  absent: { label: "Nothing on file", icon: CircleSlash, tone: "text-[#111214]/35" },
};

function DimensionRow({ dimensionKey, label, state, count }: { dimensionKey: DimensionKey; label: string; state: DimensionState; count: number }) {
  const s = STATE[state];
  const Icon = s.icon;
  // "Nothing on record · 1" is a contradiction. An absent dimension may still hold a factor — the
  // trust graph records "no lab tests on record" AS a factor — but there is nothing to count.
  const showCount = state !== "absent" && count > 0;
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[#111214]/10 py-2.5 first:border-t-0">
      <span className="text-[13px] font-bold text-[#3a3d46]">{DIMENSION_LABEL[dimensionKey] ?? label}</span>
      <span className={`inline-flex items-center gap-1.5 text-[12px] font-bold ${s.tone}`}>
        <Icon className="size-3.5" aria-hidden="true" />
        {s.label}
        {/* The number is how many checks fed this row — say so, so it can't be misread as
            "13 lab tests" when it is "1 check that found 13". */}
        {showCount && <span className="text-[#111214]/40">· {count} check{count === 1 ? "" : "s"}</span>}
      </span>
    </div>
  );
}

// `vendorName` names the card as a region ("VialGrade {name}") where it is the hero's aside.
export function VialGradeCard({ grade, summary, vendorName }: { grade: VialGradeResult; summary: string; vendorName?: string }) {
  const b = BAND[grade.band];
  const Icon = b.icon;
  const letterLabel = grade.letter === null ? "Not graded — not enough evidence" : `VialGrade ${grade.letter}`;
  return (
    <Frame as="section" tone={b.tone} shadow="lg" radius="rounded-[20px]" ariaLabel={vendorName ? `VialGrade ${vendorName}` : undefined} className="flex flex-col">
      <Chip tone={b.tone} icon={Icon} className="w-fit">VialGrade</Chip>

      <div className="mt-4 flex items-center gap-4">
        <span className={`ink hard-sm grid size-[76px] shrink-0 place-items-center rounded-[18px] text-white ${b.box}`}>
          <span aria-hidden="true" className="text-[34px] font-extrabold leading-none tracking-[-.06em]">{grade.letter ?? "—"}</span>
          <span className="sr-only">{letterLabel}</span>
        </span>
        <div className="min-w-0">
          {/* Deliberately NOT a heading. "B — generally trusted" as an <h2> is a page heading that
              asserts a vendor is trustworthy; the same words as a sentence, under a heading that
              asks the question instead, say exactly as much without the page structure vouching
              for it. The verdict section below owns the heading. */}
          <p className="text-2xl font-extrabold leading-tight tracking-[-.03em] text-[#111214]">{grade.headline}</p>
          <p className="mt-1.5 text-[15px] font-medium leading-6 text-[#3a3d46]">{summary}</p>
          <p className={UI.small + " mt-2"}>Evidence summary only. Not a safety, authenticity, approval, or lawful-sale certification.</p>
        </div>
      </div>

      {/* The decomposition the letter is built from — never collapsed away entirely. */}
      <div className="ink-1 mt-5 rounded-[14px] bg-white px-4 py-1.5">
        {grade.dimensions.map(d => (
          <DimensionRow key={d.key} dimensionKey={d.key} label={d.label} state={d.state} count={d.factors.length} />
        ))}
      </div>

      <p className={UI.small + " mt-3"}>
        <span className={UI.eyebrowMuted}>Why this grade — </span>
        {grade.rationale}
      </p>

      {/* Sentence case, not the uppercase kicker it used to be — this is a sentence now, and
          "WEIGHED ACROSS 4 SIGNALS" was neither readable nor a phrase anyone says. */}
      <p className="mt-auto pt-4 text-[11px] font-bold text-[#4a4d56]">
        {`${grade.letter === null ? "Only" : "Based on"} ${grade.weighed} check${grade.weighed === 1 ? "" : "s"}${grade.letter === null ? " so far" : ""}. ${grade.verifiedCount > 0 ? `${grade.verifiedCount} backed by a document.` : "None backed by a document."}`}
      </p>
    </Frame>
  );
}

// The compact grade, for market cards and directory rows — the surfaces a buyer actually lands on.
// It carries the seller's name because on a market card the question is "who am I buying from and
// are they OK", and it still refuses to show a letter the evidence does not support.
export function VialGradePill({ grade, vendorName }: { grade: GradeLike; vendorName?: string }) {
  const b = BAND[(grade.band as GradeBand) ?? "insufficient"];
  const ungraded = grade.letter === null || grade.letter === undefined;
  return (
    <span
      className="ink-1 inline-flex items-center gap-1.5 rounded-full bg-white px-2 py-1 text-[11px] font-bold"
      style={{ color: b.accent }}
      title={grade.rationale || undefined}
    >
      <span className={`ink-1 grid size-5 shrink-0 place-items-center rounded-full text-white ${b.box}`}>
        <span className="text-[10px] font-extrabold leading-none">{ungraded ? "?" : grade.letter}</span>
      </span>
      <span className="uppercase tracking-[.08em]">
        {grade.band === "reference" ? "Maker — not a shop" : ungraded ? "Not rated yet" : `Grade ${grade.letter}`}
      </span>
      {vendorName && <span className="max-w-[9rem] truncate font-semibold normal-case tracking-normal opacity-70">· {vendorName}</span>}
    </span>
  );
}

// The grade at row density: the letter in an ink box, nothing else. The pill's wash of band
// colour was one more coloured thing on a tile already carrying three; the letter is the
// information, the rationale rides in the tooltip, and the vendor page has the full block.
// No letter → nothing: three quarters of vendors are unrated, and a "?" on three quarters of the
// market is noise, not an unknown kept visible (the listing's own evidence line stays).
export function VialGradeMark({ grade, vendorName }: { grade: GradeLike; vendorName?: string }) {
  if (grade.letter === null || grade.letter === undefined || grade.band === "reference") return null;
  const b = BAND[(grade.band as GradeBand) ?? "insufficient"];
  return (
    <span
      className="ink hard-sm inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-[6px] bg-white px-1 text-[11px] font-extrabold leading-none tabular-nums"
      style={{ color: b.accent }}
      title={`${vendorName ? `${vendorName} — ` : ""}VialGrade ${grade.letter}${grade.rationale ? `. ${grade.rationale}` : ""}`}
      aria-label={`VialGrade ${grade.letter}`}
    >
      {grade.letter}
    </span>
  );
}
