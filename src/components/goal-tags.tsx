import { GOAL_TAGS } from "@/lib/compound-education";

const TONE: Record<string, string> = {
  emerald: "bg-emerald-50 text-emerald-800",
  blue: "bg-blue-50 text-blue-800",
  violet: "bg-violet-50 text-violet-800",
  amber: "bg-amber-50 text-amber-800",
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
        return <span key={g} className={`inline-flex items-center rounded-full font-semibold ${pad} ${TONE[tag.tone] ?? "bg-black/[.05] text-black/60"}`}>{tag.label}</span>;
      })}
    </span>
  );
}
