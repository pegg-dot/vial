import type { EvidenceDimension } from "@/lib/types";
import { Check, CircleAlert, CircleDashed, Minus } from "lucide-react";

export function EvidenceMatrix({ evidence }: { evidence: EvidenceDimension[] }) {
  if (evidence.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-black/15 bg-black/[.015] px-5 py-8 text-center">
        <CircleDashed className="mx-auto size-6 text-black/30" />
        <p className="mt-3 text-sm font-semibold">No independent lab evidence located yet</p>
        <p className="mt-1 text-sm leading-5 text-[var(--muted)]">We track this listing&rsquo;s price and availability from the vendor&rsquo;s public page. No third-party test has been matched to it yet — unknown stays visible.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-[24px] border border-black/[.07] bg-white">
      {evidence.map((dimension, index) => {
        const config = {
          established: { icon: Check, label: "Established", className: "bg-emerald-50 text-emerald-700" },
          partial: { icon: CircleAlert, label: "Partial", className: "bg-violet-50 text-violet-700" },
          unknown: { icon: CircleDashed, label: "Unknown", className: "bg-zinc-100 text-zinc-600" },
          "not-tested": { icon: Minus, label: "Not tested", className: "bg-amber-50 text-amber-700" },
        }[dimension.status];
        const Icon = config.icon;
        return (
          <div key={dimension.label} className={`grid gap-3 px-5 py-4 sm:grid-cols-[180px_120px_1fr] sm:items-center ${index > 0 ? "border-t border-black/[.06]" : ""}`}>
            <p className="text-sm font-semibold">{dimension.label}</p>
            <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${config.className}`}>
              <Icon className="size-3" /> {config.label}
            </span>
            <p className="text-sm leading-5 text-[var(--muted)]">{dimension.detail}</p>
          </div>
        );
      })}
    </div>
  );
}
