import { ArrowUpRight, Layers3, ShieldCheck } from "lucide-react";

// The lean "what VialGrade is" strip — the verification layer, said in buyer language.
// No "safe"/endorsement claims.
const BEATS = [
  { Icon: Layers3, title: "Observed listings and historical prices", line: "Third-party snapshots shown for comparison, not a buying recommendation." },
  { Icon: ShieldCheck, title: "Laboratory evidence with source context", line: "Reports show the available level of issuer confirmation and sample linkage." },
  { Icon: ArrowUpRight, title: "No buying or sales referrals", line: "VialGrade does not handle transactions or provide seller checkout links." },
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
