import { GOAL_TAGS } from "@/lib/compound-education";
import { Chip, type Tone } from "@/components/intelligence/research-ui";

// The education file names its tones after the old palette; each maps onto one kit tone so a tag
// says what kind of research it labels without choosing a colour of its own.
const TONE: Record<string, Tone> = { emerald: "mint", blue: "blue", violet: "violet", amber: "warn" };

// The "what is this for?" tags. On a listing they tell a first-timer, at a glance, what a
// compound is researched toward — so they don't have to already know what BPC-157 is.
export function GoalTags({ goals, limit, size = "sm" }: { goals?: string[]; limit?: number; size?: "sm" | "md" }) {
  if (!goals || goals.length === 0) return null;
  const shown = limit ? goals.slice(0, limit) : goals;
  return (
    <span className={"inline-flex flex-wrap " + (size === "md" ? "gap-2" : "gap-1.5")}>
      {shown.map((g) => {
        const tag = GOAL_TAGS[g];
        if (!tag) return null;
        return <Chip key={g} tone={TONE[tag.tone] ?? "paper"}>{tag.label}</Chip>;
      })}
    </span>
  );
}
