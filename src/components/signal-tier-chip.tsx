import type { SignalConfidence } from "@/server/verify";

// How much a signal can be trusted, shown next to it so a guess never wears a fact's clothes. Used
// on BOTH surfaces that render trust-graph factors — the vendor page and the /verify tool — so the
// two can never disagree about what "verified" looks like.
const TIER_CHIP: Record<SignalConfidence, { label: string; cls: string; hint: string }> = {
  verified: { label: "Verified", cls: "bg-[#0e8f80]/12 text-[#0a6b60]", hint: "Backed by a document, government record, or hard shared identifier." },
  reported: { label: "Reported", cls: "bg-[#2b31d8]/10 text-[#2b31d8]", hint: "A third-party human account — buyer reviews, community, tracker scores." },
  inferred: { label: "Inferred", cls: "bg-[#111214]/[.06] text-black/45", hint: "A heuristic read or single probe — treat it as a lead, not a proven fact." },
};

export function TierChip({ tier }: { tier: SignalConfidence }) {
  const t = TIER_CHIP[tier];
  return <span title={t.hint} className={`ink-1 rounded-full px-1.5 py-[3px] text-[9px] font-bold uppercase tracking-[.08em] ${t.cls}`}>{t.label}</span>;
}
