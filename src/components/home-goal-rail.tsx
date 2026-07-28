import Link from "next/link";
import { Atom, Brain, Dumbbell, Flame, HeartPulse, Hourglass, Moon, ShieldPlus, Sparkles, Sprout, Sun, TrendingUp } from "lucide-react";
import { GOAL_TAGS } from "@/lib/compound-education";

// Browse-by-goal rail — Gumroad-disciplined pills: uniform white, thick ink border, hard shadow, one
// small accent icon-chip. Each pill is a real filter into the compound directory.
const GOAL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  recovery: HeartPulse, gut: Sprout, gh: TrendingUp, metabolic: Flame, longevity: Hourglass,
  cognitive: Brain, skin: Sparkles, tanning: Sun, immune: ShieldPlus, muscle: Dumbbell, sleep: Moon, hormonal: Atom,
};
const ORDER = ["metabolic", "recovery", "gh", "longevity", "cognitive", "muscle", "gut", "skin", "immune", "sleep", "hormonal", "tanning"];

export function HomeGoalRail() {
  return (
    <div className="scroll-fade-x -mx-5 overflow-x-auto px-5 pb-2 no-scrollbar sm:-mx-8 sm:px-8">
      <div className="flex w-max gap-3">
        {ORDER.filter((g) => GOAL_TAGS[g]).map((g) => {
          const Icon = GOAL_ICON[g] ?? Sparkles;
          return (
            <Link
              key={g}
              href={`/compounds?goal=${g}`}
              className="ink-1 hard-sm press group inline-flex shrink-0 items-center gap-2.5 rounded-full bg-white py-2 pl-2 pr-5 text-[15px] font-bold text-[#111214]"
            >
              <span className="grid size-8 place-items-center rounded-full bg-[#2b31d8] text-white">
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
