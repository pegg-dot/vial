// Extract a vendor's real product photo from their product-page HTML. Uses the standard
// social-share tags that virtually every e-commerce platform emits (WordPress/WooCommerce,
// Shopify, custom), in priority order: og:image → twitter:image → <link rel="image_src">.
// Pure and deterministic — safe to unit test on an HTML string.

const META_PATTERNS = [
  /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]*>/gi,
  /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]*>/gi,
  /<link[^>]+rel=["']image_src["'][^>]*>/gi,
];

function attr(tag: string, name: "content" | "href"): string | null {
  const m = tag.match(new RegExp(`${name}=["']([^"']+)["']`, "i"));
  return m ? m[1].trim() : null;
}

// Force https (avoids mixed-content blocking on an https app) and resolve a relative URL
// against the page it came from. Returns null for anything that isn't a usable image URL.
export function normalizeImageUrl(raw: string, baseUrl: string): string | null {
  let url = raw.trim();
  if (!url || url.startsWith("data:")) return null;
  try {
    if (url.startsWith("//")) url = `https:${url}`;
    const resolved = new URL(url, baseUrl);
    if (resolved.protocol === "http:") resolved.protocol = "https:";
    if (resolved.protocol !== "https:") return null;
    return resolved.toString();
  } catch {
    return null;
  }
}

export function extractProductImage(html: string, baseUrl: string): string | null {
  for (const pattern of META_PATTERNS) {
    for (const tag of html.match(pattern) ?? []) {
      const raw = attr(tag, "content") ?? attr(tag, "href");
      if (!raw) continue;
      const normalized = normalizeImageUrl(raw, baseUrl);
      if (normalized) return normalized;
    }
  }
  return null;
}
