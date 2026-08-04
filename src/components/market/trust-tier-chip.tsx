import type { TrustTier } from "@/lib/curation";
import { FlaskConical, ShieldCheck, CircleHelp } from "lucide-react";

const STYLE = {
  independent: { cls: "bg-[#e6fbf4] text-[#0e8f80]", Icon: ShieldCheck },
  vendor: { cls: "bg-[#fff4e0] text-[#b26a00]", Icon: FlaskConical },
  none: { cls: "bg-[#f0f0ec] text-[var(--muted)]", Icon: CircleHelp },
} as const;

export function TrustTierChip({ tier }: { tier: TrustTier }) {
  const { cls, Icon } = STYLE[tier.tier];
  return (
    <span
      className={`ink-1 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${cls}`}
      title={tier.reasons.join(" · ")}
      aria-label={`${tier.label}. ${tier.reasons[0]}`}
    >
      <Icon className="size-3" aria-hidden /> {tier.label}
    </span>
  );
}
