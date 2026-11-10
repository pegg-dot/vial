import { Pill as PillIcon, AlertTriangle, Scale } from "lucide-react";
import { usLegalFor } from "@/lib/us-legal";
import { Chip, Frame, Pill, type Tone } from "@/components/intelligence/research-ui";

// Each legal bucket is one kit tone: danger for prescription-only, warn for investigational, white
// for research-only. The tone says which bucket; the chip and the headline say why.
const STYLE = {
  prescription: { tone: "danger", icon: PillIcon },
  investigational: { tone: "warn", icon: AlertTriangle },
  "research-only": { tone: "white", icon: Scale },
} as const satisfies Record<string, { tone: Tone; icon: typeof Scale }>;

// The compound-specific US legal reality, surfaced in context. Informational, never advice or a
// gate — it tells a US buyer which legal bucket this compound is in and links to the full law.
//
// A band, not a tile. It says the same thing on every listing of a compound, so it is standing
// context rather than evidence about the vial in front of you, and squeezing it into a third of a
// tile row made the longest of these (investigational compounds run to a full paragraph) set the
// height of every tile beside it. Across the full width the prose keeps a reading measure and the
// link to the full law sits out at the end of the band where an action belongs.
export function UsLegalNotice({ slug }: { slug: string }) {
  const s = usLegalFor(slug);
  const st = STYLE[s.category];
  return (
    <Frame tone={st.tone} shadow="sm" radius="rounded-[16px]">
      <div className="flex flex-col gap-x-10 gap-y-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="white" icon={st.icon}>US regulatory context</Chip>
            {s.flags.map((f) => <Chip key={f} tone="white" plain>{f}</Chip>)}
          </div>
          <p className="mt-4 max-w-[46ch] text-base font-extrabold leading-6 tracking-[-.02em] text-[#111214]">{s.headline}</p>
          <p className="mt-2 max-w-[76ch] text-[13px] font-medium leading-6 text-[#3a3d46]">{s.detail}</p>
        </div>
        <Pill href="/legal/us-regulations" variant="ghost" size="sm" arrow="right" className="shrink-0 self-start">Read US regulatory overview</Pill>
      </div>
      <p className="mt-4 max-w-[96ch] text-[11px] font-medium leading-4 text-[var(--muted)]">Regulatory context only. This label does not establish that a vendor, sample, shipment or transaction is lawful.</p>
    </Frame>
  );
}
