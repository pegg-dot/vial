// Text arriving from a third-party feed is hostile data. Everything a collector stores passes
// through here first: markup stripped, entities decoded, whitespace collapsed, length clamped.
//
// Nothing in here interprets the text — it never decides attribution, permission, or severity. It
// only makes a byte string safe to persist and render.

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘",
  ldquo: "“", rdquo: "”", trade: "™", reg: "®", copy: "©", deg: "°",
};

/**
 * Decode HTML entities, including the numeric forms. Runs twice because government feeds routinely
 * double-encode (`&amp;nbsp;` appears verbatim in the DOJ feed), but no further — an unbounded
 * decode loop is how a hostile payload turns `&amp;amp;lt;script` into live markup.
 */
export function decodeEntities(value: string): string {
  let out = value;
  for (let pass = 0; pass < 2; pass += 1) {
    out = out.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,10});/g, (whole, body: string) => {
      if (body.startsWith("#")) {
        const code = body[1] === "x" || body[1] === "X" ? Number.parseInt(body.slice(2), 16) : Number.parseInt(body.slice(1), 10);
        // Reject non-characters, surrogates, and control codes rather than emitting them.
        if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return "";
        if (code >= 0xd800 && code <= 0xdfff) return "";
        if (code < 0x20 && code !== 0x09 && code !== 0x0a) return " ";
        return String.fromCodePoint(code);
      }
      return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
    });
  }
  return out;
}

/** Remove markup outright. Script/style bodies go with their tags rather than becoming text. */
export function stripTags(value: string): string {
  return value
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]*>/g, " ");
}

/** Strip markup, decode entities, collapse whitespace, and clamp. The one entry point collectors use. */
export function cleanText(value: string | null | undefined, maxLength = 1200): string {
  if (!value) return "";
  const decoded = decodeEntities(stripTags(String(value)));
  const collapsed = decoded
    // Drop C0/C1 control characters that survived decoding — they render as garbage and can hide
    // content from a human reviewer reading the stored row.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return collapsed.length > maxLength ? `${collapsed.slice(0, maxLength - 1).trimEnd()}…` : collapsed;
}

/** `20251015` (openFDA) or an RFC-822 pubDate (RSS) to `YYYY-MM-DD`. Null when it isn't a real date. */
export function toIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    const [, y, m, d] = compact;
    return Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31 ? `${y}-${m}-${d}` : null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

/**
 * Only an https URL on an expected host may be stored as a source link. A feed that hands us a
 * `javascript:` or off-host destination gets dropped, not rendered as a clickable "source".
 */
export function safeSourceUrl(value: string | null | undefined, allowedHostnames: string[]): string | null {
  if (!value) return null;
  let url: URL;
  try { url = new URL(String(value).trim()); } catch { return null; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!allowedHostnames.map((h) => h.toLowerCase()).includes(host)) return null;
  url.protocol = "https:"; // feeds link http:// even where the site is https-only
  url.hash = "";
  return url.toString();
}
