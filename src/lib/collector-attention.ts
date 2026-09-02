// The honest state of an ailing collector target.
//
// "Collectors needing attention" used to paint every failure the same red, so a known,
// structurally-covered blocker (Janoshik's Cloudflare answers every non-browser client 403 —
// while the browser-capture collector supplies the same feed) screamed exactly as loudly as a
// genuinely new breakage. A panel that cries wolf trains its one reader to stop looking.
// This module is the single place that decides the label and the tone, so the table and any
// future surface can never disagree.

/** A failing collector whose scope another, healthy collector structurally covers. */
export const COLLECTOR_COVERED_BY: Partial<Record<string, string>> = {
  // public.janoshik.com's edge 403s every server; the human browser capture is the same source,
  // same parser contract. The live collector keeps knocking weekly so it self-heals if the edge
  // ever opens — its failure is expected, not news.
  "lab-janoshik": "lab-janoshik-capture",
};

export interface AttentionTarget {
  collector: string;
  enabled: boolean;
  consecutiveFailures: number;
}

export interface CollectorRunSummary {
  collector: string;
  lastOk: boolean | null;
}

export interface AttentionState {
  label: string;
  /** red = act on it; amber = known and covered, watch only; muted = self-healing by design. */
  tone: "red" | "amber" | "muted";
}

export function attentionState(t: AttentionTarget, runs: CollectorRunSummary[]): AttentionState {
  if (!t.enabled) return { label: "disabled — retried weekly", tone: "muted" };
  const coveredBy = COLLECTOR_COVERED_BY[t.collector];
  if (coveredBy) {
    const covering = runs.find((r) => r.collector === coveredBy);
    // The soft label is EARNED by the covering collector's last run being green. If the cover
    // itself is failing or has never run, this is a real outage again — paint it red.
    if (covering?.lastOk === true) {
      return { label: `failing (${t.consecutiveFailures}) — known blocker; ${coveredBy} covers it`, tone: "amber" };
    }
  }
  return { label: `failing (${t.consecutiveFailures})`, tone: "red" };
}
