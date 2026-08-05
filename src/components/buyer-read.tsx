import Link from "next/link";
import { ShieldCheck, ShieldAlert, ShieldQuestion, CheckCircle2, AlertTriangle, Info, ArrowRight } from "lucide-react";
import type { BuyerRead, BuyerReadTone } from "@/lib/buyer-read";

const HEAD: Record<BuyerRead["verdict"], { bg: string; chip: string; icon: typeof ShieldCheck; tag: string }> = {
  tested: { bg: "bg-[#e6fbf6]", chip: "bg-white text-[#0e8f80]", icon: ShieldCheck, tag: "Best-case evidence" },
  untested: { bg: "bg-[#f7f7f4]", chip: "bg-white text-[#5a4be0]", icon: ShieldQuestion, tag: "What we know so far" },
  flagged: { bg: "bg-[#fff1f0]", chip: "bg-white text-[#d3372c]", icon: ShieldAlert, tag: "Proceed carefully" },
};

const DOT: Record<BuyerReadTone, { icon: typeof Info; className: string }> = {
  good: { icon: CheckCircle2, className: "text-[#0e8f80]" },
  warn: { icon: AlertTriangle, className: "text-[#b26a00]" },
  bad: { icon: AlertTriangle, className: "text-[#d3372c]" },
  info: { icon: Info, className: "text-black/40" },
};

// The consumer's decision block — honest verdict + what we know + the one action that gets verification.
export function BuyerReadCard({ read }: { read: BuyerRead }) {
  const h = HEAD[read.verdict];
  const HeadIcon = h.icon;
  return (
    <div className={`ink hard rounded-[18px] ${h.bg} p-5`}>
      <div className="flex items-center gap-2">
        <span className={`ink-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${h.chip}`}><HeadIcon className="size-3.5" /> {h.tag}</span>
      </div>
      <p className="mt-3 text-[16px] font-extrabold leading-6 tracking-[-.02em]">{read.headline}</p>

      <ul className="mt-3 space-y-2">
        {read.points.map((pt, i) => {
          const d = DOT[pt.tone];
          const Icon = d.icon;
          return (
            <li key={i} className="flex items-start gap-2 text-[13px] leading-5">
              <Icon className={`mt-0.5 size-3.5 shrink-0 ${d.className}`} />
              <span className="font-medium text-black/70">{pt.text}</span>
            </li>
          );
        })}
      </ul>

      <div className="ink-1 mt-4 rounded-[14px] bg-white/70 p-3.5">
        <p className="text-[11px] font-bold uppercase tracking-[.12em] text-[#5a4be0]">How to verify this yourself</p>
        <p className="mt-1 text-[13px] font-medium leading-5 text-black/75">{read.action}</p>
        <Link href="/verify" className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-[#2b31d8] hover:underline">
          Open the Verify tool <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
