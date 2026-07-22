import Link from "next/link";
import { Pill, AlertTriangle, Scale } from "lucide-react";
import { usLegalFor } from "@/lib/us-legal";

const STYLE = {
  prescription: { ring: "border-rose-200", bg: "bg-rose-50", chip: "bg-rose-100 text-rose-800", icon: Pill },
  investigational: { ring: "border-amber-200", bg: "bg-amber-50", chip: "bg-amber-100 text-amber-800", icon: AlertTriangle },
  "research-only": { ring: "border-black/[.09]", bg: "bg-black/[.02]", chip: "bg-black/[.06] text-black/60", icon: Scale },
} as const;

// The compound-specific US legal reality, surfaced in context. Informational, never advice or a
// gate — it tells a US buyer which legal bucket this compound is in and links to the full law.
export function UsLegalNotice({ slug }: { slug: string }) {
  const s = usLegalFor(slug);
  const st = STYLE[s.category];
  const Icon = st.icon;
  return (
    <div className={`rounded-[24px] border ${st.ring} ${st.bg} p-5`}>
      <div className="flex items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${st.chip}`}><Icon className="size-3.5" /> US legal status</span>
        {s.flags.map((f) => <span key={f} className="rounded-full border border-black/[.1] bg-white/70 px-2 py-0.5 text-[10px] font-semibold text-black/60">{f}</span>)}
      </div>
      <p className="mt-3 text-[15px] font-semibold leading-6 tracking-[-.02em]">{s.headline}</p>
      <p className="mt-2 text-[13px] leading-6 text-black/65">{s.detail}</p>
      <Link href="/legal/us-regulations" className="mt-3 inline-block text-xs font-semibold text-violet-700 hover:underline">Read the full US legal overview →</Link>
      <p className="mt-3 text-[10px] leading-4 text-black/40">General information, not legal or medical advice. VIAL sells nothing and encourages no human use.</p>
    </div>
  );
}
