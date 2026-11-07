/**
 * A plain, labeled link to a company's own website on its VialGrade page. Off unless the deployment
 * sets VIALGRADE_VENDOR_LINKS=true, and independent of the evidence-only quarantine and of
 * commerce-pause: it is a normal outbound link, not a tracked click-through, referral or buy path.
 */
export function vendorLinksReleased(enabled = process.env.VIALGRADE_VENDOR_LINKS): boolean {
  return enabled === "true";
}

export const VENDOR_LINK_LABEL = "Company's own website";
export const VENDOR_LINK_NOTE = "External site, not verified or endorsed by VialGrade. Nothing here is a recommendation to buy.";

/** Statuses that mean the storefront is alive where we stored it. `blocked` is bot protection, not death. */
const LIVE_STATUSES = new Set(["operating", "blocked"]);

/** A link is offered only for a non-avoid verdict and a known-live (or never-probed) storefront. */
export function vendorLinkAllowed(input: { verdict: string; status: string | null }): boolean {
  if (input.verdict === "avoid" || input.verdict === "high-risk") return false;
  return input.status == null || LIVE_STATUSES.has(input.status);
}

/**
 * https URL for a stored domain, or null. Stored domains are data, so they are validated: a bare
 * hostname with a public-looking TLD only. No scheme, credentials, port, path, query, IP address
 * or internal name is ever turned into a link.
 */
export function vendorSourceUrl(domain: string | null | undefined): string | null {
  if (!domain) return null;
  const host = domain.trim().toLowerCase().replace(/^www\./, "");
  if (host.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(host)) return null;
  if (/^(?:localhost|.*\.local|.*\.internal|.*\.test|.*\.example)$/.test(host)) return null;
  return "https://" + host + "/";
}
