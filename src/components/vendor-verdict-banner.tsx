import { CircleAlert, CircleDashed, ShieldCheck, X } from "lucide-react";
import type { Verdict } from "@/server/verify";

// The verdict-first signal a scared buyer needs the instant they land on a vendor:
// one clear Trusted / Caution / Avoid up top, plain-English why underneath. The full
// decomposed evidence still lives below for anyone who scrolls.
const STYLE: Record<Verdict, { label: string; wrap: string; icon: typeof ShieldCheck; ring: string }> = {
  trusted: { label: "Generally trusted", wrap: "ink bg-[#e6fbf4] text-[#0e8f80]", icon: ShieldCheck, ring: "bg-[#0e8f80]" },
  caution: { label: "Proceed with caution", wrap: "ink bg-[#fff4e0] text-[#b26a00]", icon: CircleAlert, ring: "bg-[#b26a00]" },
  avoid: { label: "Avoid — do not buy", wrap: "ink bg-[#fff1f0] text-[#d3372c]", icon: X, ring: "bg-[#d3372c]" },
  "high-risk": { label: "High risk", wrap: "ink bg-[#fff1f0] text-[#d3372c]", icon: CircleAlert, ring: "bg-[#d3372c]" },
  unproven: { label: "Unproven", wrap: "ink bg-[#fff4e0] text-[#b26a00]", icon: CircleDashed, ring: "bg-[#b26a00]" },
  info: { label: "Info", wrap: "ink bg-[#f0edff] text-[#6d5dfc]", icon: CircleDashed, ring: "bg-[#6d5dfc]" },
};

export function VendorVerdictBanner({ verdict, summary }: { verdict: Verdict; summary: string }) {
  const s = STYLE[verdict];
  const Icon = s.icon;
  return (
    <div className={`flex items-start gap-4 rounded-[18px] p-5 hard sm:p-6 ${s.wrap}`}>
      <span className={`ink mt-0.5 grid size-10 shrink-0 place-items-center rounded-[12px] text-white ${s.ring}`}><Icon className="size-5" /></span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[.12em] opacity-80">VIAL verdict</p>
        <h2 className="mt-1 text-2xl font-extrabold tracking-[-.03em]">{s.label}</h2>
        <p className="mt-2 text-sm font-medium leading-6 opacity-90">{summary}</p>
      </div>
    </div>
  );
}
