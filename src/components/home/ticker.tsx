import { BadgeCheck, FlaskConical, Link2, Lock, ScanLine, Wallet } from "lucide-react";

// Ascend-style announcement ticker — a bold bar of what VialGrade actually is, scrolling. Facts, not sales.
const ITEMS: Array<{ icon: React.ComponentType<{ className?: string }>; text: string }> = [
  { icon: FlaskConical, text: "Laboratory reports on record" },
  { icon: ScanLine, text: "Evidence limited to named samples" },
  { icon: BadgeCheck, text: "Vendor records may be incomplete" },
  { icon: Link2, text: "Claims and provenance reviewed" },
  { icon: Wallet, text: "Evidence registry — no purchase links" },
  { icon: Lock, text: "Free to read · no account needed" },
];

export function HomeTicker() {
  const row = [...ITEMS, ...ITEMS];
  return (
    <div className="overflow-hidden bg-[#2b31d8] text-white">
      <div className="market-ticker flex items-center gap-10 py-2.5 pr-10 text-[13px] font-semibold">
        {row.map((item, i) => (
          <span key={i} className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <item.icon className="size-4 opacity-90" /> {item.text}
            <span className="ml-10 size-1.5 rounded-full bg-white/40" />
          </span>
        ))}
      </div>
    </div>
  );
}
