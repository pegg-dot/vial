import Link from "next/link";
import { BadgeCheck, ExternalLink, FlaskConical, ShieldAlert, ShieldQuestion } from "lucide-react";
import type { CoaCrossCheck } from "@/server/verify/coa-cross-check";
import { PURITY_PROVENANCE } from "@/lib/provenance-copy";

// Shows how a vendor's advertised testing holds up against independent evidence. This is the
// honest verdict a buyer wants: does the paperwork check out, or is it a claim we can't back?
const STYLE: Record<CoaCrossCheck["status"], { bg: string; chip: string; icon: typeof BadgeCheck; tag: string }> = {
  "batch-verified": { bg: "bg-[#e6fbf6]", chip: "bg-white text-[#0e8f80]", icon: BadgeCheck, tag: "Independently confirmed" },
  verified: { bg: "bg-[#e6fbf6]", chip: "bg-white text-[#0e8f80]", icon: BadgeCheck, tag: "Independently backed" },
  "low-purity": { bg: "bg-[#fff6e6]", chip: "bg-white text-[#b26a00]", icon: ShieldAlert, tag: "Tested below claim" },
  unbacked: { bg: "bg-[#fff6e6]", chip: "bg-white text-[#b26a00]", icon: ShieldQuestion, tag: "Claim not confirmed" },
  mismatch: { bg: "bg-[#ffecea]", chip: "bg-white text-[#d3372c]", icon: ShieldAlert, tag: "Certificate mismatch" },
  "no-claim": { bg: "bg-white", chip: "bg-[#111214]/[.06] text-black/60", icon: ShieldQuestion, tag: "Nothing to verify" },
};

export function CoaCrossCheckPanel({ check }: { check: CoaCrossCheck }) {
  const s = STYLE[check.status];
  const Icon = s.icon;
  return (
    <div className={`ink hard rounded-[18px] ${s.bg} p-5`}>
      <div className="flex items-center gap-2">
        <span className={`ink-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${s.chip}`}><Icon className="size-3.5" /> {s.tag}</span>
        {check.claimedIssuer ? <span className="text-[11px] font-semibold text-black/45">vendor cites {check.claimedIssuer}</span> : null}
      </div>
      <p className="mt-4 text-[15px] font-extrabold leading-6 tracking-[-.02em]">{check.headline}</p>
      <p className="mt-2 text-[13px] font-medium leading-6 text-black/70">{check.detail}</p>
      <ul className="mt-4 space-y-2">
        {check.signals.map((sig, i) => (
          <li key={i} className="flex items-start gap-2 text-xs leading-5">
            <span className={`mt-1 size-2 shrink-0 rounded-full ${sig.ok === true ? "bg-[#12b3a6]" : sig.ok === false ? "bg-[#f5463d]" : "bg-black/25"}`} />
            <span><span className="font-bold text-black/75">{sig.label}.</span> <span className="font-medium text-black/60">{sig.detail}</span></span>
          </li>
        ))}
      </ul>
      {check.testedAt ? (
        <p className="mt-3 text-xs text-black/55">Certificate analyzed <span className="font-semibold text-black/70">{check.testedAt}</span>{check.stale ? <span className="ml-2 inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">years old — may not describe current stock</span> : null}</p>
      ) : null}
      {check.independentUrl ? (
        <a href={check.independentUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[#2b31d8] hover:underline">
          Open the independent certificate <ExternalLink className="size-3.5" />
        </a>
      ) : null}
      {check.compoundEvidence ? (
        <Link href={`/compounds/${check.compoundEvidence.compoundSlug}`} className="ink-1 mt-4 flex items-center gap-2.5 rounded-xl bg-[#eef0ff] px-3.5 py-2.5 text-xs font-bold text-[#2b31d8] transition hover:-translate-y-0.5">
          <FlaskConical className="size-3.5 shrink-0 text-[#2b31d8]" />
          <span>{check.compoundEvidence.count} independent COA{check.compoundEvidence.count === 1 ? "" : "s"} on record for this compound{check.compoundEvidence.medianPurity != null ? ` · median ${check.compoundEvidence.medianPurity.toFixed(1)}%` : ""} — see them all</span>
          <ExternalLink className="ml-auto size-3.5 shrink-0" />
        </Link>
      ) : null}
      <p className="mt-4 text-[10px] leading-4 text-black/40">Cross-checks the vendor&rsquo;s testing claim against independent lab records. {PURITY_PROVENANCE} Never a statement that a product is safe, sterile, or correctly dosed.</p>
    </div>
  );
}
