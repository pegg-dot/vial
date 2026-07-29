"use client";
import Link from "next/link";
import { Atom, Brain, Flame, HeartPulse, Hourglass, LayoutGrid, ShieldPlus, Sparkles, Sun, TrendingUp } from "lucide-react";
import { SHELVES } from "@/lib/market-taxonomy";

const ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  metabolic: Flame, gh: TrendingUp, healing: HeartPulse, longevity: Hourglass, cognitive: Brain,
  skin: Sparkles, tanning: Sun, immune: ShieldPlus, hormonal: Atom,
};

// Browse-by-shelf rail. Client-filter mode when onSelect is given; otherwise deep-links
// into the compound directory by shelf.
export function CategoryRail({ activeKey, onSelect }: { activeKey?: string | null; onSelect?: (key: string | null) => void }) {
  const pills: Array<{ key: string | null; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
    { key: null, label: "All", Icon: LayoutGrid },
    ...SHELVES.map((s) => ({ key: s.key, label: s.label, Icon: ICON[s.key] ?? Sparkles })),
  ];

  return (
    <div className="scroll-fade-x -mx-5 overflow-x-auto px-5 pb-2 no-scrollbar sm:-mx-8 sm:px-8">
      <div className="flex w-max gap-3">
        {pills.map(({ key, label, Icon }) => {
          const active = activeKey === key || (key === null && !activeKey);
          const inner = (
            <>
              <span className="grid size-8 place-items-center rounded-full bg-[#12b3a6] text-white">
                <Icon className="size-4" />
              </span>
              {label}
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
