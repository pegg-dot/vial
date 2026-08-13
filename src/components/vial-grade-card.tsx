import { Check, CircleAlert, CircleDashed, CircleSlash, Factory, ShieldCheck, X } from "lucide-react";
import type { GradeBand, DimensionKey, DimensionState, VialGradeResult } from "@/server/verify/grade";

// The pill also renders from the MATERIALIZED grade on a vendor row, which is a plain object
// rather than a full VialGradeResult — same fields, no dimensions.
export type GradeLike = { letter: string | null; band: string; rationale?: string };

// The headline grade. It is deliberately never shown alone: the letter, the reason it landed
// there, and the per-dimension evidence ship as one block, so the reader can always audit the
// number instead of trusting it. When the evidence is too thin, there is no letter at all.
const BAND: Record<GradeBand, { wrap: string; chip: string; accent: string; icon: typeof ShieldCheck }> = {
  strong: { wrap: "bg-[#e6fbf4]", chip: "bg-[#0e8f80]", accent: "#0e8f80", icon: ShieldCheck },
  mixed: { wrap: "bg-[#fff4e0]", chip: "bg-[#b26a00]", accent: "#b26a00", icon: CircleAlert },
  adverse: { wrap: "bg-[#fff1f0]", chip: "bg-[#d3372c]", accent: "#d3372c", icon: X },
  insufficient: { wrap: "bg-[#f0edff]", chip: "bg-[#6d5dfc]", accent: "#6d5dfc", icon: CircleDashed },
  // Neutral, never a rank — a maker is not a worse shop, it is not a shop.
  reference: { wrap: "bg-[#f2f2ef]", chip: "bg-[#39414e]", accent: "#39414e", icon: Factory },
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
  supported: { label: "Yes", icon: ShieldCheck, tone: "text-[#0e8f80]" },
  // "We checked and found nothing against them" — real, but weaker than evidence FOR them.
  clear: { label: "Nothing bad found", icon: Check, tone: "text-[#111214]/55" },
  adverse: { label: "Concerns found", icon: X, tone: "text-[#d3372c]" },
  conflicting: { label: "Reports disagree", icon: CircleAlert, tone: "text-[#b26a00]" },
  // Neutral observation, not an alarm — styled like a note, not a warning.
  noted: { label: "Worth a look", icon: CircleDashed, tone: "text-[#111214]/55" },
  absent: { label: "Nothing on file", icon: CircleSlash, tone: "text-[#111214]/35" },
};

function DimensionRow({ dimensionKey, label, state, count }: { dimensionKey: DimensionKey; label: string; state: DimensionState; count: number }) {
  const s = STATE[state];
  const Icon = s.icon;
  // "Nothing on record · 1" is a contradiction. An absent dimension may still hold a factor — the
  // trust graph records "no lab tests on record" AS a factor — but there is nothing to count.
  const showCount = state !== "absent" && count > 0;
  return (
    <div className="flex items-center justify-between gap-3 border-t-2 border-[#111214]/10 py-2.5 first:border-t-0">
      <span className="text-[13px] font-bold text-[#111214]/80">{DIMENSION_LABEL[dimensionKey] ?? label}</span>
      <span className={`inline-flex items-center gap-1.5 text-[12px] font-bold ${s.tone}`}>
        <Icon className="size-3.5" />
        {s.label}
        {/* The number is how many checks fed this row — say so, so it can't be misread as
            "13 lab tests" when it is "1 check that found 13". */}
        {showCount && <span className="text-[#111214]/40">· {count} check{count === 1 ? "" : "s"}</span>}
      </span>
    </div>
  );
}

export function VialGradeCard({ grade, summary }: { grade: VialGradeResult; summary: string }) {
  const b = BAND[grade.band];
  const Icon = b.icon;
  const letterLabel = grade.letter === null ? "Not graded — not enough evidence" : `VialGrade ${grade.letter}`;
  return (
    <div className={`ink hard-lg flex flex-col rounded-[22px] p-6 text-[#111214] ${b.wrap}`}>
      <div className="ink inline-flex w-fit items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[.12em]" style={{ color: b.accent }}>
        <Icon className="size-4" /> VialGrade
      </div>

      <div className="mt-4 flex items-center gap-4">
        <span className={`ink grid size-[76px] shrink-0 place-items-center rounded-[18px] text-white ${b.chip}`}>
          <span aria-hidden className="text-[34px] font-extrabold leading-none tracking-[-.06em]">{grade.letter ?? "—"}</span>
          <span className="sr-only">{letterLabel}</span>
        </span>
        <div className="min-w-0">
          <h2 className="text-2xl font-extrabold leading-tight tracking-[-.03em]">{grade.headline}</h2>
          <p className="mt-1.5 text-[15px] font-medium leading-6 text-[#111214]/75">{summary}</p>
        </div>
      </div>

      {/* The decomposition the letter is built from — never collapsed away entirely. */}
      <div className="ink-1 mt-5 rounded-[14px] bg-white/70 px-4 py-1.5">
        {grade.dimensions.map(d => (
          <DimensionRow key={d.key} dimensionKey={d.key} label={d.label} state={d.state} count={d.factors.length} />
        ))}
      </div>

      <p className="mt-3 text-[12px] font-medium leading-5 text-[#111214]/60">
        <span className="font-bold uppercase tracking-[.08em] text-[#111214]/45">Why this grade — </span>
        {grade.rationale}
      </p>

      {/* Sentence case, not the uppercase kicker it used to be — this is a sentence now, and
          "WEIGHED ACROSS 4 SIGNALS" was neither readable nor a phrase anyone says. */}
      <p className="mt-auto pt-4 text-[11px] font-bold text-[#111214]/45">
        {`${grade.letter === null ? "Only" : "Based on"} ${grade.weighed} check${grade.weighed === 1 ? "" : "s"}${grade.letter === null ? " so far" : ""}. ${grade.verifiedCount > 0 ? `${grade.verifiedCount} backed by a document.` : "None backed by a document."}`}
      </p>
    </div>
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
      className={`ink-1 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-bold ${b.wrap}`}
      style={{ color: b.accent }}
      title={grade.rationale || undefined}
    >
      <span className={`ink-1 grid size-5 shrink-0 place-items-center rounded-full text-white ${b.chip}`}>
        <span className="text-[10px] font-extrabold leading-none">{ungraded ? "?" : grade.letter}</span>
      </span>
      <span className="uppercase tracking-[.08em]">
        {grade.band === "reference" ? "Maker — not a shop" : ungraded ? "Not rated yet" : `Grade ${grade.letter}`}
      </span>
      {vendorName && <span className="max-w-[9rem] truncate font-semibold normal-case tracking-normal opacity-70">· {vendorName}</span>}
    </span>
  );
}
