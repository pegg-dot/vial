/**
 * A plain, labeled link to a company's own website on its VialGrade page. Off unless the deployment
 * sets VIALGRADE_VENDOR_LINKS=true, and independent of the evidence-only quarantine and of
 * commerce-pause: it is a normal outbound link, not a tracked click-through, referral or buy path.
 */
export function vendorLinksReleased(enabled = process.env.VIALGRADE_VENDOR_LINKS): boolean {
  return enabled === "true";
}

/**
 * The one rule for a storefront link wherever a vendor appears (its page, the directory, a
 * compound's "tested by" list): the release flag is on, the verdict and status allow it, and the
 * stored domain is a plain public hostname. Anything else is null, never a fallback.
 */
export function storefrontUrlFor(input: { verdict: string; status: string | null; domain: string | null | undefined }, released = vendorLinksReleased()): string | null {
  if (!released || !vendorLinkAllowed(input)) return null;
  return vendorSourceUrl(input.domain);
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

export const LISTING_LINK_LABEL = "Source listing";
export const LISTING_LINK_NOTE = "A source listing is the vendor's own page, where this record was read: an external site, not verified or endorsed by VialGrade.";

/**
 * A plain link to the listing a market record was read from, or null. It exists only where the
 * vendor's own website link does (`vendorWebsiteUrl` is the result of storefrontUrlFor, so the
 * release flag, the verdict and the status have already agreed), and only when the stored listing
 * URL is an https page on that same site. The query string and fragment are dropped, so no
 * referral, affiliate or campaign tag can ride along: this is a citation of where a figure came
 * from, never a tracked click-through, and it does not pass through /go.
 */
export function listingSourceUrl(externalUrl: string | null | undefined, vendorWebsiteUrl: string | null | undefined): string | null {
  if (!externalUrl || !vendorWebsiteUrl) return null;
  let listing: URL;
  let site: URL;
  try { listing = new URL(externalUrl.trim()); site = new URL(vendorWebsiteUrl); } catch { return null; }
  if (listing.protocol !== "https:" || listing.username || listing.password || listing.port) return null;
  const host = listing.hostname.toLowerCase().replace(/^www\./, "");
  const siteHost = site.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== siteHost && !host.endsWith("." + siteHost)) return null;
  // Rebuilt from its parts rather than echoed, so nothing but host and path can reach the page.
  const path = listing.pathname.split("/").map((part) => encodeURIComponent(safeDecode(part))).join("/");
  return "https://" + listing.hostname.toLowerCase() + (path || "/");
}

function safeDecode(part: string): string {
  try { return decodeURIComponent(part); } catch { return part; }
}
