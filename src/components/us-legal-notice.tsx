import Link from "next/link";
import { Pill, AlertTriangle, Scale } from "lucide-react";
import { usLegalFor } from "@/lib/us-legal";

const STYLE = {
  prescription: { bg: "bg-[#ffecea]", chip: "bg-white text-[#d3372c]", icon: Pill },
  investigational: { bg: "bg-[#fff6e6]", chip: "bg-white text-[#b26a00]", icon: AlertTriangle },
  "research-only": { bg: "bg-white", chip: "bg-[#111214]/[.06] text-black/60", icon: Scale },
} as const;

// The compound-specific US legal reality, surfaced in context. Informational, never advice or a
// gate — it tells a US buyer which legal bucket this compound is in and links to the full law.
export function UsLegalNotice({ slug }: { slug: string }) {
  const s = usLegalFor(slug);
  const st = STYLE[s.category];
  const Icon = st.icon;
  return (
    <div className={`ink hard rounded-[18px] ${st.bg} p-5`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`ink-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${st.chip}`}><Icon className="size-3.5" /> US legal status</span>
        {s.flags.map((f) => <span key={f} className="ink-1 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-black/60">{f}</span>)}
      </div>
      <p className="mt-3 text-[15px] font-extrabold leading-6 tracking-[-.02em]">{s.headline}</p>
      <p className="mt-2 text-[13px] font-medium leading-6 text-black/70">{s.detail}</p>
      <Link href="/legal/us-regulations" className="mt-3 inline-block text-xs font-bold text-[#2b31d8] hover:underline">Read the full US legal overview →</Link>
      <p className="mt-3 text-[10px] leading-4 text-black/40">General information, not legal or medical advice. VIAL sells nothing and encourages no human use.</p>
    </div>
  );
}
