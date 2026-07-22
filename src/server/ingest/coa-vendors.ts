// Deriving real vendors from the independent COA feed.
//
// Every Janoshik certificate names two parties: the "Made By" manufacturer and the "client"
// who ordered the test — usually the reselling vendor a buyer would actually recognize. Those
// client strings ("CertaPeptides | EU VENDOR | 99.3%…", "https://alphabiopharma.info",
// "Cocer Peptides") are real vendors we can surface, each with a verifiable independent-lab
// history. This module cleans those messy strings into canonical {name, slug, domain} vendors.
//
// Honest by construction: these vendors are identified from public third-party lab records,
// never endorsed. A one-off noise string resolves to null rather than a junk vendor.

export interface DerivedVendor { name: string; slug: string; domain?: string }

const NOISE = /^(unknown|n\/?a|na|test|sample|none|private|customer|client|-)$/i;
const VENDOR_HINT = /peptide|pharma|\bbio\b|biotech|chem|\blab\b|labs|research|amino|nootropic|\braw|supply|hgh|melano|sarms?/i;

/** Clean one manufacturer/client string into a canonical vendor, or null if it's noise. */
export function cleanVendorString(raw: string): DerivedVendor | null {
  let s = (raw ?? "").trim();
  if (!s) return null;

  // Pull a domain if one is present (full URL or a bare hostname).
  let domain: string | undefined;
  const url = s.match(/https?:\/\/([^\s/|,，)]+)/i);
  if (url) domain = url[1].replace(/^www\./i, "").toLowerCase();

  // Strip marketing cruft: everything after the first separator, inline URLs, whitespace.
  s = s.split(/[|(（]/)[0];
  s = s.split(/[,，]/)[0];
  s = s.replace(/https?:\/\/\S+/gi, "").replace(/\s+/g, " ").trim();
  s = s.replace(/[.\s]+$/g, "").trim();

  const bare = s.match(/^((?:www\.)?[a-z0-9-]+\.[a-z]{2,})(?:\/|$)/i);
  if (!domain && bare) domain = bare[1].replace(/^www\./i, "").toLowerCase();

  // If the remaining name is empty or itself just a URL/domain, build a name from the domain.
  let name = s;
  const looksBareDomain = /^(www\.)?[a-z0-9-]+\.[a-z]{2,}(\/.*)?$/i.test(name) || /^https?/i.test(name);
  if (domain && (!name || looksBareDomain)) {
    const core = domain.replace(/\.[a-z]{2,}$/i, "");
    name = core.replace(/[-_.]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  }

  name = name.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 60 || NOISE.test(name)) return null;

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50);
  if (slug.length < 2) return null;
  return { name, slug, domain };
}

/** A cleaned string only becomes a vendor if it reads like one (a domain, or a vendor keyword). */
export function looksLikeVendor(v: DerivedVendor): boolean {
  return Boolean(v.domain) || VENDOR_HINT.test(v.name);
}

/**
 * Derive canonical vendors from the feed. Prefers the client (the reseller a buyer recognizes),
 * falls back to the manufacturer. Returns a de-duplicated vendor list and a per-testId map of
 * which vendor slug each COA should attach to.
 */
export function deriveCoaVendors(entries: { testId: string; client?: string; manufacturer: string }[]): {
  vendors: DerivedVendor[];
  vendorByTestId: Map<string, string>;
} {
  const vendors = new Map<string, DerivedVendor>();
  const vendorByTestId = new Map<string, string>();
  for (const e of entries) {
    const client = e.client ? cleanVendorString(e.client) : null;
    const maker = cleanVendorString(e.manufacturer);
    const pick = (client && looksLikeVendor(client) ? client : null) ?? (maker && looksLikeVendor(maker) ? maker : null);
    if (!pick) continue;
    if (!vendors.has(pick.slug)) vendors.set(pick.slug, pick);
    vendorByTestId.set(e.testId, pick.slug);
  }
  return { vendors: [...vendors.values()], vendorByTestId };
}
