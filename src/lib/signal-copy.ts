/**
 * The names we put on each check, in the reader's words.
 *
 * The trust graph files its seams under keys the grade routes on — "COA integrity",
 * "Operator network", "Research-use notice". Those strings are load-bearing (the grade maps a
 * label to a dimension), so they stay exactly as they are in the data. This is the label a person
 * sees instead. Anything unmapped falls through unchanged, so a new seam is never blank.
 */
const SIGNAL_LABELS: Record<string, string> = {
  "Independent testing": "Independent lab tests",
  "Third-party testing": "Independent lab tests",
  "COA integrity": "Lab reports that don't add up",
  "Government enforcement": "Government records",
  "Operator network": "Linked to a flagged store",
  "Scam & red flags": "Scam reports",
  "Conflicting evidence": "Evidence that disagrees",
  "Third-party trackers": "What other trackers say",
  "Buyer reviews": "What buyers say",
  Community: "What the community says",
  "Domain age": "How old their website is",
  "Storefront signal": "Something on their own site",
  "Research-use notice": "Research-only disclaimer",
  "Site status": "Is their site up?",
};

export function signalLabel(label: string): string {
  return SIGNAL_LABELS[label] ?? label;
}
