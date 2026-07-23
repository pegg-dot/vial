import Link from "next/link";
import { Atom, Brain, Dumbbell, Flame, HeartPulse, Hourglass, Moon, ShieldPlus, Sparkles, Sprout, Sun, TrendingUp } from "lucide-react";
import { GOAL_TAGS } from "@/lib/compound-education";

// Browse-by-goal rail — the Gumroad-style pill carousel, in VIAL's scientific palette. Each pill is a
// real filter: it links to the compound directory scoped to that research goal. Icons are gumdrop
// circles so the row reads friendly, not clinical.
const GOAL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  recovery: HeartPulse, gut: Sprout, gh: TrendingUp, metabolic: Flame, longevity: Hourglass,
  cognitive: Brain, skin: Sparkles, tanning: Sun, immune: ShieldPlus, muscle: Dumbbell, sleep: Moon, hormonal: Atom,
};
// Candy-gumdrop tones, spread so the row feels colorful without losing the clean base.
const GOAL_TONE: Record<string, { chip: string; icon: string }> = {
  recovery: { chip: "bg-emerald-100/70", icon: "bg-emerald-500" },
  gut: { chip: "bg-amber-100/70", icon: "bg-amber-500" },
  gh: { chip: "bg-blue-100/70", icon: "bg-blue-500" },
  metabolic: { chip: "bg-violet-100/70", icon: "bg-violet-500" },
  longevity: { chip: "bg-sky-100/70", icon: "bg-sky-500" },
  cognitive: { chip: "bg-rose-100/70", icon: "bg-rose-500" },
  skin: { chip: "bg-fuchsia-100/70", icon: "bg-fuchsia-500" },
  tanning: { chip: "bg-orange-100/70", icon: "bg-orange-500" },
  immune: { chip: "bg-teal-100/70", icon: "bg-teal-500" },
  muscle: { chip: "bg-indigo-100/70", icon: "bg-indigo-500" },
  sleep: { chip: "bg-purple-100/70", icon: "bg-purple-500" },
  hormonal: { chip: "bg-pink-100/70", icon: "bg-pink-500" },
};
// Show goals in an order that leads with the most-searched research areas.
const ORDER = ["metabolic", "recovery", "gh", "longevity", "cognitive", "muscle", "gut", "skin", "immune", "sleep", "hormonal", "tanning"];

export function HomeGoalRail() {
  return (
    <div className="scroll-fade-x -mx-5 overflow-x-auto px-5 no-scrollbar sm:-mx-8 sm:px-8">
      <div className="flex w-max gap-3 pb-1">
        {ORDER.filter((g) => GOAL_TAGS[g]).map((g) => {
          const Icon = GOAL_ICON[g] ?? Sparkles;
          const tone = GOAL_TONE[g] ?? { chip: "bg-black/[.05]", icon: "bg-black/50" };
          return (
            <Link
              key={g}
              href={`/compounds?goal=${g}`}
              className={`group inline-flex shrink-0 items-center gap-2.5 rounded-full border border-black/[.06] ${tone.chip} py-2 pl-2 pr-4 text-sm font-semibold text-black/75 shadow-[0_1px_2px_rgba(0,0,0,.03)] transition hover:-translate-y-0.5 hover:border-black/[.12] hover:shadow-[0_10px_26px_rgba(20,22,27,.10)]`}
            >
              <span className={`grid size-8 place-items-center rounded-full ${tone.icon} text-white shadow-sm transition group-hover:scale-110`}>
                <Icon className="size-4" />
              </span>
              {GOAL_TAGS[g].label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
