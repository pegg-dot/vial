// Research-context depth for each compound — what it is, HOW it works (mechanism), what it's
// studied for, how far the research has gone (WHEN), and the single most important caveat.
// Gathered from reputable sources (peer-reviewed, drugs.com, trial data). STRICTLY informational,
// research-use-only: mechanism and research status only — never dosing, protocols, or human-use
// advice. Generated from research passes; keep the framing neutral (no efficacy/endorsement).

export interface CompoundDepth {
  plainEnglish?: string;   // the human translation, rendered ABOVE the science (compound-plain-english.ts)
  mechanism: string;       // how it works — receptor/pathway/class
  researchedFor: string;   // what it's studied toward
  researchStatus: string;  // how far: "FDA-approved (for X)…", "In clinical trials…", "Preclinical…", "Limited human data…"
  knownAs: string;         // brand/other names, or ""
  caveat: string;          // the key neutral, safety-relevant caveat
}

export type ResearchStage = "approved" | "clinical" | "preclinical" | "limited" | "studied";

// Map the free-text status to a short, honestly-framed badge. "FDA-approved" describes the
// MOLECULE (as a prescription drug) — never the grey-market vial — so its label says so.
export function researchStage(status: string): { stage: ResearchStage; label: string; tint: string } {
  const s = status.toLowerCase();
  if (s.startsWith("fda-approved")) return { stage: "approved", label: "FDA-approved molecule", tint: "bg-[#eef0ff] text-[#2b31d8]" };
  if (s.startsWith("in clinical")) return { stage: "clinical", label: "In clinical trials", tint: "bg-[#f0edff] text-[#6d5dfc]" };
  if (s.startsWith("preclinical")) return { stage: "preclinical", label: "Preclinical / animal only", tint: "bg-[#fff4e0] text-[#b26a00]" };
  if (s.startsWith("limited")) return { stage: "limited", label: "Limited human data", tint: "bg-[#fff4e0] text-[#b26a00]" };
  return { stage: "studied", label: "Widely studied", tint: "bg-[#eef0ff] text-[#2b31d8]" };
}

import { COMPOUND_DEPTH_DATA } from "./compound-depth-data";

export const COMPOUND_DEPTH: Record<string, CompoundDepth> = COMPOUND_DEPTH_DATA;

import { PLAIN_ENGLISH } from "./compound-plain-english";

export function depthFor(slug: string): CompoundDepth | undefined {
  const d = COMPOUND_DEPTH[slug];
  if (!d) return undefined;
  const plainEnglish = PLAIN_ENGLISH[slug];
  return plainEnglish ? { ...d, plainEnglish } : d;
}
