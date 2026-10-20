"use client";

import { FlaskConical, LibraryBig, Link2, ScanLine, ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";

/**
 * The archived ticker belongs to discovery, where motion and social proof
 * help establish the brand. Evidence analysis is a reading task, so remove
 * the competing moving stripe there, without deleting the original ticker.
 */
const TICKER = [
  { icon: LibraryBig, label: "16 research identities on file" },
  { icon: FlaskConical, label: "Original studies, not just summaries" },
  { icon: ScanLine, label: "5 selected trial examples" },
  { icon: Link2, label: "Every source belongs to a named record" },
  { icon: ShieldCheck, label: "Source coverage isn't an efficacy grade" },
] as const;

export function ResearchBrandTicker() {
  const path = usePathname();
  if (path !== "/intelligence" && path !== "/intelligence/market") return null;
  return (
    <div aria-label="Research library facts" className="overflow-hidden bg-[#2b31d8] text-white">
      <div className="market-ticker flex w-max items-center gap-10 py-2.5 pr-10 text-[13px] font-semibold">
        {[...TICKER, ...TICKER].map((item, index) => (
          <span key={index} className="flex shrink-0 items-center gap-2 whitespace-nowrap">
            <item.icon className="size-4 opacity-90" aria-hidden="true" />
            {item.label}
            <span className="ml-9 size-1.5 rounded-full bg-white/40" />
          </span>
        ))}
      </div>
    </div>
  );
}
