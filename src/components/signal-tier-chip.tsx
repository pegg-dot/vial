import type { SignalConfidence } from "@/server/verify";

// How much a signal can be trusted, shown next to it so a guess never wears a fact's clothes. Used
// on BOTH surfaces that render trust-graph factors — the vendor page and the /verify tool — so the
// two can never disagree about what "verified" looks like.
//
// The tones are the kit's chip tones (mint = recorded, blue = reported by someone we cite, paper =
// our own read); composed by hand rather than through `Chip` only because the hint rides on a
// `title`, which the kit chip does not take.
const TIER_CHIP: Record<SignalConfidence, { label: string; cls: string; hint: string }> = {
  verified: { label: "Confirmed", cls: "bg-[#e6fbf6] text-[#0b6b60]", hint: "We have the document — a lab report, a government record, or a hard shared ID." },
  reported: { label: "Reported", cls: "bg-[#eef0ff] text-[#2b31d8]", hint: "Someone else said it — buyers, the community, or another tracker." },
  inferred: { label: "Our guess", cls: "bg-[var(--background)] text-[#4a4d56]", hint: "Our own read of their site, or one attempt to load it. Treat it as a lead, not a fact." },
};

export function TierChip({ tier }: { tier: SignalConfidence }) {
  const t = TIER_CHIP[tier];
  return <span title={t.hint} className={`ink-1 inline-flex min-h-6 items-center rounded-full px-2.5 text-[10px] font-extrabold uppercase tracking-[.1em] ${t.cls}`}>{t.label}</span>;
}
