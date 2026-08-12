import { BadgeCheck, FlaskConical, Link2, Lock, ScanLine, Wallet } from "lucide-react";

// Ascend-style announcement ticker — a bold bar of what VialGrade actually is, scrolling. Facts, not sales.
const ITEMS: Array<{ icon: React.ComponentType<{ className?: string }>; text: string }> = [
  { icon: FlaskConical, text: "279 lab tests read by hand" },
  { icon: ScanLine, text: "COA-verified — batch by batch" },
  { icon: BadgeCheck, text: "83 vendors tracked, always updating" },
  { icon: Link2, text: "Every claim linked to its source" },
  { icon: Wallet, text: "We never sell — we link you straight to the vendor" },
  { icon: Lock, text: "Free forever · no account needed" },
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
