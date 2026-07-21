import { BadgeCheck, ExternalLink, ShieldAlert, ShieldQuestion } from "lucide-react";
import type { CoaCrossCheck } from "@/server/verify/coa-cross-check";

// Shows how a vendor's advertised testing holds up against independent evidence. This is the
// honest verdict a buyer wants: does the paperwork check out, or is it a claim we can't back?
const STYLE: Record<CoaCrossCheck["status"], { ring: string; bg: string; chip: string; icon: typeof BadgeCheck; tag: string }> = {
  "batch-verified": { ring: "border-emerald-200", bg: "bg-emerald-50", chip: "bg-emerald-100 text-emerald-800", icon: BadgeCheck, tag: "Independently confirmed" },
  verified: { ring: "border-emerald-200", bg: "bg-emerald-50", chip: "bg-emerald-100 text-emerald-800", icon: BadgeCheck, tag: "Independently backed" },
  "low-purity": { ring: "border-amber-200", bg: "bg-amber-50", chip: "bg-amber-100 text-amber-800", icon: ShieldAlert, tag: "Tested below claim" },
  unbacked: { ring: "border-amber-200", bg: "bg-amber-50", chip: "bg-amber-100 text-amber-800", icon: ShieldQuestion, tag: "Claim not confirmed" },
  mismatch: { ring: "border-rose-300", bg: "bg-rose-50", chip: "bg-rose-100 text-rose-800", icon: ShieldAlert, tag: "Certificate mismatch" },
  "no-claim": { ring: "border-black/[.09]", bg: "bg-black/[.02]", chip: "bg-black/[.06] text-black/60", icon: ShieldQuestion, tag: "Nothing to verify" },
};

export function CoaCrossCheckPanel({ check }: { check: CoaCrossCheck }) {
  const s = STYLE[check.status];
  const Icon = s.icon;
  return (
    <div className={`rounded-[26px] border ${s.ring} ${s.bg} p-5`}>
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.chip}`}><Icon className="size-3.5" /> {s.tag}</span>
        {check.claimedIssuer ? <span className="text-[11px] font-medium text-black/45">vendor cites {check.claimedIssuer}</span> : null}
      </div>
      <p className="mt-4 text-[15px] font-semibold leading-6 tracking-[-.02em]">{check.headline}</p>
      <p className="mt-2 text-[13px] leading-6 text-black/65">{check.detail}</p>
      <ul className="mt-4 space-y-2">
        {check.signals.map((sig, i) => (
          <li key={i} className="flex items-start gap-2 text-xs leading-5">
            <span className={`mt-1 size-1.5 shrink-0 rounded-full ${sig.ok === true ? "bg-emerald-500" : sig.ok === false ? "bg-rose-500" : "bg-black/25"}`} />
            <span><span className="font-semibold text-black/75">{sig.label}.</span> <span className="text-black/60">{sig.detail}</span></span>
          </li>
        ))}
      </ul>
      {check.independentUrl ? (
        <a href={check.independentUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 hover:underline">
          Open the independent certificate <ExternalLink className="size-3.5" />
        </a>
      ) : null}
      <p className="mt-4 text-[10px] leading-4 text-black/40">Cross-checks the vendor&rsquo;s testing claim against independent lab records. Never a statement that a product is safe, sterile, or correctly dosed.</p>
    </div>
  );
}
