import type { EvidenceDimension } from "@/lib/types";
import { Check, CircleAlert, CircleDashed, Minus } from "lucide-react";

export function EvidenceMatrix({ evidence }: { evidence: EvidenceDimension[] }) {
  if (evidence.length === 0) {
    return (
      <div className="rounded-[18px] border-2 border-dashed border-[#111214]/30 bg-[#f7f7f4] px-5 py-8 text-center">
        <CircleDashed className="mx-auto size-6 text-[#111214]/30" />
        <p className="mt-3 text-sm font-extrabold">No independent lab evidence located yet</p>
        <p className="mt-1 text-sm font-medium leading-5 text-[var(--muted)]">We track this listing&rsquo;s price and availability from the vendor&rsquo;s public page. No third-party test has been matched to it yet — unknown stays visible.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-[18px] ink bg-white hard">
      {evidence.map((dimension, index) => {
        const config = {
          established: { icon: Check, label: "Established", className: "ink-1 bg-[#e6fbf4] text-[#0e8f80]" },
          partial: { icon: CircleAlert, label: "Partial", className: "ink-1 bg-[#f0edff] text-[#6d5dfc]" },
          unknown: { icon: CircleDashed, label: "Unknown", className: "ink-1 bg-[#f2f2ef] text-[var(--muted)]" },
          "not-tested": { icon: Minus, label: "Not tested", className: "ink-1 bg-[#fff4e0] text-[#b26a00]" },
        }[dimension.status];
        const Icon = config.icon;
        return (
          <div key={dimension.label} className={`grid gap-3 px-5 py-4 sm:grid-cols-[180px_120px_1fr] sm:items-center ${index > 0 ? "border-t border-[#111214]/10" : ""}`}>
            <p className="text-sm font-extrabold">{dimension.label}</p>
            <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide ${config.className}`}>
              <Icon className="size-3" /> {config.label}
            </span>
            <p className="text-sm font-medium leading-5 text-[var(--muted)]">{dimension.detail}</p>
          </div>
        );
      })}
    </div>
  );
}
