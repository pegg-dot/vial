"use client";
import { useMemo } from "react";
import Link from "next/link";
import { Atom, Brain, Flame, FlaskConical, HeartPulse, Hourglass, LayoutGrid, ShieldPlus, Sparkles, Sun, TrendingUp } from "lucide-react";
import { OTHER_SHELF, SHELVES } from "@/lib/market-taxonomy";

const ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  metabolic: Flame, gh: TrendingUp, healing: HeartPulse, longevity: Hourglass, cognitive: Brain,
  skin: Sparkles, tanning: Sun, immune: ShieldPlus, hormonal: Atom, other: FlaskConical,
};

// Browse-by-shelf rail. Client-filter mode when onSelect is given; otherwise deep-links
// into the compound directory by shelf.
//
// `counts` comes from the caller rather than being derived here: only the caller knows which
// records its grid is about, and the same map feeds the category select further down the page so
// the two controls cannot end up offering different shelves.
export function CategoryRail({ counts, activeKey, onSelect }: { counts: Map<string, number>; activeKey?: string | null; onSelect?: (key: string | null) => void }) {
  // The taxonomy hard-codes nine shelves, but the catalog does not stock all nine. An unstocked
  // pill scrolled the reader down to an empty grid that reads as a broken filter, not as an empty
  // shelf. "All" always renders — it is the way back.
  const pills = useMemo(() => {
    const stocked: Array<{ key: string | null; label: string; Icon: React.ComponentType<{ className?: string }>; count: number | null }> = [
      { key: null, label: "All", Icon: LayoutGrid, count: null },
    ];
    // OTHER_SHELF is a real bucket in groupByShelf; a compound filed there was unreachable from
    // a rail that only knew the nine named shelves.
    for (const s of [...SHELVES, OTHER_SHELF]) {
      const count = counts.get(s.key) ?? 0;
      if (count > 0) stocked.push({ key: s.key, label: s.label, Icon: ICON[s.key] ?? Sparkles, count });
    }
    return stocked;
  }, [counts]);

  return (
    <div className="scroll-fade-x -mx-5 overflow-x-auto px-5 pb-2 no-scrollbar sm:-mx-8 sm:px-8">
      <div className="flex w-max gap-3">
        {pills.map(({ key, label, Icon, count }) => {
          const active = activeKey === key || (key === null && !activeKey);
          const inner = (
            <>
              <span className="grid size-8 place-items-center rounded-full bg-[#12b3a6] text-white">
                <Icon className="size-4" />
              </span>
              {label}
              {count != null && <span className="tabular-nums opacity-60">{count}</span>}
            </>
          );
          const cls = `ink-1 hard-sm press inline-flex shrink-0 items-center gap-2.5 rounded-full py-2 pl-2 pr-5 text-[15px] font-bold ${
            active ? "bg-[#111214] text-white" : "bg-white text-[#111214]"
          }`;
          return onSelect ? (
            <button key={label} type="button" onClick={() => onSelect(key)} aria-pressed={active} className={cls}>
              {inner}
            </button>
          ) : (
            <Link key={label} href={key ? `/compounds?shelf=${key}` : "/compounds"} className={cls}>
              {inner}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
