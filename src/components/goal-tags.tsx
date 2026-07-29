import { GOAL_TAGS } from "@/lib/compound-education";

const TONE: Record<string, string> = {
  emerald: "ink-1 bg-[#e6fbf4] text-[#0e8f80]",
  blue: "ink-1 bg-[#eef0ff] text-[#2b31d8]",
  violet: "ink-1 bg-[#f0edff] text-[#6d5dfc]",
  amber: "ink-1 bg-[#fff4e0] text-[#b26a00]",
};

// The "what is this for?" tags. On a listing they tell a first-timer, at a glance, what a
// compound is researched toward — so they don't have to already know what BPC-157 is.
export function GoalTags({ goals, limit, size = "sm" }: { goals?: string[]; limit?: number; size?: "sm" | "md" }) {
  if (!goals || goals.length === 0) return null;
  const shown = limit ? goals.slice(0, limit) : goals;
  const pad = size === "md" ? "px-3 py-1.5 text-xs" : "px-2 py-0.5 text-[10px]";
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      {shown.map((g) => {
        const tag = GOAL_TAGS[g];
        if (!tag) return null;
        return <span key={g} className={`inline-flex items-center rounded-full font-extrabold uppercase tracking-wide ${pad} ${TONE[tag.tone] ?? "ink-1 bg-[#f2f2ef] text-[var(--muted)]"}`}>{tag.label}</span>;
      })}
    </span>
  );
}
