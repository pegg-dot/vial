// Regulatory & enforcement records — the strongest, safest trust signal VIAL can carry.
//
// These are PUBLIC official records (FDA warning letters and import alerts, DOJ prosecutions, FTC
// actions, recalls). Reporting "the FDA issued a warning letter to X on date Y" is factual and
// defamation-safe *when it's true and correctly attributed*. Two disciplines make it safe:
//   1. We only ever store a real record with its primary-source URL and the subject's exact name.
//   2. We attribute an action to one of our vendors ONLY on a strict match (exact normalized name
//      or an explicit domain hit). A weak guess stays unattributed — shown in the market-wide feed
//      but never pinned to a specific vendor's page, because a false accusation is the real risk.
// Severity also never overstates: "charged" is not "convicted," a warning letter is not a crime.

export type RegAgency = "FDA" | "DOJ" | "FTC" | "state" | "other";
export type RegActionType = "warning_letter" | "import_alert" | "doj_action" | "ftc_action" | "recall" | "advisory";
export type RegOutcome = "charged" | "indicted" | "guilty_plea" | "convicted" | "settlement" | "injunction" | "seizure" | "sentenced" | null;
export type RegSeverity = "severe" | "caution" | "informational";

export interface RegulatoryActionInput {
  actionType: RegActionType;
  agency: RegAgency;
  subjectName: string;
  subjectDomain?: string; // the website the record explicitly cites, if any — the strongest match key
  outcome?: RegOutcome;
  title: string;
  summary: string;
  actionDate: string | null;
  sourceUrl: string;
  isPrimarySource?: boolean;
}

/**
 * How serious is this action? Deliberately conservative: only a proven criminal/civil outcome is
 * "severe"; a mere charge, a regulatory warning, an import detention, or a recall is "caution";
 * a market-wide advisory naming no specific vendor is "informational".
 */
export function severityForAction(a: { actionType: RegActionType; outcome?: RegOutcome }): RegSeverity {
  if (a.actionType === "doj_action" || a.actionType === "ftc_action") {
    if (a.outcome && ["guilty_plea", "convicted", "injunction", "seizure", "sentenced", "settlement"].includes(a.outcome)) return "severe";
    return "caution"; // charged / indicted / unknown outcome — real but not proven
  }
  if (a.actionType === "advisory") return "informational";
  return "caution"; // warning_letter, import_alert, recall
}

const LEGAL_SUFFIX = /\b(llc|l\.l\.c\.|inc|inc\.|incorporated|ltd|limited|corp|corporation|co|company|gmbh|s\.r\.o\.)\b\.?/gi;
function norm(s: string): string {
  return (s ?? "").toLowerCase().replace(LEGAL_SUFFIX, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function hostFrom(s: string): string | null {
  const m = (s ?? "").toLowerCase().match(/([a-z0-9-]+\.[a-z]{2,})(?:\/|\s|$)/);
  return m ? m[1].replace(/^www\./, "") : null;
}

export interface VendorRef { slug: string; name: string; domains: string[] }

/**
 * Resolve an enforcement action's subject to one of our vendors — STRICTLY. Returns a slug only on
 * a domain match or an exact normalized-name match. Anything softer returns null (the action is
 * real market intelligence, but we won't pin it to a vendor we're not certain about).
 */
export function resolveActionToVendor(subjectName: string, vendors: VendorRef[], citedDomain?: string): { vendorSlug: string | null; confidence: "high" | "none" } {
  const citedHost = citedDomain ? hostFrom(citedDomain) ?? citedDomain.toLowerCase().replace(/^www\./, "") : null;
  const subjHost = hostFrom(subjectName);
  const subjNorm = norm(subjectName);
  if (!subjNorm && !citedHost) return { vendorSlug: null, confidence: "none" };
  for (const v of vendors) {
    for (const d of v.domains) {
      const vd = d.toLowerCase().replace(/^www\./, "");
      if (vd && (citedHost === vd || subjHost === vd || subjectName.toLowerCase().includes(vd))) return { vendorSlug: v.slug, confidence: "high" };
    }
  }
  if (!subjNorm) return { vendorSlug: null, confidence: "none" };
  for (const v of vendors) {
    if (norm(v.name) === subjNorm && subjNorm.length >= 4) return { vendorSlug: v.slug, confidence: "high" };
  }
  return { vendorSlug: null, confidence: "none" };
}

/** The worst severity present downgrades a vendor's verdict. */
export function verdictFromSeverities(severities: RegSeverity[]): "avoid" | "caution" | null {
  if (severities.includes("severe")) return "avoid";
  if (severities.includes("caution")) return "caution";
  return null;
}
