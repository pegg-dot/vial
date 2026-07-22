// The monetization seam. Every outbound "Buy at vendor" click passes through buildOutboundUrl,
// which turns the vendor's plain product URL into whatever the deal requires — WITHOUT any UI or
// ingest change. Today there are no rules (plain pass-through), so links just work and every click
// is tracked. As deals land you add one line per vendor here, and the same buttons start earning.
//
// Two rule shapes cover essentially every real affiliate arrangement in this market:
//   - "params": append tracking params to the vendor's own URL (the common per-vendor program /
//     coupon-attribution case, e.g. ?ref=vial or ?utm_source=vial&aff=123).
//   - "template": wrap the destination in a third party's click URL (a universal affiliate network
//     like Sovrn/Skimlinks, or a coupon/redirect service), e.g.
//       "https://redirect.viglink.com/?key=ABC&u={dest}"  ({dest} = URL-encoded destination).
//
// A "template" rule keyed under "*" applies to ALL vendors — that's how a single universal-network
// integration monetizes the entire long tail at once, with per-vendor rules overriding it.

export interface AffiliateRule {
  kind: "params" | "template";
  params?: Record<string, string>;
  template?: string; // must contain the literal {dest}
}

// No live deals yet. Add rules as they're negotiated. Example (commented) shapes:
//   "eternal-peptides": { kind: "params", params: { ref: "vial" } },
//   "*":                 { kind: "template", template: "https://go.sovrn.com/?u={dest}&aff=VIAL" },
export const AFFILIATE_RULES: Record<string, AffiliateRule> = {};

export interface OutboundResult { url: string; affiliateApplied: boolean }

function applyRule(rule: AffiliateRule, dest: string): string | null {
  try {
    if (rule.kind === "params" && rule.params) {
      const u = new URL(dest);
      for (const [k, v] of Object.entries(rule.params)) u.searchParams.set(k, v);
      return u.toString();
    }
    if (rule.kind === "template" && rule.template && rule.template.includes("{dest}")) {
      return rule.template.replace("{dest}", encodeURIComponent(dest));
    }
  } catch {
    /* a malformed destination or rule never breaks the handoff — fall through to plain */
  }
  return null;
}

/**
 * Resolve the URL a "Buy at vendor" click should actually navigate to. Per-vendor rule wins over
 * the universal "*" rule; with no rule the vendor's own URL passes through unchanged. Never throws
 * — a bad rule or URL degrades to the plain destination so the buyer always reaches the vendor.
 */
export function buildOutboundUrl(vendorSlug: string, dest: string): OutboundResult {
  const rule = AFFILIATE_RULES[vendorSlug] ?? AFFILIATE_RULES["*"];
  if (!rule) return { url: dest, affiliateApplied: false };
  const out = applyRule(rule, dest);
  return out ? { url: out, affiliateApplied: true } : { url: dest, affiliateApplied: false };
}
