import { ArrowUpRight, Layers3, ShieldCheck } from "lucide-react";

// The lean "what VialGrade is" strip — the verification layer, said in buyer language.
// No "safe"/endorsement claims.
const BEATS = [
  { Icon: Layers3, title: "Every vendor & price, side by side", line: "One screen for what a compound costs across the market." },
  { Icon: ShieldCheck, title: "Cross-checked against independent lab tests", line: "Real third-party COAs you can verify — not vendor marketing." },
  { Icon: ArrowUpRight, title: "We hand you to the vendor", line: "VialGrade never sells or takes payment. It helps you not get scammed." },
];

export function VialValueBand() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {BEATS.map(({ Icon, title, line }) => (
        <div key={title} className="ink-1 hard flex items-start gap-4 rounded-[18px] bg-white p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#12b3a6] text-white">
            <Icon className="size-5" aria-hidden />
          </span>
          <div>
            <p className="text-sm font-extrabold tracking-[-.02em]">{title}</p>
            <p className="mt-1 text-[13px] font-medium leading-5 text-[var(--muted)]">{line}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
