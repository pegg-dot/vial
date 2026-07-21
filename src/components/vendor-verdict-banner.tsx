import { CircleAlert, CircleDashed, ShieldCheck, X } from "lucide-react";
import type { Verdict } from "@/server/verify";

// The verdict-first signal a scared buyer needs the instant they land on a vendor:
// one clear Trusted / Caution / Avoid up top, plain-English why underneath. The full
// decomposed evidence still lives below for anyone who scrolls.
const STYLE: Record<Verdict, { label: string; wrap: string; icon: typeof ShieldCheck; ring: string }> = {
  trusted: { label: "Generally trusted", wrap: "border-emerald-200 bg-emerald-50 text-emerald-900", icon: ShieldCheck, ring: "bg-emerald-500" },
  caution: { label: "Proceed with caution", wrap: "border-amber-200 bg-amber-50 text-amber-950", icon: CircleAlert, ring: "bg-amber-500" },
  avoid: { label: "Avoid — do not buy", wrap: "border-rose-200 bg-rose-50 text-rose-900", icon: X, ring: "bg-rose-500" },
  "high-risk": { label: "High risk", wrap: "border-rose-200 bg-rose-50 text-rose-900", icon: CircleAlert, ring: "bg-rose-500" },
  unproven: { label: "Unproven", wrap: "border-amber-200 bg-amber-50 text-amber-950", icon: CircleDashed, ring: "bg-amber-500" },
  info: { label: "Info", wrap: "border-violet-200 bg-violet-50 text-violet-900", icon: CircleDashed, ring: "bg-violet-500" },
};

export function VendorVerdictBanner({ verdict, summary }: { verdict: Verdict; summary: string }) {
  const s = STYLE[verdict];
  const Icon = s.icon;
  return (
    <div className={`flex items-start gap-4 rounded-[24px] border p-5 sm:p-6 ${s.wrap}`}>
      <span className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-2xl text-white ${s.ring}`}><Icon className="size-5" /></span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[.12em] opacity-80">VIAL verdict</p>
        <h2 className="mt-1 text-2xl font-semibold tracking-[-.03em]">{s.label}</h2>
        <p className="mt-2 text-sm leading-6 opacity-90">{summary}</p>
      </div>
    </div>
  );
}
